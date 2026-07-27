const mongoose = require('mongoose');
const WasteThreshold = require('../models/WasteThreshold');
const { logAudit } = require('../middleware/auditLogger');

// All threshold data is scoped to the tenant taken from the session
// (actor.tenantId). The client never chooses the tenant, so one customer can
// never see or change another customer's legal limits.
//
// Why this service exists:
// Before this, the WasteThreshold model had no way to be filled — no API ever
// wrote to it. That meant the legal-threshold check on annual reports always
// ran against an empty list and always reported a (misleading) "passed".
// This service lets an administrator configure the real limits so the check
// becomes meaningful and audit-defensible.

// Returns the tenant's own thresholds (optionally for one year), newest first.
// We deliberately return ONLY tenant-owned rows here (not the null "platform
// default" rows) so an admin manages exactly what they own.
const listThresholds = async (tenantId, filters = {}) => {
  const query = { tenantId };
  if (filters.year) query.year = Number(filters.year);
  return WasteThreshold.find(query).sort({ year: -1, category: 1 });
};

// Creates OR updates the limit for one category + year for the tenant.
// We use "upsert by (tenantId, category, year)" because there can only ever be
// one limit per category per year (the model enforces this with a unique
// index). This makes the API friendly: the admin just says "the limit for
// PLASTIC in 2026 is X" and we do the right thing whether or not a row exists.
const upsertThreshold = async (data, actor) => {
  const filter = {
    tenantId: actor.tenantId,
    category: data.category,
    year: Number(data.year),
  };

  // Snapshot the existing row (if any) so the audit log can show what changed.
  const existing = await WasteThreshold.findOne(filter);
  const oldValue = existing ? existing.toObject() : null;

  // Normalise the two optional numbers: an empty/undefined value clears the
  // limit (stored as null), any given value is stored as a Number.
  const toNumberOrNull = (v) =>
    v === undefined || v === null || v === '' ? null : Number(v);

  const update = {
    ...filter,
    reportingThresholdKg: toNumberOrNull(data.reportingThresholdKg),
    maxWeightKg: toNumberOrNull(data.maxWeightKg),
    updatedBy: actor.userId,
  };
  if (!existing) update.createdBy = actor.userId;

  const threshold = await WasteThreshold.findOneAndUpdate(filter, update, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  });

  await logAudit({
    tenantId: actor.tenantId,
    userId: actor.userId,
    userEmail: actor.userEmail,
    action: existing ? 'WASTE_THRESHOLD_UPDATED' : 'WASTE_THRESHOLD_CREATED',
    resource: 'WasteThreshold',
    resourceId: threshold._id.toString(),
    oldValue,
    newValue: threshold.toObject(),
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
  });

  return threshold;
};

// Deletes one threshold, but only if it belongs to the caller's tenant.
// Throwing a 404 (not 403) avoids revealing that the id exists for someone else.
const deleteThreshold = async (thresholdId, actor) => {
  if (!mongoose.Types.ObjectId.isValid(thresholdId)) {
    throw { status: 400, message: 'Valid threshold id is required' };
  }

  const threshold = await WasteThreshold.findOne({
    _id: thresholdId,
    tenantId: actor.tenantId,
  });
  if (!threshold) throw { status: 404, message: 'Threshold not found' };

  const oldValue = threshold.toObject();
  await threshold.deleteOne();

  await logAudit({
    tenantId: actor.tenantId,
    userId: actor.userId,
    userEmail: actor.userEmail,
    action: 'WASTE_THRESHOLD_DELETED',
    resource: 'WasteThreshold',
    resourceId: thresholdId,
    oldValue,
    newValue: null,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
  });

  return { deleted: true };
};

module.exports = {
  listThresholds,
  upsertThreshold,
  deleteThreshold,
};
