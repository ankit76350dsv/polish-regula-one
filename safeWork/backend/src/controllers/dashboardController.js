const dashboardService = require('../services/dashboardService');
const { sendSuccess, sendError } = require('../utils/responseHelper');

// GET /api/dashboard/overview
// Returns all dashboard data for the authenticated user's tenant in one response.
//
// Tenant is taken from req.tenantId, which the auth middleware derived from the
// logged-in user's RegulaOne session (/api/auth/me). The frontend does NOT send
// a tenantId — the backend always uses the authenticated user's own tenant.
const getDashboardOverview = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;

    if (!tenantId) {
      return sendError(res, 'Tenant context required — ensure you are authenticated', 400);
    }

    const data = await dashboardService.getDashboardOverview(tenantId);
    return sendSuccess(res, data, 'Dashboard data retrieved');
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

module.exports = { getDashboardOverview };
