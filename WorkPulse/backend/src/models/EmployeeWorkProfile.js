const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// EmployeeWorkProfile — extra working-time protections for special groups.
// ─────────────────────────────────────────────────────────────────────────────
//
// WHY THIS EXISTS:
//   Polish law gives some workers extra protection from overtime and night work:
//     * Art. 178 §1 — pregnant employees may NOT work overtime or at night.
//     * Art. 178 §2 — a parent of a child under 4 may not be made to work
//                     overtime/at night WITHOUT their agreement.
//     * Art. 203 — young workers (młodociani) may not work overtime or at night.
//
//   WorkPulse cannot guess who is in these groups, so HR records it here. When a
//   flag is set, the clock flow warns (and can require consent) instead of
//   letting protected overtime/night work slip through unnoticed.
//
//   These flags describe a person's protected status — sensitive data — so they
//   live in WorkPulse's own collection with tenant isolation, not mixed into the
//   raw time records.
const employeeWorkProfileSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    employeeId: { type: String, index: true },

    // Protected-group flags (set by HR).
    isPregnant: { type: Boolean, default: false }, // art. 178 §1
    isParentOfChildUnder4: { type: Boolean, default: false }, // art. 178 §2
    isYoungWorker: { type: Boolean, default: false }, // art. 203

    // For the "parent of a small child" case, overtime/night work is allowed
    // ONLY with the employee's written agreement. This records that agreement.
    consentToOvertime: { type: Boolean, default: false },
    consentToNightWork: { type: Boolean, default: false },

    updatedBy: { type: String },
  },
  {
    collection: 'workplus_employee_profiles',
    timestamps: true,
  }
);

employeeWorkProfileSchema.index({ tenantId: 1, userId: 1 }, { unique: true });

module.exports =
  mongoose.models.WorkPulse_EmployeeWorkProfile ||
  mongoose.model('WorkPulse_EmployeeWorkProfile', employeeWorkProfileSchema);
