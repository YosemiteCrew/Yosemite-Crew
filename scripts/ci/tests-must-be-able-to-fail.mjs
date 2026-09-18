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
import { readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
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
 *
 * The value is the `pnpm --filter` argument, which is the package name and not
 * the directory. Those coincide for three of the four workspaces; desktop's
 * package is scoped, and leaving it out of this map is what made every desktop
 * test change read as "outside a known workspace" and fail the gate.
 */
export const workspaceOf = (file) => {
  const match = /^apps\/([^/]+)\//.exec(file);
  if (!match) return undefined;
  return {
    frontend: 'frontend',
    backend: 'backend',
    mobileAppYC: 'mobileAppYC',
    desktop: '@yosemite-crew/desktop',
  }[match[1]];
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
 * Of the changed test paths handed to a workspace, the ones jest itself will
 * discover there.
 *
 * `jest --listTests` enumerates exactly the files that workspace's own
 * `testMatch` and `testPathIgnorePatterns` admit, so intersecting with it
 * separates the two reasons a path can contribute no suite:
 *
 * - legitimately, because it holds no tests - a `__tests__/support/` helper,
 *   which is what `--passWithNoTests` exists for; and
 * - wrongly, because the path never reached the runner - which is a bug, and
 *   until #3264 was indistinguishable from the first.
 *
 * Both sides arrive already resolved through `realpathSync`, because jest
 * prints absolute paths and `/var` is a symlink to `/private/var` on macOS -
 * the same trap the direct-invocation check at the bottom of this file
 * documents.
 */
export const selectDiscoverable = (paths, discovered) => {
  const set = new Set(discovered);
  return paths.filter((p) => set.has(p));
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
  suiteShortfall = null,
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
  if (nothingRunnable === 'e2e-only') {
    return {
      ok: false,
      reason:
        'The changed tests are all end-to-end specs, which this gate does not run.\n' +
        'It therefore cannot tell whether they verify this source change.\n' +
        'Add a unit test for the changed behaviour, or label the PR no-behaviour-change\n' +
        'if the source change genuinely alters nothing observable.',
    };
  }
  if (nothingRunnable === 'all-tests-deleted') {
    return {
      ok: false,
      reason:
        'Every changed test file is one the branch DELETED, so none of them exist to run -\n' +
        '`jest` against a path that is gone reports zero tests, which is not evidence either\n' +
        'way. This is expected for a component removed alongside its own test; verify there\n' +
        'is truly no other reference (a clean `tsc` build is real evidence of that) and label\n' +
        'the PR no-behaviour-change, or add a test if any of the deleted source still runs.',
    };
  }
  // A path reached jest and no suite came back for it. Every branch below this
  // one reads `testsPassedAgainstBase` as evidence, and a suite that did not
  // run is not evidence either way - so the shortfall is reported rather than
  // resolved, and no label excuses it. This sits ABOVE the two passing
  // branches deliberately: the permissive reading of a suite that never
  // executed is the exact false green this file exists to remove.
  if (suiteShortfall) {
    const { workspace, expected, ran } = suiteShortfall;
    return {
      ok: false,
      reason:
        `${expected} runnable test file(s) were handed to jest in ${workspace}, but ` +
        `${ran === null ? 'no suite count came back' : `${ran} test suite(s) ran`}.\n` +
        'A suite that did not run proves nothing about this branch, so the gate cannot\n' +
        'judge it. This is a fault in the gate or in the changed test paths, not\n' +
        'something the no-behaviour-change label covers.',
    };
  }
  if (nothingRunnable === 'no-tests-in-changed-tests') {
    return {
      ok: false,
      reason:
        'None of the changed test files hold a test jest can run - they are helpers or\n' +
        'fixtures, which is legitimate, but it means nothing was executed against the\n' +
        'reverted source and the gate has no evidence either way.\n' +
        'Change or add a test that asserts the behaviour this branch alters.',
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

/** Resolves a path the way jest prints one, tolerating one that is already gone. */
const real = (path) => {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
};

const jest = (ws, jestArgs, options) =>
  execFileSync('pnpm', ['--filter', ws, 'exec', 'jest', '--ci', ...jestArgs], options);

/** The changed paths this workspace's jest will actually discover. */
const discoverableIn = (ws, absolutePaths) => {
  const listed = jest(ws, ['--listTests', '--passWithNoTests'], { encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map(real);
  return selectDiscoverable(absolutePaths, listed);
};

/** The suite total jest recorded, or null if it recorded nothing readable. */
const suitesRunFrom = (reportPath) => {
  try {
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    return typeof report.numTotalTestSuites === 'number' ? report.numTotalTestSuites : null;
  } catch {
    // Fail closed. A missing or unparseable report is "the gate does not know
    // how many suites ran", which the caller turns into a shortfall rather
    // than into the permissive verdict.
    return null;
  }
};

/**
 * Runs each workspace's changed tests against the reverted source.
 *
 * Every workspace must pass for the branch to be judged "the tests survive their
 * own revert". One failing workspace proves the tests depend on the change.
 *
 * Paths go to jest ABSOLUTE and behind `--runTestsByPath`. A positional path is
 * a REGEX matched against absolute test paths, so `__tests__/(routes)/book.test.tsx`
 * is read as a capture group matching `.../routes/book.test.tsx`, which does not
 * exist - the suite never ran, `--passWithNoTests` made that a clean exit 0, and
 * the gate returned the permissive verdict for a test it had not executed.
 * `--runTestsByPath` takes literal paths, and resolves them against the workspace
 * `rootDir` rather than the repository root, which is why they are absolute here.
 * (#3264)
 */
const runChangedTests = (byWorkspace, repoRoot) => {
  let allPassed = true;
  let suiteShortfall = null;
  let ranAnything = false;
  for (const [ws, paths] of byWorkspace) {
    const absolute = paths.map((path) => real(resolve(repoRoot, path)));
    const runnable = discoverableIn(ws, absolute);
    const noTests = absolute.length - runnable.length;
    console.log(
      `running ${runnable.length} changed test file(s) in ${ws} against the base` +
        (noTests > 0 ? ` (${noTests} of ${absolute.length} hold no tests jest can run)` : '')
    );
    if (runnable.length === 0) continue;
    ranAnything = true;

    // The count was the only visible symptom of a path that never ran, and
    // nothing reconciled it: `running 4 changed test file(s)` and jest's
    // `Test Suites: 2 passed` sat four lines apart and disagreed.
    const report = join(tmpdir(), `tests-must-be-able-to-fail-${ws}-${process.pid}.json`);
    try {
      jest(
        ws,
        ['--passWithNoTests', '--runTestsByPath', '--json', '--outputFile', report, ...runnable],
        {
          stdio: 'inherit',
        }
      );
    } catch {
      allPassed = false;
    }
    const ran = suitesRunFrom(report);
    rmSync(report, { force: true });
    if (ran !== runnable.length && !suiteShortfall) {
      suiteShortfall = { workspace: ws, expected: runnable.length, ran };
    }
  }
  return { allPassed, suiteShortfall, ranAnything };
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
    // A suite that never ran must not be read as one that passed, even under
    // the label that excuses a passing base run.
    const shortfall = verdict({
      source: ['a.ts'],
      tests: ['a.test.ts'],
      testsPassedAgainstBase: false,
      suiteShortfall: { workspace: 'frontend', expected: 2, ran: 1 },
      allowUnchangedBehaviour: true,
    });
    if (bad.ok || !good.ok || noTest.ok || shortfall.ok) {
      console.error('selftest FAILED: the gate does not distinguish its own cases');
      process.exit(1);
    }
    console.log('selftest passed: a test that survives its own revert is rejected');
    return;
  }

  const base = get('--base', 'origin/dev');
  const allowUnchangedBehaviour = args.includes('--allow-unchanged-behaviour');

  // --runTestsByPath resolves against the workspace rootDir, not the repo root,
  // so the repo-relative paths a diff yields have to be made absolute first.
  const repoRoot = git('rev-parse', '--show-toplevel');

  const files = git('diff', '--name-only', `${base}...HEAD`).split('\n').filter(Boolean);
  const { source, tests } = classify(files);

  console.log(`source files changed: ${source.length}`);
  console.log(`test files changed:   ${tests.length}`);

  let testsPassedAgainstBase = null;
  let nothingRunnable = false;
  let suiteShortfall = null;

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

    // A test file the branch DELETES does not exist at HEAD either - there is
    // no content left to run it. Asking jest to run it anyway does not error;
    // `--passWithNoTests` makes a path matching nothing exit 0, which this
    // gate would otherwise misread as "the test survived its own revert",
    // when nothing actually ran. Excluded here, the same way a deleted
    // SOURCE file is excluded from the restore-from-HEAD step above.
    const runnableTests = tests.filter(existsAtHead);
    if (runnableTests.length < tests.length) {
      console.log(
        `${tests.length - runnableTests.length} changed test file(s) were deleted by this branch - excluded, nothing to run`
      );
    }

    const byWorkspace = groupTestsByWorkspace(runnableTests);
    try {
      if (runnableTests.length === 0) {
        console.log('every changed test file was deleted by this branch; nothing left to run');
        nothingRunnable = 'all-tests-deleted';
      } else if (byWorkspace.size === 0) {
        console.log('no runnable unit tests changed (e2e only, or outside a known workspace)');
        nothingRunnable = 'e2e-only';
      } else {
        const run = runChangedTests(byWorkspace, repoRoot);
        suiteShortfall = run.suiteShortfall;
        // `allPassed` starts true and nothing ran to falsify it, so reading it
        // as "the tests survived their own revert" would be the vacuous pass
        // `--passWithNoTests` used to hand out for a branch whose only test
        // change is a `__tests__/support/` helper.
        testsPassedAgainstBase = run.ranAnything ? run.allPassed : null;
        if (!run.ranAnything) nothingRunnable = 'no-tests-in-changed-tests';
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
    suiteShortfall,
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
