const TimeEntry = require('../models/TimeEntry');
const notificationService = require('../services/notificationService');
const wt = require('../utils/workingTime');

// ─────────────────────────────────────────────────────────────────────────────
// Break reminder job.
// ─────────────────────────────────────────────────────────────────────────────
// Runs every few minutes. Under Polish law an employee who works at least 6
// hours is entitled to a break (art. 134). This job nudges people BEFORE and AT
// that point so the break actually gets recorded.
//
//   * Approaching 6 hours worked (>= 5h45m) and no break yet  → gentle heads-up.
//   * At/over 6 hours worked and break shorter than 15 minutes → please record it.
//
// It only sends a reminder; it never changes the time entry. The notification
// service de-duplicates so the same person is not spammed every run.

const APPROACHING_MINUTES = 5 * 60 + 45; // 5h45m
const REQUIRED_POINT_MINUTES = 6 * 60; // 6h

async function runBreakReminderJob() {
  // Look at everyone who is currently clocked in (working, not on a break).
  const openEntries = await TimeEntry.find({ status: 'OPEN', deletedAt: null }).lean();

  let sent = 0;
  for (const entry of openEntries) {
    // How long have they worked so far (breaks excluded), measured to "now"?
    const totals = wt.computeEntryTotals(
      { clockIn: entry.clockIn, clockOut: null, breaks: entry.breaks },
      entry.scheduledMinutes || 480
    );

    const workedSoFar = totals.netWorkedMinutes;
    const hasBreak = totals.breakMinutes > 0;

    let title = null;
    let message = null;

    if (workedSoFar >= REQUIRED_POINT_MINUTES && totals.breakMinutes < 15) {
      title = 'Please record your break';
      message = 'You have worked 6 hours or more. Polish law entitles you to at least a 15-minute break.';
    } else if (workedSoFar >= APPROACHING_MINUTES && !hasBreak) {
      title = 'Break coming up';
      message = 'You are approaching 6 hours of work — remember to take and record your 15-minute break.';
    }

    if (title) {
      await notificationService.createNotification({
        tenantId: entry.tenantId,
        userId: entry.userId,
        employeeId: entry.employeeId,
        type: 'BREAK_DUE',
        title,
        message,
        relatedEntryId: entry._id,
        channel: 'PUSH',
      });
      sent += 1;
    }
  }

  if (sent > 0) console.log(`[JOB] breakReminder — ${sent} reminder(s) raised`);
  return sent;
}

module.exports = { runBreakReminderJob };
