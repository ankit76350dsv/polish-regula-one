const auditService = require('../services/auditService');
const { sendSuccess, sendError } = require('../utils/responseHelper');

// GET /api/audit?action=&userId=&from=&to=&page=&limit=
// Returns the tenant's audit trail, newest first, with simple filters.
const getAuditLogs = async (req, res, next) => {
  try {
    const { action, userId, from, to, page, limit } = req.query;

    const { logs, pagination } = await auditService.getAuditLogs(req.tenantId, {
      action,
      userId,
      from,
      to,
      page,
      limit,
    });

    return sendSuccess(res, { logs, pagination }, 'Audit logs fetched');
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

module.exports = { getAuditLogs };
