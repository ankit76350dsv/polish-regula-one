// Wraps an async route handler so errors are forwarded to the Express
// error handler automatically — no try/catch needed in every controller.
module.exports = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
