const mongoose = require('mongoose');
const TimeEntry = require('../models/TimeEntry');
const { logAudit } = require('../middleware/auditLogger');
const eligibilityService = require('./eligibilityService');
const policyService = require('./policyService');
const notificationService = require('./notificationService');
const wt = require('../utils/workingTime');

// ─────────────────────────────────────────────────────────────────────────────
// Time entry service — the heart of WorkPulse.
// ─────────────────────────────────────────────────────────────────────────────
// Handles clock-in, clock-out, breaks, corrections and overtime approval, and
// keeps every derived working-time number (via the working-time engine) in sync.
// Every state change writes an immutable audit log.

// The calendar day (server-local midnight) a timestamp belongs to. Used to group
// entries per day and to keep one shift per day tidy.
function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Find the employee's currently active shift (clocked in, or on a break).
function findActiveEntry(userId) {
  return TimeEntry.findOne({
    userId,
    status: { $in: ['OPEN', 'ON_BREAK'] },
    deletedAt: null,
  });
}

// Re-run the working-time engine over an entry and write the results back onto
// the document. Does NOT save — the caller saves once after any extra changes.
function recompute(entry) {
  const totals = wt.computeEntryTotals(
    { clockIn: entry.clockIn, clockOut: entry.clockOut, breaks: entry.breaks },
    entry.scheduledMinutes || 480
  );

  entry.grossMinutes = totals.grossMinutes;
  entry.breakMinutes = totals.breakMinutes;
  entry.netWorkedMinutes = totals.netWorkedMinutes;

  entry.requiredBreakMinutes = totals.requiredBreakMinutes;
  entry.breakRequired = totals.breakRequired;
  entry.breakTaken = totals.breakTaken;
  entry.breakComplianceStatus = totals.breakComplianceStatus;

  entry.overtimeMinutes = totals.overtimeMinutes;
  entry.isOvertime = totals.isOvertime;

  return totals;
}

// Build the denormalised snapshot fields from the SafeWork record or the user.
function snapshotFrom(eligibility, user) {
  const emp = eligibility?.employee;
  return {
    employeeName: emp?.name || user?.name || user?.email,
    department: emp?.department,
    site: emp?.site,
  };
}

// ── Status for the logged-in employee ────────────────────────────────────────
// Returns everything the Clock screen needs: whether they may clock in, their
// current open shift (if any), and a small live summary.
async function getMyStatus(user, tenantId) {
  const eligibility = await eligibilityService.checkClockInEligibility(user._id);
  const active = await findActiveEntry(user._id);

  let live = null;
  if (active) {
    // Recompute against "now" so the UI shows worked-so-far and break status.
    const totals = wt.computeEntryTotals(
      { clockIn: active.clockIn, clockOut: null, breaks: active.breaks },
      active.scheduledMinutes || 480
    );
    const openBreak = active.breaks.find((b) => b.breakStart && !b.breakEnd) || null;
    live = { totals, openBreak };
  }

  return { eligibility, active, live };
}

// ── Clock in ─────────────────────────────────────────────────────────────────
async function clockIn(user, tenantId, meta) {
  // 1) Compliance gate — reuse SafeWork's decision.
  const eligibility = await eligibilityService.checkClockInEligibility(user._id);
  if (!eligibility.allowed) {
    // Record the blocked attempt so there is evidence the rule was enforced.
    await logAudit({
      tenantId,
      userId: user._id.toString(),
      userEmail: user.email,
      action: 'CLOCK_IN_BLOCKED',
      resource: 'TimeEntry',
      newValue: { reason: eligibility.reason },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      success: false,
      errorMessage: eligibility.reason,
    });
    throw { status: 403, message: eligibility.reason, code: 'CLOCK_IN_NOT_ALLOWED' };
  }

  // 2) Only one active shift at a time.
  const active = await findActiveEntry(user._id);
  if (active) {
    throw { status: 409, message: 'You are already clocked in.' };
  }

  // 3) The daily norm comes from the tenant's working-time policy.
  const policy = await policyService.getOrCreateDefaultPolicy(tenantId, {
    userId: user._id.toString(),
  });

  const now = new Date();

  // 4) Daily-rest check (art. 132) — compare against the last completed shift.
  const lastCompleted = await TimeEntry.findOne({
    userId: user._id,
    clockOut: { $ne: null },
    deletedAt: null,
  })
    .sort({ clockOut: -1 })
    .lean();

  const dailyRest = wt.checkDailyRest(lastCompleted?.clockOut, now);

  const snap = snapshotFrom(eligibility, user);

  const entry = await TimeEntry.create({
    tenantId,
    userId: user._id,
    employeeId: user._id.toString(),
    employeeName: snap.employeeName,
    department: snap.department,
    site: snap.site,
    workDate: startOfDay(now),
    clockIn: now,
    clockInSource: meta.source || 'WEB',
    scheduledMinutes: policy.scheduledDailyMinutes,
    dailyRest: dailyRest || undefined,
    status: 'OPEN',
    createdBy: user._id.toString(),
    updatedBy: user._id.toString(),
  });

  // If the person did not get their 11 hours of rest, flag it for HR.
  if (dailyRest?.violation) {
    await notificationService.createNotification({
      tenantId,
      userId: user._id,
      employeeId: user._id.toString(),
      type: 'REST_VIOLATION',
      title: 'Daily rest may be too short',
      message: `Only ${wt.formatDuration(dailyRest.restGapMinutes)} of rest before this shift (11h required).`,
      relatedEntryId: entry._id,
    });
  }

  await logAudit({
    tenantId,
    userId: user._id.toString(),
    userEmail: user.email,
    action: 'CLOCK_IN',
    resource: 'TimeEntry',
    resourceId: entry._id.toString(),
    newValue: { clockIn: now, source: meta.source },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return entry;
}

// ── Clock out ────────────────────────────────────────────────────────────────
async function clockOut(user, tenantId, meta) {
  const entry = await findActiveEntry(user._id);
  if (!entry) throw { status: 400, message: 'You are not clocked in.' };

  const now = new Date();

  // If a break was left open, close it at clock-out so totals are correct.
  const openBreak = entry.breaks.find((b) => b.breakStart && !b.breakEnd);
  if (openBreak) {
    openBreak.breakEnd = now;
    openBreak.durationMinutes = wt.diffMinutes(openBreak.breakStart, now);
  }

  entry.clockOut = now;
  entry.clockOutSource = meta.source || 'WEB';
  entry.status = 'COMPLETED';

  const totals = recompute(entry);

  // Overtime is controlled: if the policy requires approval and this shift ran
  // over the norm, mark it PENDING so a manager decides — never approve silently.
  const policy = await policyService.getOrCreateDefaultPolicy(tenantId);
  if (totals.isOvertime && policy.overtimeRequiresApproval) {
    entry.approvalStatus = 'PENDING';
  } else if (totals.isOvertime) {
    entry.approvalStatus = 'APPROVED';
  } else {
    entry.approvalStatus = 'NOT_REQUIRED';
  }

  entry.updatedBy = user._id.toString();
  await entry.save();

  if (entry.approvalStatus === 'PENDING') {
    await notificationService.createNotification({
      tenantId,
      userId: user._id,
      employeeId: user._id.toString(),
      type: 'OVERTIME_APPROVAL',
      title: 'Overtime awaiting approval',
      message: `${wt.formatDuration(totals.overtimeMinutes)} of overtime recorded and needs manager approval.`,
      relatedEntryId: entry._id,
    });
  }

  await logAudit({
    tenantId,
    userId: user._id.toString(),
    userEmail: user.email,
    action: 'CLOCK_OUT',
    resource: 'TimeEntry',
    resourceId: entry._id.toString(),
    newValue: {
      clockOut: now,
      netWorkedMinutes: totals.netWorkedMinutes,
      overtimeMinutes: totals.overtimeMinutes,
      breakComplianceStatus: totals.breakComplianceStatus,
    },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return entry;
}

// ── Start a break ────────────────────────────────────────────────────────────
async function startBreak(user, tenantId, meta) {
  const entry = await findActiveEntry(user._id);
  if (!entry) throw { status: 400, message: 'You are not clocked in.' };
  if (entry.status === 'ON_BREAK') throw { status: 409, message: 'You are already on a break.' };

  const now = new Date();
  entry.breaks.push({ breakStart: now, breakEnd: null, durationMinutes: 0 });
  entry.status = 'ON_BREAK';
  entry.updatedBy = user._id.toString();
  await entry.save();

  await logAudit({
    tenantId,
    userId: user._id.toString(),
    userEmail: user.email,
    action: 'BREAK_START',
    resource: 'TimeEntry',
    resourceId: entry._id.toString(),
    newValue: { breakStart: now },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return entry;
}

// ── End a break ──────────────────────────────────────────────────────────────
async function endBreak(user, tenantId, meta) {
  const entry = await findActiveEntry(user._id);
  if (!entry) throw { status: 400, message: 'You are not clocked in.' };

  const openBreak = entry.breaks.find((b) => b.breakStart && !b.breakEnd);
  if (!openBreak) throw { status: 400, message: 'You are not on a break.' };

  const now = new Date();
  openBreak.breakEnd = now;
  openBreak.durationMinutes = wt.diffMinutes(openBreak.breakStart, now);
  entry.status = 'OPEN';

  recompute(entry);
  entry.updatedBy = user._id.toString();
  await entry.save();

  await logAudit({
    tenantId,
    userId: user._id.toString(),
    userEmail: user.email,
    action: 'BREAK_END',
    resource: 'TimeEntry',
    resourceId: entry._id.toString(),
    newValue: { breakEnd: now, durationMinutes: openBreak.durationMinutes },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return entry;
}

// ── The logged-in employee's own entries ─────────────────────────────────────
async function getMyEntries(userId, { from, to, page = 1, limit = 30 } = {}) {
  const query = { userId, deletedAt: null };
  if (from || to) {
    query.workDate = {};
    if (from) query.workDate.$gte = startOfDay(from);
    if (to) query.workDate.$lte = new Date(to);
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 30));

  const [entries, total] = await Promise.all([
    TimeEntry.find(query)
      .sort({ workDate: -1, clockIn: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    TimeEntry.countDocuments(query),
  ]);

  return {
    entries,
    pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) || 1 },
  };
}

// ── Admin/HR list across the whole tenant ────────────────────────────────────
async function listEntries(tenantId, filters = {}) {
  const { from, to, status, department, page = 1, limit = 25 } = filters;

  const query = { tenantId, deletedAt: null };
  if (status && status !== 'All') query.status = status;
  if (department && department !== 'All') query.department = department;
  if (from || to) {
    query.workDate = {};
    if (from) query.workDate.$gte = startOfDay(from);
    if (to) query.workDate.$lte = new Date(to);
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));

  const [entries, total] = await Promise.all([
    TimeEntry.find(query)
      .sort({ workDate: -1, clockIn: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    TimeEntry.countDocuments(query),
  ]);

  return {
    entries,
    pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) || 1 },
  };
}

async function getEntryById(entryId, tenantId) {
  if (!mongoose.Types.ObjectId.isValid(entryId)) {
    throw { status: 400, message: 'Valid entry id is required' };
  }
  const entry = await TimeEntry.findOne({ _id: entryId, tenantId, deletedAt: null }).lean();
  if (!entry) throw { status: 404, message: 'Time entry not found' };
  return entry;
}

// ── Manual correction by HR/admin (evidence integrity) ───────────────────────
// Allows fixing a wrong clock time or break. The change is recorded with a
// reason and marked as corrected, and the old/new values are audited so the
// original facts are never silently lost.
async function correctEntry(entryId, tenantId, updates, actor) {
  const entry = await TimeEntry.findOne({ _id: entryId, tenantId, deletedAt: null });
  if (!entry) throw { status: 404, message: 'Time entry not found' };
  if (!updates.correctionReason) {
    throw { status: 400, message: 'A correction reason is required for any manual edit.' };
  }

  const oldValue = {
    clockIn: entry.clockIn,
    clockOut: entry.clockOut,
    breaks: entry.breaks,
    netWorkedMinutes: entry.netWorkedMinutes,
    overtimeMinutes: entry.overtimeMinutes,
  };

  if (updates.clockIn) entry.clockIn = new Date(updates.clockIn);
  if (updates.clockOut !== undefined) {
    entry.clockOut = updates.clockOut ? new Date(updates.clockOut) : null;
  }
  if (Array.isArray(updates.breaks)) {
    entry.breaks = updates.breaks.map((b) => ({
      breakStart: b.breakStart ? new Date(b.breakStart) : undefined,
      breakEnd: b.breakEnd ? new Date(b.breakEnd) : null,
      durationMinutes:
        b.breakStart && b.breakEnd ? wt.diffMinutes(b.breakStart, b.breakEnd) : 0,
    }));
  }

  // A corrected entry with a clock-out is treated as completed.
  if (entry.clockOut) entry.status = updates.status || 'COMPLETED';

  const totals = recompute(entry);

  // Re-evaluate overtime approval after the correction.
  const policy = await policyService.getOrCreateDefaultPolicy(tenantId);
  if (totals.isOvertime && policy.overtimeRequiresApproval && entry.approvalStatus !== 'APPROVED') {
    entry.approvalStatus = 'PENDING';
  } else if (!totals.isOvertime) {
    entry.approvalStatus = 'NOT_REQUIRED';
  }

  entry.corrected = true;
  entry.correctionReason = updates.correctionReason;
  entry.correctedBy = actor.userId;
  entry.updatedBy = actor.userId;
  await entry.save();

  await logAudit({
    tenantId,
    userId: actor.userId,
    userEmail: actor.userEmail,
    action: 'ENTRY_CORRECTED',
    resource: 'TimeEntry',
    resourceId: entry._id.toString(),
    oldValue,
    newValue: {
      clockIn: entry.clockIn,
      clockOut: entry.clockOut,
      reason: updates.correctionReason,
      netWorkedMinutes: entry.netWorkedMinutes,
      overtimeMinutes: entry.overtimeMinutes,
    },
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
  });

  return entry;
}

// ── Overtime approval decision by a manager ──────────────────────────────────
async function decideOvertime(entryId, tenantId, { decision, reason }, actor) {
  const entry = await TimeEntry.findOne({ _id: entryId, tenantId, deletedAt: null });
  if (!entry) throw { status: 404, message: 'Time entry not found' };
  if (!entry.isOvertime) throw { status: 400, message: 'This entry has no overtime to decide on.' };

  const oldValue = { approvalStatus: entry.approvalStatus };

  if (decision === 'APPROVE') {
    entry.approvalStatus = 'APPROVED';
  } else if (decision === 'REJECT') {
    entry.approvalStatus = 'REJECTED';
  } else {
    throw { status: 400, message: 'decision must be APPROVE or REJECT' };
  }

  entry.overtimeReason = reason || entry.overtimeReason || 'MANUAL_HR_APPROVAL';
  entry.approvedBy = actor.userId;
  entry.approvedAt = new Date();
  entry.updatedBy = actor.userId;
  await entry.save();

  await logAudit({
    tenantId,
    userId: actor.userId,
    userEmail: actor.userEmail,
    action: decision === 'APPROVE' ? 'OVERTIME_APPROVED' : 'OVERTIME_REJECTED',
    resource: 'TimeEntry',
    resourceId: entry._id.toString(),
    oldValue,
    newValue: { approvalStatus: entry.approvalStatus, reason: entry.overtimeReason },
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
  });

  return entry;
}

module.exports = {
  startOfDay,
  findActiveEntry,
  getMyStatus,
  clockIn,
  clockOut,
  startBreak,
  endBreak,
  getMyEntries,
  listEntries,
  getEntryById,
  correctEntry,
  decideOvertime,
};
