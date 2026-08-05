const { CognitoJwtVerifier } = require('aws-jwt-verify');
const ErrorHandler = require('../utils/ErrorHandler');
const catchAsyncError = require('../utils/catchAsyncError');
const config = require('../config/environment');
const { User } = require('../models/User');
// Every call to the central RegulaOne backend goes through one small client, so
// credential forwarding and error handling are written once, not per caller.
const { fetchCurrentUser } = require('../services/regulaOneClient');
const {
  ALLOWED_PERMISSIONS,
  normalizePermissions,
  hasAnyPermission,
  resolveCapabilities,
  hasCapability,
} = require('../config/permissions');
const { logAudit } = require('./auditLogger');

// Build the Cognito token verifier once at startup. It checks that a token was
// really signed by our Cognito user pool and was issued for one of our app
// clients. WasteSync NEVER creates tokens — it only verifies the one RegulaOne
// already set in the shared cookie.
const cognitoVerifier = CognitoJwtVerifier.create({
  userPoolId: config.cognito.userPoolId,
  tokenUse: config.cognito.tokenUse,
  clientId: config.cognito.clientId,
});

// Fallback only: pull the tenant id out of the local WasteSync user document.
// The Java RegulaOne backend stores tenant as a MongoDB DBRef
// ({ "$ref": "tenants", "$id": ObjectId("...") }), so a plain .toString() would
// give "[object Object]". This handles all three possible shapes. We only use
// this if the live call to RegulaOne /api/auth/me fails for some reason.
function resolveTenantIdFromUser(tenant) {
  if (!tenant) return undefined;
  if (tenant.$id) return tenant.$id.toString(); // DBRef — Java RegulaOne path
  if (tenant._id) return tenant._id.toString(); // populated Mongoose document
  return tenant.toString(); // plain ObjectId or string
}

// Finds the login token for this request. We look in TWO places, in order:
//   1. The browser cookies (preferred — the token is sent automatically and is
//      never readable by frontend JavaScript, so XSS cannot steal it).
//   2. The "Authorization: Bearer <token>" header (backup, for non-browser).
function getTokenFromRequest(req) {
  const cookies = req.cookies || {};

  // Cognito may use an "id" token or an "access" token, so we prefer the
  // configured one and also accept a few common generic cookie names.
  const cookieOrder =
    config.cognito.tokenUse === 'access'
      ? ['accessToken', 'idToken', 'token', 'authToken']
      : ['idToken', 'accessToken', 'token', 'authToken'];

  for (const name of cookieOrder) {
    if (cookies[name]) {
      return cookies[name];
    }
  }

  if (req.headers.authorization?.startsWith('Bearer ')) {
    return req.headers.authorization.split(' ')[1];
  }

  return null;
}

// Main guard: every protected route runs through this. It proves the caller is
// a real, enabled user and works out which tenant they belong to.
exports.isAuthenticatedUser = catchAsyncError(async (req, res, next) => {
  const token = getTokenFromRequest(req);

  if (!token) {
    return next(new ErrorHandler('Please login to access this resource', 401));
  }

  let decoded;
  try {
    decoded = await cognitoVerifier.verify(token);
  } catch (error) {
    return next(new ErrorHandler('Invalid or expired authentication token', 401));
  }

  const cognitoSub = decoded.sub;
  const email = decoded.email;

  // Match the local user by their Cognito id first, then email as a backup.
  const user = await User.findOne({
    $or: [{ cognitoSub }, { email }],
  });

  if (!user) {
    return next(new ErrorHandler('User not found', 401));
  }

  if (!user.enabled) {
    return next(new ErrorHandler('User account is inactive', 403));
  }

  req.user = user;
  req.cognitoUser = decoded;

  // Keep the verified token on the request. Later handlers (for example the
  // company-profile endpoint, which asks RegulaOne for the tenant's details)
  // need to forward the caller's OWN credentials, and must never use a
  // service account that could reach across tenants.
  req.authToken = token;

  // ── Resolve the tenant id ONCE, here, for the whole request ────────────────
  // Single source of truth: ask RegulaOne /api/auth/me who this user is and use
  // the tenantId it returns. The frontend never sends a tenant id — the backend
  // always derives it from the authenticated session. This is what enforces
  // tenant isolation (a client can never request another tenant's data).
  const regulaUser = await fetchCurrentUser(req, token);
  req.regulaUser = regulaUser;
  // Prefer RegulaOne's tenantId; fall back to the local user document only if
  // the /me call failed, so a brief RegulaOne outage doesn't lock everyone out.
  req.tenantId = regulaUser?.tenantId || resolveTenantIdFromUser(user.tenant);

  // ── Load the caller's permissions ONCE, here, for the whole request ─────────
  // RegulaOne is the ONLY system that knows what a user is allowed to do, so we
  // read the permission list from its /api/auth/me answer and clean it up (see
  // config/permissions.js). Every later authorization check reads this list, so
  // a request can never be checked against a different or stale set.
  //
  // Note this is deliberately NOT copied from the local WasteSync user document:
  // a stale local copy could grant access the platform has already removed.
  req.permissions = normalizePermissions(regulaUser?.permissions);

  // Turn those job titles into the exact list of things this person may DO
  // (for example COMPANY_WRITE, REPORT_SUBMIT). The table that decides this
  // lives in config/permissions.js. We work it out once here so every route
  // check below is a simple, fast list lookup on the same trusted data.
  req.capabilities = resolveCapabilities(req.permissions);

  next();
});

// ── Authorization: permission based ──────────────────────────────────────────
//
// WHY THIS REPLACED THE OLD ROLE CHECK
// The old check (authorizeRoles, kept below) compared the user's platform ROLE —
// for example "ROLE_ADMIN" — against a list. A role is far too broad: every tenant
// admin on the whole platform has ROLE_ADMIN, including people who were never
// granted WasteSync at all. So a KSeFFlow-only admin could read and change this
// tenant's waste figures and its legal limits, which are the numbers the company
// files with a government register.
//
// RegulaOne now returns a per-module "permissions" list, which says exactly what a
// person was granted. We check that instead. Only the permissions listed in
// config/permissions.js get through; everything else is refused with 403.
//
// Usage:
//   authorizePermissions()                     -> the WasteSync list (normal case)
//   authorizePermissions('WASTESYNC_ADMIN')    -> narrow a single route further
exports.authorizePermissions = (...allowed) => {
  // Work the required list out ONCE when the server starts, not per request.
  // No arguments means "use the module-wide WasteSync list".
  const required = allowed.length ? normalizePermissions(allowed) : ALLOWED_PERMISSIONS;

  return (req, res, next) => {
    // Must run after isAuthenticatedUser. If it did not, we have no user and
    // cannot decide anything — refuse instead of guessing.
    if (!req.user) {
      return next(new ErrorHandler('Please login to access this resource', 401));
    }

    // We could not reach RegulaOne, so we do not know this user's permissions.
    // We refuse the request ("fail closed") rather than assume they are allowed.
    // 503 is used, not 403, so support staff can tell a real outage apart from a
    // genuine "you are not allowed" answer.
    if (!req.regulaUser) {
      return next(
        new ErrorHandler('Unable to verify your access rights right now. Please try again.', 503)
      );
    }

    const permitted = hasAnyPermission(req.permissions, required);

    if (!permitted) {
      recordDenial(req, { required }, 'Caller does not hold a WasteSync role');
      // The message stays general on purpose. Telling a caller which permission
      // they would need helps an attacker map the system.
      return next(
        new ErrorHandler('You do not have permission to access this resource', 403)
      );
    }

    next();
  };
};

// ── Authorization: capability based (per action) ──────────────────────────────
//
// This is the check every route should use. It asks about ONE ACTION, not about a
// job title:
//
//   router.get('/',           authorizeCapability(CAPABILITIES.COMPANY_READ), ...)
//   router.patch('/:id/submit', authorizeCapability(CAPABILITIES.REPORT_SUBMIT), ...)
//
// Why not check the job title here? Because "is this an admin?" cannot express
// "auditors may look but never change anything". The table in
// config/permissions.js says which job title gets which actions, and this
// middleware simply asks "was this action granted?". So changing what HR may do is
// a one-line edit to that table — no route file changes, nothing to miss.
//
// Passing more than one capability means "any ONE of these is enough".
exports.authorizeCapability = (...capabilities) => {
  const required = capabilities.filter(Boolean);

  // A route that asks for nothing would let everybody through, which is exactly
  // the kind of silent hole we are trying to prevent. Fail loudly at startup.
  if (required.length === 0) {
    throw new Error('authorizeCapability() needs at least one capability');
  }

  return (req, res, next) => {
    // Must run after isAuthenticatedUser.
    if (!req.user) {
      return next(new ErrorHandler('Please login to access this resource', 401));
    }

    // RegulaOne unreachable -> we do not know what this person may do, so we say
    // no. 503 (not 403) so an outage is not mistaken for a real refusal.
    if (!req.regulaUser) {
      return next(
        new ErrorHandler('Unable to verify your access rights right now. Please try again.', 503)
      );
    }

    const allowed = required.some((capability) => hasCapability(req.capabilities, capability));

    if (!allowed) {
      recordDenial(req, { required }, 'Caller lacks the required capability');
      return next(
        new ErrorHandler('You do not have permission to perform this action', 403)
      );
    }

    next();
  };
};

// Writes an audit record for a refused request.
//
// Every refusal is recorded because an audit trail of denied access is required
// for ISO 27001 / SOC2, and a burst of refusals is how you spot someone probing
// the API.
//
// We START the write but do NOT wait for it. logAudit handles its own errors and
// never throws, and waiting would let a slow database hold the "no" answer open —
// which someone could use to tie up the server on purpose. The refusal itself is
// what protects the data; this entry is the record of it.
function recordDenial(req, details, reason) {
  logAudit({
    tenantId: req.tenantId || 'UNKNOWN',
    userId: req.user?._id?.toString() || 'UNKNOWN',
    userEmail: req.user?.email,
    action: 'ACCESS_DENIED',
    resource: 'WasteSyncApi',
    resourceId: `${req.method} ${req.originalUrl}`,
    // Only NAMES are stored here — never tokens, files or personal data.
    newValue: {
      held: req.permissions,
      capabilities: req.capabilities,
      ...details,
    },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    success: false,
    errorMessage: reason,
  });
}

// Exported so other middleware records refusals in exactly the same shape,
// keeping the audit trail consistent.
exports.recordDenial = recordDenial;

/**
 * DEPRECATED — do not use for new routes. Kept only so the old behaviour is
 * documented and so nothing that still imports it breaks at startup.
 *
 * Why it is no longer used: it authorises by platform ROLE, and a role is granted
 * platform-wide. Any ROLE_ADMIN of any module passed this check, even without
 * WasteSync access, which is too wide for figures that are filed with a
 * government register. Use authorizeCapability() above instead — it checks the
 * per-action policy in config/permissions.js.
 */
exports.authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ErrorHandler('Please login to access this resource', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new ErrorHandler(
          `Role: ${req.user.role} is not allowed to access this resource`,
          403
        )
      );
    }

    next();
  };
};
