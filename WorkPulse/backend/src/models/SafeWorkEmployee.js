const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// READ-ONLY view of SafeWork's employee compliance records.
// ─────────────────────────────────────────────────────────────────────────────
//
// WHY THIS EXISTS:
//   In WorkPulse, an employee may only clock in if they are ALLOWED to work.
//   That "allowed to work" decision is already made by the SafeWork module,
//   which tracks each employee's medical certificate and BHP (safety) training.
//   SafeWork stores the result on every employee record as:
//     - isBlocked        : true when a required certificate is EXPIRED or MISSING
//     - blockReason      : a human-readable reason for the block
//     - complianceStatus : COMPLIANT / EXPIRING / NON_COMPLIANT / BLOCKED
//
//   Rather than duplicate that logic, WorkPulse READS the same record and reuses
//   the decision. All RegulaOne modules share one MongoDB database, so WorkPulse
//   simply points a read-only model at SafeWork's `safework_employees` collection.
//
// IMPORTANT: WorkPulse must NEVER write to this collection. It only reads.
//
// We define just the fields WorkPulse needs. `strict: false` keeps the rest of
// SafeWork's fields available if we ever need them, without WorkPulse having to
// mirror SafeWork's full schema.
const safeWorkEmployeeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, index: true },
    employeeId: { type: String, index: true },
    name: { type: String },
    email: { type: String },
    department: { type: String },
    position: { type: String },
    site: { type: String },

    // The compliance decision WorkPulse relies on.
    complianceStatus: { type: String },
    isBlocked: { type: Boolean },
    blockReason: { type: String },
    isActive: { type: Boolean },

    requiresMedicalCertificate: { type: Boolean },
    requiresBHPTraining: { type: Boolean },
    medicalCertificate: { type: mongoose.Schema.Types.Mixed },
    bhpTraining: { type: mongoose.Schema.Types.Mixed },
  },
  {
    collection: 'safework_employees',
    strict: false,
  }
);

// Guard against OverwriteModelError on nodemon hot-reload. We use a WorkPulse
// specific model name so it never collides with SafeWork's own model.
module.exports =
  mongoose.models.WorkPulse_SafeWorkEmployeeRef ||
  mongoose.model('WorkPulse_SafeWorkEmployeeRef', safeWorkEmployeeSchema);
