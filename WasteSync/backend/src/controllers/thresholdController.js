const thresholdService = require('../services/thresholdService');
const { sendSuccess, sendError } = require('../utils/responseHelper');

// The tenant id is resolved once by the auth middleware (req.tenantId).
// Controllers ALWAYS use req.tenantId and never accept a tenant id from the
// client (query/body/params). This is what keeps tenants isolated.

// Builds the "actor" object every service call needs for audit logging.
const buildActor = (req) => ({
  tenantId: req.tenantId,
  userId: req.user._id.toString(),
  userEmail: req.user.email,
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
});

const listThresholds = async (req, res, next) => {
  try {
    const thresholds = await thresholdService.listThresholds(req.tenantId, {
      year: req.query.year,
    });
    return sendSuccess(res, { count: thresholds.length, thresholds }, 'Thresholds fetched');
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

const upsertThreshold = async (req, res, next) => {
  try {
    // Strip any tenantId the client may have sent — we always use the session's.
    const { tenantId: _ignored, ...data } = req.body;
    const threshold = await thresholdService.upsertThreshold(data, buildActor(req));
    return sendSuccess(res, threshold, 'Threshold saved', 201);
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

const deleteThreshold = async (req, res, next) => {
  try {
    const result = await thresholdService.deleteThreshold(req.params.id, buildActor(req));
    return sendSuccess(res, result, 'Threshold deleted');
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

module.exports = {
  listThresholds,
  upsertThreshold,
  deleteThreshold,
};
