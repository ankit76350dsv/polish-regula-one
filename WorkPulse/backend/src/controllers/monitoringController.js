const monitoringService = require('../services/monitoringService');
const { sendSuccess, sendError } = require('../utils/responseHelper');

// GET /api/monitoring/status — does this employee still need to accept the
// monitoring notice before location can be used? The Clock screen calls this.
const getStatus = async (req, res, next) => {
  try {
    const status = await monitoringService.getStatus(req.tenantId, req.user._id);
    return sendSuccess(res, status, 'Monitoring status retrieved');
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

// POST /api/monitoring/acknowledge — the employee confirms they read the notice.
const acknowledge = async (req, res, next) => {
  try {
    const ack = await monitoringService.acknowledge(req.tenantId, req.user, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return sendSuccess(res, ack, 'Monitoring notice acknowledged', 201);
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

module.exports = { getStatus, acknowledge };
