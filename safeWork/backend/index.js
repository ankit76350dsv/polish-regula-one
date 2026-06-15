// SafeWork Express application entry point.
// Auth (login/logout/me) is handled by the RegulaOne backend on port 8080.
// This service runs on port 3001 and owns: employee compliance profiles, dashboard.

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const config = require('./src/config/environment');
const connectDB = require('./src/config/database');
const { apiLimiter } = require('./src/middleware/rateLimiter');
const { errorHandler, notFoundHandler } = require('./src/middleware/errorHandler');

// Route modules — auth routes removed; RegulaOne owns authentication
const adminRoutes = require('./src/routes/adminRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const authRoutes = require('./src/routes/authRoutes');

const app = express();

// ─── Security middleware ───────────────────────────────────────────────────────
app.use(helmet());

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

// ─── Rate limiting ────────────────────────────────────────────────────────────
app.use('/api', apiLimiter);

// ─── Health check — no auth required ─────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'safework-backend', port: config.port, timestamp: new Date().toISOString() });
});

// ─── API routes ───────────────────────────────────────────────────────────────
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use('/api/auth', authRoutes);



// ─── Error handling — must be registered after all routes ─────────────────────
app.use(notFoundHandler);
app.use(errorHandler);










// ─── Bootstrap ────────────────────────────────────────────────────────────────
const start = async () => {
  await connectDB();
  app.listen(config.port, () => {
    console.log(`[APP] SafeWork backend running on port ${config.port} (${config.nodeEnv})`);
    console.log(`[APP] Health: http://localhost:${config.port}/health`);
    console.log(`[APP] Auth is served by RegulaOne at http://localhost:8080`);
  });
};

start();
