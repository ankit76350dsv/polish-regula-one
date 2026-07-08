const AuditLog = require('../models/AuditLog');

// Returns a paginated, filtered list of audit logs for the tenant.
// Audit logs are read-only here — they are written by logAudit and never edited.
const getAuditLogs = async (tenantId, filters = {}) => {
  const { action, userId, from, to, page = 1, limit = 20 } = filters;

  // Clamp pagination so a client cannot ask for a huge page.
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  // Always scope to the tenant — this is the core isolation rule.
  const query = { tenantId };
  if (action) query.action = action;
  if (userId) query.userId = userId;

  // Optional date range on createdAt.
  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = new Date(from);
    if (to) query.createdAt.$lte = new Date(to);
  }

  // Run the page query and the total count together for speed.
  const [logs, total] = await Promise.all([
    AuditLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
    AuditLog.countDocuments(query),
  ]);

  return {
    logs,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    },
  };
};

module.exports = { getAuditLogs };
