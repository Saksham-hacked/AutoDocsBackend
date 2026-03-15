'use strict';

const { Router } = require('express');
const { handleGitHubWebhook } = require('../controllers/webhookController');
const { githubWebhookVerifier } = require('../middleware/githubWebhookVerifier');

const router = Router();

/**
 * POST /webhook/github
 *
 * We use express.raw() here (not express.json()) so the verifier
 * middleware receives the raw Buffer needed for HMAC verification.
 * The verifier parses JSON itself and attaches req.webhookPayload.
 */
router.post(
  '/github',
  require('express').raw({ type: 'application/json' }),
  githubWebhookVerifier,
  handleGitHubWebhook
);

module.exports = router;
