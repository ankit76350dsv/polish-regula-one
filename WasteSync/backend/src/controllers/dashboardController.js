const dashboardService = require('../services/dashboardService');
const { sendSuccess, sendError } = require('../utils/responseHelper');

// GET /api/dashboard/overview?companyId=&year=
// Returns all dashboard data in one payload. Tenant comes from the session.
const getOverview = async (req, res, next) => {
  try {
    const { companyId, year } = req.query;
    const data = await dashboardService.getOverview(req.tenantId, { companyId, year });
    return sendSuccess(res, data, 'Dashboard overview fetched');
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

module.exports = { getOverview };
