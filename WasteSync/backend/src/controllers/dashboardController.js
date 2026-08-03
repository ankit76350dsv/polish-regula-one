const dashboardService = require('../services/dashboardService');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { CAPABILITIES, hasCapability } = require('../config/permissions');

// GET /api/dashboard/overview?companyId=&year=
// Returns all dashboard data in one payload. Tenant comes from the session.
const getOverview = async (req, res, next) => {
  try {
    const { companyId, year } = req.query;

    // The dashboard's "recent activity" panel is the audit trail. Only send it to
    // someone who is allowed to read the audit trail (admins and auditors, not HR),
    // otherwise the dashboard would become a back door to data the Audit Logs page
    // deliberately keeps from them. req.capabilities is worked out once per request
    // by the auth middleware from the permissions RegulaOne returned.
    const includeAuditActivity = hasCapability(req.capabilities, CAPABILITIES.AUDIT_READ);

    const data = await dashboardService.getOverview(req.tenantId, {
      companyId,
      year,
      includeAuditActivity,
    });
    return sendSuccess(res, data, 'Dashboard overview fetched');
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

module.exports = { getOverview };
