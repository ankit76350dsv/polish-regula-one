const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// Absence — leave, sickness and other non-working days.
// ─────────────────────────────────────────────────────────────────────────────
//
// A complete working-time record must explain not only the days a person worked
// but also the days they did NOT work and why. Payroll and labour inspection both
// need this. Types follow common Polish leave categories.
const absenceSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    employeeId: { type: String, index: true },
    employeeName: { type: String },

    // Polish leave categories (Kodeks pracy + ZUS sick-leave rules):
    //   ANNUAL_LEAVE    — urlop wypoczynkowy (paid annual leave)
    //   ON_DEMAND_LEAVE — urlop na żądanie (up to 4 days/year, part of annual)
    //   SICK_LEAVE      — zwolnienie lekarskie (L4)
    //   UNPAID_LEAVE    — urlop bezpłatny
    //   MATERNITY_LEAVE — urlop macierzyński / rodzicielski
    //   CHILDCARE_LEAVE — urlop wychowawczy / opieka nad dzieckiem
    //   SPECIAL_LEAVE   — urlop okolicznościowy (e.g. wedding, funeral)
    //   PUBLIC_HOLIDAY  — dzień wolny (statutory public holiday)
    //   OTHER           — anything else, described in `reason`
    type: {
      type: String,
      enum: [
        'ANNUAL_LEAVE',
        'ON_DEMAND_LEAVE',
        'SICK_LEAVE',
        'UNPAID_LEAVE',
        'MATERNITY_LEAVE',
        'CHILDCARE_LEAVE',
        'SPECIAL_LEAVE',
        'PUBLIC_HOLIDAY',
        'OTHER',
      ],
      required: true,
    },

    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    // Number of working days the absence covers (excludes weekends/holidays).
    workingDays: { type: Number, default: 0 },

    // Whether these days count as paid for payroll purposes.
    paid: { type: Boolean, default: true },

    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },

    reason: { type: String },
    // For sick leave (L4) — reference to a stored, encrypted medical document.
    documentPath: { type: String },

    approvedBy: { type: String },
    approvedAt: { type: Date },

    createdBy: { type: String },
    updatedBy: { type: String },

    // Soft delete — retained for the legal retention period.
    deletedAt: { type: Date, default: null },
  },
  {
    collection: 'workplus_absences',
    timestamps: true,
  }
);

absenceSchema.index({ tenantId: 1, startDate: -1 });
absenceSchema.index({ userId: 1, startDate: -1 });

module.exports =
  mongoose.models.WorkPulse_Absence || mongoose.model('WorkPulse_Absence', absenceSchema);
