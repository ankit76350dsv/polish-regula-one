const { User } = require('../models/User');
const { logAudit } = require('../middleware/auditLogger');

// NOTE: The local password login() and its JWT generateToken() helper were
// removed. SafeWork no longer authenticates users with a password or issues
// its own token. Login is owned by the RegulaOne SSO service, which sets the
// shared HttpOnly cookie that SafeWork's auth middleware verifies (Cognito).
// This service now only loads the current user (getMe) and writes the logout
// audit record (logout).

const getMe = async (userId) => {
  const user = await User.findById(userId)
    .populate('tenant')
    .select('-password');

  if (!user) {
    throw { status: 404, message: 'User not found' };
  }

  if (!user.enabled) {
    throw { status: 403, message: 'User account is disabled' };
  }

  return user;
};

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
  logout
};