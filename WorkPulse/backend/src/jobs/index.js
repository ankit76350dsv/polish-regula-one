const cron = require('node-cron');
const config = require('../config/environment');
const { runBreakReminderJob } = require('./breakReminderJob');
const { runOpenBreakJob } = require('./openBreakJob');
const { runMissingClockOutJob } = require('./missingClockOutJob');
const { runOvertimeReconciliationJob } = require('./overtimeReconciliationJob');
const { runAttendanceReconciliationJob } = require('./attendanceReconciliationJob');
const { runShiftAnomalyJob } = require('./shiftAnomalyJob');

// ─────────────────────────────────────────────────────────────────────────────
// Cron job registry.
// ─────────────────────────────────────────────────────────────────────────────
// Registers the three WorkPulse scheduled jobs. Each job is wrapped so a crash
// in one run is logged but never stops the schedule. Jobs can be turned off with
// ENABLE_CRON_JOBS=false (e.g. when running several instances, so the jobs only
// fire on one node).

// Run a job safely — catch and log any error so the schedule keeps going.
function safe(name, fn) {
  return async () => {
    try {
      await fn();
    } catch (err) {
      console.error(`[JOB] ${name} failed:`, err.message);
    }
  };
}

function registerJobs() {
  if (!config.jobs.enabled) {
    console.log('[JOB] Cron jobs are disabled (ENABLE_CRON_JOBS=false)');
    return;
  }

  // Every 15 minutes — remind people about their 6-hour break.
  cron.schedule('*/15 * * * *', safe('breakReminder', runBreakReminderJob));

  // Every 10 minutes — chase breaks that were started but never ended.
  cron.schedule('*/10 * * * *', safe('openBreak', runOpenBreakJob));

  // Every 30 minutes — chase (and eventually flag) missing clock-outs.
  cron.schedule('*/30 * * * *', safe('missingClockOut', runMissingClockOutJob));

  // Every 3 hours — spot unusual finished shifts (very long, unapproved
  // overtime, rest breaches, flagged location) so a human reviews them.
  cron.schedule('0 */3 * * *', safe('shiftAnomaly', runShiftAnomalyJob));

  // Once a day at 00:30 — reconcile yesterday's attendance into a daily,
  // dated audit summary per tenant (labour-law record-keeping evidence).
  cron.schedule('30 0 * * *', safe('attendanceReconciliation', runAttendanceReconciliationJob));

  // Once a day at 01:00 — add up each employee's hours across the settlement
  // period and the year, save the summaries, and alert on the 48h / 150h caps.
  cron.schedule('0 1 * * *', safe('overtimeReconciliation', runOvertimeReconciliationJob));

  console.log(
    '[JOB] WorkPulse cron jobs registered (break / open-break / missing-clock-out / ' +
      'shift-anomaly / attendance-reconciliation / overtime-reconciliation)'
  );
}

module.exports = { registerJobs };
