const mongoose = require('mongoose');
const TimeEntry = require('../models/TimeEntry');
const { logAudit } = require('../middleware/auditLogger');
const eligibilityService = require('./eligibilityService');
const policyService = require('./policyService');
const notificationService = require('./notificationService');
const wt = require('../utils/workingTime');
const holidays = require('../utils/polishHolidays');
const locationService = require('./locationService');
const monitoringService = require('./monitoringService');
const employeeProfileService = require('./employeeProfileService');

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

// Work out the "special day" facts for a finished shift and write them onto the
// entry: how much night work it had, whether it was a Sunday or public holiday,
// and (if there was overtime) whether it is paid at the 50% or 100% rate.
// Needs the tenant policy for the night-window hours and night bonus %.
function applyClassification(entry, policy) {
  // Night work (art. 151⁷). Measure how many minutes fell in the night window.
  const nightMinutes = wt.nightWorkMinutes(
    entry.clockIn,
    entry.clockOut,
    policy.nightStartHour ?? 21,
    policy.nightEndHour ?? 7
  );
  entry.nightMinutes = nightMinutes;
  entry.isNightWork = nightMinutes > 0;
  entry.nightPremiumPercent = nightMinutes > 0 ? policy.nightPremiumPercent ?? 20 : 0;

  // What kind of day was worked (art. 151⁹–151¹²)? Public holiday beats Sunday
  // if a holiday happens to land on a Sunday.
  const isHoliday = holidays.isPublicHoliday(entry.clockIn);
  const isSunday = holidays.isSunday(entry.clockIn);
  entry.isHolidayWork = isHoliday;
  entry.isSundayWork = isSunday;
  entry.dayType = isHoliday ? 'HOLIDAY' : isSunday ? 'SUNDAY' : 'WORKDAY';

  // Overtime pay rate (art. 151¹) — only meaningful when there IS overtime.
  entry.overtimePremiumRate = entry.isOvertime
    ? wt.overtimePremiumRate({ isSunday, isHoliday, nightMinutes })
    : 0;
}

// Work out the GPS location to store for one clock action (clock-in/out).
//
// Privacy first (Art. 22²): if the tenant has NOT turned location monitoring on,
// we return null and never touch the coordinates. If it IS on, the employee must
// first have acknowledged the monitoring notice, otherwise we refuse the punch.
// We also let the tenant BLOCK punches made outside every allowed work site.
//
//   prevPunch — the location of the employee's previous punch, for the
//               "impossible travel" (teleport) spoofing check.
async function resolvePunchLocation(tenantId, user, policy, meta, prevPunch, now) {
  // Location monitoring switched off → do not capture anything.
  if (!policy.locationTrackingEnabled) return null;

  // Monitoring is on → the employee must have been informed (Art. 22²).
  const acknowledged = await monitoringService.hasAcknowledgedCurrent(tenantId, user._id);
  if (!acknowledged) {
    throw {
      status: 403,
      code: 'MONITORING_NOTICE_REQUIRED',
      message:
        'Please read and accept the location monitoring notice before clocking in.',
    };
  }

  const punch = locationService.evaluatePunch({
    policy,
    location: meta.location,
    device: meta.device || {},
    prevPunch,
    now,
  });

  // If the company blocks off-site punches, stop here with a clear message.
  if (policy.blockOutsideGeofence && punch.flags.includes('OUTSIDE_GEOFENCE')) {
    throw {
      status: 403,
      code: 'OUTSIDE_GEOFENCE',
      message: 'You appear to be away from an allowed work site, so this action was blocked.',
    };
  }

  return punch;
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

  // 4b) Weekly-rest check (art. 133) — did the employee get at least 35
  // continuous hours off during the 7 days before this shift? We pull every
  // finished shift in that window and ask the engine for the longest rest block.
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recentShifts = await TimeEntry.find({
    userId: user._id,
    clockOut: { $ne: null },
    workDate: { $gte: startOfDay(weekAgo) },
    deletedAt: null,
  })
    .select('clockIn clockOut')
    .lean();

  const weeklyRest = wt.checkWeeklyRestWindow(recentShifts, weekAgo, now);

  // 4c) GPS location for this clock-in (only when monitoring is on — Art. 22²).
  // The previous punch is the last completed shift's clock-out location, used to
  // detect impossible travel (a spoofing signal).
  const prevPunch = lastCompleted?.clockOutLocation || null;
  const clockInLocation = await resolvePunchLocation(
    tenantId,
    user,
    policy,
    meta,
    prevPunch,
    now
  );

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
    weeklyRest: weeklyRest || undefined,
    clockInLocation: clockInLocation || undefined,
    locationFlagged: clockInLocation ? !clockInLocation.valid : false,
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

  // If the person did not get a 35-hour continuous rest in the last 7 days,
  // flag the weekly-rest breach too (art. 133) so HR can review the roster.
  if (weeklyRest?.violation) {
    await notificationService.createNotification({
      tenantId,
      userId: user._id,
      employeeId: user._id.toString(),
      type: 'REST_VIOLATION',
      title: 'Weekly rest may be too short',
      message: `The longest unbroken rest in the last 7 days was only ${wt.formatDuration(weeklyRest.longestRestMinutes)} (art. 133 requires at least 35h).`,
      relatedEntryId: entry._id,
    });
  }

  // If the clock-in GPS looked wrong (off-site, faked, impossible travel), tell
  // HR so they can review it. We record WHAT was flagged, not the raw location.
  if (clockInLocation && !clockInLocation.valid) {
    await notificationService.createNotification({
      tenantId,
      userId: user._id,
      employeeId: user._id.toString(),
      type: 'LOCATION_FLAG',
      title: 'Clock-in location needs review',
      message: `This clock-in was flagged: ${clockInLocation.flags.join(', ')}.`,
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
    newValue: {
      clockIn: now,
      source: meta.source,
      // Store only the flags/geofence result in the audit trail, never used to
      // reveal precise movements — just enough to show the check ran.
      locationFlags: clockInLocation?.flags,
      withinGeofence: clockInLocation?.withinGeofence,
    },
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

  // GPS for the clock-out (only when monitoring is on — Art. 22²). The previous
  // punch is this shift's clock-in location, for the impossible-travel check.
  const policyForLoc = await policyService.getOrCreateDefaultPolicy(tenantId);
  const clockOutLocation = await resolvePunchLocation(
    tenantId,
    user,
    policyForLoc,
    meta,
    entry.clockInLocation || null,
    now
  );
  if (clockOutLocation) {
    entry.clockOutLocation = clockOutLocation;
    if (!clockOutLocation.valid) entry.locationFlagged = true;
  }

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
  // (Reuse the policy we already loaded for the location check above.)
  const policy = policyForLoc;

  // Record night work, Sunday/holiday work and the overtime pay rate.
  applyClassification(entry, policy);

  if (totals.isOvertime && policy.overtimeRequiresApproval) {
    entry.approvalStatus = 'PENDING';
  } else if (totals.isOvertime) {
    entry.approvalStatus = 'APPROVED';
  } else {
    entry.approvalStatus = 'NOT_REQUIRED';
  }

  // Special-group protections (art. 178 / 203): did a pregnant employee, young
  // worker, or parent of a small child do overtime/night work they should not
  // have (or without consent)? If so, flag it so HR can act.
  const profile = await employeeProfileService.getProfile(tenantId, user._id);
  const protection = employeeProfileService.evaluateProtections(profile, {
    hasOvertime: entry.isOvertime,
    nightMinutes: entry.nightMinutes,
  });
  entry.protectedWorkFlagged = protection.restricted;

  entry.updatedBy = user._id.toString();
  await entry.save();

  // Raise a clear alert for any protected-work breach.
  if (protection.restricted) {
    await notificationService.createNotification({
      tenantId,
      userId: user._id,
      employeeId: user._id.toString(),
      type: 'PROTECTED_WORK',
      title: 'Protected employee working-time breach',
      message: protection.reasons.join(' '),
      relatedEntryId: entry._id,
    });
  }

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

  // Break compliance flag (art. 134). The break outcome is already recorded on
  // the entry above (breakComplianceStatus). Here we ALSO raise a visible alert
  // when the required break was missed or too short, so the breach is surfaced —
  // not silently buried in the record. This is the "flag" half of the compliance
  // flow: the entry is the evidence, this notification is the active warning.
  if (totals.breakComplianceStatus === 'MISSING_BREAK') {
    await notificationService.createNotification({
      tenantId,
      userId: user._id,
      employeeId: user._id.toString(),
      type: 'BREAK_VIOLATION',
      title: 'Required break was not recorded',
      message: `You worked ${wt.formatDuration(totals.netWorkedMinutes)} but no break was recorded. Polish law (art. 134) requires at least ${wt.formatDuration(totals.requiredBreakMinutes)}. Please tell your manager so the record can be corrected.`,
      relatedEntryId: entry._id,
    });
  } else if (totals.breakComplianceStatus === 'SHORT_BREAK') {
    await notificationService.createNotification({
      tenantId,
      userId: user._id,
      employeeId: user._id.toString(),
      type: 'BREAK_VIOLATION',
      title: 'Break was shorter than required',
      message: `Your recorded break was ${wt.formatDuration(totals.breakMinutes)}, but art. 134 requires at least ${wt.formatDuration(totals.requiredBreakMinutes)} for the hours you worked. Please tell your manager so the record can be corrected.`,
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

  // Re-classify night / Sunday / holiday / premium after the edited times.
  if (entry.clockOut) applyClassification(entry, policy);

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
