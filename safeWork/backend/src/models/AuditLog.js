const mongoose = require('mongoose');

// Immutable audit log — required for all compliance actions per platform rules.
// Documents must NOT be updated after creation (write-once semantics).
const auditLogSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    userEmail: { type: String },

    action: {
      type: String,
      required: true,
      // Examples: LOGIN, LOGOUT, EMPLOYEE_CREATED, COMPLIANCE_UPDATED
    },

    resource: { type: String }, // e.g. "Employee", "User"
    resourceId: { type: String },

    oldValue: { type: mongoose.Schema.Types.Mixed },
    newValue: { type: mongoose.Schema.Types.Mixed },

    ipAddress: { type: String },
    userAgent: { type: String },

    success: { type: Boolean, default: true },
    errorMessage: { type: String },
  },
  {
    timestamps: true,
    // Prevent accidental updates — audit logs must be immutable
    versionKey: false,
  }
);

// Block all update operations to enforce immutability
auditLogSchema.pre(['updateOne', 'findOneAndUpdate', 'updateMany'], function () {
  throw new Error('Audit logs are immutable and cannot be updated');
});

// Compound indexes for the primary query patterns used by the audit report:
//   - tenant + time       (default list — newest first)
//   - tenant + action + time  (filter by action type)
//   - tenant + userId + time  (filter by specific user)
auditLogSchema.index({ tenantId: 1, createdAt: -1 });
auditLogSchema.index({ tenantId: 1, action: 1,  createdAt: -1 });
auditLogSchema.index({ tenantId: 1, userId: 1,  createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
