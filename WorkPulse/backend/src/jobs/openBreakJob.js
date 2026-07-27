const TimeEntry = require('../models/TimeEntry');
const notificationService = require('../services/notificationService');
const wt = require('../utils/workingTime');

// ─────────────────────────────────────────────────────────────────────────────
// Open break alert job.
// ─────────────────────────────────────────────────────────────────────────────
// Some people start a break and forget to end it. A break left open makes the
// worked-time total wrong. This job finds breaks that started but never ended
// and, once they pass a sensible limit, reminds the employee to end them.
//
// IMPORTANT: it does NOT auto-end the break. Guessing an end time would create
// an inaccurate legal record. Auto-ending should only happen if a company
// explicitly turns it on (a future policy option).

// How long an open break may run before we send a reminder.
const OPEN_BREAK_LIMIT_MINUTES = 60;

async function runOpenBreakJob() {
  const onBreak = await TimeEntry.find({ status: 'ON_BREAK', deletedAt: null }).lean();

  const now = new Date();
  let sent = 0;

  for (const entry of onBreak) {
    const openBreak = entry.breaks.find((b) => b.breakStart && !b.breakEnd);
    if (!openBreak) continue;

    const openFor = wt.diffMinutes(openBreak.breakStart, now);
    if (openFor >= OPEN_BREAK_LIMIT_MINUTES) {
      await notificationService.createNotification({
        tenantId: entry.tenantId,
        userId: entry.userId,
        employeeId: entry.employeeId,
        type: 'OPEN_BREAK',
        title: 'Your break is still open',
        message: `Your break has been running for ${wt.formatDuration(openFor)}. Please end it so your worked time is correct.`,
        relatedEntryId: entry._id,
        channel: 'PUSH',
      });
      sent += 1;
    }
  }

  if (sent > 0) console.log(`[JOB] openBreak — ${sent} alert(s) raised`);
  return sent;
}

module.exports = { runOpenBreakJob };
