const mongoose = require('mongoose');
const TimeEntry = require('../models/TimeEntry');
const SettlementSummary = require('../models/SettlementSummary');
const policyService = require('./policyService');
const wt = require('../utils/workingTime');

// ─────────────────────────────────────────────────────────────────────────────
// Settlement service — the "over time" working-time checks.
// ─────────────────────────────────────────────────────────────────────────────
//
// The day-by-day engine (utils/workingTime.js) answers "was THIS shift legal?".
// This service answers the LONGER questions the Polish Labour Code also asks:
//
//   * Art. 131 — across the whole settlement period, is the AVERAGE working week
//                (including overtime) at or under 48 hours?
//   * Art. 151 §3 — has the employee gone over 150 overtime hours this year?
//
// It reads the finished time entries (the evidence) and adds them up. Nothing
// here changes a shift — it only measures, so the raw records stay untouched.

// Add up an employee's worked and overtime minutes between two dates.
// Only finished shifts (with a clock-out) that are not deleted are counted.
async function aggregateMinutes(tenantId, userId, from, to) {
  const rows = await TimeEntry.aggregate([
    {
      $match: {
        tenantId,
        userId: new mongoose.Types.ObjectId(userId),
        deletedAt: null,
        clockOut: { $ne: null },
        workDate: { $gte: from, $lt: to },
      },
    },
    {
      $group: {
        _id: null,
        workedMinutes: { $sum: '$netWorkedMinutes' },
        overtimeMinutes: { $sum: '$overtimeMinutes' },
        // Only overtime a manager approved counts as "confirmed" overtime.
        approvedOvertimeMinutes: {
          $sum: { $cond: [{ $eq: ['$approvalStatus', 'APPROVED'] }, '$overtimeMinutes', 0] },
        },
        employeeName: { $last: '$employeeName' },
        employeeId: { $last: '$employeeId' },
      },
    },
  ]);

  return rows[0] || { workedMinutes: 0, overtimeMinutes: 0, approvedOvertimeMinutes: 0 };
}

// Work out the full settlement-period picture for ONE employee.
// referenceDate decides WHICH settlement period we look at (defaults to today).
async function reconcileEmployee(tenantId, userId, referenceDate = new Date()) {
  const policy = await policyService.getOrCreateDefaultPolicy(tenantId);

  // 1) Which settlement period does the reference date fall in?
  const { start, end } = wt.settlementPeriodBounds(
    referenceDate,
    policy.settlementPeriodMonths || 1
  );

  // 2) Add up the hours worked inside that period.
  const period = await aggregateMinutes(tenantId, userId, start, end);

  // 3) Average weekly working time across the period (art. 131).
  const avgWeekly = wt.averageWeeklyMinutes(period.workedMinutes, start, end);
  const maxAvgWeekly = (policy.maxAverageWeeklyHours || 48) * 60;

  // 4) Overtime worked so far this calendar year (art. 151 §3).
  const yearStart = new Date(referenceDate.getFullYear(), 0, 1);
  const yearEnd = new Date(referenceDate.getFullYear() + 1, 0, 1);
  const yearAgg = await aggregateMinutes(tenantId, userId, yearStart, yearEnd);
  const annualLimit = (policy.annualOvertimeLimitHours || 150) * 60;

  return {
    tenantId,
    userId,
    employeeId: period.employeeId,
    employeeName: period.employeeName,

    periodStart: start,
    periodEnd: end,
    settlementPeriodMonths: policy.settlementPeriodMonths || 1,

    workedMinutes: period.workedMinutes,
    overtimeMinutes: period.overtimeMinutes,
    approvedOvertimeMinutes: period.approvedOvertimeMinutes,

    averageWeeklyMinutes: avgWeekly,
    maxAverageWeeklyMinutes: maxAvgWeekly,
    exceedsWeeklyAverageCap: avgWeekly > maxAvgWeekly,

    year: referenceDate.getFullYear(),
    annualOvertimeMinutes: yearAgg.overtimeMinutes,
    annualOvertimeLimitMinutes: annualLimit,
    exceedsAnnualOvertimeLimit: yearAgg.overtimeMinutes > annualLimit,
    // Warn once the employee has used 90% or more of the yearly overtime budget.
    approachingAnnualOvertimeLimit:
      yearAgg.overtimeMinutes <= annualLimit &&
      yearAgg.overtimeMinutes >= Math.round(annualLimit * 0.9),

    calculatedAt: new Date(),
  };
}

// Find every employee who has a time entry in the current settlement period.
// We drive off time entries (not the users table) because the entries carry the
// tenantId + userId directly, which keeps tenant isolation simple and safe.
async function employeesWithEntries(tenantId, from, to) {
  return TimeEntry.distinct('userId', {
    tenantId,
    deletedAt: null,
    workDate: { $gte: from, $lt: to },
  });
}

// Reconcile every active employee in a tenant for the given reference date, and
// SAVE each result as a SettlementSummary (created or updated in place).
// Returns the list of summaries so a caller (report or cron) can act on them.
async function reconcileTenant(tenantId, referenceDate = new Date()) {
  const policy = await policyService.getOrCreateDefaultPolicy(tenantId);
  const { start, end } = wt.settlementPeriodBounds(
    referenceDate,
    policy.settlementPeriodMonths || 1
  );

  const userIds = await employeesWithEntries(tenantId, start, end);
  const summaries = [];

  for (const userId of userIds) {
    const result = await reconcileEmployee(tenantId, userId, referenceDate);

    // Save (or update) the one summary row for this employee + period.
    const saved = await SettlementSummary.findOneAndUpdate(
      { tenantId, userId, periodStart: result.periodStart },
      { $set: { ...result, calculatedBy: 'SYSTEM' } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    summaries.push(saved);
  }

  return summaries;
}

// Read the stored summaries for a tenant (for the reports screen). Optionally
// only the current period, and optionally only rows that broke a cap.
async function getSummaries(tenantId, { referenceDate = new Date(), onlyViolations = false } = {}) {
  const policy = await policyService.getOrCreateDefaultPolicy(tenantId);
  const { start } = wt.settlementPeriodBounds(
    referenceDate,
    policy.settlementPeriodMonths || 1
  );

  const query = { tenantId, periodStart: start };
  if (onlyViolations) {
    query.$or = [{ exceedsWeeklyAverageCap: true }, { exceedsAnnualOvertimeLimit: true }];
  }

  return SettlementSummary.find(query).sort({ employeeName: 1 }).lean();
}

module.exports = {
  aggregateMinutes,
  reconcileEmployee,
  reconcileTenant,
  getSummaries,
};
