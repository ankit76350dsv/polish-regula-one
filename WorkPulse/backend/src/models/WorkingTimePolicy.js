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

// A single allowed work-site circle for mobile clock-in ("geofence").
// A punch is "at the site" when it lands within radiusMeters of this point.
const geofenceSchema = new mongoose.Schema(
  {
    site: { type: String, trim: true },
    latitude: { type: Number },
    longitude: { type: Number },
    radiusMeters: { type: Number, default: 200 },
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

    // Art. 131 §1 — across the settlement period the average weekly working
    // time (including overtime) must not exceed this. 48h is the legal ceiling.
    maxAverageWeeklyHours: { type: Number, default: 48 },

    // Art. 151 §3 — yearly cap on overtime worked for the employer's special
    // needs. Default is the statutory 150h; a company may raise it in its work
    // rules (up to the limit implied by the 48h average), so it is configurable.
    annualOvertimeLimitHours: { type: Number, default: 150 },

    // Break thresholds (configurable, defaulting to the statutory values).
    breakRules: { type: breakRuleSchema, default: () => ({}) },

    // Overtime handling. Overtime should be controlled, not created silently,
    // so by default it must be approved by HR/a manager.
    overtimeRequiresApproval: { type: Boolean, default: true },

    // Protective rest periods (art. 132 / art. 133). Configurable for edge cases
    // but defaulting to the legal minimums.
    dailyRestHours: { type: Number, default: 11 },
    weeklyRestHours: { type: Number, default: 35 },

    // Night-work window (art. 151⁷). The law lets the employer pick 8 hours
    // between 21:00 and 07:00; the default is the whole 21:00–07:00 span.
    // nightPremiumPercent is the extra pay for night hours (art. 151⁸ = 20%).
    nightStartHour: { type: Number, default: 21 },
    nightEndHour: { type: Number, default: 7 },
    nightPremiumPercent: { type: Number, default: 20 },

    // ── Location monitoring (Art. 22² Kodeks pracy + GDPR/RODO) ───────────────
    // OFF BY DEFAULT on purpose. Tracking an employee's location is only lawful
    // when the employer has a real reason AND has told the employee first, so a
    // tenant must deliberately turn this on. When off, no location is captured.
    locationTrackingEnabled: { type: Boolean, default: false },
    // Allowed work-site circles. If empty, we cannot check "were they on site".
    geofences: { type: [geofenceSchema], default: [] },
    // If true, a clock-in outside every geofence is BLOCKED. If false (default),
    // it is only flagged for HR — blocking people over one bad GPS reading is
    // risky, so blocking is opt-in.
    blockOutsideGeofence: { type: Boolean, default: false },
    // GPS readings worse (larger) than this many metres are treated as unreliable.
    maxAccuracyMeters: { type: Number, default: 100 },

    // The monitoring notice shown to employees. Location/GPS tracking is a form
    // of employee monitoring: art. 22² covers video monitoring and art. 22³ §4
    // extends the same information duty to "other forms of monitoring" (GPS,
    // email). The version lets us require a fresh acknowledgement when the text
    // changes. (Verified against pip.gov.pl / uodo.gov.pl, July 2026.)
    monitoringNoticeVersion: { type: String, default: '1.0' },
    monitoringNoticeText: {
      type: String,
      default:
        'This application records the time and, when enabled, the location of your clock-in and clock-out to confirm attendance at the work site. This is a form of employee monitoring under art. 22² and art. 22³ of the Polish Labour Code and is processed in line with GDPR/RODO. The data is used only for attendance and payroll, kept for the legally required period, and never used to track you outside working time.',
    },

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
