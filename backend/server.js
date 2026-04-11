require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const logger = require('./utils/logger');
const authRoutes = require('./routes/auth');
const instagramRoutes = require('./routes/instagram');
const automationRoutes = require('./routes/automations');
const dashboardRoutes = require('./routes/dashboard');
const webhookRouter = require('./webhooks/instagram');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Security Middleware ──────────────────────────────────────────────────────
app.use(helmet());

// ── CORS — allow production + localhost ────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://chatiq.yosipo.com',
  'http://localhost:3000',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, health checks)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    logger.warn(`CORS blocked origin: ${origin}`);
    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
}));

// ── Rate Limiting ────────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', apiLimiter);

// Webhook needs raw body for signature validation
app.use('/webhook', express.raw({ type: 'application/json' }));

// ── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Logging ──────────────────────────────────────────────────────────────────
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

// ── Root Route ────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    message: 'ChatIQ API running',
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// ── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/webhook', webhookRouter);
app.use('/api/auth', authRoutes);
app.use('/api/instagram', instagramRoutes);
app.use('/api/automations', automationRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// ── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`🚀 ChatIQ Backend running on port ${PORT}`);
  logger.info(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`📡 Frontend URL: ${process.env.FRONTEND_URL}`);
  logger.info(`📡 Allowed CORS origins: ${allowedOrigins.join(', ')}`);
  logger.info(`📡 Webhook endpoint: /webhook/instagram`);
});

module.exports = app;
