import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import {
  classify,
  groupTestsByWorkspace,
  selectDiscoverable,
  workspaceOf,
  isCheckableSource,
  isTestFile,
  verdict,
  categorizeSourceFiles,
  reportPathFor,
  isInside,
  suitesRunFrom,
  withReportDir,
} from './tests-must-be-able-to-fail.mjs';

test("recognises this repository's test conventions", () => {
  for (const f of [
    'apps/frontend/src/app/__tests__/pages/Inventory/index.test.tsx',
    'apps/frontend/e2e/route-sweep.spec.ts',
    'scripts/ci/diff-coverage.test.mjs',
  ]) {
    assert.equal(isTestFile(f), true, f);
  }
  assert.equal(
    isTestFile('apps/frontend/src/app/features/inventory/pages/Inventory/index.tsx'),
    false
  );
});

test('an e2e helper is a test file even without a .spec suffix', () => {
  // Without this, e2e/support/auth.ts counts as checkable source and a PR that
  // only touches e2e plumbing is told to write a unit test for it.
  assert.equal(isTestFile('apps/frontend/e2e/support/auth.ts'), true);
  assert.equal(isTestFile('apps/desktop/tests/e2e/menu.ts'), true);
  assert.equal(isCheckableSource('apps/frontend/e2e/support/pageInvariants.ts'), false);
});

test('only counts source a test could meaningfully assert against', () => {
  assert.equal(isCheckableSource('apps/frontend/src/app/features/inventory/utils.ts'), true);
  // A test cannot fail on any of these, so demanding one would only teach
  // people to bypass the gate.
  for (const f of [
    'docs/ci/coverage.md',
    'pnpm-lock.yaml',
    '.github/workflows/frontend-e2e.yml',
    'scripts/ci/forbidden-terms.mjs',
    'apps/frontend/src/app/ui/Button.stories.tsx',
    'packages/types/dist/index.js',
  ]) {
    assert.equal(isCheckableSource(f), false, f);
  }
});

test('a source change with no test at all is rejected', () => {
  const r = verdict({ source: ['a.ts'], tests: [], testsPassedAgainstBase: null });
  assert.equal(r.ok, false);
  assert.match(r.reason, /no test/);
});

test('THE CASE THIS GATE EXISTS FOR: tests that pass against the base are rejected', () => {
  const r = verdict({ source: ['a.ts'], tests: ['a.test.ts'], testsPassedAgainstBase: true });
  assert.equal(r.ok, false);
  assert.match(r.reason, /do not verify this change/);
});

test('tests that fail without the change are accepted', () => {
  const r = verdict({ source: ['a.ts'], tests: ['a.test.ts'], testsPassedAgainstBase: false });
  assert.equal(r.ok, true);
});

test('a docs-only or CI-only pull request passes untouched', () => {
  const { source, tests } = classify(['docs/x.md', '.github/workflows/y.yml']);
  assert.deepEqual(source, []);
  assert.equal(verdict({ source, tests, testsPassedAgainstBase: null }).ok, true);
});

test('the refactor label excuses a passing base run, and says so on the record', () => {
  const r = verdict({
    source: ['a.ts'],
    tests: ['a.test.ts'],
    testsPassedAgainstBase: true,
    allowUnchangedBehaviour: true,
  });
  assert.equal(r.ok, true);
  assert.match(r.reason, /on the record/);
});

test('the label does NOT excuse shipping source with no test', () => {
  const r = verdict({
    source: ['a.ts'],
    tests: [],
    testsPassedAgainstBase: null,
    allowUnchangedBehaviour: true,
  });
  assert.equal(r.ok, false, 'the label must not become a way to skip writing tests');
});

test('routes a changed test to the workspace that can run it', () => {
  // The first version ran `pnpm --filter frontend` unconditionally, so a PR
  // whose only test change was in apps/backend ran nothing and reported a pass
  // it had not earned.
  assert.equal(workspaceOf('apps/backend/test/rate-limit-config.test.ts'), 'backend');
  assert.equal(workspaceOf('apps/frontend/src/app/__tests__/x.test.ts'), 'frontend');
  assert.equal(workspaceOf('scripts/ci/foo.test.mjs'), undefined);
  assert.equal(workspaceOf('apps/mobileAppYC/__tests__/x.test.ts'), 'mobileAppYC');
  // Scoped package, so the filter argument is not the directory name. While this
  // was missing, every desktop test change reported "outside a known workspace"
  // and the gate failed a PR that had in fact proved its change.
  assert.equal(workspaceOf('apps/desktop/tests/window-config.test.ts'), '@yosemite-crew/desktop');
});

test('groups tests per workspace and drops what this gate cannot run', () => {
  const grouped = groupTestsByWorkspace([
    'apps/backend/test/a.test.ts',
    'apps/frontend/src/app/__tests__/b.test.ts',
    'apps/frontend/src/app/__tests__/c.test.ts',
    'apps/frontend/e2e/d.spec.ts',
    'apps/mobileAppYC/__tests__/f.test.ts',
    'apps/desktop/tests/g.test.ts',
    'scripts/ci/e.test.mjs',
  ]);
  assert.deepEqual([...grouped.keys()].sort(), [
    '@yosemite-crew/desktop',
    'backend',
    'frontend',
    'mobileAppYC',
  ]);
  assert.equal(grouped.get('frontend').length, 2, 'e2e specs must not be run by this gate');
  assert.equal(grouped.get('backend').length, 1);
  assert.equal(grouped.get('mobileAppYC').length, 1);
  assert.equal(grouped.get('@yosemite-crew/desktop').length, 1);
});

test('a PR with only e2e test changes is not treated as proven', () => {
  const grouped = groupTestsByWorkspace(['apps/frontend/e2e/route-sweep.spec.ts']);
  assert.equal(grouped.size, 0, 'nothing runnable means no evidence, not a pass');
});

test('nothing runnable is NOT read as proof', () => {
  // This was the bug: `false` meant "the tests failed against the base", which
  // verdict reads as success. A PR whose only test change was an e2e spec
  // therefore PASSED the gate having proved nothing at all.
  const r = verdict({
    source: ['a.ts'],
    tests: ['apps/frontend/e2e/x.spec.ts'],
    testsPassedAgainstBase: null,
    nothingRunnable: 'e2e-only',
  });
  assert.equal(r.ok, false);
  assert.match(r.reason, /does not run/);
});

test('every changed test deleted is NOT read as proof either', () => {
  // PR #2889 deleted 3 dead components and their only tests. Asking jest to
  // run a path it deleted doesn't error - `--passWithNoTests` exits 0 with
  // zero tests executed, which this gate would otherwise misread as "the
  // tests survived their own revert" (a real pass), when nothing ran at all.
  const r = verdict({
    source: ['a.ts'],
    tests: ['a.test.ts'],
    testsPassedAgainstBase: null,
    nothingRunnable: 'all-tests-deleted',
  });
  assert.equal(r.ok, false);
  assert.match(r.reason, /DELETED/);
});

test('a genuine failure against the base is still a pass', () => {
  // The distinction that matters: tests ran and failed (proof) versus tests
  // never ran (no proof).
  const r = verdict({
    source: ['a.ts'],
    tests: ['apps/frontend/x.test.ts'],
    testsPassedAgainstBase: false,
    nothingRunnable: false,
  });
  assert.equal(r.ok, true);
});

test('the refactor label still excuses an unrunnable change', () => {
  const r = verdict({
    source: ['a.ts'],
    tests: ['apps/frontend/e2e/x.spec.ts'],
    nothingRunnable: 'e2e-only',
    allowUnchangedBehaviour: true,
  });
  assert.equal(r.ok, false, 'the label excuses a PASSING base run, not an unverifiable one');
});

test('categorizeSourceFiles: a file the branch deletes is its own category, not silently dropped or mistaken for modified', () => {
  // PR #2889 deleted 3 dead components. `existsAtBase` alone put them in
  // "modified" (true, they exist at base) and the restore step later ran
  // `git checkout HEAD -- <path>` on a path HEAD's tree does not have -
  // `error: pathspec '...' did not match any file(s) known to git`, crashing
  // the gate on a PR with nothing wrong with it.
  const atBase = new Set(['deleted.ts', 'modified.ts']);
  const atHead = new Set(['added.ts', 'modified.ts']);
  const { added, deleted, modified } = categorizeSourceFiles(
    ['added.ts', 'deleted.ts', 'modified.ts'],
    (f) => atBase.has(f),
    (f) => atHead.has(f)
  );
  assert.deepEqual(added, ['added.ts']);
  assert.deepEqual(deleted, ['deleted.ts']);
  assert.deepEqual(modified, ['modified.ts']);
});

test('categorizeSourceFiles: every file lands in exactly one category', () => {
  const files = ['a.ts', 'b.ts', 'c.ts', 'd.ts'];
  const atBase = new Set(['b.ts', 'c.ts']); // a=head-only, b=both, c=base-only, d=head-only
  const atHead = new Set(['a.ts', 'b.ts', 'd.ts']);
  const result = categorizeSourceFiles(
    files,
    (f) => atBase.has(f),
    (f) => atHead.has(f)
  );
  const seen = [...result.added, ...result.deleted, ...result.modified].sort();
  assert.deepEqual(seen, [...files].sort());
});

test('keeps only the changed paths jest will actually discover', () => {
  // The two reasons a handed-over path contributes no suite have to be told
  // apart: a support helper legitimately holds no tests, a path jest never
  // saw is a bug. Only the first may be subtracted silently.
  const discovered = [
    '/repo/apps/frontend/src/app/__tests__/(routes)/signin/page.test.tsx',
    '/repo/apps/frontend/src/app/__tests__/ui/Button.test.tsx',
  ];
  const kept = selectDiscoverable(
    [
      '/repo/apps/frontend/src/app/__tests__/(routes)/signin/page.test.tsx',
      '/repo/apps/frontend/src/app/__tests__/support/renderServerComponent.tsx',
      '/repo/apps/frontend/src/app/__tests__/ui/Button.test.tsx',
    ],
    discovered
  );
  assert.deepEqual(kept, [
    '/repo/apps/frontend/src/app/__tests__/(routes)/signin/page.test.tsx',
    '/repo/apps/frontend/src/app/__tests__/ui/Button.test.tsx',
  ]);
});

test('a route-group path is compared literally, not as a pattern', () => {
  // #3264: handed to jest positionally, `(routes)` is a capture group, so the
  // path matched `.../routes/...` - a DIFFERENT directory that also exists in
  // this repository - and the real suite never ran. Set membership cannot do
  // that: the two paths are simply unequal.
  const kept = selectDiscoverable(
    ['/repo/apps/frontend/src/app/__tests__/(routes)/signin/page.test.tsx'],
    ['/repo/apps/frontend/src/app/__tests__/routes/signin/page.test.tsx']
  );
  assert.deepEqual(
    kept,
    [],
    'a route-group path must not be satisfied by its unparenthesised twin'
  );
});

test('selectDiscoverable returns nothing when jest discovered nothing', () => {
  assert.deepEqual(selectDiscoverable(['/repo/a.test.ts'], []), []);
});

test('THE #3264 CASE: a suite that did not run is not read as one that passed', () => {
  // `testsPassedAgainstBase: false` is the branch that PASSES the gate. A
  // shortfall has to outrank it, or a path that silently never ran decides
  // the verdict - which is what this whole file exists to prevent.
  const r = verdict({
    source: ['a.ts'],
    tests: ['apps/frontend/src/app/__tests__/(routes)/signin/page.test.tsx'],
    testsPassedAgainstBase: false,
    suiteShortfall: { workspace: 'frontend', expected: 4, ran: 2 },
  });
  assert.equal(r.ok, false);
  assert.match(r.reason, /4 runnable test file\(s\) were handed to jest in frontend/);
  assert.match(r.reason, /2 test suite\(s\) ran/);
});

test('a shortfall is not excused by the no-behaviour-change label', () => {
  const r = verdict({
    source: ['a.ts'],
    tests: ['a.test.ts'],
    testsPassedAgainstBase: true,
    suiteShortfall: { workspace: 'backend', expected: 3, ran: 1 },
    allowUnchangedBehaviour: true,
  });
  assert.equal(r.ok, false, 'the label excuses a passing base run, not an unexecuted one');
  assert.match(r.reason, /not\nsomething the no-behaviour-change label covers/);
});

test('an unreadable jest report is reported as a shortfall, not as a pass', () => {
  // suitesRunFrom returns null when the JSON is missing or unparseable, which
  // must fail closed: "the gate does not know how many suites ran".
  const r = verdict({
    source: ['a.ts'],
    tests: ['a.test.ts'],
    testsPassedAgainstBase: false,
    suiteShortfall: { workspace: 'frontend', expected: 2, ran: null },
  });
  assert.equal(r.ok, false);
  assert.match(r.reason, /no suite count came back/);
});

test('no shortfall leaves the existing verdicts untouched', () => {
  // The new branch must be inert when every handed-over path ran.
  assert.equal(
    verdict({
      source: ['a.ts'],
      tests: ['a.test.ts'],
      testsPassedAgainstBase: false,
      suiteShortfall: null,
    }).ok,
    true
  );
  assert.equal(
    verdict({
      source: ['a.ts'],
      tests: ['a.test.ts'],
      testsPassedAgainstBase: true,
      suiteShortfall: null,
    }).ok,
    false
  );
});

test('a branch whose only test change is a helper proves nothing', () => {
  // The helper legitimately holds no test, so jest exits 0 having run nothing
  // and `allPassed` stays vacuously true. Reading that as "the tests survived
  // their own revert" is the false green --passWithNoTests used to hand out.
  const r = verdict({
    source: ['a.ts'],
    tests: ['apps/frontend/src/app/__tests__/support/renderServerComponent.tsx'],
    testsPassedAgainstBase: null,
    nothingRunnable: 'no-tests-in-changed-tests',
  });
  assert.equal(r.ok, false);
  assert.match(r.reason, /nothing was executed against the/);
});

test('the helper-only verdict is not excused by the label either', () => {
  const r = verdict({
    source: ['a.ts'],
    tests: ['apps/frontend/src/app/__tests__/support/renderServerComponent.tsx'],
    testsPassedAgainstBase: null,
    nothingRunnable: 'no-tests-in-changed-tests',
    allowUnchangedBehaviour: true,
  });
  assert.equal(r.ok, false, 'the label excuses a PASSING base run, not an unverifiable one');
});

test('the report path stays inside its directory for every workspace this gate runs', () => {
  // `@yosemite-crew/desktop` is a real workspace name and it carries a slash.
  // Interpolated raw, it named a directory nobody had created, so jest's
  // --outputFile write threw and no desktop run could ever be reconciled.
  const dir = '/tmp/some-report-dir';
  for (const ws of ['frontend', 'backend', 'mobileAppYC', '@yosemite-crew/desktop']) {
    const path = reportPathFor(ws, dir);
    assert.equal(dirname(path), dir, ws);
    assert.equal(isInside(dir, path), true, ws);
  }
});

test('a workspace name that tries to climb out cannot', () => {
  const dir = '/tmp/some-report-dir';
  for (const hostile of ['../../etc/passwd', '..', '/etc/passwd', 'a/../../b']) {
    assert.equal(dirname(reportPathFor(hostile, dir)), dir, hostile);
    assert.equal(isInside(dir, reportPathFor(hostile, dir)), true, hostile);
  }
});

test('isInside rejects what it is meant to reject', () => {
  // Without these the containment guard would be satisfied by anything and
  // the read it protects would be unbounded.
  assert.equal(isInside('/tmp/d', '/tmp/d/report.json'), true);
  assert.equal(isInside('/tmp/d', 'report.json'), true);
  assert.equal(isInside('/tmp/d', '/tmp/d'), false); // the directory is not a report
  assert.equal(isInside('/tmp/d', '../report.json'), false);
  assert.equal(isInside('/tmp/d', '/etc/passwd'), false);
  assert.equal(isInside('/tmp/d', '/tmp/dd/report.json'), false);
});

test('a readable report outside the run directory is not read', () => {
  // Fail closed, not open: the caller turns null into a shortfall, so a report
  // the gate did not write can never supply the suite count it trusts.
  const dir = mkdtempSync(join(tmpdir(), 'tests-must-be-able-to-fail-test-'));
  const outside = join(tmpdir(), `outside-${process.pid}.json`);
  try {
    writeFileSync(join(dir, 'frontend.json'), JSON.stringify({ numTotalTestSuites: 2 }));
    writeFileSync(outside, JSON.stringify({ numTotalTestSuites: 99 }));
    // The control: the same read succeeds when the report is where we put it.
    assert.equal(suitesRunFrom(join(dir, 'frontend.json'), dir), 2);
    assert.equal(suitesRunFrom(outside, dir), null);
    assert.equal(suitesRunFrom(join(dir, '../..', outside), dir), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(outside, { force: true });
  }
});

test('the report directory is private, is not the shared tmpdir, and is removed', () => {
  let seen;
  const returned = withReportDir((dir) => {
    seen = dir;
    assert.notEqual(dir, tmpdir(), 'writing reports straight into the shared tmpdir');
    assert.equal(isInside(tmpdir(), dir), true);
    assert.equal(existsSync(dir), true);
    // Non-empty, so a cleanup that is not recursive leaves the directory behind.
    writeFileSync(join(dir, 'frontend.json'), '{}');
    return 'value';
  });
  assert.equal(returned, 'value');
  assert.equal(existsSync(seen), false, 'report directory outlived the run');
});

test('two runs never share a report directory', () => {
  const dirs = [withReportDir((d) => d), withReportDir((d) => d)];
  assert.notEqual(dirs[0], dirs[1]);
});

test('the report directory is removed even when the run throws', () => {
  let seen;
  assert.throws(() =>
    withReportDir((dir) => {
      seen = dir;
      writeFileSync(join(dir, 'frontend.json'), '{}');
      throw new Error('jest exploded');
    })
  );
  assert.equal(existsSync(seen), false);
});

test('a report that does not state a suite count fails closed', () => {
  // The caller compares this to the number of files it handed jest, so any
  // non-number reaching it would be an inequality read as a shortfall by luck
  // rather than by decision.
  const dir = mkdtempSync(join(tmpdir(), 'tests-must-be-able-to-fail-test-'));
  const write = (body) => {
    writeFileSync(join(dir, 'frontend.json'), body);
    return suitesRunFrom(join(dir, 'frontend.json'), dir);
  };
  try {
    assert.equal(write(JSON.stringify({ numTotalTestSuites: 3 })), 3);
    assert.equal(write(JSON.stringify({ numTotalTestSuites: '3' })), null);
    assert.equal(write(JSON.stringify({})), null);
    assert.equal(write('not json'), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
