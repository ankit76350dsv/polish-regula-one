const { CognitoJwtVerifier } = require('aws-jwt-verify');
const ErrorHandler = require('../utils/ErrorHandler');
const catchAsyncError = require('../utils/catchAsyncError');
const config = require('../config/environment');
const { User } = require('../models/User');
const cognitoVerifier = CognitoJwtVerifier.create({
  userPoolId: config.cognito.userPoolId,
  tokenUse: config.cognito.tokenUse,
  clientId: config.cognito.clientId
});

// Find the login token for this request.
// We look in TWO places, in this exact order:
//   1. The browser cookies (preferred — the token is sent automatically and
//      is never read by frontend JavaScript, so it cannot be stolen by XSS).
//   2. The "Authorization: Bearer <token>" header (only used as a backup).
// If we cannot find a token in either place, we return null and the caller
// will send back a "please login" error.
// Fallback only: pull the tenant id out of the local SafeWork user document.
// The Java RegulaOne backend stores tenant as a MongoDB DBRef
// ({ "$ref": "tenants", "$id": ObjectId("...") }), so a plain .toString()
// would give "[object Object]". This handles all three shapes. We only use
// this if the call to RegulaOne /api/auth/me fails for some reason.
function resolveTenantIdFromUser(tenant) {
  if (!tenant) return undefined;
  if (tenant.$id) return tenant.$id.toString();   // DBRef — Java RegulaOne path
  if (tenant._id) return tenant._id.toString();    // populated Mongoose document
  return tenant.toString();                         // plain ObjectId or string
}

// Asks the central RegulaOne backend "who is this logged-in user?" by calling
// GET /api/auth/me. We forward the SAME credentials the client sent us — the
// shared cookie (preferred) and/or the Bearer token — so RegulaOne identifies
// exactly the same user. The response includes the authoritative tenantId.
//
// Returns the user object ({ id, email, role, tenantId, ... }) or null on any
// failure, so the caller can fall back to the local user document.
async function fetchRegulaOneUser(req, token) {
  const headers = {};
  // Forward the shared auth cookie if present (this is the normal browser path).
  if (req.headers.cookie) headers.cookie = req.headers.cookie;
  // Also forward the Bearer token for non-browser clients (Postman, mobile).
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

function getTokenFromRequest(req) {
  const cookies = req.cookies || {};

  // List of cookie names we will accept, in order of preference.
  // Cognito can use either an "id" token or an "access" token, so we put the
  // configured one first. We also accept a few common generic names so the
  // token is still found no matter what the login service named the cookie.
  const cookieOrder =
    config.cognito.tokenUse === 'access'
      ? ['accessToken', 'idToken', 'token', 'authToken']
      : ['idToken', 'accessToken', 'token', 'authToken'];

  // Step 1: try to read the token from the cookies first.
  for (const name of cookieOrder) {
    if (cookies[name]) {
      return cookies[name];
    }
  }

  console.log("Hii.... ", req.headers.authorization.split(' ')[1]);
  // Step 2: no cookie found — fall back to the Authorization Bearer header.
  if (req.headers.authorization?.startsWith('Bearer ')) {
    return req.headers.authorization.split(' ')[1];
  }

  // Step 3: nothing found in cookies or header.
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
    $or: [
      { cognitoSub },
      { email }
    ]
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
  // the tenantId it returns. The frontend never sends a tenant id anymore — the
  // backend always derives it from the authenticated session. This is what
  // enforces tenant isolation (a client can never ask for another tenant's data).
  const regulaUser = await fetchRegulaOneUser(req, token);
  req.regulaUser = regulaUser;
  // Prefer RegulaOne's tenantId; fall back to the local user document only if
  // the /me call failed, so a transient RegulaOne outage doesn't lock everyone out.
  req.tenantId = regulaUser?.tenantId || resolveTenantIdFromUser(user.tenant);

  next();
});

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