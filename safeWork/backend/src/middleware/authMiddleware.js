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

function getTokenFromRequest(req) {
  const { idToken, accessToken } = req.cookies || {};

  let token = null;

  if (config.cognito.tokenUse === 'access') {
    token = accessToken || idToken;
  } else {
    token = idToken || accessToken;
  }

  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  return token;
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