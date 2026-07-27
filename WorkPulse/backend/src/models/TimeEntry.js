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

    // ── Overtime (art. 151) — controlled, not silent ─────────────────────────
    overtimeMinutes: { type: Number, default: 0 },
    isOvertime: { type: Boolean, default: false },
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
