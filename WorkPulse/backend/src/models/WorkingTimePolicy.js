const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// Working Time Policy (Regulamin czasu pracy)
// ─────────────────────────────────────────────────────────────────────────────
//
// WHY THIS EXISTS:
//   Polish employers do NOT all use the same working-time rules. The Labour Code
//   allows several "working-time systems" (systemy czasu pracy): standard,
//   equivalent, task-based, shortened week, weekend work, flexible and individual
//   schedules. The daily norm, the settlement period and even break lengths can
//   differ between companies. So WorkPulse must NOT hard-code one rule — each
//   tenant configures its own policy here, and the calculation engine reads it.
//
// Defaults below match the most common case (art. 129: 8 h/day, average
// 40 h/week over a 5-day week) and the statutory break thresholds (art. 134).
const breakRuleSchema = new mongoose.Schema(
  {
    // Break is owed once daily working time reaches this many hours.
    firstThresholdHours: { type: Number, default: 6 },
    firstBreakMinutes: { type: Number, default: 15 },

    // Extra break once working time passes this many hours.
    secondThresholdHours: { type: Number, default: 9 },
    secondBreakMinutes: { type: Number, default: 30 },

    // Further break once working time passes this many hours.
    thirdThresholdHours: { type: Number, default: 16 },
    thirdBreakMinutes: { type: Number, default: 45 },
  },
  { _id: false }
);

const workingTimePolicySchema = new mongoose.Schema(
  {
    // Tenant this policy belongs to (stored as a string id, same as audit logs).
    tenantId: { type: String, required: true, index: true },

    name: { type: String, trim: true, default: 'Default Working Time Policy' },

    // The adopted working-time system. Values follow the Polish Labour Code.
    workingTimeSystem: {
      type: String,
      enum: [
        'STANDARD', // podstawowy — 8h/day, 40h/week average
        'EQUIVALENT', // równoważny — longer days balanced by shorter ones
        'TASK_BASED', // zadaniowy — measured by tasks, not clock hours
        'SHORTENED_WEEK', // skrócony tydzień pracy
        'WEEKEND_WORK', // praca weekendowa
        'FLEXIBLE', // ruchomy / elastyczny czas pracy
        'INDIVIDUAL', // indywidualny rozkład czasu pracy
      ],
      default: 'STANDARD',
    },

    // Standard norms. scheduledDailyMinutes is what the engine actually compares
    // worked time against when deciding overtime; the hours fields are for display
    // and are kept in sync by the service layer.
    standardDailyHours: { type: Number, default: 8 },
    standardWeeklyHours: { type: Number, default: 40 },
    workDaysPerWeek: { type: Number, default: 5 },
    scheduledDailyMinutes: { type: Number, default: 480 },

    // Okres rozliczeniowy — the period over which average weekly hours are
    // settled. Configurable because different systems allow different lengths.
    settlementPeriodMonths: { type: Number, default: 1 },

    // Break thresholds (configurable, defaulting to the statutory values).
    breakRules: { type: breakRuleSchema, default: () => ({}) },

    // Overtime handling. Overtime should be controlled, not created silently,
    // so by default it must be approved by HR/a manager.
    overtimeRequiresApproval: { type: Boolean, default: true },

    // Protective rest periods (art. 132 / art. 133). Configurable for edge cases
    // but defaulting to the legal minimums.
    dailyRestHours: { type: Number, default: 11 },
    weeklyRestHours: { type: Number, default: 35 },

    // Exactly one policy per tenant should be the default used for new employees.
    isDefault: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },

    createdBy: { type: String },
    updatedBy: { type: String },
  },
  {
    collection: 'workplus_policies',
    timestamps: true,
  }
);

// One default policy per tenant.
workingTimePolicySchema.index({ tenantId: 1, isDefault: 1 });

module.exports =
  mongoose.models.WorkPulse_WorkingTimePolicy ||
  mongoose.model('WorkPulse_WorkingTimePolicy', workingTimePolicySchema);
