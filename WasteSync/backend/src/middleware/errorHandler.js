const { sendError } = require('../utils/responseHelper');

// Centralised error handler — must be registered LAST in the Express chain.
// It turns known error types into clean responses and NEVER leaks a stack trace
// to the client (stack traces can reveal internal details to an attacker).
const errorHandler = (err, req, res, next) => {
  console.error('[ERROR]', err.message, err.stack);

  // Errors we threw on purpose already carry the right HTTP status code.
  if (err.statusCode) {
    return sendError(res, err.message, err.statusCode);
  }

  // Mongoose validation errors → collect each field message.
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => e.message);
    return sendError(res, 'Validation failed', 400, errors);
  }

  // Mongoose duplicate key error (e.g. two companies with the same BDO number).
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return sendError(res, `${field} already exists`, 409);
  }

  // Invalid Mongo ObjectId in the URL.
  if (err.name === 'CastError') {
    return sendError(res, 'Invalid ID format', 400);
  }

  // Anything else → generic message only.
  return sendError(res, 'Internal server error', 500);
};

// Catches requests that did not match any route.
const notFoundHandler = (req, res) => {
  return sendError(res, `Route ${req.originalUrl} not found`, 404);
};

module.exports = { errorHandler, notFoundHandler };
