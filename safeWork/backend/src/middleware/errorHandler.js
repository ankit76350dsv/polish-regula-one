const { sendError } = require('../utils/responseHelper');

// Centralised error handler — must be registered LAST in the Express middleware chain.
// Converts known error types to user-friendly responses without exposing stack traces.
const errorHandler = (err, req, res, next) => {
  console.error('[ERROR]', err.message, err.stack);

  // ErrorHandler instances already carry the right statusCode — use it directly
  if (err.statusCode) {
    return sendError(res, err.message, err.statusCode);
  }

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => e.message);
    return sendError(res, 'Validation failed', 400, errors);
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return sendError(res, `${field} already exists`, 409);
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    return sendError(res, 'Invalid ID format', 400);
  }

  // Default — never expose internal details to the client
  return sendError(res, 'Internal server error', 500);
};

// 404 handler — catches requests that matched no route
const notFoundHandler = (req, res) => {
  return sendError(res, `Route ${req.originalUrl} not found`, 404);
};

module.exports = { errorHandler, notFoundHandler };
