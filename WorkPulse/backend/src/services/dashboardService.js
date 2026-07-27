const TimeEntry = require('../models/TimeEntry');
const Absence = require('../models/Absence');
const AuditLog = require('../models/AuditLog');
const { minutesToHours } = require('../utils/workingTime');

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard & reporting service.
// ─────────────────────────────────────────────────────────────────────────────
// Gives HR a single-request overview of the tenant's working-time picture today
// plus a monthly payroll-style summary per employee.

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Human-readable labels for the audit timeline on the dashboard.
function actionLabel(action) {
  const map = {
    CLOCK_IN: 'clocked in',
    CLOCK_OUT: 'clocked out',
    BREAK_START: 'started a break',
    BREAK_END: 'ended a break',
    CLOCK_IN_BLOCKED: 'was blocked from clocking in',
    ENTRY_CORRECTED: 'time entry corrected',
    OVERTIME_APPROVED: 'overtime approved',
    OVERTIME_REJECTED: 'overtime rejected',
    ABSENCE_CREATED: 'requested an absence',
    ABSENCE_DECISION: 'absence decision made',
    POLICY_UPDATED: 'working-time policy updated',
  };
  return map[action] || action.replace(/_/g, ' ').toLowerCase();
}

// One-shot tenant overview for the WorkPulse dashboard.
async function getOverview(tenantId) {
  if (!tenantId) throw { status: 400, message: 'Tenant context is required' };

  const today = startOfDay(new Date());

  // A week window (last 7 days) for the rest-violation and break-compliance view.
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    liveCounts,
    todayList,
    weekAgg,
    pendingOvertime,
    pendingAbsences,
    recentAudit,
  ] = await Promise.all([
    // Live status counts (who is working / on break / missing a clock-out).
    TimeEntry.aggregate([
      { $match: { tenantId, deletedAt: null, workDate: { $gte: today } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),

    // Today's entries, most recent first, for the activity table.
    TimeEntry.find({ tenantId, deletedAt: null, workDate: { $gte: today } })
      .sort({ clockIn: -1 })
      .limit(50)
      .lean(),

    // Last-7-days totals: worked time, overtime, and break-compliance breakdown.
    TimeEntry.aggregate([
      { $match: { tenantId, deletedAt: null, workDate: { $gte: weekAgo } } },
      {
        $group: {
          _id: null,
          totalWorked: { $sum: '$netWorkedMinutes' },
          totalOvertime: { $sum: '$overtimeMinutes' },
          missingBreak: { $sum: { $cond: [{ $eq: ['$breakComplianceStatus', 'MISSING_BREAK'] }, 1, 0] } },
          shortBreak: { $sum: { $cond: [{ $eq: ['$breakComplianceStatus', 'SHORT_BREAK'] }, 1, 0] } },
          restViolations: { $sum: { $cond: ['$dailyRest.violation', 1, 0] } },
        },
      },
    ]),

    TimeEntry.countDocuments({ tenantId, deletedAt: null, approvalStatus: 'PENDING' }),
    Absence.countDocuments({ tenantId, deletedAt: null, status: 'PENDING' }),

    AuditLog.find({ tenantId }).sort({ createdAt: -1 }).limit(15).lean(),
  ]);

  // Turn the status aggregation into a simple object.
  const statusCounts = liveCounts.reduce((acc, row) => {
    acc[row._id] = row.count;
    return acc;
  }, {});

  const week = weekAgg[0] || {};

  return {
    metrics: {
      clockedInNow: (statusCounts.OPEN || 0) + (statusCounts.ON_BREAK || 0),
      onBreakNow: statusCounts.ON_BREAK || 0,
      completedToday: statusCounts.COMPLETED || 0,
      missingClockOut: statusCounts.MISSING_CLOCK_OUT || 0,
      pendingOvertime,
      pendingAbsences,
    },
    weeklyTotals: {
      workedHours: minutesToHours(week.totalWorked || 0),
      overtimeHours: minutesToHours(week.totalOvertime || 0),
      missingBreak: week.missingBreak || 0,
      shortBreak: week.shortBreak || 0,
      restViolations: week.restViolations || 0,
    },
    todayEntries: todayList,
    recentActivity: recentAudit.map((l) => ({
      id: l._id,
      when: l.createdAt,
      who: l.userEmail || l.userId,
      what: actionLabel(l.action),
      resourceId: l.resourceId,
      success: l.success,
    })),
  };
}

// Monthly payroll-style summary: one row per employee with worked hours,
// overtime hours (approved only, since overtime is controlled) and absence days.
async function getMonthlySummary(tenantId, year, month) {
  const y = parseInt(year, 10);
  const m = parseInt(month, 10); // 1-12
  if (!y || !m || m < 1 || m > 12) {
    throw { status: 400, message: 'Valid year and month (1-12) are required' };
  }

  const from = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const to = new Date(y, m, 0, 23, 59, 59, 999); // last day of the month

  const worked = await TimeEntry.aggregate([
    { $match: { tenantId, deletedAt: null, workDate: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: '$userId',
        employeeName: { $first: '$employeeName' },
        department: { $first: '$department' },
        daysWorked: { $sum: 1 },
        workedMinutes: { $sum: '$netWorkedMinutes' },
        // Only count overtime that was actually approved — pending/rejected
        // overtime must not silently flow into payroll.
        overtimeMinutes: {
          $sum: { $cond: [{ $eq: ['$approvalStatus', 'APPROVED'] }, '$overtimeMinutes', 0] },
        },
        pendingOvertimeMinutes: {
          $sum: { $cond: [{ $eq: ['$approvalStatus', 'PENDING'] }, '$overtimeMinutes', 0] },
        },
      },
    },
    { $sort: { employeeName: 1 } },
  ]);

  const absences = await Absence.aggregate([
    {
      $match: {
        tenantId,
        deletedAt: null,
        status: 'APPROVED',
        startDate: { $lte: to },
        endDate: { $gte: from },
      },
    },
    { $group: { _id: { userId: '$userId', type: '$type' }, days: { $sum: '$workingDays' } } },
  ]);

  // Attach absence day counts to each employee row.
  const absenceByUser = {};
  for (const a of absences) {
    const uid = String(a._id.userId);
    absenceByUser[uid] = absenceByUser[uid] || {};
    absenceByUser[uid][a._id.type] = a.days;
  }

  const rows = worked.map((w) => ({
    userId: w._id,
    employeeName: w.employeeName,
    department: w.department,
    daysWorked: w.daysWorked,
    workedHours: minutesToHours(w.workedMinutes),
    overtimeHours: minutesToHours(w.overtimeMinutes),
    pendingOvertimeHours: minutesToHours(w.pendingOvertimeMinutes),
    absences: absenceByUser[String(w._id)] || {},
  }));

  return { year: y, month: m, rows };
}

module.exports = {
  getOverview,
  getMonthlySummary,
};
