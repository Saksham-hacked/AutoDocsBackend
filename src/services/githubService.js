'use strict';

const { createAppAuth } = require('@octokit/auth-app');
const { Octokit } = require('@octokit/rest');
const { config } = require('../config');
const { createLogger } = require('../utils/logger');

const logger = createLogger('GitHubService');

/**
 * Returns an authenticated Octokit instance scoped to the given installation.
 *
 * Uses @octokit/auth-app which handles:
 *   - JWT generation for the GitHub App
 *   - Installation token exchange
 *   - Token caching & automatic refresh
 *
 * @param {number|string} installationId
 * @returns {Promise<InstanceType<Octokit>>}
 */
async function getOctokit(installationId) {
  const auth = createAppAuth({
    appId: Number(config.github.appId),
    privateKey: config.github.privateKey,
    installationId: String(installationId),
  });

  // Fetch an installation access token
  const { token } = await auth({ type: 'installation' });

  logger.debug('Installation token obtained', { installationId });

  return new Octokit({ auth: token });
}

/**
 * Resolves the SHA of the HEAD commit on the default (or specified) branch.
 *
 * @param {InstanceType<Octokit>} octokit
 * @param {string} owner
 * @param {string} repo
 * @param {string} branch
 * @returns {Promise<string>} SHA
 */
async function getBranchSha(octokit, owner, repo, branch) {
  const { data } = await octokit.rest.repos.getBranch({ owner, repo, branch });
  return data.commit.sha;
}

/**
 * Creates a new branch from a given base SHA.
 *
 * @param {InstanceType<Octokit>} octokit
 * @param {string} owner
 * @param {string} repo
 * @param {string} newBranch
 * @param {string} baseSha
 */
async function createBranch(octokit, owner, repo, newBranch, baseSha) {
  await octokit.rest.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${newBranch}`,
    sha: baseSha,
  });
  logger.info('Branch created', { owner, repo, newBranch, baseSha });
}

/**
 * Creates or updates a file in a repository on a given branch.
 * If the file already exists its SHA must be passed to overwrite it.
 *
 * @param {InstanceType<Octokit>} octokit
 * @param {{ owner, repo, branch, path, content, message }} params
 */
async function upsertFile(octokit, { owner, repo, branch, path, content, message }) {
  let existingSha;

  try {
    const { data } = await octokit.rest.repos.getContent({ owner, repo, path, ref: branch });
    existingSha = data.sha;
  } catch (err) {
    if (err.status !== 404) throw err;
    // File doesn't exist yet — that's fine
  }

  const encodedContent = Buffer.from(content, 'utf8').toString('base64');

  await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message,
    content: encodedContent,
    branch,
    ...(existingSha ? { sha: existingSha } : {}),
  });

  logger.debug('File upserted', { owner, repo, path, branch });
}

/**
 * Opens a pull request.
 *
 * @param {InstanceType<Octokit>} octokit
 * @param {{ owner, repo, head, base, title, body }} params
 * @returns {Promise<string>} Pull request URL
 */
async function openPullRequest(octokit, { owner, repo, head, base, title, body }) {
  const { data } = await octokit.rest.pulls.create({
    owner,
    repo,
    head,
    base,
    title,
    body,
  });

  logger.info('Pull request opened', { owner, repo, prNumber: data.number, url: data.html_url });
  return data.html_url;
}

module.exports = {
  getOctokit,
  getBranchSha,
  createBranch,
  upsertFile,
  openPullRequest,
};
