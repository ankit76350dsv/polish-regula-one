const auditService = require('../services/auditService');
const { sendSuccess, sendError } = require('../utils/responseHelper');

// GET /api/audit-logs — paginated, filterable WorkPulse audit trail.
const getAuditLogs = async (req, res, next) => {
  try {
    const { action, userId, from, to, page, limit } = req.query;
    const result = await auditService.getAuditLogs(req.tenantId, {
      action,
      userId,
      from,
      to,
      page,
      limit,
    });
    return sendSuccess(res, result, 'Audit logs retrieved');
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

module.exports = { getAuditLogs };
