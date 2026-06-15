const auditService = require('../services/auditService');
const { sendSuccess, sendError } = require('../utils/responseHelper');

// GET /api/admin/audit-logs
// Returns a paginated, filtered list of audit events for the current tenant.
//
// Query params:
//   action?       — exact action key (e.g. EMPLOYEE_PROFILE_VIEWED)
//   userId?       — filter to a specific actor
//   resource?     — filter to a specific resource type
//   search?       — text search across email, action, resource, resourceId
//   startDate?    — ISO date lower bound (inclusive)
//   endDate?      — ISO date upper bound (inclusive, end of day)
//   page?         — page number  (default 1)
//   limit?        — records/page (default 20, max 100)
const getAuditLogs = async (req, res, next) => {
  try {
    const {
      tenantId: tenantIdParam,
      action,
      userId,
      resource,
      search,
      startDate,
      endDate,
      page,
      limit,
    } = req.query;

    // tenantId comes from the frontend as a query param (auth.user.tenantId).
    // Fall back to user.tenant on the SafeWork User document if absent.
    const tenantId = tenantIdParam || req.user?.tenant?.toString();

    if (!tenantId) {
      return sendError(res, 'Tenant context required — ensure you are authenticated', 400);
    }

    const { logs, pagination } = await auditService.getAuditLogs(tenantId, {
      action:    action    || undefined,
      userId:    userId    || undefined,
      resource:  resource  || undefined,
      search:    search?.trim() || undefined,
      startDate: startDate || undefined,
      endDate:   endDate   || undefined,
      page:  page  ? parseInt(page,  10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });

    return sendSuccess(
      res,
      { count: logs.length, logs, pagination },
      'Audit logs fetched successfully'
    );
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

module.exports = { getAuditLogs };
