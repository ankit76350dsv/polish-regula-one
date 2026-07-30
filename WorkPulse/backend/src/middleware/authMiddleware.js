const { CognitoJwtVerifier } = require('aws-jwt-verify');
const ErrorHandler = require('../utils/ErrorHandler');
const catchAsyncError = require('../utils/catchAsyncError');
const config = require('../config/environment');
const { User } = require('../models/User');
const {
  ALLOWED_PERMISSIONS,
  normalizePermissions,
  hasAnyPermission,
  resolveCapabilities,
  hasCapability,
} = require('../config/permissions');
const { logAudit } = require('./auditLogger');

// Verifies Cognito access/id tokens. Same shared user pool as the rest of the
// RegulaOne platform, so a user who logged in on any app is recognised here too.
const cognitoVerifier = CognitoJwtVerifier.create({
  userPoolId: config.cognito.userPoolId,
  tokenUse: config.cognito.tokenUse,
  clientId: config.cognito.clientId,
});

// Pull the tenant id out of the local user document as a FALLBACK only.
// The Java RegulaOne backend stores tenant as a MongoDB DBRef
// ({ "$ref": "tenants", "$id": ObjectId("...") }), so a plain .toString()
// would give "[object Object]". This helper handles all three shapes and is
// only used if the call to RegulaOne /api/auth/me fails for some reason.
function resolveTenantIdFromUser(tenant) {
  if (!tenant) return undefined;
  if (tenant.$id) return tenant.$id.toString(); // DBRef — Java RegulaOne path
  if (tenant._id) return tenant._id.toString(); // populated Mongoose document
  return tenant.toString(); // plain ObjectId or string
}

// Asks the central RegulaOne backend "who is this logged-in user?" by calling
// GET /api/auth/me. We forward the SAME credentials the client sent us — the
// shared cookie (preferred) and/or the Bearer token — so RegulaOne identifies
// exactly the same user and returns the authoritative tenantId.
// Returns the user object or null on any failure, so the caller can fall back
// to the local user document.
async function fetchRegulaOneUser(req, token) {
  const headers = {};
  if (req.headers.cookie) headers.cookie = req.headers.cookie;
  if (token) headers.authorization = `Bearer ${token}`;

  try {
    const response = await fetch(`${config.regulaOne.baseUrl}/api/auth/me`, {
      method: 'GET',
      headers,
    });
    if (!response.ok) return null;

    const json = await response.json();
    // RegulaOne wraps responses as { success, message, data: UserResponse }.
    return json?.data?.user ?? json?.data ?? json;
  } catch (error) {
    // Network error / RegulaOne down — let the caller use the fallback.
    return null;
  }
}

// Find the login token for this request.
// We look in TWO places, in this order:
//   1. Browser cookies (preferred — HttpOnly, so XSS cannot read it).
//   2. "Authorization: Bearer <token>" header (backup, for Postman / mobile).
function getTokenFromRequest(req) {
  const cookies = req.cookies || {};

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

  // ── Resolve the tenant id ONCE, here, for the whole request ────────────────
  // Single source of truth: ask RegulaOne /api/auth/me who this user is and use
  // the tenantId it returns. The frontend never sends a tenant id — the backend
  // always derives it from the authenticated session. This is what enforces
  // tenant isolation (a client can never ask for another tenant's data).
  const regulaUser = await fetchRegulaOneUser(req, token);
  req.regulaUser = regulaUser;
  // Prefer RegulaOne's tenantId; fall back to the local user document only if
  // the /me call failed, so a transient RegulaOne outage doesn't lock everyone out.
  req.tenantId = regulaUser?.tenantId || resolveTenantIdFromUser(user.tenant);

  // ── Load the caller's permissions ONCE, here, for the whole request ─────────
  // RegulaOne is the ONLY system that knows what a user is allowed to do, so we
  // read the permission list from its /api/auth/me answer and clean it up (see
  // config/permissions.js). Every authorization check below reads this same list,
  // so one request can never be judged against two different sets.
  //
  // Deliberately NOT copied from the local WorkPulse user document: a stale local
  // copy could grant access the platform has already taken away.
  req.permissions = normalizePermissions(regulaUser?.permissions);

  // Turn those job titles into the exact list of things this person may DO
  // (for example CLOCK_SELF, TIME_CORRECT). The table that decides this lives in
  // config/permissions.js. Working it out once here keeps every route check a
  // simple, fast lookup over the same trusted data.
  req.capabilities = resolveCapabilities(req.permissions);

  next();
});

// ── Authorization: front door ────────────────────────────────────────────────
//
// "May you use WorkPulse at all?" — the caller must hold at least one recognised
// WORKPULSE_ role. Applied once per router with router.use(), so a new endpoint
// can never be left completely open by accident.
exports.authorizePermissions = (...allowed) => {
  // Work the required list out ONCE at start-up, not per request.
  const required = allowed.length ? normalizePermissions(allowed) : ALLOWED_PERMISSIONS;

  return (req, res, next) => {
    if (!req.user) {
      return next(new ErrorHandler('Please login to access this resource', 401));
    }

    // We could not reach RegulaOne, so we do not know this user's permissions.
    // We refuse ("fail closed") rather than assume they are allowed. 503, not 403,
    // so support staff can tell a real outage apart from a genuine refusal.
    if (!req.regulaUser) {
      return next(
        new ErrorHandler('Unable to verify your access rights right now. Please try again.', 503)
      );
    }

    if (!hasAnyPermission(req.permissions, required)) {
      recordDenial(req, { required }, 'Caller does not hold a WorkPulse role');
      // Kept general on purpose: telling a caller which permission they would
      // need helps an attacker map the system.
      return next(new ErrorHandler('You do not have permission to access this resource', 403));
    }

    next();
  };
};

// ── Authorization: capability based (per action) ──────────────────────────────
//
// This is the check every route should use. It asks about ONE ACTION, not about a
// job title:
//
//   router.post('/clock-in', authorizeCapability(CAPABILITIES.CLOCK_SELF), ...)
//   router.patch('/entries/:id/correct', authorizeCapability(CAPABILITIES.TIME_CORRECT), ...)
//
// Why not check the job title here? Because "is this an admin?" cannot express
// "an auditor may read every time record but must never change one". The table in
// config/permissions.js says which job title gets which actions, and this
// middleware only asks "was this action granted?". Changing what HR may do is then
// a one-line edit to that table, with no route files to hunt through.
//
// Passing more than one capability means "any ONE of these is enough".
exports.authorizeCapability = (...capabilities) => {
  const required = capabilities.filter(Boolean);

  // A route that asks for nothing would let everybody through — exactly the kind
  // of silent hole we are trying to prevent. Fail loudly at start-up instead.
  if (required.length === 0) {
    throw new Error('authorizeCapability() needs at least one capability');
  }

  return (req, res, next) => {
    if (!req.user) {
      return next(new ErrorHandler('Please login to access this resource', 401));
    }

    if (!req.regulaUser) {
      return next(
        new ErrorHandler('Unable to verify your access rights right now. Please try again.', 503)
      );
    }

    const allowed = required.some((capability) => hasCapability(req.capabilities, capability));

    if (!allowed) {
      recordDenial(req, { required }, 'Caller lacks the required capability');
      return next(new ErrorHandler('You do not have permission to perform this action', 403));
    }

    next();
  };
};

// Writes an audit record for a refused request.
//
// Every refusal is recorded: an audit trail of denied access is required for ISO
// 27001 / SOC2, and a burst of refusals is how you spot someone probing the API.
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
    resource: 'WorkPulseApi',
    resourceId: `${req.method} ${req.originalUrl}`,
    // Only NAMES are stored here — never tokens, locations or personal data.
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

// Exported so other middleware can record refusals in the same shape, keeping the
// audit trail consistent.
exports.recordDenial = recordDenial;

/**
 * DEPRECATED — do not use for new routes. Kept only so the old behaviour is
 * documented and nothing that still imports it breaks at start-up.
 *
 * Why it is no longer used: it authorises by ROLE, and a role is granted
 * platform-wide. Any ROLE_ADMIN of any module passed this check, even someone who
 * was never given WorkPulse — and ROLE_USER passed the self-service routes, so a
 * user of a completely different module could clock in here. Worse, a role cannot
 * express "an auditor may read every working-time record but change none".
 * Use authorizeCapability() above instead.
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
