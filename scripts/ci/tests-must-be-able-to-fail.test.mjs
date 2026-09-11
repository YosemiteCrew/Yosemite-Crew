import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classify,
  groupTestsByWorkspace,
  workspaceOf,
  isCheckableSource,
  isTestFile,
  verdict,
  categorizeSourceFiles,
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
});

test('groups tests per workspace and drops what this gate cannot run', () => {
  const grouped = groupTestsByWorkspace([
    'apps/backend/test/a.test.ts',
    'apps/frontend/src/app/__tests__/b.test.ts',
    'apps/frontend/src/app/__tests__/c.test.ts',
    'apps/frontend/e2e/d.spec.ts',
    'apps/mobileAppYC/__tests__/f.test.ts',
    'scripts/ci/e.test.mjs',
  ]);
  assert.deepEqual([...grouped.keys()].sort(), ['backend', 'frontend', 'mobileAppYC']);
  assert.equal(grouped.get('frontend').length, 2, 'e2e specs must not be run by this gate');
  assert.equal(grouped.get('backend').length, 1);
  assert.equal(grouped.get('mobileAppYC').length, 1);
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
