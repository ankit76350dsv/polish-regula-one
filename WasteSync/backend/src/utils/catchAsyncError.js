// Wraps an async route handler so any error it throws is passed to the Express
// error handler automatically — this saves writing a try/catch in every handler.
module.exports = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
