const WasteEntry = require('../models/WasteEntry');
const { logAudit } = require('../middleware/auditLogger');

// Waste figures are scoped by tenantId alone.
//
// WHAT CHANGED: every function here used to take a companyId and call
// assertCompanyInTenant() first, to prove the company existed and belonged to the
// caller. That check is gone because the thing it protected against is now
// impossible: there is no company id to guess. The tenant id comes from the
// verified session, never from the client, so a caller can only ever touch their
// own figures. One fewer database round-trip on every read, and one fewer way to
// get tenant isolation wrong.

// Combines duplicate categories in the incoming items so the same category can
// never appear twice. e.g. two PAPER lines of 10 and 5 become one PAPER of 15.
const mergeItemsByCategory = (items = []) => {
  const totals = new Map();
  for (const item of items) {
    const current = totals.get(item.category) || 0;
    totals.set(item.category, current + Number(item.weightKg || 0));
  }
  return Array.from(totals, ([category, weightKg]) => ({ category, weightKg }));
};

// Returns the CURRENT figures for every month of a year.
// Only the latest version of each month is returned (isLatest: true), so the
// caller sees corrected values, while old versions remain in the database.
const getMonthlyEntries = async (tenantId, year) => {
  return WasteEntry.find({
    tenantId,
    year: Number(year),
    isLatest: true,
  }).sort({ month: 1 });
};

// Returns the FULL version history for one specific month, newest version first.
// This is what an auditor uses to see how a figure changed over time.
const getEntryHistory = async (tenantId, year, month) => {
  return WasteEntry.find({
    tenantId,
    year: Number(year),
    month: Number(month),
  }).sort({ version: -1 });
};

// Records the waste figures for one month.
//
// This is the append-only heart of the system:
//   - If this month has no entry yet, we create version 1.
//   - If it already has one, we DO NOT change it. We create a new version with
//     version + 1, point it back at the old one (supersedesEntryId), and flip
//     the old one's isLatest to false. The old figures stay forever.
const recordMonthlyEntry = async (data, actor) => {
  const { year, month, items, notes } = data;

  const mergedItems = mergeItemsByCategory(items);

  // Is there already a current entry for this exact month?
  const existing = await WasteEntry.findOne({
    tenantId: actor.tenantId,
    year: Number(year),
    month: Number(month),
    isLatest: true,
  });

  // Create the new version document.
  const newEntry = await WasteEntry.create({
    tenantId: actor.tenantId,
    year: Number(year),
    month: Number(month),
    items: mergedItems,
    notes,
    version: existing ? existing.version + 1 : 1,
    isLatest: true,
    supersedesEntryId: existing ? existing._id : null,
    createdBy: actor.userId,
  });

  // Retire the old version (if any). We use .save() rather than a query update
  // because the model blocks query-based updates to protect history; save()
  // only flips the flag and never edits the recorded figures.
  if (existing) {
    existing.isLatest = false;
    await existing.save();
  }

  await logAudit({
    tenantId: actor.tenantId,
    userId: actor.userId,
    userEmail: actor.userEmail,
    // A first entry is CREATED; a correction is recorded as CORRECTED so the
    // audit trail makes the difference obvious.
    action: existing ? 'WASTE_ENTRY_CORRECTED' : 'WASTE_ENTRY_CREATED',
    resource: 'WasteEntry',
    resourceId: newEntry._id.toString(),
    // For a correction, show the previous figures as the "old value".
    oldValue: existing ? { items: existing.items, totalWeightKg: existing.totalWeightKg, version: existing.version } : null,
    newValue: { items: newEntry.items, totalWeightKg: newEntry.totalWeightKg, version: newEntry.version, year: newEntry.year, month: newEntry.month },
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
  });

  return newEntry;
};

module.exports = {
  getMonthlyEntries,
  getEntryHistory,
  recordMonthlyEntry,
};
