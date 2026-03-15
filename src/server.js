'use strict';

require('dotenv').config();

const express = require('express');
const { config, validateConfig } = require('./config');
const { createLogger } = require('./utils/logger');
const webhookRouter = require('./routes/webhook');
const filesRouter   = require('./routes/files');

const logger = createLogger('Server');

// ── Validate environment on startup ─────────────────────────────────────────
try {
  validateConfig();
} catch (err) {
  console.error(`[FATAL] Configuration error: ${err.message}`);
  process.exit(1);
}

// ── Express app setup ────────────────────────────────────────────────────────
const app = express();

// Global JSON middleware — explicitly excluded from webhook route which uses express.raw()
app.use((req, res, next) => {
  if (req.path.startsWith('/webhook')) return next();
  express.json({ limit: '10mb' })(req, res, next);
});

// ── Routes ───────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.status(200).json({
    service: 'AutoDocs Integration Layer',
    status: 'running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.use('/webhook', webhookRouter);
app.use('/files', filesRouter);

// ── 404 handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Global error handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error('Unhandled express error', { message: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start server ─────────────────────────────────────────────────────────────
const server = app.listen(config.port, () => {
  logger.info(`AutoDocs Integration Layer started`, {
    port: config.port,
    env: config.nodeEnv,
    pythonAI: config.pythonAI.baseUrl,
  });
});

// ── Graceful shutdown ────────────────────────────────────────────────────────
function shutdown(signal) {
  logger.info(`Received ${signal} — shutting down gracefully`);
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  // Force exit if server hasn't closed within 10s
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { message: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: String(reason) });
});

module.exports = app;
