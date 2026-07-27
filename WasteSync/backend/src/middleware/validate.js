const { validationResult } = require('express-validator');
const { sendError } = require('../utils/responseHelper');

// Runs after a list of express-validator rules. If any rule failed, it stops
// the request and returns a 400 with the list of problems. If everything is
// valid, it calls next() and the real controller runs.
//
// This keeps controllers clean — they can trust that the input is already valid.
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 'Validation failed', 400, errors.array());
  }
  next();
};

module.exports = { validate };
