// Environment configuration loader.
// Centralises all env var access so missing vars are caught at startup, not at runtime.
require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT, 10) || 8082,

  // Which network connections to answer on. 0.0.0.0 means "all of them", so the API can be
  // reached both as http://localhost:8082 and as http://<machine-ip>:8082 by the rest of the
  // team. Set BIND_HOST=127.0.0.1 to keep it private to this computer.
  bindHost: process.env.BIND_HOST || '0.0.0.0',

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
    // The web app and the Flutter mobile app log in through DIFFERENT Cognito
    // "app clients" (each has its own client id), even though they share the
    // same user pool. Every token carries its app client id in the "aud" field,
    // and aws-jwt-verify rejects the token if that id is not in our allow-list.
    // So we accept a COMMA-SEPARATED list of client ids here. Example:
    //   AWS_COGNITO_CLIENT_ID=webClientId,mobileClientId
    // We turn that text into a clean list. If only one id is given we pass a
    // plain string (what the library expected before), so nothing else breaks.
    clientId: (() => {
      const ids = (process.env.AWS_COGNITO_CLIENT_ID || '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
      return ids.length > 1 ? ids : ids[0];
    })(),
    tokenUse: process.env.AWS_COGNITO_TOKEN_USE || 'id'
  },

  // RegulaOne is the central auth service. SafeWork asks it "who is this user?"
  // by calling GET /api/auth/me, which returns the user's tenantId. We use that
  // as the single source of truth for tenant isolation.
  regulaOne: {
    // Two spellings of this variable exist in older .env files
    // (REGULAONE_API_URL and REGULA_ONE_API_URL). We accept BOTH so an existing
    // deployment keeps working after this change. This matters a lot now: the
    // user's permissions are read from RegulaOne, so if this address is wrong we
    // cannot check permissions and every request is refused.
    baseUrl:
      process.env.REGULAONE_API_URL ||
      process.env.REGULA_ONE_API_URL ||
      'http://localhost:8080',
  },

  // SafeWork access rules.
  //
  // The central RegulaOne login tells us what a user is allowed to do by
  // returning a "permissions" list (see config/permissions.js). Only the
  // permissions named here may call SafeWork APIs — everyone else is refused.
  //
  // Kept as configuration (not hard-coded in the routes) so the list can change
  // per environment, and so the platform can rename a permission without a code
  // change. Comma-separated, for example:
  //   SAFEWORK_ALLOWED_PERMISSIONS=SAFEVOICE_ADMIN,SAFEVOICE_HR_MANAGER
  safework: {
    allowedPermissions: (
      process.env.SAFEWORK_ALLOWED_PERMISSIONS ||
      'SAFEWORK_ADMIN,SAFEWORK_HR_MANAGER,SAFEWORK_AUDITOR'
    )
      .split(',')
      .map((permission) => permission.trim())
      .filter(Boolean),
  },

  cors: {
    // Accept comma-separated origins for multi-frontend support.
    //
    // The fallback used to be http://localhost:5173 — Vite's out-of-the-box port, which
    // SafeWork does not use. So if CORS_ORIGIN was ever missing, the API allowed a port
    // nothing runs on and refused the SafeWork frontend on 3002. The fallback is now the
    // port this module actually uses (see the platform start.sh port map).
    //
    // Entries are trimmed and blanks dropped, so a stray space or trailing comma in the
    // .env file cannot create an origin that matches nothing.
    origins: (process.env.CORS_ORIGIN || 'http://localhost:3002')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),

    // While developing, also accept the SAME port on this computer or on a private
    // office/home network, so a teammate opening http://<machine-ip>:3002 is not refused.
    // Off in production, where the list above is the only answer. See config/corsOptions.js.
    allowPrivateNetwork: (process.env.NODE_ENV || 'development') !== 'production',
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
