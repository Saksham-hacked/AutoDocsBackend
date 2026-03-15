'use strict';

const { Router } = require('express');
const { fetchFileContent, fetchFileDiff } = require('../services/fileService');
const { createLogger } = require('../utils/logger');
const { config } = require('../config');

const router = Router();
const logger = createLogger('FileRoutes');

/**
 * Auth middleware — validates X-AUTODOCS-SECRET header.
 * These endpoints are only called by Layer 2 (Python), not by GitHub.
 */
function requireSecret(req, res, next) {
  const secret = req.headers['x-autodocs-secret'];
  if (!secret || secret !== config.pythonAI.sharedSecret) {
    logger.warn('Unauthorized file-content request', { ip: req.ip });
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

/**
 * GET /files/file-content
 * Query params: path, repo, owner, branch, installationId
 *
 * Called by Layer 2 (update_memory + generate_docs nodes) to fetch
 * the full source or doc file content.
 */
router.get('/file-content', requireSecret, async (req, res) => {
  const { path, repo, owner, branch, installationId } = req.query;

  if (!path || !repo || !owner || !branch || !installationId) {
    return res.status(400).json({ error: 'Missing required query params: path, repo, owner, branch, installationId' });
  }

  try {
    const content = await fetchFileContent({
      owner,
      repo,
      branch,
      path,
      installationId: parseInt(installationId, 10),
    });
    return res.json({ content });
  } catch (err) {
    logger.error('file-content endpoint error', { path, error: err.message });
    return res.status(500).json({ error: 'Failed to fetch file content' });
  }
});

/**
 * GET /files/file-diff
 * Query params: path, repo, owner, branch, commit_id, installationId
 *
 * Called by Layer 2 to get the unified diff for a specific file at a commit.
 */
router.get('/file-diff', requireSecret, async (req, res) => {
  const { path, repo, owner, branch, commit_id, installationId } = req.query;

  if (!path || !repo || !owner || !commit_id || !installationId) {
    return res.status(400).json({ error: 'Missing required query params: path, repo, owner, commit_id, installationId' });
  }

  try {
    const diff = await fetchFileDiff({
      owner,
      repo,
      path,
      commitId: commit_id,
      installationId: parseInt(installationId, 10),
    });
    return res.json({ diff });
  } catch (err) {
    logger.error('file-diff endpoint error', { path, error: err.message });
    return res.status(500).json({ error: 'Failed to fetch file diff' });
  }
});

module.exports = router;
