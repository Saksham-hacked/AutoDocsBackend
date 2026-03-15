'use strict';

const { sendRepoChangeToAI } = require('../services/aiService');
const { createDocumentationPR } = require('../services/prService');
const { fetchAllDiffs } = require('../services/fileService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('WebhookController');

/**
 * Handles incoming GitHub webhook events.
 *
 * Only processes `push` events. All other events are acknowledged
 * and ignored gracefully.
 */
async function handleGitHubWebhook(req, res) {
  const event = req.headers['x-github-event'];
  const deliveryId = req.headers['x-github-delivery'];
  const payload = req.webhookPayload; // set by githubWebhookVerifier

  logger.info('Webhook received', { event, deliveryId });

  // Acknowledge receipt immediately — GitHub expects a fast response
  res.status(200).json({ received: true, event, deliveryId });

  // Only handle push events
  if (event !== 'push') {
    logger.debug('Ignoring non-push event', { event });
    return;
  }

  // Ignore pushes to AutoDocs' own branches to prevent feedback loops
  const branch = payload.ref?.replace('refs/heads/', '');
  if (branch?.startsWith('autodocs/')) {
    logger.debug('Ignoring push to AutoDocs branch', { branch });
    return;
  }

  // Ignore merge commits and AutoDocs-generated commits
  const commitMessage = payload.head_commit?.message || '';
  const isAutoDocsCommit = commitMessage.startsWith('docs: update') && commitMessage.includes('via AutoDocs');
  const isMergeCommit = commitMessage.startsWith('Merge pull request') || commitMessage.startsWith('Merge branch');
  if (isAutoDocsCommit || isMergeCommit) {
    logger.debug('Ignoring merge or AutoDocs-generated commit', { commitMessage: commitMessage.substring(0, 80) });
    return;
  }

  // Process asynchronously so we don't block the response
  processPushEvent(payload, deliveryId).catch((err) => {
    logger.error('Unhandled error in push event processing', {
      deliveryId,
      message: err.message,
      stack: err.stack,
    });
  });
}

/**
 * Core push-event processing pipeline.
 *
 * @param {object} payload  Parsed GitHub webhook payload
 * @param {string} deliveryId  Delivery ID for tracing
 */
async function processPushEvent(payload, deliveryId) {
  // ── Step 1: Extract context from payload ──────────────────────────────────
  const repo = payload.repository?.name;
  const owner = payload.repository?.owner?.login;
  const branch = payload.ref?.replace('refs/heads/', '');
  const installationId = payload.installation?.id;
  const commitMessage = payload.head_commit?.message || '';
  const commitId = payload.after || payload.head_commit?.id || '';

  // Collect unique changed file paths from all commits in the push
  const changedFilesSet = new Set();
  for (const commit of payload.commits || []) {
    [...(commit.added || []), ...(commit.modified || []), ...(commit.removed || [])].forEach((f) =>
      changedFilesSet.add(f)
    );
  }
  // Exclude AutoDocs-managed doc files — Layer 2 should not summarise its own output
  const DOC_PATHS = /^docs\//;
  const changedFiles = Array.from(changedFilesSet).filter((f) => !DOC_PATHS.test(f));

  if (!repo || !owner || !branch || !installationId) {
    logger.warn('Push payload is missing critical fields — skipping', {
      deliveryId,
      repo,
      owner,
      branch,
      installationId,
    });
    return;
  }

  logger.info('Push received', {
    owner,
    repo,
    branch,
    commitId: commitId.substring(0, 8),
    changedFiles: changedFiles.length,
    commitMessage: commitMessage.substring(0, 80),
  });

  // ── Step 2: Fetch diffs for all changed files ──────────────────────────────
  let diffs = {};
  try {
    diffs = await fetchAllDiffs({ owner, repo, commitId, changedFiles, installationId });
    logger.info('Diffs fetched', { owner, repo, commitId, count: Object.keys(diffs).length });
  } catch (err) {
    logger.warn('Could not fetch diffs — proceeding without them', { error: err.message });
  }

  // ── Step 3: Send to AI service ────────────────────────────────────────────
  const aiResponse = await sendRepoChangeToAI({
    repo,
    owner,
    branch,
    installationId,
    commitMessage,
    commitId,
    changedFiles,
    optional: {
      diffs,
      repo_size_commits: (payload.commits || []).length,
    },
  });

  // ── Step 3: Guard — nothing to do if AI returned no updates ──────────────
  if (!aiResponse.files_to_update || aiResponse.files_to_update.length === 0) {
    logger.info('AI service returned no files to update — skipping PR creation', {
      owner,
      repo,
      branch,
    });
    return;
  }

  // ── Step 4: Create documentation PR ──────────────────────────────────────
  const prUrl = await createDocumentationPR({
    owner,
    repo,
    installationId,
    baseBranch: branch,
    files: aiResponse.files_to_update,
    title: aiResponse.pr_title,
    body: aiResponse.pr_body,
  });

  logger.info('Full documentation pipeline completed', { owner, repo, branch, prUrl, deliveryId });
}

module.exports = { handleGitHubWebhook };
