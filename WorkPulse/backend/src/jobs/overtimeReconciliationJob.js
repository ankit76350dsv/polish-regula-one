const TimeEntry = require('../models/TimeEntry');
const settlementService = require('../services/settlementService');
const notificationService = require('../services/notificationService');
const { logAudit } = require('../middleware/auditLogger');
const wt = require('../utils/workingTime');

// ─────────────────────────────────────────────────────────────────────────────
// Overtime / settlement reconciliation job.
// ─────────────────────────────────────────────────────────────────────────────
// Runs once a day. For every tenant it adds up each employee's hours across the
// current settlement period and the calendar year, then:
//   * saves a SettlementSummary row (so HR and inspectors can see the totals), and
//   * raises an alert when a legal cap is passed or nearly passed:
//       - average weekly time over 48h across the period (art. 131), or
//       - overtime over 150h this year (art. 151 §3).
//
// It only measures and warns — it never changes a time entry.

// Every tenant that has at least one time entry (so we know who to reconcile).
async function activeTenantIds() {
  return TimeEntry.distinct('tenantId', { deletedAt: null });
}

async function runOvertimeReconciliationJob() {
  const tenantIds = await activeTenantIds();
  const now = new Date();
  let summaries = 0;
  let alerts = 0;

  for (const tenantId of tenantIds) {
    // Recalculate and save every employee's settlement summary for this tenant.
    const rows = await settlementService.reconcileTenant(tenantId, now);
    summaries += rows.length;

    for (const s of rows) {
      // 48h average weekly cap (art. 131).
      if (s.exceedsWeeklyAverageCap) {
        await notificationService.createNotification({
          tenantId,
          userId: s.userId,
          employeeId: s.employeeId,
          type: 'OVERTIME_LIMIT',
          title: 'Average weekly hours over the legal limit',
          message: `Average weekly working time this period is ${wt.formatDuration(
            s.averageWeeklyMinutes
          )}, above the 48h cap (art. 131). Please review the roster.`,
        });
        alerts += 1;
      }

      // 150h/year overtime cap (art. 151 §3) — alert when passed or close.
      if (s.exceedsAnnualOvertimeLimit) {
        await notificationService.createNotification({
          tenantId,
          userId: s.userId,
          employeeId: s.employeeId,
          type: 'OVERTIME_LIMIT',
          title: 'Yearly overtime limit exceeded',
          message: `Overtime this year is ${wt.formatDuration(
            s.annualOvertimeMinutes
          )}, over the ${wt.formatDuration(s.annualOvertimeLimitMinutes)} yearly limit (art. 151 §3).`,
        });
        alerts += 1;
      } else if (s.approachingAnnualOvertimeLimit) {
        await notificationService.createNotification({
          tenantId,
          userId: s.userId,
          employeeId: s.employeeId,
          type: 'OVERTIME_LIMIT',
          title: 'Approaching yearly overtime limit',
          message: `Overtime this year is ${wt.formatDuration(
            s.annualOvertimeMinutes
          )} — close to the ${wt.formatDuration(s.annualOvertimeLimitMinutes)} yearly limit (art. 151 §3).`,
        });
        alerts += 1;
      }
    }

    // One audit line per tenant so there is a record the reconciliation ran.
    await logAudit({
      tenantId,
      userId: 'SYSTEM',
      userEmail: 'system@workpulse',
      action: 'SETTLEMENT_RECONCILED',
      resource: 'SettlementSummary',
      newValue: { employees: rows.length },
    });
  }

  if (summaries || alerts) {
    console.log(`[JOB] overtimeReconciliation — ${summaries} summary(ies), ${alerts} alert(s)`);
  }
  return { summaries, alerts };
}

module.exports = { runOvertimeReconciliationJob };
