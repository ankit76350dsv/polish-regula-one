const rateLimit = require('express-rate-limit');
const config = require('../config/environment');

// General API rate limiter — applied to all /api routes.
// This slows down anyone trying to hammer the API (abuse / brute force).
const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

module.exports = { apiLimiter };
