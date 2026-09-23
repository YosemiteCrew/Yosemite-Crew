#!/usr/bin/env node
// How far the shared dev API has drifted behind the `dev` branch (#2740).
//
// The deploy is deliberately manual, and /health used to say only
// {"status":"ok"}: a 200 proved some process was alive, not which code it ran.
// On 2026-09-05 the dev box was serving a commit 122 commits behind `dev` and
// nothing said so. The API now reports the commit it was started on; this
// compares that commit with the branch and fails when the lag passes a
// threshold, so drift turns into a red run instead of a surprise.
//
// Lag is counted in FIRST-PARENT commits, i.e. merges into `dev`, because that
// is one per landed PR. The all-commits count is reported alongside it, but
// the branch-internal commits inside each PR say nothing about how much work
// is undeployed.
//
// Usage: node scripts/ci/check-api-drift.mjs --url <base> --ref <git-ref> [--max-behind <n>]
// Needs a checkout that contains the full history of <ref>.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// About four days of merges at the 7-day average measured when this was added
// (180 first-parent commits into dev in 7 days). Deploys were landing every one
// to three days, so this stays quiet on a normal cadence and fires once the box
// has visibly been forgotten.
export const DEFAULT_MAX_BEHIND = 100;

const COMMIT_SHA = /^[0-9a-f]{40}$/;

// Classify a measurement. Pure, so the decision is testable without a network.
export function evaluate({ revision, known, isAncestor, behind, maxBehind }) {
  if (!revision) {
    return {
      verdict: 'fail',
      reason: 'the API does not report a revision, so which code it runs is unknown',
    };
  }
  if (!known) {
    return {
      verdict: 'fail',
      reason: `the served revision ${revision} is not in this repository's history`,
    };
  }
  if (!isAncestor) {
    return {
      verdict: 'fail',
      reason: `the served revision ${revision} is not on the branch - it was deployed from somewhere else`,
    };
  }
  if (behind > maxBehind) {
    return {
      verdict: 'fail',
      reason: `${behind} merges behind, over the threshold of ${maxBehind}`,
    };
  }
  return {
    verdict: 'pass',
    reason: `${behind} merges behind, within the threshold of ${maxBehind}`,
  };
}

// Only a full lowercase sha is accepted, for the same reason the API only emits
// one: anything else is a misconfiguration, not a revision.
export function readRevision(body) {
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  const revision = parsed?.revision;
  return typeof revision === 'string' && COMMIT_SHA.test(revision) ? revision : null;
}

const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

function gitOk(cwd, args) {
  try {
    execFileSync('git', args, { cwd, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Where the served revision sits relative to <ref>, read from git.
export function measure(revision, ref, cwd = process.cwd()) {
  const tip = git(cwd, ['rev-parse', '--verify', `${ref}^{commit}`]);
  if (!revision)
    return { tip, revision, known: false, isAncestor: false, behind: null, behindAll: null };
  const known = gitOk(cwd, ['cat-file', '-e', `${revision}^{commit}`]);
  if (!known) return { tip, revision, known, isAncestor: false, behind: null, behindAll: null };
  const isAncestor = gitOk(cwd, ['merge-base', '--is-ancestor', revision, tip]);
  if (!isAncestor) return { tip, revision, known, isAncestor, behind: null, behindAll: null };
  const count = (extra) =>
    Number(git(cwd, ['rev-list', '--count', ...extra, `${revision}..${tip}`]));
  return {
    tip,
    revision,
    known,
    isAncestor,
    behind: count(['--first-parent']),
    behindAll: count([]),
  };
}

async function fetchHealth(base) {
  const url = new URL('/health', base);
  // Unique per run, on top of the API's own no-store, so no intermediary can
  // hand back a revision from before the last cutover.
  url.searchParams.set('drift-check', String(Date.now()));
  const response = await fetch(url, {
    headers: { 'cache-control': 'no-cache' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`${url.origin}/health answered ${response.status}`);
  return response.text();
}

function parseArgs(argv) {
  const args = { maxBehind: DEFAULT_MAX_BEHIND };
  for (let i = 0; i < argv.length; i += 2) {
    const [flag, value] = [argv[i], argv[i + 1]];
    if (flag === '--url') args.url = value;
    else if (flag === '--ref') args.ref = value;
    else if (flag === '--max-behind') args.maxBehind = Number(value);
    else throw new Error(`unknown argument ${flag}`);
  }
  if (!args.url || !args.ref) throw new Error('--url and --ref are required');
  if (!Number.isInteger(args.maxBehind) || args.maxBehind < 0) {
    throw new Error('--max-behind must be a non-negative integer');
  }
  return args;
}

async function main() {
  const { url, ref, maxBehind } = parseArgs(process.argv.slice(2));
  const revision = readRevision(await fetchHealth(url));
  const m = measure(revision, ref);
  const result = evaluate({ ...m, maxBehind });
  console.log(`api:        ${new URL(url).origin}`);
  console.log(`served:     ${revision ?? '(not reported)'}`);
  console.log(`branch:     ${ref} at ${m.tip}`);
  if (m.behind !== null) console.log(`behind:     ${m.behind} merges (${m.behindAll} commits)`);
  console.log(`threshold:  ${maxBehind} merges`);
  console.log(`verdict:    ${result.verdict} - ${result.reason}`);
  if (result.verdict !== 'pass') process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`drift check could not run: ${error.message}`);
    process.exitCode = 2;
  });
}
