// Environment configuration loader for WorkPulse.
// Centralises all env var access so a missing variable is obvious at startup
// instead of failing deep inside a request. Mirrors the SafeWork config so the
// whole platform is configured the same way.
require('dotenv').config();

const config = {
  // WorkPulse backend listens on 8085 by default (see platform start.sh port map).
  port: parseInt(process.env.PORT, 10) || 8085,
  nodeEnv: process.env.NODE_ENV || 'development',

  mongo: {
    // Shares the platform database. WorkPulse reads `users` + `safework_employees`
    // and writes its own `workplus_*` collections into this same database.
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/safework',
  },

  cognito: {
    userPoolId: process.env.AWS_COGNITO_USER_POOL_ID,
    // The web app and the mobile app log in through DIFFERENT Cognito app
    // clients (each has its own client id) but share one user pool. Every token
    // carries its app-client id in the "aud" field and aws-jwt-verify rejects
    // any token whose id is not in our allow-list. So we accept a comma-separated
    // list here and turn it into a clean array. If only one id is given we pass a
    // plain string (what the library expected before) so nothing else breaks.
    clientId: (() => {
      const ids = (process.env.AWS_COGNITO_CLIENT_ID || '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
      return ids.length > 1 ? ids : ids[0];
    })(),
    tokenUse: process.env.AWS_COGNITO_TOKEN_USE || 'id',
  },

  // RegulaOne is the central identity service. WorkPulse asks it "who is this
  // logged-in user?" via GET /api/auth/me and uses the tenantId it returns as
  // the single source of truth for tenant isolation.
  regulaOne: {
    baseUrl: process.env.REGULAONE_API_URL || 'http://localhost:8080',
  },

  cors: {
    // Accept comma-separated origins so several frontends can share the API.
    origins: (process.env.CORS_ORIGIN || 'http://localhost:3005').split(','),
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  },

  // Cron jobs run inside the API process by default. Set ENABLE_CRON_JOBS=false
  // when running more than one instance so the jobs only fire on a single node.
  jobs: {
    enabled: (process.env.ENABLE_CRON_JOBS || 'true').toLowerCase() !== 'false',
  },
};

module.exports = config;
