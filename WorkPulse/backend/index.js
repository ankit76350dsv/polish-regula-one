// WorkPulse Express application entry point.
//
// WorkPulse is the working-time evidence module of the RegulaOne platform. It
// records clock-in/out, breaks, overtime and absences, and enforces Polish
// Labour Code rules (breaks, overtime vs the daily norm, daily/weekly rest).
//
// Auth is handled centrally by RegulaOne (:8080), exactly like SafeWork:
// WorkPulse verifies the shared Cognito cookie and asks RegulaOne /api/auth/me
// for the authoritative tenantId. This service runs on port 8085.

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const config = require('./src/config/environment');
const corsOptions = require('./src/config/corsOptions');
const connectDB = require('./src/config/database');
const { apiLimiter } = require('./src/middleware/rateLimiter');
const { errorHandler, notFoundHandler } = require('./src/middleware/errorHandler');
const { registerJobs } = require('./src/jobs');

// Route modules — auth is verified locally but LOGIN is owned by RegulaOne.
const authRoutes = require('./src/routes/authRoutes');
const timeRoutes = require('./src/routes/timeRoutes');
const policyRoutes = require('./src/routes/policyRoutes');
const settlementRoutes = require('./src/routes/settlementRoutes');
const monitoringRoutes = require('./src/routes/monitoringRoutes');
const employeeProfileRoutes = require('./src/routes/employeeProfileRoutes');
const absenceRoutes = require('./src/routes/absenceRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const auditRoutes = require('./src/routes/auditRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');

const app = express();

// ─── Security middleware ─────────────────────────────────────────────────────
app.use(helmet());

// Which browsers may call this API. The rule lives in one place because it decides who can
// act as a signed-in user — see src/config/corsOptions.js for what is allowed and why.
app.use(cors(corsOptions));

// ─── Request parsing ─────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Logging ─────────────────────────────────────────────────────────────────
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));

// ─── Rate limiting ───────────────────────────────────────────────────────────
app.use('/api', apiLimiter);

// ─── Health check — no auth required ─────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'workpulse-backend',
    port: config.port,
    timestamp: new Date().toISOString(),
  });
});

// ─── API routes ──────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/time', timeRoutes);
app.use('/api/policy', policyRoutes);
app.use('/api/settlement', settlementRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/employee-profiles', employeeProfileRoutes);
app.use('/api/absences', absenceRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/notifications', notificationRoutes);

// ─── Error handling — must be registered after all routes ────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ─── Bootstrap ───────────────────────────────────────────────────────────────

// Find this computer's address on the local network (for example 192.168.20.38) so the
// startup message can show a link that works from other devices. We skip the internal
// loopback address, anything that is not IPv4, and the 169.254.x.x range a computer invents
// for itself when there is no network. Returns an empty string when there is nothing to show.
const detectLanIp = () => {
  const interfaces = require('os').networkInterfaces();
  for (const addresses of Object.values(interfaces)) {
    for (const address of addresses || []) {
      const isIPv4 = address.family === 'IPv4' || address.family === 4;
      if (isIPv4 && !address.internal && !address.address.startsWith('169.254.')) {
        return address.address;
      }
    }
  }
  return '';
};

const start = async () => {
  await connectDB();

  // Start the scheduled compliance jobs (break / open-break / missing clock-out).
  registerJobs();

  // bindHost is 0.0.0.0 by default: answer on every network connection, so the API works
  // both on this computer and from other devices on the same network.
  app.listen(config.port, config.bindHost, () => {
    console.log(`[APP] WorkPulse backend running on ${config.bindHost}:${config.port} (${config.nodeEnv})`);
    console.log(`[APP] Health: http://localhost:${config.port}/health`);

    // Print the network address too, so it can be copied to a teammate without hunting for
    // it in system settings.
    const lanIp = detectLanIp();
    if (lanIp) {
      console.log(`[APP] On this network: http://${lanIp}:${config.port}/health`);
      console.log(`[APP] Team opens the app at: http://${lanIp}:3005`);
    }

    console.log(`[APP] Auth is served by RegulaOne at ${config.regulaOne.baseUrl}`);
  });
};

start();
