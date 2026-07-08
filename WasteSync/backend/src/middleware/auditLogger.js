const AuditLog = require('../models/AuditLog');

// Writes one immutable audit entry.
//
// Why audit logs matter here: BDO is a government register. If an auditor asks
// "who changed this waste figure, and when?", we must be able to answer. So
// every important action (create, update, generate report, download, login)
// writes a record that can never be edited or deleted.
//
// This is called from the SERVICE layer so the log is written no matter which
// route triggered the action.
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
    // If writing the audit log fails, we log to the console but DO NOT throw.
    // A failed audit write must never block the real operation the user asked
    // for — we investigate audit gaps separately.
    console.error('[AUDIT] Failed to write audit log:', err.message);
  }
};

module.exports = { logAudit };
