const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// MonitoringAcknowledgement — proof the employee was told about monitoring.
// ─────────────────────────────────────────────────────────────────────────────
//
// WHY THIS EXISTS (Art. 22² Kodeks pracy + GDPR/RODO):
//   Before an employer may track where an employee is, the employee must be
//   INFORMED about it. This record is the proof that a specific employee saw a
//   specific version of the monitoring notice, and when. If the notice text
//   changes we bump its version and ask again, so consent is never stale.
//
//   One row per employee per notice version. It is never deleted (it is legal
//   evidence), so there is no soft-delete field here on purpose.
const monitoringAcknowledgementSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    employeeId: { type: String },

    // Which version of the notice the employee agreed to.
    noticeVersion: { type: String, required: true },

    acknowledgedAt: { type: Date, required: true },
    // Kept as evidence of how/where the acknowledgement was made.
    ipAddress: { type: String },
    userAgent: { type: String },
  },
  {
    collection: 'workplus_monitoring_acks',
    timestamps: true,
  }
);

// One acknowledgement per employee per notice version.
monitoringAcknowledgementSchema.index(
  { tenantId: 1, userId: 1, noticeVersion: 1 },
  { unique: true }
);

module.exports =
  mongoose.models.WorkPulse_MonitoringAcknowledgement ||
  mongoose.model('WorkPulse_MonitoringAcknowledgement', monitoringAcknowledgementSchema);
