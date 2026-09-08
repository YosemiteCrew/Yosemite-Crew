#!/usr/bin/env node
/**
 * Fails a pull request whose tests pass against the code it claims to change.
 *
 * WHY THIS EXISTS
 *
 * A PIMS release shipped an Inventory page reading "0 items below reorder point"
 * directly above a panel headed "Low stock 21", with 546 tests passing and an
 * audit document reporting mutation checks. Both numbers were tested. Neither
 * test could see the other, because each asserted against a fixture its own
 * author wrote, and a fixture cannot contradict itself.
 *
 * Counting tests cannot detect that. Coverage cannot detect it either: both
 * lines were covered. The only mechanical question that separates a test which
 * verifies a change from one that merely runs beside it is:
 *
 *     if the source change were removed, would this test fail?
 *
 * So that is what this does. Keep the branch's test changes, restore its source
 * changes to the base, run the tests the branch added or modified. If they all
 * still pass, they never tested the change.
 *
 * WHAT A FAILURE TO COMPILE MEANS
 *
 * Reverting source can leave a test importing something that no longer exists.
 * That is treated as the test failing, and reported distinctly. It is weaker
 * evidence than an assertion failure - it proves the test depends on the change
 * without proving it checks the behaviour - but it is not a pass, and calling it
 * one would be the exact false green this gate exists to remove.
 *
 * THE ESCAPE HATCH, AND WHY IT IS NARROW
 *
 * A pure refactor legitimately has tests that pass both ways. That is the only
 * honest exemption, and it is claimed per pull request with a label rather than
 * configured in the repository, so it appears in the review and expires with the
 * branch. It is not a way to skip writing a test: a source change with no test
 * change fails regardless of the label.
 */

import { execFileSync } from 'node:child_process';
import { realpathSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** A test file, by this repository's own conventions. */
export const isTestFile = (file) =>
  /(^|\/)__tests__\//.test(file) ||
  /\.(test|spec)\.[mc]?[jt]sx?$/.test(file) ||
  /(^|\/)e2e\//.test(file);

/**
 * A source file whose change should be provable by a test.
 *
 * Excludes what a test cannot meaningfully assert against: documentation,
 * lockfiles, CI definitions, and generated output. A PR touching only these is
 * not evading the gate, it has nothing for the gate to check.
 */
export const isCheckableSource = (file) => {
  if (isTestFile(file)) return false;
  if (/^docs\//.test(file) || /\.(md|mdx|txt|json|ya?ml|lock)$/.test(file)) return false;
  if (/^\.github\//.test(file) || /^scripts\/ci\//.test(file)) return false;
  if (/\.(stories|d)\.[mc]?[jt]sx?$/.test(file)) return false;
  if (/(^|\/)(dist|build|generated|__generated__)\//.test(file)) return false;
  return /\.[mc]?[jt]sx?$/.test(file);
};

/**
 * The workspace a changed test belongs to.
 *
 * The first version ran `pnpm --filter frontend` unconditionally, so a PR whose
 * only test change was in apps/backend ran nothing and the gate reported a pass
 * it had not earned.
 */
export const workspaceOf = (file) => {
  const match = /^apps\/([^/]+)\//.exec(file);
  if (!match) return undefined;
  return { frontend: 'frontend', backend: 'backend' }[match[1]];
};

/** Groups test paths by the workspace whose runner can execute them. */
export const groupTestsByWorkspace = (tests) => {
  const out = new Map();
  for (const t of tests) {
    if (/(^|\/)e2e\//.test(t)) continue; // this gate does not drive browsers
    const ws = workspaceOf(t);
    if (!ws) continue;
    const paths = out.get(ws);
    if (paths) paths.push(t);
    else out.set(ws, [t]);
  }
  return out;
};

export const classify = (files) => ({
  source: files.filter(isCheckableSource),
  tests: files.filter(isTestFile),
});

/**
 * Splits changed source files by where they exist, so the checkout dance
 * around them can be run in the right direction for each:
 *
 * - `added`    exists at HEAD only (the branch created it) - reverting it
 *   means removing it, and restoring it means checking it out from HEAD.
 * - `deleted`  exists at base only (the branch removed it) - reverting it
 *   means checking it out from base, and restoring it means removing it
 *   again. The mirror image of `added`, and just as real: a PR that deletes
 *   a file is exactly as checkable as one that adds or edits one.
 * - `modified` exists at both - checkout works in both directions.
 *
 * A pure function of two existence checks, not of git itself, so the
 * decision is testable without a real repository.
 */
export const categorizeSourceFiles = (source, existsAtBase, existsAtHead) => {
  const added = [];
  const deleted = [];
  const modified = [];
  for (const file of source) {
    const atBase = existsAtBase(file);
    const atHead = existsAtHead(file);
    if (atBase && atHead) modified.push(file);
    else if (atHead) added.push(file);
    else if (atBase) deleted.push(file);
    // Present at neither is unreachable: `source` came from a diff against
    // one of these two refs, so every entry exists at at least one of them.
  }
  return { added, deleted, modified };
};

/**
 * The whole judgement, as a pure function, so it is tested directly rather than
 * inferred from a CI run.
 */
export const verdict = ({
  source,
  tests,
  testsPassedAgainstBase,
  nothingRunnable = false,
  allowUnchangedBehaviour = false,
}) => {
  if (source.length === 0) {
    return { ok: true, reason: 'no checkable source changed; nothing for this gate to prove' };
  }
  if (tests.length === 0) {
    return {
      ok: false,
      reason:
        `This pull request changes ${source.length} source file(s) and no test.\n` +
        'A change nothing can fail on is a change nothing verified.',
    };
  }
  // Distinct from "the tests failed against the base". Nothing ran, so nothing
  // was proved - and `false` here would be read as proof, which is the exact
  // false green this gate exists to remove. It was written that way first.
  if (nothingRunnable) {
    return {
      ok: false,
      reason:
        'The changed tests are all end-to-end specs, which this gate does not run.\n' +
        'It therefore cannot tell whether they verify this source change.\n' +
        'Add a unit test for the changed behaviour, or label the PR no-behaviour-change\n' +
        'if the source change genuinely alters nothing observable.',
    };
  }
  if (testsPassedAgainstBase === false) {
    return { ok: true, reason: 'the changed tests fail without the source change, as they must' };
  }
  if (allowUnchangedBehaviour) {
    return {
      ok: true,
      reason:
        'the changed tests pass against the base, allowed by the no-behaviour-change label.\n' +
        'That claim is now on the record in this pull request.',
    };
  }
  return {
    ok: false,
    reason:
      'The changed tests PASS against the unmodified base code.\n' +
      'They therefore do not verify this change: removing it entirely would not fail them.\n' +
      'Assert the behaviour that is different, or label the PR no-behaviour-change if it is a\n' +
      'pure refactor.',
  };
};

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

/**
 * Runs each workspace's changed tests against the reverted source.
 *
 * Every workspace must pass for the branch to be judged "the tests survive their
 * own revert". One failing workspace proves the tests depend on the change.
 */
const runChangedTests = (byWorkspace) => {
  let allPassed = true;
  for (const [ws, paths] of byWorkspace) {
    console.log(`running ${paths.length} changed test file(s) in ${ws} against the base`);
    try {
      execFileSync(
        'pnpm',
        ['--filter', ws, 'exec', 'jest', '--ci', '--passWithNoTests', ...paths],
        {
          stdio: 'inherit',
        }
      );
    } catch {
      allPassed = false;
    }
  }
  return allPassed;
};

const main = () => {
  const args = process.argv.slice(2);
  const get = (flag, fallback) => {
    const i = args.indexOf(flag);
    return i === -1 ? fallback : args[i + 1];
  };

  if (args[0] === 'selftest') {
    // Proves the gate can fail before it is trusted to pass anything.
    const bad = verdict({ source: ['a.ts'], tests: ['a.test.ts'], testsPassedAgainstBase: true });
    const good = verdict({ source: ['a.ts'], tests: ['a.test.ts'], testsPassedAgainstBase: false });
    const noTest = verdict({ source: ['a.ts'], tests: [], testsPassedAgainstBase: false });
    if (bad.ok || !good.ok || noTest.ok) {
      console.error('selftest FAILED: the gate does not distinguish its own cases');
      process.exit(1);
    }
    console.log('selftest passed: a test that survives its own revert is rejected');
    return;
  }

  const base = get('--base', 'origin/dev');
  const allowUnchangedBehaviour = args.includes('--allow-unchanged-behaviour');

  const files = git('diff', '--name-only', `${base}...HEAD`).split('\n').filter(Boolean);
  const { source, tests } = classify(files);

  console.log(`source files changed: ${source.length}`);
  console.log(`test files changed:   ${tests.length}`);

  let testsPassedAgainstBase = null;
  let nothingRunnable = false;

  if (source.length > 0 && tests.length > 0) {
    // A file the branch ADDS does not exist at the base, and one it DELETES
    // does not exist at HEAD - `git checkout <ref> -- <path>` fails outright
    // when <path> is not in <ref>'s tree, in either direction. Both crashed
    // this gate the first time a real pull request did them.
    const existsAt = (ref, file) => {
      try {
        execFileSync('git', ['cat-file', '-e', `${ref}:${file}`], { stdio: 'ignore' });
        return true;
      } catch {
        return false;
      }
    };
    const existsAtBase = (file) => existsAt(base, file);
    const existsAtHead = (file) => existsAt('HEAD', file);
    const { added, deleted, modified } = categorizeSourceFiles(source, existsAtBase, existsAtHead);

    // Revert: added files vanish, deleted files come back, modified files
    // take the base version.
    if (modified.length || deleted.length) git('checkout', base, '--', ...modified, ...deleted);
    for (const file of added) rmSync(file, { force: true });

    const byWorkspace = groupTestsByWorkspace(tests);
    try {
      if (byWorkspace.size === 0) {
        console.log('no runnable unit tests changed (e2e only, or outside a known workspace)');
        nothingRunnable = true;
      } else {
        testsPassedAgainstBase = runChangedTests(byWorkspace);
      }
    } finally {
      // Always put the branch back, including when the run threw. Mirror the
      // revert: added and modified files exist at HEAD and check out cleanly;
      // deleted files do not exist at HEAD, so removing them again is the
      // only way to restore that state - `checkout HEAD --` on a path HEAD's
      // tree does not have just errors, which is the bug this fixes.
      const restorable = [...added, ...modified];
      if (restorable.length) git('checkout', 'HEAD', '--', ...restorable);
      for (const file of deleted) rmSync(file, { force: true });
      if (deleted.length) git('rm', '--cached', '-q', '--ignore-unmatch', '--', ...deleted);
    }
  }

  const result = verdict({
    source,
    tests,
    testsPassedAgainstBase,
    nothingRunnable,
    allowUnchangedBehaviour,
  });
  console.log(`\n${result.ok ? 'PASS' : 'FAIL'}: ${result.reason}`);
  process.exit(result.ok ? 0 : 1);
};

/**
 * Compare REAL paths. import.meta.url resolves symlinks and process.argv[1]
 * does not, so on a macOS temp dir (/var -> /private/var) the naive comparison
 * is false, main() never runs, and the gate exits 0 having checked nothing -
 * a no-op that reads as a pass, which is the failure mode this file exists to
 * eliminate.
 */
const invokedDirectly = (() => {
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
})();

if (invokedDirectly) main();
