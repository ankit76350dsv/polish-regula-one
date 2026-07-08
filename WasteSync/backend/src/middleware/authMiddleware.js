const { CognitoJwtVerifier } = require('aws-jwt-verify');
const ErrorHandler = require('../utils/ErrorHandler');
const catchAsyncError = require('../utils/catchAsyncError');
const config = require('../config/environment');
const { User } = require('../models/User');

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

// Asks the central RegulaOne backend "who is this logged-in user?" by calling
// GET /api/auth/me. We forward the SAME credentials the client sent us — the
// shared cookie (normal browser path) and/or the Bearer token (Postman/mobile)
// — so RegulaOne identifies exactly the same user and returns the authoritative
// tenantId. Returns null on any failure so the caller can use the fallback.
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
    // Network error / RegulaOne down — let the caller use the local fallback.
    return null;
  }
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

  // ── Resolve the tenant id ONCE, here, for the whole request ────────────────
  // Single source of truth: ask RegulaOne /api/auth/me who this user is and use
  // the tenantId it returns. The frontend never sends a tenant id — the backend
  // always derives it from the authenticated session. This is what enforces
  // tenant isolation (a client can never request another tenant's data).
  const regulaUser = await fetchRegulaOneUser(req, token);
  req.regulaUser = regulaUser;
  // Prefer RegulaOne's tenantId; fall back to the local user document only if
  // the /me call failed, so a brief RegulaOne outage doesn't lock everyone out.
  req.tenantId = regulaUser?.tenantId || resolveTenantIdFromUser(user.tenant);

  next();
});

// Role guard. Use after isAuthenticatedUser to restrict an action to certain
// roles, e.g. authorizeRoles('ROLE_ADMIN').
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
