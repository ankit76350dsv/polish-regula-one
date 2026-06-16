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