const authService = require('../services/authService');
const { sendSuccess, sendError } = require('../utils/responseHelper');

// Thin controller — it only reads the request, calls the service, and formats
// the response. All logic lives in authService.
//
// WasteSync does not log users in. The RegulaOne SSO service owns login and
// sets the shared auth cookie. This controller exposes only profile + logout.

const getMe = async (req, res, next) => {
  try {
    const user = await authService.getMe(req.user._id);
    return sendSuccess(res, { user }, 'User profile retrieved');
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

const logout = async (req, res, next) => {
  try {
    await authService.logout({
      userId: req.user._id.toString(),
      tenantId: req.tenantId,
      userEmail: req.user.email,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return sendSuccess(res, null, 'Logged out successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = { getMe, logout };
