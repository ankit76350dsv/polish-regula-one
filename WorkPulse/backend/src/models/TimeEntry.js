const mongoose = require('mongoose');

// A single break inside a shift. breakEnd stays null while the break is open;
// the "open break" cron job watches for breaks that were started but never ended.
const breakSchema = new mongoose.Schema(
  {
    breakStart: { type: Date, required: true },
    breakEnd: { type: Date, default: null },
    // Stored for reporting; recomputed by the service whenever a break ends.
    durationMinutes: { type: Number, default: 0 },
  },
  { _id: true }
);

// Where a single clock action happened (only stored when the tenant has turned
// location monitoring on and the employee was told — see Art. 22²). `valid` is
// false when something looked wrong (fake GPS, off-site, poor accuracy).
const punchLocationSchema = new mongoose.Schema(
  {
    latitude: { type: Number },
    longitude: { type: Number },
    accuracy: { type: Number }, // GPS accuracy in metres (smaller is better)
    mocked: { type: Boolean, default: false }, // app reported a fake location
    platform: { type: String }, // e.g. "android" / "ios"
    withinGeofence: { type: Boolean },
    matchedSite: { type: String },
    distanceMeters: { type: Number },
    valid: { type: Boolean, default: true },
    flags: { type: [String], default: [] }, // e.g. ["OUTSIDE_GEOFENCE"]
    at: { type: Date },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// TimeEntry — the core working-time evidence record.
// ─────────────────────────────────────────────────────────────────────────────
//
// One document = one work day / shift for one employee. It captures the raw
// facts (clock-in, clock-out, breaks) AND the derived legal numbers (worked
// time, break entitlement, overtime, rest checks). Derived numbers are written
// by the working-time engine (utils/workingTime.js) so they stay consistent.
//
// This record is the evidence a company would hand to a labour inspector, so it
// keeps correction history and links every change to an immutable audit log.
const timeEntrySchema = new mongoose.Schema(
  {
    // ── Ownership / tenant isolation ─────────────────────────────────────────
    tenantId: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // The RegulaOne user id as a string — handy for cross-service references.
    employeeId: { type: String, index: true },

    // Denormalised snapshot for fast reporting without a join on every read.
    employeeName: { type: String },
    department: { type: String },
    site: { type: String },

    // ── The calendar day this shift belongs to (local midnight) ──────────────
    // Used to group entries per day and to stop two open shifts on the same day.
    workDate: { type: Date, required: true, index: true },

    // ── Raw clock facts ──────────────────────────────────────────────────────
    clockIn: { type: Date, required: true },
    clockOut: { type: Date, default: null },
    clockInSource: { type: String, enum: ['WEB', 'MOBILE', 'KIOSK', 'SYSTEM'], default: 'WEB' },
    clockOutSource: { type: String, enum: ['WEB', 'MOBILE', 'KIOSK', 'SYSTEM'], default: 'WEB' },

    // GPS of each clock action (only when location monitoring is on — Art. 22²).
    clockInLocation: { type: punchLocationSchema, default: undefined },
    clockOutLocation: { type: punchLocationSchema, default: undefined },
    // True if any punch on this shift raised a location warning (spoof/off-site).
    locationFlagged: { type: Boolean, default: false },

    // True if a protected employee (pregnant / young / parent of a small child)
    // did overtime or night work without the required consent (art. 178 / 203).
    protectedWorkFlagged: { type: Boolean, default: false },

    breaks: { type: [breakSchema], default: [] },

    // ── Derived working-time numbers (from utils/workingTime.js) ─────────────
    grossMinutes: { type: Number, default: 0 }, // clock-out minus clock-in
    breakMinutes: { type: Number, default: 0 }, // total completed break time
    netWorkedMinutes: { type: Number, default: 0 }, // gross minus breaks
    scheduledMinutes: { type: Number, default: 480 }, // the day's norm (from policy)

    // ── Break compliance (art. 134) ──────────────────────────────────────────
    requiredBreakMinutes: { type: Number, default: 0 },
    breakRequired: { type: Boolean, default: false },
    breakTaken: { type: Boolean, default: false },
    breakComplianceStatus: {
      type: String,
      enum: ['NOT_REQUIRED', 'COMPLIANT', 'SHORT_BREAK', 'MISSING_BREAK'],
      default: 'NOT_REQUIRED',
    },

    // ── Night work (art. 151⁷/151⁸) ──────────────────────────────────────────
    // How many minutes of the shift fell in the night window (21:00–07:00 by
    // default) and the % night bonus that applies to them (20% by default).
    nightMinutes: { type: Number, default: 0 },
    isNightWork: { type: Boolean, default: false },
    nightPremiumPercent: { type: Number, default: 0 },

    // ── What kind of day was this? (art. 151⁹–151¹²) ──────────────────────────
    //   WORKDAY — an ordinary working day
    //   SUNDAY  — worked on a Sunday
    //   HOLIDAY — worked on a public holiday
    dayType: {
      type: String,
      enum: ['WORKDAY', 'SUNDAY', 'HOLIDAY'],
      default: 'WORKDAY',
    },
    isSundayWork: { type: Boolean, default: false },
    isHolidayWork: { type: Boolean, default: false },

    // ── Overtime (art. 151) — controlled, not silent ─────────────────────────
    overtimeMinutes: { type: Number, default: 0 },
    isOvertime: { type: Boolean, default: false },
    // The pay rate for any overtime on this shift: 50% or 100% (art. 151¹).
    overtimePremiumRate: { type: Number, default: 0 },
    overtimeReason: {
      type: String,
      enum: ['EMPLOYER_REQUEST', 'EMERGENCY', 'MANUAL_HR_APPROVAL', 'OTHER', null],
      default: null,
    },
    approvalStatus: {
      type: String,
      enum: ['NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED'],
      default: 'NOT_REQUIRED',
    },
    approvedBy: { type: String },
    approvedAt: { type: Date },

    // ── Daily rest check (art. 132 — at least 11 h before this shift) ─────────
    dailyRest: {
      restGapMinutes: { type: Number },
      requiredMinutes: { type: Number },
      violation: { type: Boolean, default: false },
    },

    // ── Weekly rest check (art. 133 — at least 35 continuous hours per week) ──
    // Measured over the 7 days ending at this shift's clock-in. longestRestMinutes
    // is the biggest unbroken rest block found in that window.
    weeklyRest: {
      longestRestMinutes: { type: Number },
      requiredMinutes: { type: Number },
      violation: { type: Boolean, default: false },
    },

    // ── Lifecycle status ─────────────────────────────────────────────────────
    //   OPEN              — clocked in, not yet clocked out
    //   ON_BREAK          — clocked in and currently on a break
    //   COMPLETED         — clocked out normally
    //   MISSING_CLOCK_OUT — shift end passed but no clock-out (flagged by cron)
    //   AUTO_CLOSED       — closed by the system per company configuration
    status: {
      type: String,
      enum: ['OPEN', 'ON_BREAK', 'COMPLETED', 'MISSING_CLOCK_OUT', 'AUTO_CLOSED'],
      default: 'OPEN',
      index: true,
    },

    // ── Correction / edit history (evidence integrity) ───────────────────────
    corrected: { type: Boolean, default: false },
    correctionReason: { type: String },
    correctedBy: { type: String },

    notes: { type: String },

    createdBy: { type: String },
    updatedBy: { type: String },

    // Soft delete — records are never hard-deleted (10-year retention rule).
    deletedAt: { type: Date, default: null },
  },
  {
    collection: 'workplus_timeentries',
    timestamps: true,
  }
);

// Query patterns: an employee's day list, an employee's open shift, the tenant's
// daily report, and open shifts for the cron jobs.
timeEntrySchema.index({ tenantId: 1, workDate: -1 });
timeEntrySchema.index({ userId: 1, workDate: -1 });
timeEntrySchema.index({ tenantId: 1, status: 1 });

module.exports =
  mongoose.models.WorkPulse_TimeEntry || mongoose.model('WorkPulse_TimeEntry', timeEntrySchema);
