const TimeEntry = require('../models/TimeEntry');
const notificationService = require('../services/notificationService');
const { logAudit } = require('../middleware/auditLogger');
const wt = require('../utils/workingTime');

// ─────────────────────────────────────────────────────────────────────────────
// Missing clock-out job.
// ─────────────────────────────────────────────────────────────────────────────
// Runs after shift end. If someone's planned shift finished but they never
// clocked out, we:
//   * remind them shortly after the planned end (grace period), and
//   * after a longer delay, flag the entry as MISSING_CLOCK_OUT so HR can fix it,
//     because an open shift left running forever produces a nonsense record.
//
// The "planned end" is the clock-in time plus the day's scheduled minutes (from
// the working-time policy stored on the entry). We do NOT auto-clock-out — the
// real end time is unknown, so HR corrects it with a documented reason instead.

const REMIND_AFTER_MINUTES = 15; // grace after planned end before we nudge
const FLAG_AFTER_MINUTES = 2 * 60; // 2h after planned end → flag for HR

async function runMissingClockOutJob() {
  const active = await TimeEntry.find({
    status: { $in: ['OPEN', 'ON_BREAK'] },
    deletedAt: null,
  }).lean();

  const now = new Date();
  let reminded = 0;
  let flagged = 0;

  for (const entry of active) {
    const plannedEnd = new Date(
      new Date(entry.clockIn).getTime() + (entry.scheduledMinutes || 480) * 60000
    );
    const overrunMinutes = wt.diffMinutes(plannedEnd, now);
    if (overrunMinutes < REMIND_AFTER_MINUTES) continue; // still within the shift/grace

    if (overrunMinutes >= FLAG_AFTER_MINUTES) {
      // Long overrun — flag the record so HR reviews and corrects it.
      await TimeEntry.updateOne(
        { _id: entry._id },
        { $set: { status: 'MISSING_CLOCK_OUT', updatedBy: 'SYSTEM' } }
      );

      await logAudit({
        tenantId: entry.tenantId,
        userId: 'SYSTEM',
        userEmail: 'system@workpulse',
        action: 'MISSING_CLOCK_OUT_FLAGGED',
        resource: 'TimeEntry',
        resourceId: entry._id.toString(),
        newValue: { plannedEnd, overrunMinutes },
      });

      await notificationService.createNotification({
        tenantId: entry.tenantId,
        userId: entry.userId,
        employeeId: entry.employeeId,
        type: 'MISSING_CLOCK_OUT',
        title: 'Missing clock-out flagged',
        message: 'Your shift ended more than 2 hours ago with no clock-out. HR has been notified to correct your record.',
        relatedEntryId: entry._id,
        channel: 'PUSH',
      });
      flagged += 1;
    } else {
      // Short overrun — friendly reminder to clock out.
      await notificationService.createNotification({
        tenantId: entry.tenantId,
        userId: entry.userId,
        employeeId: entry.employeeId,
        type: 'MISSING_CLOCK_OUT',
        title: 'Please clock out',
        message: 'Your planned shift has ended. Please remember to clock out.',
        relatedEntryId: entry._id,
        channel: 'PUSH',
      });
      reminded += 1;
    }
  }

  if (reminded || flagged) {
    console.log(`[JOB] missingClockOut — ${reminded} reminder(s), ${flagged} flagged`);
  }
  return { reminded, flagged };
}

module.exports = { runMissingClockOutJob };
