const AuditLog = require('../models/AuditLog');

// ─────────────────────────────────────────────────────────────────────────────
// Audit service — reads the immutable WorkPulse audit trail (workplus_auditlogs).
// ─────────────────────────────────────────────────────────────────────────────
// Read-only. The trail itself is written from the service layer via logAudit().

// Returns a paginated, filterable list of audit logs for one tenant.
async function getAuditLogs(tenantId, { action, userId, from, to, page = 1, limit = 25 } = {}) {
  if (!tenantId) throw { status: 400, message: 'Tenant context is required' };

  const query = { tenantId };
  if (action && action !== 'All') query.action = action;
  if (userId) query.userId = userId;
  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = new Date(from);
    if (to) query.createdAt.$lte = new Date(to);
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));

  const [logs, total] = await Promise.all([
    AuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    AuditLog.countDocuments(query),
  ]);

  return {
    logs,
    pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) || 1 },
  };
}

module.exports = { getAuditLogs };
