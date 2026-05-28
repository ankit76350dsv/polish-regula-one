const jwt = require('jsonwebtoken');
const config = require('../config/environment');
const User = require('../models/User');
const { sendError } = require('../utils/responseHelper');

// JWT authentication middleware.
// Reads the Bearer token from the Authorization header and attaches the
// full user document to req.user so downstream handlers don't re-query.
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Authentication token required', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret);

    const user = await User.findById(decoded.userId).select('-password');
    if (!user || !user.isActive) {
      return sendError(res, 'User not found or deactivated', 401);
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return sendError(res, 'Invalid token', 401);
    }
    if (error.name === 'TokenExpiredError') {
      return sendError(res, 'Token expired', 401);
    }
    next(error);
  }
};

// Role-based access control factory.
// Usage: authorize('COMPANY_ADMIN', 'HR_MANAGER')
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return sendError(res, 'Insufficient permissions', 403);
    }
    next();
  };
};

module.exports = { authenticate, authorize };