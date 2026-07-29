const cron = require('node-cron');
const { runCertificateExpiryJob } = require('./certificateExpiryJob');

// ─────────────────────────────────────────────────────────────────────────────
// Cron job registry.
// ─────────────────────────────────────────────────────────────────────────────
// Registers SafeWork's scheduled jobs. Each run is wrapped so a crash in one run
// is logged but never stops the schedule. Set ENABLE_CRON_JOBS=false to turn the
// jobs off (for example when running several instances, so they fire on one node
// only).

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
  const enabled = (process.env.ENABLE_CRON_JOBS || 'true').toLowerCase() !== 'false';
  if (!enabled) {
    console.log('[JOB] Cron jobs are disabled (ENABLE_CRON_JOBS=false)');
    return;
  }

  // Every day at 00:01 — refresh medical / BHP certificate statuses so that
  // certificates that have expired or are about to expire are flagged even if
  // nobody opened the record. Runs in the server's local time zone.
  cron.schedule('1 0 * * *', safe('certificateExpiry', runCertificateExpiryJob));


  console.log('[JOB] SafeWork cron jobs registered (certificate-expiry @ 00:01 daily)');
}

module.exports = { registerJobs };
