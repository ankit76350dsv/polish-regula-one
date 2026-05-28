const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config/environment');
const { logAudit } = require('../middleware/auditLogger');

// Signs a JWT containing the userId and tenantId claims.
const generateToken = (user) => {
  return jwt.sign(
    { userId: user._id, tenantId: user.tenantId, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
};

// Validates credentials and returns a signed token.
// Audit logs both successes and failures so security teams can detect brute-force.
const login = async ({ email, password, ipAddress, userAgent }) => {
  // Fetch user with password field (excluded by default via select: false)
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

  if (!user || !user.isActive) {
    await logAudit({
      tenantId: 'unknown',
      userId: 'unknown',
      userEmail: email,
      action: 'LOGIN_FAILED',
      resource: 'User',
      ipAddress,
      userAgent,
      success: false,
      errorMessage: 'User not found or inactive',
    });
    throw { status: 401, message: 'Invalid email or password' };
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    await logAudit({
      tenantId: user.tenantId,
      userId: user._id.toString(),
      userEmail: email,
      action: 'LOGIN_FAILED',
      resource: 'User',
      ipAddress,
      userAgent,
      success: false,
      errorMessage: 'Password mismatch',
    });
    throw { status: 401, message: 'Invalid email or password' };
  }

  const token = generateToken(user);

  await logAudit({
    tenantId: user.tenantId,
    userId: user._id.toString(),
    userEmail: user.email,
    action: 'LOGIN',
    resource: 'User',
    resourceId: user._id.toString(),
    ipAddress,
    userAgent,
  });

  // Strip password from returned object
  const userObj = user.toObject();
  delete userObj.password;

  return { token, user: userObj };
};

// Fetches the authenticated user's profile.
const getMe = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw { status: 404, message: 'User not found' };
  return user;
};

// Logs the logout action for the audit trail.
// Token invalidation is client-side (stateless JWT); the audit log is the server record.
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

module.exports = { login, getMe, logout };
