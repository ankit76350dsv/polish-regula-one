const dashboardService = require('../services/dashboardService');
const { sendSuccess } = require('../utils/responseHelper');

// Returns aggregated compliance statistics for the authenticated user's tenant.
const getDashboard = async (req, res, next) => {
  try {
    const data = await dashboardService.getDashboardStats(req.user.tenantId);
    return sendSuccess(res, data, 'Dashboard data retrieved');
  } catch (err) {
    next(err);
  }
};

module.exports = { getDashboard };
