const policyService = require('../services/policyService');
const { sendSuccess, sendError } = require('../utils/responseHelper');

// GET /api/policy — the tenant's working-time policy (created on first use).
const getPolicy = async (req, res, next) => {
  try {
    const policy = await policyService.getPolicy(req.tenantId);
    return sendSuccess(res, policy, 'Policy retrieved');
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

// PUT /api/policy — update the tenant's working-time policy (admin only).
const updatePolicy = async (req, res, next) => {
  try {
    const policy = await policyService.updatePolicy(req.tenantId, req.body, {
      userId: req.user._id.toString(),
      userEmail: req.user.email,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return sendSuccess(res, policy, 'Policy updated');
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

module.exports = { getPolicy, updatePolicy };
