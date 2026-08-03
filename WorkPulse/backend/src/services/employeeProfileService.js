const EmployeeWorkProfile = require('../models/EmployeeWorkProfile');
const { logAudit } = require('../middleware/auditLogger');

// ─────────────────────────────────────────────────────────────────────────────
// Employee work-profile service — special-group protections.
// ─────────────────────────────────────────────────────────────────────────────
// Reads and updates the extra protections HR sets for pregnant employees, young
// workers, and parents of small children, and decides whether a finished shift
// broke one of those protections.

// Get the profile for one employee (or null if HR never set one).
async function getProfile(tenantId, userId) {
  return EmployeeWorkProfile.findOne({ tenantId, userId }).lean();
}

// Create/update the profile (HR only). Every change is audited.
async function upsertProfile(tenantId, userId, updates, actor) {
  const allowed = [
    'isPregnant',
    'isParentOfChildUnder4',
    'isYoungWorker',
    'consentToOvertime',
    'consentToNightWork',
  ];
  const set = { employeeId: String(userId), updatedBy: actor.userId };
  for (const key of allowed) {
    if (updates[key] !== undefined) set[key] = Boolean(updates[key]);
  }

  const profile = await EmployeeWorkProfile.findOneAndUpdate(
    { tenantId, userId },
    { $set: set },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await logAudit({
    tenantId,
    userId: actor.userId,
    userEmail: actor.userEmail,
    action: 'EMPLOYEE_PROFILE_UPDATED',
    resource: 'EmployeeWorkProfile',
    resourceId: profile._id.toString(),
    newValue: set,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
  });

  return profile;
}

// Decide whether a finished shift broke a special-group protection.
//   profile     — the employee's protection profile (or null).
//   hasOvertime — did the shift have any overtime?
//   nightMinutes— how many minutes of night work the shift had.
// Returns { restricted, reasons: [] }. reasons are short human-readable strings.
function evaluateProtections(profile, { hasOvertime = false, nightMinutes = 0 } = {}) {
  const reasons = [];
  if (!profile) return { restricted: false, reasons };

  const nightWork = nightMinutes > 0;

  // Overtime protections.
  if (hasOvertime) {
    if (profile.isPregnant) reasons.push('Pregnant employee did overtime (banned, art. 178 §1)');
    if (profile.isYoungWorker) reasons.push('Young worker did overtime (banned, art. 203)');
    if (profile.isParentOfChildUnder4 && !profile.consentToOvertime) {
      reasons.push('Parent of a child under 4 did overtime without consent (art. 178 §2)');
    }
  }

  // Night-work protections.
  if (nightWork) {
    if (profile.isPregnant) reasons.push('Pregnant employee did night work (banned, art. 178 §1)');
    if (profile.isYoungWorker) reasons.push('Young worker did night work (banned, art. 203)');
    if (profile.isParentOfChildUnder4 && !profile.consentToNightWork) {
      reasons.push('Parent of a child under 4 did night work without consent (art. 178 §2)');
    }
  }

  return { restricted: reasons.length > 0, reasons };
}

module.exports = { getProfile, upsertProfile, evaluateProtections };
