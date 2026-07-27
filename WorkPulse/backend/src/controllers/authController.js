const { User } = require('../models/User');
const { logAudit } = require('../middleware/auditLogger');
const { sendSuccess, sendError } = require('../utils/responseHelper');

// Thin controller — WorkPulse does NOT log users in. The RegulaOne SSO service
// owns login and sets the shared auth cookie. Here we only return the current
// user's profile and write a logout audit record.

const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate('tenant').select('-password');
    if (!user) return sendError(res, 'User not found', 404);
    return sendSuccess(res, { user }, 'User profile retrieved');
  } catch (err) {
    next(err);
  }
};

const logout = async (req, res, next) => {
  try {
    await logAudit({
      tenantId: req.tenantId,
      userId: req.user._id.toString(),
      userEmail: req.user.email,
      action: 'LOGOUT',
      resource: 'User',
      resourceId: req.user._id.toString(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return sendSuccess(res, null, 'Logged out successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = { getMe, logout };
