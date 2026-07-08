const { User } = require('../models/User');
const { logAudit } = require('../middleware/auditLogger');

// WasteSync does NOT log users in. Login is owned by the RegulaOne SSO service,
// which sets the shared HttpOnly cookie that our auth middleware verifies.
// This service only loads the current user (getMe) and writes the logout audit.

// Loads the signed-in user's profile (without the password field).
const getMe = async (userId) => {
  const user = await User.findById(userId).populate('tenant').select('-password');

  if (!user) {
    throw { status: 404, message: 'User not found' };
  }

  if (!user.enabled) {
    throw { status: 403, message: 'User account is disabled' };
  }

  return user;
};

// Records a logout in the immutable audit log. The actual cookie is cleared by
// the central RegulaOne service — WasteSync only notes that it happened.
const logout = async ({ userId, tenantId, userEmail, ipAddress, userAgent }) => {
  await logAudit({
    tenantId,
    userId,
    userEmail,
    action: 'LOGOUT',
    resource: 'User',
    resourceId: userId,
    ipAddress,
    userAgent,
  });
};

module.exports = {
  getMe,
  logout,
};
