// Environment configuration loader.
// We read every environment variable in ONE place so that the rest of the code
// never touches process.env directly. This makes missing settings easy to spot
// and keeps secrets out of the business logic.
require('dotenv').config();

const config = {
  // The network port the server listens on. SafeWork uses 8082, so WasteSync
  // uses 8083 to avoid a clash when both backends run on the same machine.
  port: parseInt(process.env.PORT, 10) || 8083,
  nodeEnv: process.env.NODE_ENV || 'development',

  mongo: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/wastesync',
  },

  // AWS Cognito settings. The login token is a Cognito JWT that RegulaOne sets
  // in a shared cookie. WasteSync only VERIFIES this token — it never creates one.
  cognito: {
    userPoolId: process.env.AWS_COGNITO_USER_POOL_ID,
    // The web app and the mobile app log in through DIFFERENT Cognito "app
    // clients" (each has its own client id) but share one user pool. Every token
    // carries its client id in the "aud" field, and aws-jwt-verify rejects any
    // token whose id is not in our allow-list. So we accept a COMMA-SEPARATED
    // list. If only one id is given we pass a plain string (what the library
    // originally expected), so nothing else breaks.
    clientId: (() => {
      const ids = (process.env.AWS_COGNITO_CLIENT_ID || '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
      return ids.length > 1 ? ids : ids[0];
    })(),
    tokenUse: process.env.AWS_COGNITO_TOKEN_USE || 'id',
  },

  // RegulaOne is the central auth service. WasteSync asks it "who is this user?"
  // by calling GET /api/auth/me, which returns the user's tenantId. We use that
  // as the single source of truth for tenant isolation.
  regulaOne: {
    baseUrl: process.env.REGULAONE_API_URL || 'http://localhost:8080',
  },

  cors: {
    // Accept a comma-separated list of origins so several frontends can connect.
    origins: (process.env.CORS_ORIGIN || 'http://localhost:3003').split(','),
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  },

  // AWS S3 — used for storing generated XML + PDF reports.
  // The region MUST stay inside the EEA (Frankfurt) for GDPR / RODO compliance.
  s3: {
    region: process.env.AWS_REGION || 'eu-central-1',
    bucketName: process.env.AWS_S3_BUCKET || '',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
};

module.exports = config;
