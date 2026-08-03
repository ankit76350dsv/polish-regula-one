const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// SettlementSummary — the "big picture" working-time check for one employee.
// ─────────────────────────────────────────────────────────────────────────────
//
// WHY THIS EXISTS:
//   A single day's record cannot tell you if the law was broken over time.
//   Polish law also has LONGER limits:
//     * Art. 131 — the average working week (including overtime) across the whole
//                  settlement period must not be more than 48 hours.
//     * Art. 151 §3 — overtime for the employer's special needs is capped at
//                  150 hours per calendar year (unless the work rules raise it).
//
//   This document is the saved result of adding up an employee's hours across a
//   settlement period and across the year, so HR and a labour inspector can see
//   at a glance whether either cap was passed. It is recalculated by the
//   overtime-reconciliation cron job and updated in place (one row per employee
//   per settlement period).
const settlementSummarySchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    employeeId: { type: String, index: true },
    employeeName: { type: String },

    // The settlement period this summary covers (start inclusive, end exclusive).
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    settlementPeriodMonths: { type: Number, default: 1 },

    // ── Period totals ────────────────────────────────────────────────────────
    workedMinutes: { type: Number, default: 0 }, // real time worked in the period
    overtimeMinutes: { type: Number, default: 0 }, // total overtime in the period
    approvedOvertimeMinutes: { type: Number, default: 0 },

    // Average working time per 7-day week across the period (art. 131).
    averageWeeklyMinutes: { type: Number, default: 0 },
    maxAverageWeeklyMinutes: { type: Number, default: 48 * 60 },
    // True when the 48h average weekly cap was passed.
    exceedsWeeklyAverageCap: { type: Boolean, default: false },

    // ── Yearly overtime (art. 151 §3) ─────────────────────────────────────────
    year: { type: Number },
    annualOvertimeMinutes: { type: Number, default: 0 },
    annualOvertimeLimitMinutes: { type: Number, default: 150 * 60 },
    // True when the 150h/year overtime cap was passed.
    exceedsAnnualOvertimeLimit: { type: Boolean, default: false },
    // A softer warning when close (>= 90%) to the yearly cap.
    approachingAnnualOvertimeLimit: { type: Boolean, default: false },

    calculatedAt: { type: Date },
    calculatedBy: { type: String, default: 'SYSTEM' },
  },
  {
    collection: 'workplus_settlement_summaries',
    timestamps: true,
  }
);

// One summary per employee per settlement period.
settlementSummarySchema.index(
  { tenantId: 1, userId: 1, periodStart: 1 },
  { unique: true }
);

module.exports =
  mongoose.models.WorkPulse_SettlementSummary ||
  mongoose.model('WorkPulse_SettlementSummary', settlementSummarySchema);
