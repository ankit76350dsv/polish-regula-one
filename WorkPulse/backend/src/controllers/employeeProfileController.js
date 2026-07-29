const employeeProfileService = require('../services/employeeProfileService');
const { sendSuccess, sendError } = require('../utils/responseHelper');

// GET /api/employee-profiles/:userId — read one employee's protection profile.
const getProfile = async (req, res, next) => {
  try {
    const profile = await employeeProfileService.getProfile(req.tenantId, req.params.userId);
    return sendSuccess(res, profile, 'Profile retrieved');
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

// PUT /api/employee-profiles/:userId — set the protection flags (HR/admin only).
const upsertProfile = async (req, res, next) => {
  try {
    const profile = await employeeProfileService.upsertProfile(
      req.tenantId,
      req.params.userId,
      req.body,
      {
        userId: req.user._id.toString(),
        userEmail: req.user.email,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }
    );
    return sendSuccess(res, profile, 'Profile saved');
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

module.exports = { getProfile, upsertProfile };
