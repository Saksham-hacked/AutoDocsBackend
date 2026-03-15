'use strict';

const {
  getOctokit,
  getBranchSha,
  createBranch,
  upsertFile,
  openPullRequest,
} = require('./githubService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('PRService');

/**
 * Creates a documentation pull request on the target repository.
 *
 * Flow:
 *   1. Authenticate with GitHub as the installation
 *   2. Resolve the HEAD SHA of the default branch
 *   3. Create a new short-lived branch (autodocs/update-docs-{timestamp})
 *   4. Upsert each documentation file on that branch
 *   5. Open a pull request back to the base branch
 *
 * @param {{
 *   owner: string,
 *   repo: string,
 *   installationId: string|number,
 *   baseBranch: string,
 *   files: Array<{ path: string, content: string }>,
 *   title: string,
 *   body: string,
 * }} params
 *
 * @returns {Promise<string>} URL of the opened pull request
 */
async function createDocumentationPR({
  owner,
  repo,
  installationId,
  baseBranch,
  files,
  title,
  body,
}) {
  logger.info('Starting documentation PR creation', { owner, repo, baseBranch, files: files.length });

  // Step 1 — authenticated Octokit instance
  const octokit = await getOctokit(installationId);

  // Step 2 — resolve HEAD SHA of the base branch
  const baseSha = await getBranchSha(octokit, owner, repo, baseBranch);
  logger.debug('Resolved base branch SHA', { baseBranch, baseSha });

  // Step 3 — create a unique docs branch
  const timestamp = Date.now();
  const docsBranch = `autodocs/update-docs-${timestamp}`;
  await createBranch(octokit, owner, repo, docsBranch, baseSha);

  // Step 4 — upsert each file
  // Fetch existing file content so we can replace only inside the AUTODOCS marker,
  // preserving the rest of the file. Fall back to writing content directly if fetch fails.
  const ocktokitForRead = octokit;
  for (const file of files) {
    logger.info('Writing documentation file', { path: file.path });

    let finalContent = file.content;
    const section = file.marker_section; // Layer 2 sends this in target_docs context

    if (section) {
      try {
        const { data } = await ocktokitForRead.rest.repos.getContent({
          owner, repo, path: file.path, ref: baseBranch,
        });
        const existing = Buffer.from(data.content, 'base64').toString('utf8');
        const startTag = `<!-- AUTODOCS:${section}_START -->`;
        const endTag   = `<!-- AUTODOCS:${section}_END -->`;
        const notice   = `\n<!-- Managed by AutoDocs v1 — Changes may be overwritten -->\n`;
        const startIdx = existing.indexOf(startTag);
        const endIdx   = existing.indexOf(endTag);
        if (startIdx !== -1 && endIdx !== -1) {
          finalContent = existing.slice(0, startIdx + startTag.length)
            + notice + file.content + '\n'
            + existing.slice(endIdx);
        } else {
          // Markers missing — append a new marker block
          finalContent = existing + `\n${startTag}${notice}${file.content}\n${endTag}\n`;
        }
      } catch (err) {
        if (err.status !== 404) logger.warn('Could not fetch existing doc file', { path: file.path, err: err.message });
        // File doesn't exist yet — wrap content in markers
        finalContent = `<!-- AUTODOCS:${section}_START -->\n<!-- Managed by AutoDocs v1 — Changes may be overwritten -->\n${file.content}\n<!-- AUTODOCS:${section}_END -->\n`;
      }
    }

    await upsertFile(octokit, {
      owner,
      repo,
      branch: docsBranch,
      path: file.path,
      content: finalContent,
      message: `docs: update ${file.path} via AutoDocs`,
    });
  }

  // Step 5 — open the pull request
  const prUrl = await openPullRequest(octokit, {
    owner,
    repo,
    head: docsBranch,
    base: baseBranch,
    title,
    body,
  });

  logger.info('Documentation PR created successfully', { owner, repo, prUrl });
  return prUrl;
}

module.exports = { createDocumentationPR };
