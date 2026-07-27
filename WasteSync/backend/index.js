// WasteSync Express application entry point.
//
// Auth (login/logout/me) is owned by the central RegulaOne backend on port 8080.
// This service runs on port 8083 and owns: companies, monthly waste entries,
// annual report generation (XML + PDF), dashboard, and the audit trail.

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const config = require('./src/config/environment');
const connectDB = require('./src/config/database');
const { apiLimiter } = require('./src/middleware/rateLimiter');
const { errorHandler, notFoundHandler } = require('./src/middleware/errorHandler');

// Route modules. Login routes are intentionally absent — RegulaOne owns auth.
const authRoutes = require('./src/routes/authRoutes');
const companyRoutes = require('./src/routes/companyRoutes');
const wasteEntryRoutes = require('./src/routes/wasteEntryRoutes');
const reportRoutes = require('./src/routes/reportRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const auditRoutes = require('./src/routes/auditRoutes');
const thresholdRoutes = require('./src/routes/thresholdRoutes');

const app = express();

// ─── Security middleware ────────────────────────────────────────────────────
// Helmet sets a range of secure HTTP headers (XSS, clickjacking, etc.).
app.use(helmet());

// CORS — only our known frontends may call the API, and they may send cookies.
app.use(
  cors({
    origin: config.cors.origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─── Request parsing ──────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Logging ──────────────────────────────────────────────────────────────────
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));

// ─── Rate limiting ──────────────────────────────────────────────────────────────
app.use('/api', apiLimiter);

// ─── Health check — no auth required ─────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'wastesync-backend',
    port: config.port,
    timestamp: new Date().toISOString(),
  });
});

// ─── API routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/waste-entries', wasteEntryRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/thresholds', thresholdRoutes);

// ─── Error handling — must be registered AFTER all routes ─────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ─── Bootstrap ──────────────────────────────────────────────────────────────────
const start = async () => {
  await connectDB();
  app.listen(config.port, () => {
    console.log(`[APP] WasteSync backend running on port ${config.port} (${config.nodeEnv})`);
    console.log(`[APP] Health: http://localhost:${config.port}/health`);
    console.log('[APP] Auth is served by RegulaOne at http://localhost:8080');
  });
};

start();
