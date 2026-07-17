const WorkingTimePolicy = require('../models/WorkingTimePolicy');
const { logAudit } = require('../middleware/auditLogger');

// ─────────────────────────────────────────────────────────────────────────────
// Working Time Policy service.
// ─────────────────────────────────────────────────────────────────────────────
// Every tenant has exactly one default policy. The time-tracking engine reads it
// to know the daily norm (for overtime), the break thresholds, and the rest
// rules. If a tenant has never configured a policy we create a sensible default
// that matches Polish Labour Code norms (8h/day, 40h/week, statutory breaks).

// Returns the tenant's default policy, creating it on first use.
async function getOrCreateDefaultPolicy(tenantId, actor = {}) {
  if (!tenantId) throw { status: 400, message: 'Tenant context is required' };

  let policy = await WorkingTimePolicy.findOne({ tenantId, isDefault: true });
  if (policy) return policy;

  // First time this tenant opens WorkPulse — seed a legal default policy.
  policy = await WorkingTimePolicy.create({
    tenantId,
    name: 'Default Working Time Policy',
    workingTimeSystem: 'STANDARD',
    standardDailyHours: 8,
    standardWeeklyHours: 40,
    workDaysPerWeek: 5,
    scheduledDailyMinutes: 480,
    settlementPeriodMonths: 1,
    isDefault: true,
    isActive: true,
    createdBy: actor.userId,
    updatedBy: actor.userId,
  });

  return policy;
}

// Reads the tenant's policy (creating the default if none exists).
async function getPolicy(tenantId) {
  return getOrCreateDefaultPolicy(tenantId);
}

// Updates the tenant's default policy. Only known fields are applied, and
// scheduledDailyMinutes is kept in sync with standardDailyHours so the engine
// and the display never disagree. Every change is audited.
async function updatePolicy(tenantId, updates, actor) {
  const policy = await getOrCreateDefaultPolicy(tenantId, actor);

  const oldValue = policy.toObject();

  const allowed = [
    'name',
    'workingTimeSystem',
    'standardDailyHours',
    'standardWeeklyHours',
    'workDaysPerWeek',
    'settlementPeriodMonths',
    'breakRules',
    'overtimeRequiresApproval',
    'dailyRestHours',
    'weeklyRestHours',
    'isActive',
  ];

  for (const key of allowed) {
    if (updates[key] !== undefined) policy[key] = updates[key];
  }

  // Keep the minutes the engine uses aligned with the hours the admin edited.
  if (updates.standardDailyHours !== undefined) {
    policy.scheduledDailyMinutes = Math.round(Number(updates.standardDailyHours) * 60);
  }

  policy.updatedBy = actor.userId;
  await policy.save();

  await logAudit({
    tenantId,
    userId: actor.userId,
    userEmail: actor.userEmail,
    action: 'POLICY_UPDATED',
    resource: 'WorkingTimePolicy',
    resourceId: policy._id.toString(),
    oldValue: {
      workingTimeSystem: oldValue.workingTimeSystem,
      standardDailyHours: oldValue.standardDailyHours,
      standardWeeklyHours: oldValue.standardWeeklyHours,
      settlementPeriodMonths: oldValue.settlementPeriodMonths,
    },
    newValue: updates,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
  });

  return policy;
}

module.exports = {
  getOrCreateDefaultPolicy,
  getPolicy,
  updatePolicy,
};
