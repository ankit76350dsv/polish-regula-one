const { validationResult } = require('express-validator');
const authService = require('../services/authService');
const { sendSuccess, sendError } = require('../utils/responseHelper');

// Thin controller — only parses request, delegates to service, formats response.
// Business logic lives in authService.

const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 'Validation failed', 400, errors.array());
    }

    const { email, password } = req.body;
    const result = await authService.login({
      email,
      password,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return sendSuccess(res, result, 'Login successful');
  } catch (err) {
    if (err.status) return sendError(res, err.message, err.status);
    next(err);
  }
};

const getMe = async (req, res, next) => {
  try {
    // req.user is attached by authMiddleware after token validation
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

module.exports = { login, getMe, logout };
