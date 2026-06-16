const authService = require('../services/authService');
const { sendSuccess, sendError } = require('../utils/responseHelper');


// Thin controller — only parses request, delegates to service, formats response.
// Business logic lives in authService.
//
// NOTE: The local login() handler was removed. SafeWork does not log users in
// itself anymore — the RegulaOne SSO service owns login and sets the shared
// auth cookie. This controller now only exposes profile (getMe) and logout.

const getMe = async (req, res, next) => {
  console.log('AuthController.getMe called with user:', req.user);
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
      tenantId: req.user.tenantId,
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
