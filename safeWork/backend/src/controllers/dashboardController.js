const dashboardService = require('../services/dashboardService');
const { sendSuccess, sendError } = require('../utils/responseHelper');

// GET /api/dashboard/overview
// Returns all dashboard data for the authenticated user's tenant in one response.
//
// OLD: getDashboard called getDashboardStats(req.user.tenantId) — bug because
//   1. req.user.tenantId does not exist; the field is req.user.tenant (ObjectId).
//   2. getDashboardStats queried Employee.find({ tenantId }) but Employee has no
//      tenantId field — tenant is on the linked User document.
// NEW: calls getDashboardOverview(tenantId) which joins through users collection.
const getDashboardOverview = async (req, res, next) => {
  try {
    // Primary: tenantId passed as a query param by the frontend (auth.user.tenantId from Redux).
    // Fallback: req.user.tenant from the JWT-resolved User document.
    // This pattern is consistent with getAuditLogs and getEmployees in this codebase.
    const tenantId = req.query.tenantId || req.user?.tenant?.toString();

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
