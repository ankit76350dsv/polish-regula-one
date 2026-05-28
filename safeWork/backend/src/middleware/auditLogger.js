const AuditLog = require('../models/AuditLog');

// Writes an immutable audit entry.
// Called directly from service layer so every compliance action is logged
// regardless of which route triggered it.
const logAudit = async ({ tenantId, userId, userEmail, action, resource, resourceId, oldValue, newValue, ipAddress, userAgent, success = true, errorMessage }) => {
  try {
    await AuditLog.create({
      tenantId,
      userId,
      userEmail,
      action,
      resource,
      resourceId,
      oldValue,
      newValue,
      ipAddress,
      userAgent,
      success,
      errorMessage,
    });
  } catch (err) {
    // Log audit failures to console but never throw — a failed audit must not
    // block the original operation. Investigate separately.
    console.error('[AUDIT] Failed to write audit log:', err.message);
  }
};

module.exports = { logAudit };
