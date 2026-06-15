// Custom error class that carries an HTTP statusCode alongside the message.
// Throw this anywhere in the service/controller layer; the central error
// handler middleware reads err.statusCode to set the response status.
class ErrorHandler extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ErrorHandler;
