const TimeEntry = require('../models/TimeEntry');
const { logAudit } = require('../middleware/auditLogger');

// ─────────────────────────────────────────────────────────────────────────────
// Daily attendance reconciliation job.
// ─────────────────────────────────────────────────────────────────────────────
// Runs once a day (early morning) and looks back at YESTERDAY. It adds up what
// happened per tenant — how many shifts, how many still have no clock-out, how
// many broke a break or rest rule — and writes ONE audit record per tenant.
//
// This gives HR and a labour inspector a dated, tamper-resistant daily summary
// ("on this day, X shifts, Y problems"), which is exactly the kind of evidence
// the Labour Code record-keeping duty expects. It never changes a time entry.

// Start and end of "yesterday" in server-local time.
function yesterdayBounds(now) {
  const start = new Date(now);
  start.setDate(start.getDate() - 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function runAttendanceReconciliationJob() {
  const now = new Date();
  const { start, end } = yesterdayBounds(now);

  // Add up yesterday's entries per tenant in one pass.
  const rows = await TimeEntry.aggregate([
    { $match: { deletedAt: null, workDate: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: '$tenantId',
        shifts: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } },
        missingClockOut: {
          $sum: { $cond: [{ $in: ['$status', ['OPEN', 'ON_BREAK', 'MISSING_CLOCK_OUT']] }, 1, 0] },
        },
        breakIssues: {
          $sum: {
            $cond: [{ $in: ['$breakComplianceStatus', ['MISSING_BREAK', 'SHORT_BREAK']] }, 1, 0],
          },
        },
        dailyRestIssues: { $sum: { $cond: ['$dailyRest.violation', 1, 0] } },
        weeklyRestIssues: { $sum: { $cond: ['$weeklyRest.violation', 1, 0] } },
        overtimeShifts: { $sum: { $cond: ['$isOvertime', 1, 0] } },
        locationFlags: { $sum: { $cond: ['$locationFlagged', 1, 0] } },
        protectedFlags: { $sum: { $cond: ['$protectedWorkFlagged', 1, 0] } },
      },
    },
  ]);

  for (const r of rows) {
    await logAudit({
      tenantId: r._id,
      userId: 'SYSTEM',
      userEmail: 'system@workpulse',
      action: 'ATTENDANCE_RECONCILED',
      resource: 'TimeEntry',
      newValue: {
        date: start.toISOString().slice(0, 10),
        shifts: r.shifts,
        completed: r.completed,
        missingClockOut: r.missingClockOut,
        breakIssues: r.breakIssues,
        dailyRestIssues: r.dailyRestIssues,
        weeklyRestIssues: r.weeklyRestIssues,
        overtimeShifts: r.overtimeShifts,
        locationFlags: r.locationFlags,
        protectedFlags: r.protectedFlags,
      },
    });
  }

  if (rows.length) {
    console.log(`[JOB] attendanceReconciliation — ${rows.length} tenant summary(ies) for ${start.toISOString().slice(0, 10)}`);
  }
  return { tenants: rows.length };
}

module.exports = { runAttendanceReconciliationJob };
