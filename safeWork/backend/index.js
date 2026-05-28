// SafeWork Express application entry point.
// Wires together all middleware, routes, and database connection.

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const config = require('./src/config/environment');
const connectDB = require('./src/config/database');
const { apiLimiter } = require('./src/middleware/rateLimiter');
const { errorHandler, notFoundHandler } = require('./src/middleware/errorHandler');

// Route modules
const authRoutes = require('./src/routes/authRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');

const app = express();

// ─── Security middleware ───────────────────────────────────────────────────────
// helmet sets secure HTTP headers (XSS protection, no sniff, etc.)
app.use(helmet());

// CORS — only allow configured origins to prevent unintended cross-origin access
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

// ─── Logging ──────────────────────────────────────────────────────────────────
// Use concise 'dev' format in development, 'combined' (Apache format) in production
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));

// ─── Rate limiting ────────────────────────────────────────────────────────────
app.use('/api', apiLimiter);

// ─── Health check — no auth required ─────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'safework-backend', timestamp: new Date().toISOString() });
});

// ─── API routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ─── Error handling — must be registered after all routes ─────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ─── Bootstrap ────────────────────────────────────────────────────────────────
const start = async () => {
  await connectDB();
  app.listen(config.port, () => {
    console.log(`[APP] SafeWork backend running on port ${config.port} (${config.nodeEnv})`);
    console.log(`[APP] Health check: http://localhost:${config.port}/health`);
  });
};

start();
