'use strict';

const crypto = require('crypto');
const { config } = require('../config');
const { createLogger } = require('../utils/logger');

const logger = createLogger('WebhookVerifier');

/**
 * Express middleware that verifies the GitHub webhook HMAC-SHA256 signature.
 * GitHub sends the signature in the `x-hub-signature-256` header.
 *
 * IMPORTANT: This middleware must be mounted BEFORE express.json() on the
 * webhook route so that it has access to the raw request body buffer.
 * We achieve this by using express.raw() only on the webhook route.
 */
function githubWebhookVerifier(req, res, next) {
  const signature = req.headers['x-hub-signature-256'];

  if (!signature) {
    logger.warn('Request rejected — missing x-hub-signature-256 header', {
      ip: req.ip,
    });
    return res.status(401).json({ error: 'Missing webhook signature' });
  }

  if (!signature.startsWith('sha256=')) {
    logger.warn('Request rejected — malformed signature header', { signature });
    return res.status(401).json({ error: 'Malformed webhook signature' });
  }

  // req.body here is a raw Buffer (we mount express.raw() on this route)
  const rawBody = req.body;

  if (!Buffer.isBuffer(rawBody)) {
    logger.error('Raw body is not a Buffer — ensure express.raw() is used on this route');
    return res.status(500).json({ error: 'Internal server error: body parsing misconfiguration' });
  }

  const expectedSignature =
    'sha256=' +
    crypto
      .createHmac('sha256', config.github.webhookSecret)
      .update(rawBody)
      .digest('hex');

  const trusted = Buffer.from(expectedSignature, 'utf8');
  const provided = Buffer.from(signature, 'utf8');

  // Constant-time comparison to prevent timing attacks
  if (trusted.length !== provided.length || !crypto.timingSafeEqual(trusted, provided)) {
    logger.warn('Request rejected — invalid webhook signature', {
      ip: req.ip,
      provided: signature.substring(0, 20) + '...',
    });
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  // Attach parsed body for downstream handlers
  try {
    req.webhookPayload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    logger.error('Failed to parse webhook JSON body after signature verification');
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  logger.debug('Webhook signature verified successfully');
  next();
}

module.exports = { githubWebhookVerifier };
