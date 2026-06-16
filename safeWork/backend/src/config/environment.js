// Environment configuration loader.
// Centralises all env var access so missing vars are caught at startup, not at runtime.
require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT, 10) || 8082,
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

  // RegulaOne is the central auth service. SafeWork asks it "who is this user?"
  // by calling GET /api/auth/me, which returns the user's tenantId. We use that
  // as the single source of truth for tenant isolation.
  regulaOne: {
    baseUrl: process.env.REGULAONE_API_URL || 'http://localhost:8080',
  },

  cors: {
    // Accept comma-separated origins for multi-frontend support
    origins: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(','),
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  },

  // AWS S3 — used for storing compliance documents (medical certs, BHP certs)
  s3: {
    region:     process.env.AWS_REGION       || 'eu-central-1',
    bucketName: process.env.AWS_S3_BUCKET    || '',
    // Credentials are picked up automatically from env vars or EC2 instance role
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  },
};

module.exports = config;
