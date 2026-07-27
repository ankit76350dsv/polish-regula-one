const AuditLog = require('../models/AuditLog');

// Writes one immutable audit entry into the WorkPulse audit collection
// (workplus_auditlogs). Called from the service layer so every important
// working-time action is recorded no matter which route triggered it.
const logAudit = async ({
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
  success = true,
  errorMessage,
}) => {
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
    // Log audit failures to the console but never throw — a failed audit write
    // must not block the original operation. Investigate these separately.
    console.error('[AUDIT] Failed to write audit log:', err.message);
  }
};

module.exports = { logAudit };
