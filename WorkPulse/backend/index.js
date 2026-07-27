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
const connectDB = require('./src/config/database');
const { apiLimiter } = require('./src/middleware/rateLimiter');
const { errorHandler, notFoundHandler } = require('./src/middleware/errorHandler');
const { registerJobs } = require('./src/jobs');

// Route modules — auth is verified locally but LOGIN is owned by RegulaOne.
const authRoutes = require('./src/routes/authRoutes');
const timeRoutes = require('./src/routes/timeRoutes');
const policyRoutes = require('./src/routes/policyRoutes');
const absenceRoutes = require('./src/routes/absenceRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const auditRoutes = require('./src/routes/auditRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');

const app = express();

// ─── Security middleware ─────────────────────────────────────────────────────
app.use(helmet());

app.use(
  cors({
    origin: config.cors.origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

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
app.use('/api/absences', absenceRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/notifications', notificationRoutes);

// ─── Error handling — must be registered after all routes ────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ─── Bootstrap ───────────────────────────────────────────────────────────────
const start = async () => {
  await connectDB();

  // Start the scheduled compliance jobs (break / open-break / missing clock-out).
  registerJobs();

  app.listen(config.port, () => {
    console.log(`[APP] WorkPulse backend running on port ${config.port} (${config.nodeEnv})`);
    console.log(`[APP] Health: http://localhost:${config.port}/health`);
    console.log(`[APP] Auth is served by RegulaOne at ${config.regulaOne.baseUrl}`);
  });
};

start();
