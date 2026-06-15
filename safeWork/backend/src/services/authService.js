const jwt = require('jsonwebtoken');
const { User } = require('../models/User');
const config = require('../config/environment');
const { logAudit } = require('../middleware/auditLogger');

const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      tenantId: user.tenant,
      role: user.role
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
};

const login = async ({ email, password, ipAddress, userAgent }) => {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

  if (!user || !user.enabled) {
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
      tenantId: user.tenant,
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
    tenantId: user.tenant,
    userId: user._id.toString(),
    userEmail: user.email,
    action: 'LOGIN',
    resource: 'User',
    resourceId: user._id.toString(),
    ipAddress,
    userAgent,
  });

  const userObj = user.toObject();
  delete userObj.password;

  return {
    token,
    user: userObj
  };
};

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
  login,
  getMe,
  logout
};