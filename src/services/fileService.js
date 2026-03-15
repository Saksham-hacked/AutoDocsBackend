'use strict';

const { getOctokit } = require('./githubService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('FileService');

/**
 * Fetches the raw content of a single file from a GitHub repo.
 *
 * @param {{ owner, repo, branch, path, installationId }} params
 * @returns {Promise<string>} UTF-8 file content, or empty string if not found
 */
async function fetchFileContent({ owner, repo, branch, path, installationId }) {
  try {
    const octokit = await getOctokit(installationId);
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref: branch,
    });

    if (data.type !== 'file') {
      logger.warn('getContent returned non-file type', { path, type: data.type });
      return '';
    }

    const content = Buffer.from(data.content, 'base64').toString('utf8');
    logger.debug('File fetched', { owner, repo, path, branch, bytes: content.length });
    return content;
  } catch (err) {
    if (err.status === 404) {
      logger.debug('File not found', { owner, repo, path, branch });
      return '';
    }
    logger.error('Failed to fetch file content', { owner, repo, path, error: err.message });
    throw err;
  }
}

/**
 * Fetches the unified diff for a file at a specific commit.
 * Uses the GitHub compare API: base = commitSha^, head = commitSha.
 *
 * @param {{ owner, repo, path, commitId, installationId }} params
 * @returns {Promise<string>} Unified diff string for the file, or empty string
 */
async function fetchFileDiff({ owner, repo, path, commitId, installationId }) {
  try {
    const octokit = await getOctokit(installationId);

    // Get the commit to find its parent
    const { data: commit } = await octokit.rest.repos.getCommit({
      owner,
      repo,
      ref: commitId,
    });

    // Find this file in the commit's files list
    const fileEntry = (commit.files || []).find((f) => f.filename === path);
    if (!fileEntry) {
      logger.debug('File not in commit diff', { path, commitId });
      return '';
    }

    const patch = fileEntry.patch || '';
    logger.debug('Diff fetched', { owner, repo, path, commitId, patchLen: patch.length });
    return patch;
  } catch (err) {
    if (err.status === 404) {
      return '';
    }
    logger.error('Failed to fetch file diff', { owner, repo, path, commitId, error: err.message });
    throw err;
  }
}

/**
 * Fetches diffs for all changed files in a commit.
 * Returns a map of { filePath: patchString }.
 *
 * @param {{ owner, repo, commitId, changedFiles, installationId }} params
 * @returns {Promise<Record<string, string>>}
 */
async function fetchAllDiffs({ owner, repo, commitId, changedFiles, installationId }) {
  try {
    const octokit = await getOctokit(installationId);
    const { data: commit } = await octokit.rest.repos.getCommit({
      owner,
      repo,
      ref: commitId,
    });

    const changedSet = new Set(changedFiles);
    const diffs = {};

    for (const file of commit.files || []) {
      if (changedSet.has(file.filename) && file.patch) {
        diffs[file.filename] = file.patch;
      }
    }

    logger.debug('All diffs fetched', { owner, repo, commitId, count: Object.keys(diffs).length });
    return diffs;
  } catch (err) {
    logger.error('Failed to fetch commit diffs', { owner, repo, commitId, error: err.message });
    return {};
  }
}

module.exports = { fetchFileContent, fetchFileDiff, fetchAllDiffs };
