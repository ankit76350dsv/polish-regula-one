const mongoose = require('mongoose');

// Immutable audit log — required for all compliance actions per platform rules.
// Documents must NOT be updated after creation (write-once semantics). For BDO,
// these records must be kept for at least 10 years for government audits.
const auditLogSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    userEmail: { type: String },

    action: {
      type: String,
      required: true,
      // Examples: LOGIN, LOGOUT, COMPANY_CREATED, WASTE_ENTRY_CREATED,
      //           REPORT_GENERATED, REPORT_DOWNLOADED
    },

    resource: { type: String }, // e.g. "Company", "WasteEntry", "AnnualReport"
    resourceId: { type: String },

    // The "before" and "after" snapshots so an auditor can see exactly what
    // changed in any update.
    oldValue: { type: mongoose.Schema.Types.Mixed },
    newValue: { type: mongoose.Schema.Types.Mixed },

    ipAddress: { type: String },
    userAgent: { type: String },

    success: { type: Boolean, default: true },
    errorMessage: { type: String },
  },
  {
    timestamps: true,
    // Prevent accidental updates — audit logs must be immutable.
    versionKey: false,
    // Dedicated WasteSync audit-log collection (kept separate from other modules).
    collection: 'WasteSync-auditlogs',
  }
);

// Block all update operations to enforce immutability. If any code accidentally
// tries to edit an audit log, this throws instead of silently changing history.
auditLogSchema.pre(['updateOne', 'findOneAndUpdate', 'updateMany'], function () {
  throw new Error('Audit logs are immutable and cannot be updated');
});

// Compound indexes for the queries the audit report actually runs:
//   - tenant + time            (default list — newest first)
//   - tenant + action + time   (filter by action type)
//   - tenant + userId + time   (filter by a specific user)
auditLogSchema.index({ tenantId: 1, createdAt: -1 });
auditLogSchema.index({ tenantId: 1, action: 1, createdAt: -1 });
auditLogSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });

module.exports = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
