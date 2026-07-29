// Guard for the one compliance action that needs a closer look than a plain
// "may this person write?" check: removing a clock-in block.
//
// WHY THIS EXISTS
// PATCH /api/admin/employees/:employeeId/compliance can do two very different
// things with the same request:
//
//   1. BLOCK someone (isBlocked: true) — this ENFORCES the law. Polish Labour
//      Code art. 229 §4 says an employer must not let an employee work without a
//      valid medical certificate; art. 237(3) says the same for BHP safety
//      training. HR should be able to do this at any time, so it only needs the
//      normal COMPLIANCE_BLOCK permission.
//
//   2. UNBLOCK someone (isBlocked: false) — this switches that legal safety gate
//      OFF. If it is done while the certificate is still expired, the company is
//      breaking the law and the employee may be working without medical
//      clearance. So it needs a stronger permission (COMPLIANCE_UNBLOCK, which
//      only an admin has) AND a written reason we keep forever in the audit log.
//
// Because both arrive on the same URL, the route cannot tell them apart on its
// own — we have to look at what the request is asking for. That is what this
// middleware does.
//
// It must run AFTER authorizeCapability(COMPLIANCE_BLOCK), so by the time we get
// here we already know the caller may change compliance data at all.

const ErrorHandler = require('../utils/ErrorHandler');
const { CAPABILITIES, hasCapability } = require('../config/permissions');
const { recordDenial } = require('./authMiddleware');

// The shortest reason we accept. A one-word reason like "ok" is useless to an
// auditor two years later, so we ask for a real sentence.
const MIN_REASON_LENGTH = 10;

/**
 * Is this request trying to remove a block?
 *
 * We only treat it as an unblock when the body EXPLICITLY says isBlocked: false.
 * A request that does not mention isBlocked at all is just a normal compliance
 * update and is left alone.
 *
 * We also accept the string "false", because form posts and some HTTP clients
 * send booleans as text.
 *
 * @param {object} body the request body
 * @returns {boolean}
 */
function isUnblockAttempt(body) {
  if (!body || typeof body !== 'object') return false;
  if (!('isBlocked' in body)) return false;

  return body.isBlocked === false || String(body.isBlocked).toLowerCase() === 'false';
}

/**
 * Express middleware. Lets normal compliance updates through untouched, and
 * applies the two extra rules only when the request tries to unblock someone.
 */
const guardUnblock = (req, res, next) => {
  // Not an unblock — nothing special to check here.
  if (!isUnblockAttempt(req.body)) {
    return next();
  }

  // Rule 1: only someone with the unblock capability may switch the gate off.
  if (!hasCapability(req.capabilities, CAPABILITIES.COMPLIANCE_UNBLOCK)) {
    recordDenial(
      req,
      { required: [CAPABILITIES.COMPLIANCE_UNBLOCK], attempted: 'UNBLOCK_CLOCK_IN' },
      'Caller may change compliance data but may not remove a clock-in block'
    );

    // This message is more specific than our usual one on purpose: it is not a
    // secret, and telling HR "ask an admin" is far more useful than a blank no.
    return next(
      new ErrorHandler(
        'Removing a clock-in block requires an administrator. Please ask an administrator to review this case.',
        403
      )
    );
  }

  // Rule 2: even an administrator must say WHY. The reason is stored in the
  // audit log (the service records the whole update), which is what makes the
  // override defensible if a labour inspector ever asks about it.
  const reason = typeof req.body.unblockReason === 'string' ? req.body.unblockReason.trim() : '';

  if (reason.length < MIN_REASON_LENGTH) {
    return next(
      new ErrorHandler(
        `A written reason of at least ${MIN_REASON_LENGTH} characters is required to remove a clock-in block (send it as "unblockReason").`,
        400
      )
    );
  }

  // Store the cleaned-up reason back on the request so everything downstream —
  // including the audit log entry — sees the trimmed text, not the raw input.
  req.body.unblockReason = reason;

  next();
};

module.exports = { guardUnblock, isUnblockAttempt, MIN_REASON_LENGTH };
