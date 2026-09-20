#!/usr/bin/env node
// Close the issues a merged PR says it closes, on a repo whose default branch is
// not the one it merges into.
//
// GitHub only honours `Closes #N` / `Fixes #N` when the PR merges into the
// DEFAULT branch. This repo merges into `dev`, so every issue a PR body marks as
// closed stays open forever - work that shipped weeks ago still reads as live,
// and people re-start it. This runs on push to `dev`, reads the closing keywords
// out of the merged PR's body exactly as GitHub itself would, comments which PR
// closed the issue and that it merged to `dev`, and closes it.
//
// It is deliberately narrow:
//   - only the keywords GitHub recognises, never a bare `#123` mention;
//   - only same-repo `#N`, never a cross-repo `owner/repo#N`;
//   - a comment before every close, so the trail names the PR;
//   - already-closed issues are left alone, so a re-run is a no-op.
//
// It uses the `gh` CLI already present on GitHub runners and no other dependency.
import { execFileSync } from 'node:child_process';
import { argv, env, exit, stderr, stdout } from 'node:process';
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';

// GitHub's own closing-keyword set: close/closes/closed, fix/fixes/fixed,
// resolve/resolves/resolved. The keyword must sit immediately before the
// reference (an optional colon and whitespace between), so `Closes #1, #2` marks
// only #1 - which is exactly what GitHub does, and keeps a bare `#2` mention from
// closing anything.
const CLOSING_KEYWORD = /\b(?:close[sd]?|fix(?:es|ed)?|resolve[sd]?)\b[:\s]+#(\d+)/gi;

// Cross-repo references (`owner/repo#N`) carry a `/` or word char right before
// the keyword's issue; the `\b#` above already excludes `repo#N`, but a body may
// still paste a full URL. Numbers are validated as same-repo issues by the API
// call in main(), so a stray match simply finds no open issue and is skipped.
export const closedIssues = (body) => {
  const found = new Set();
  for (const match of String(body ?? '').matchAll(CLOSING_KEYWORD)) {
    found.add(Number(match[1]));
  }
  return [...found];
};

const gh = (args) => execFileSync('gh', args, { encoding: 'utf8' }).trim();

// The PRs a commit belongs to. A squash or merge commit on `dev` maps to the one
// PR that introduced it; the API is authoritative regardless of merge style,
// where scraping `(#N)` out of the subject line is not.
const pullsForCommit = (repo, sha) => {
  const out = gh(['api', `repos/${repo}/commits/${sha}/pulls`, '--jq', '.[].number']);
  return out
    .split('\n')
    .map((line) => Number(line.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
};

const issueState = (repo, number) => {
  try {
    return gh(['api', `repos/${repo}/issues/${number}`, '--jq', '.state']);
  } catch {
    // A number that is not an issue in this repo (a pull request id, or a
    // cross-repo reference that slipped through) 404s. Not ours to close.
    return null;
  }
};

const main = () => {
  const repo = env.GITHUB_REPOSITORY;
  const sha = env.GITHUB_SHA;
  if (!repo || !sha) {
    stderr.write('GITHUB_REPOSITORY and GITHUB_SHA are required\n');
    exit(2);
  }

  const prs = pullsForCommit(repo, sha);
  if (prs.length === 0) {
    stdout.write(`No PR is associated with ${sha}; nothing to close.\n`);
    return;
  }

  let closed = 0;
  for (const pr of prs) {
    const body = gh(['api', `repos/${repo}/issues/${pr}`, '--jq', '.body']);
    for (const issue of closedIssues(body)) {
      if (issue === pr) continue; // a PR never closes itself
      const state = issueState(repo, issue);
      if (state !== 'open') {
        stdout.write(`#${issue}: ${state ?? 'not an issue'}, skipping.\n`);
        continue;
      }
      gh([
        'api',
        `repos/${repo}/issues/${issue}/comments`,
        '-f',
        `body=Closed by #${pr}, which merged into \`dev\`. GitHub does not fire closing keywords outside the default branch, so this is closed here instead.`,
      ]);
      gh(['api', '-X', 'PATCH', `repos/${repo}/issues/${issue}`, '-f', 'state=closed']);
      stdout.write(`Closed #${issue} (referenced by #${pr}).\n`);
      closed += 1;
    }
  }
  stdout.write(`Done: closed ${closed} issue(s).\n`);
};

// Only run when invoked directly, so the test can import closedIssues().
const invokedDirectly = () => {
  if (!argv[1]) return false;
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(argv[1]);
  } catch {
    return false;
  }
};

if (invokedDirectly()) {
  main();
}
