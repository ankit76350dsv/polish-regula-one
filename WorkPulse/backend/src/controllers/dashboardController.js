const dashboardService = require('../services/dashboardService');
const { sendSuccess, sendError } = require('../utils/responseHelper');

// GET /api/dashboard/overview — tenant-wide working-time snapshot.
const getOverview = async (req, res, next) => {
  try {
    if (!req.tenantId) return sendError(res, 'Tenant context required', 400);
    const data = await dashboardService.getOverview(req.tenantId);
    return sendSuccess(res, data, 'Dashboard data retrieved');
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

// GET /api/dashboard/monthly?year=YYYY&month=M — payroll-style monthly summary.
const getMonthly = async (req, res, next) => {
  try {
    const now = new Date();
    const year = req.query.year || now.getFullYear();
    const month = req.query.month || now.getMonth() + 1;
    const data = await dashboardService.getMonthlySummary(req.tenantId, year, month);
    return sendSuccess(res, data, 'Monthly summary retrieved');
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

module.exports = { getOverview, getMonthly };
