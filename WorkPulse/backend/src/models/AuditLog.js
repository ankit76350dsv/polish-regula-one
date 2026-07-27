const mongoose = require('mongoose');

// Immutable audit log for WorkPulse — one entry per important working-time
// action. Stored in its OWN collection (workplus_auditlogs) so WorkPulse audit
// data is isolated from the other modules' logs.
//
// Documents must NEVER be updated after creation (write-once semantics) so the
// trail is legally defensible during a labour inspection.
const auditLogSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    userEmail: { type: String },

    // Examples: CLOCK_IN, CLOCK_OUT, BREAK_START, BREAK_END, ENTRY_CORRECTED,
    // OVERTIME_APPROVED, ABSENCE_CREATED, POLICY_UPDATED, CLOCK_IN_BLOCKED.
    action: { type: String, required: true },

    resource: { type: String }, // e.g. "TimeEntry", "Absence", "WorkingTimePolicy"
    resourceId: { type: String },

    oldValue: { type: mongoose.Schema.Types.Mixed },
    newValue: { type: mongoose.Schema.Types.Mixed },

    ipAddress: { type: String },
    userAgent: { type: String },

    success: { type: Boolean, default: true },
    errorMessage: { type: String },
  },
  {
    collection: 'workplus_auditlogs',
    timestamps: true,
    versionKey: false,
  }
);

// Block all update operations to enforce immutability.
auditLogSchema.pre(['updateOne', 'findOneAndUpdate', 'updateMany'], function () {
  throw new Error('Audit logs are immutable and cannot be updated');
});

// Indexes for the primary query patterns used by the audit report.
auditLogSchema.index({ tenantId: 1, createdAt: -1 });
auditLogSchema.index({ tenantId: 1, action: 1, createdAt: -1 });
auditLogSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });

module.exports =
  mongoose.models.WorkPulse_AuditLog || mongoose.model('WorkPulse_AuditLog', auditLogSchema);
