// SafeWork Express application entry point.
// Auth (login/logout/me) is handled by the RegulaOne backend on port 8080.
// This service runs on port 3001 and owns: employee compliance profiles, dashboard.

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

// Route modules — auth routes removed; RegulaOne owns authentication
const adminRoutes = require('./src/routes/adminRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const authRoutes = require('./src/routes/authRoutes');

// Scheduled jobs (daily certificate-expiry refresh).
const { registerJobs } = require('./src/jobs');

const app = express();

// ─── Security middleware ───────────────────────────────────────────────────────
app.use(helmet());

// Which browsers may call this API. The rule lives in one place because it decides who can
// act as a signed-in user — see src/config/corsOptions.js for what is allowed and why.
app.use(cors(corsOptions));

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
// Find this computer's address on the local network (for example 192.168.x.y) so the
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
  // Start the scheduled jobs once the DB is connected.
  registerJobs();
  // bindHost is 0.0.0.0 by default: answer on every network connection, so the API works
  // both on this computer and from other devices on the same network. start.sh was already
  // passing BIND_HOST, but nothing read it until now.
  app.listen(config.port, config.bindHost, () => {
    console.log(`[APP] SafeWork backend running on ${config.bindHost}:${config.port} (${config.nodeEnv})`);
    console.log(`[APP] Health: http://localhost:${config.port}/health`);

    // Print the network address too, so it can be copied to a teammate without hunting for
    // it in system settings.
    const lanIp = detectLanIp();
    if (lanIp) {
      console.log(`[APP] On this network: http://${lanIp}:${config.port}/health`);
      console.log(`[APP] Team opens the app at: http://${lanIp}:3002`);
    }

    console.log(`[APP] Auth is served by RegulaOne at http://localhost:8080`);
  });
};

start();
