const rateLimit = require('express-rate-limit');
const config = require('../config/environment');

// General API rate limiter — applied to all /api routes.
const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

// Stricter limiter for the clock endpoints. Clock-in / clock-out are the most
// abused endpoints (a spoofing script could hammer them), so we cap them harder.
const clockLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many clock actions, please slow down.' },
});

module.exports = { apiLimiter, clockLimiter };
