// Environment configuration loader.
// Centralises all env var access so missing vars are caught at startup, not at runtime.
require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT, 10) || 8080,
  nodeEnv: process.env.NODE_ENV || 'development',

  mongo: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/safework',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  cognito: {
    userPoolId: process.env.AWS_COGNITO_USER_POOL_ID,
    clientId: process.env.AWS_COGNITO_CLIENT_ID,
    tokenUse: process.env.AWS_COGNITO_TOKEN_USE || 'id'
  },

  cors: {
    // Accept comma-separated origins for multi-frontend support
    origins: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(','),
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  },
};

module.exports = config;
