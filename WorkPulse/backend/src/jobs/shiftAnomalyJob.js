const TimeEntry = require('../models/TimeEntry');
const notificationService = require('../services/notificationService');
const { logAudit } = require('../middleware/auditLogger');
const wt = require('../utils/workingTime');

// ─────────────────────────────────────────────────────────────────────────────
// Shift anomaly detection job.
// ─────────────────────────────────────────────────────────────────────────────
// Runs a few times a day and looks at recently FINISHED shifts for patterns that
// look wrong and deserve a human check:
//   * VERY_LONG_SHIFT — worked far more than a normal long day (default > 13h).
//   * OVERTIME_NO_APPROVAL — overtime that is still not approved/rejected.
//   * REST_VIOLATION — the daily or weekly rest rule was breached.
//   * LOCATION_FLAG — the clock-in/out GPS was flagged (off-site / spoofed).
//
// One notification per anomalous shift (the notification service de-duplicates),
// plus an audit line. It never changes the shift itself.

// A net worked time above this many minutes is "very long" and worth a look.
// 13 hours = the 8h norm + a large amount of overtime in one day.
const VERY_LONG_SHIFT_MINUTES = 13 * 60;

async function runShiftAnomalyJob() {
  // Look at shifts finished in the last 24 hours.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const entries = await TimeEntry.find({
    deletedAt: null,
    status: 'COMPLETED',
    clockOut: { $gte: since },
  }).lean();

  let flagged = 0;

  for (const entry of entries) {
    const reasons = [];

    if (entry.netWorkedMinutes > VERY_LONG_SHIFT_MINUTES) {
      reasons.push(`very long shift (${wt.formatDuration(entry.netWorkedMinutes)} worked)`);
    }
    if (entry.isOvertime && entry.approvalStatus === 'PENDING') {
      reasons.push('overtime still not approved');
    }
    if (entry.dailyRest?.violation) reasons.push('daily rest under 11h');
    if (entry.weeklyRest?.violation) reasons.push('weekly rest under 35h');
    if (entry.locationFlagged) reasons.push('location was flagged');

    if (reasons.length === 0) continue;

    await notificationService.createNotification({
      tenantId: entry.tenantId,
      userId: entry.userId,
      employeeId: entry.employeeId,
      type: 'SHIFT_ANOMALY',
      title: 'Unusual shift needs review',
      message: `This shift was flagged for: ${reasons.join('; ')}.`,
      relatedEntryId: entry._id,
    });

    await logAudit({
      tenantId: entry.tenantId,
      userId: 'SYSTEM',
      userEmail: 'system@workpulse',
      action: 'SHIFT_ANOMALY_FLAGGED',
      resource: 'TimeEntry',
      resourceId: entry._id.toString(),
      newValue: { reasons },
    });

    flagged += 1;
  }

  if (flagged) {
    console.log(`[JOB] shiftAnomaly — ${flagged} shift(s) flagged`);
  }
  return { flagged };
}

module.exports = { runShiftAnomalyJob };
