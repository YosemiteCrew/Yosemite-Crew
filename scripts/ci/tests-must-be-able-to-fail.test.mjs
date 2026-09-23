import test from 'node:test';
import assert from 'node:assert/strict';
import { basename, dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import {
  baseFromMergeCommit,
  changedFiles,
  parentsOf,
  classify,
  groupTestsByWorkspace,
  authTestsOf,
  scriptTestsOf,
  selectDiscoverable,
  workspaceOf,
  isCheckableSource,
  isTestFile,
  verdict,
  categorizeSourceFiles,
  absolutePathsIn,
  resolveInside,
  suiteCountOf,
  withJestReport,
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
  assert.equal(
    workspaceOf('packages/agent-runtime/test/contract.test.ts'),
    '@yosemite-crew/agent-runtime'
  );
  assert.equal(workspaceOf('packages/mcp-server/test/client.test.ts'), '@yosemite-crew/mcp-server');
  // auth runs node --test over compiled output, so its paths must not be
  // handed to jest.
  assert.equal(workspaceOf('packages/auth/src/auth-service.test.ts'), undefined);
  assert.equal(workspaceOf('packages/types/src/x.test.ts'), undefined);
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
  assert.equal(
    scriptTestsOf(['apps/frontend/e2e/route-sweep.spec.ts']).length,
    0,
    'the root runner must not claim an e2e spec either'
  );
});

test('routes a root-script test to the runner that can execute it', () => {
  assert.deepEqual(
    scriptTestsOf([
      'scripts/mobile/check-react-renderer-pin.test.mjs',
      'scripts/ci/forbidden-terms.test.mjs',
      'scripts/security/supply-chain.test.mjs',
    ]),
    [
      'scripts/mobile/check-react-renderer-pin.test.mjs',
      'scripts/ci/forbidden-terms.test.mjs',
      'scripts/security/supply-chain.test.mjs',
    ]
  );
});

test('the root runner claims only what node --test can load', () => {
  // A workspace test belongs to jest, the source file beside a script test is
  // not a test, and node's runner cannot load TypeScript - handing it one
  // would produce a load error, which this gate reads as evidence that the
  // test depends on the reverted change.
  assert.deepEqual(
    scriptTestsOf([
      'apps/frontend/src/app/__tests__/x.test.ts',
      'scripts/mobile/check-react-renderer-pin.mjs',
      'scripts/mobile/thing.test.ts',
      'scripts/ci/__tests__/helper.ts',
    ]),
    []
  );
});

test('routes only compiled auth tests to the auth node:test runner', () => {
  assert.deepEqual(
    authTestsOf([
      'packages/auth/src/auth-service.test.ts',
      'packages/auth/src/providers/legacy-cognito/legacy-token-verifier.test.ts',
      'packages/auth/src/support.ts',
      'packages/types/src/types.test.ts',
    ]),
    [
      'packages/auth/src/auth-service.test.ts',
      'packages/auth/src/providers/legacy-cognito/legacy-token-verifier.test.ts',
    ]
  );
});

test('THE #3349 CASE: a scripts-only test change is runnable, not "outside a known workspace"', () => {
  // The gate knew four jest workspaces, all under apps/, and nothing about the
  // root `test:scripts` runner. So a branch adding scripts/mobile/x.mjs with
  // its own passing scripts/mobile/x.test.mjs grouped to zero workspaces, took
  // the e2e-only branch, and was rejected for tests the gate never tried to
  // run. This is the conjunction main() branches on.
  const changed = [
    'scripts/mobile/check-react-renderer-pin.test.mjs',
    'scripts/ci/tests-must-be-able-to-fail.test.mjs',
  ];
  assert.equal(groupTestsByWorkspace(changed).size, 0, 'no jest workspace owns these');
  assert.equal(scriptTestsOf(changed).length, 2, 'but the root runner does');

  // And the verdict such a run can now reach, which it could not before.
  const r = verdict({
    source: ['scripts/mobile/check-react-renderer-pin.mjs'],
    tests: changed,
    testsPassedAgainstBase: false,
  });
  assert.equal(r.ok, true);
  assert.match(r.reason, /fail without the source change/);
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

test('the report path is a literal name under the directory just created', () => {
  // The name used to interpolate the workspace, and one real workspace name
  // carries a slash - it pointed at a directory nobody had created, jest's
  // --outputFile write threw, and no desktop run could ever be reconciled.
  const seen = [];
  for (const ws of ['frontend', 'backend', 'mobileAppYC', '@yosemite-crew/desktop']) {
    withJestReport((report) => {
      seen.push(report);
      assert.equal(basename(report).includes('/'), false, ws);
      assert.equal(existsSync(dirname(report)), true, ws);
      assert.equal(dirname(dirname(report)), resolve(tmpdir()), ws);
    });
  }
  assert.equal(
    new Set(seen.map((p) => basename(p))).size,
    1,
    'the report name varies with the workspace'
  );
  assert.equal(new Set(seen.map((p) => dirname(p))).size, 4, 'two runs shared a report directory');
});

test('resolveInside accepts what is inside and refuses what is not', () => {
  // The changed-file list reaches this from `git diff`. Without the refusal a
  // path naming something above the repository root would be resolved and run.
  assert.equal(resolveInside('/tmp/d', 'report.json'), '/tmp/d/report.json');
  assert.equal(resolveInside('/tmp/d', 'a/b.json'), '/tmp/d/a/b.json');
  for (const outside of [
    '..',
    '../report.json',
    '/tmp/d/report.json',
    '/etc/passwd',
    'a/../../b',
    '.',
    'a//b',
    'a\\b',
    'a\0b',
  ]) {
    assert.throws(() => resolveInside('/tmp/d', outside), /not inside/, outside);
  }
});

test('the suite total comes from the report the run just wrote', () => {
  assert.equal(
    withJestReport((report) => writeFileSync(report, JSON.stringify({ numTotalTestSuites: 2 }))),
    2
  );
  // Fail closed, not open: a run that wrote nothing is "the gate does not know
  // how many suites ran", which the caller turns into a shortfall.
  assert.equal(
    withJestReport(() => {}),
    null
  );
});

test('the report directory is private, is not the shared tmpdir, and is removed', () => {
  let seen;
  withJestReport((report) => {
    seen = dirname(report);
    assert.notEqual(seen, resolve(tmpdir()), 'writing reports straight into the shared tmpdir');
    assert.equal(existsSync(seen), true);
    // Non-empty, so a cleanup that is not recursive leaves the directory behind.
    writeFileSync(report, '{}');
  });
  assert.equal(existsSync(seen), false, 'report directory outlived the run');
});

test('the report directory is removed even when the run throws', () => {
  let seen;
  const ran = withJestReport((report) => {
    seen = dirname(report);
    writeFileSync(report, '{}');
    throw new Error('jest exploded');
  });
  assert.equal(ran, null);
  assert.equal(existsSync(seen), false);
});

test('a report that does not state a suite count fails closed', () => {
  // The caller compares this to the number of files it handed jest, so any
  // non-number reaching it would be an inequality read as a shortfall by luck
  // rather than by decision.
  assert.equal(suiteCountOf(JSON.stringify({ numTotalTestSuites: 3 })), 3);
  assert.equal(suiteCountOf(JSON.stringify({ numTotalTestSuites: '3' })), null);
  assert.equal(suiteCountOf(JSON.stringify({})), null);
  assert.equal(suiteCountOf('not json'), null);
  assert.equal(suiteCountOf(''), null);
});

test('changed paths are made absolute and confined to the repository', () => {
  const root = '/tmp/some-repo-root';
  assert.deepEqual(absolutePathsIn(root, ['apps/frontend/a.test.tsx', 'apps/backend/b.test.ts']), [
    '/tmp/some-repo-root/apps/frontend/a.test.tsx',
    '/tmp/some-repo-root/apps/backend/b.test.ts',
  ]);
  // A path naming something above the root is refused, not resolved and run.
  for (const outside of ['../elsewhere/a.test.ts', '/etc/passwd', 'apps/../../a.test.ts']) {
    assert.throws(() => absolutePathsIn(root, [outside]), /not inside/, outside);
  }
});

test('changed test paths cannot escape through a symbolic link', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'mutation-gate-root-'));
  const outside = `${root}-outside.test.ts`;
  try {
    writeFileSync(outside, 'not a repository test');
    symlinkSync(outside, resolve(root, 'outside.test.ts'));
    assert.throws(
      () => absolutePathsIn(root, ['outside.test.ts']),
      /refusing a symbolic-link test path/
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { force: true });
  }
});

test('the base comes from the merge commit, not from the event payload', () => {
  // #3530: the event's base sha is the base branch tip when the event fired,
  // and the merge ref is recomputed as the base branch moves. The merge
  // commit's own first parent is the only base that cannot drift away from the
  // commit being diffed.
  assert.equal(baseFromMergeCommit(['a9920024', 'a5f7ba79'], 'a5f7ba79'), 'a9920024');
});

test('a checkout that is not the merge commit yields no base at all', () => {
  // Both of these have a plausible `parents[0]` - the branch's own previous
  // commit - which would narrow the range to one commit with no error at all.
  assert.equal(baseFromMergeCommit(['a5f7ba79'], 'a5f7ba79'), null, 'a head-sha checkout');
  assert.equal(
    baseFromMergeCommit(['0cb8629c', 'a9920024'], 'a5f7ba79'),
    null,
    'a branch that merged its base in by hand'
  );
});

test('the range excludes what the base branch merged after this branch forked', () => {
  // Reproduces #3530 against a real repository: a base branch that moves on
  // after the branch forks, and the merge commit GitHub recomputes from the two.
  const repo = mkdtempSync(resolve(tmpdir(), 'gate-base-skew-'));
  const hooks = resolve(repo, 'no-hooks');
  const git = (...args) =>
    execFileSync(
      'git',
      [
        '-C',
        repo,
        '-c',
        `core.hooksPath=${hooks}`,
        '-c',
        'user.email=t@example.com',
        '-c',
        'user.name=T',
        ...args,
      ],
      { encoding: 'utf8' }
    ).trim();
  const commit = (file, body) => {
    writeFileSync(resolve(repo, file), body);
    git('add', file);
    git('commit', '-q', '-m', file);
    return git('rev-parse', 'HEAD');
  };

  try {
    mkdirSync(hooks);
    git('init', '-q', '-b', 'base');
    // The base branch tip when the pull request event fired, which is what the
    // job used to be handed as its base.
    const baseShaAtEventTime = commit('base.ts', 'export const a = 1;\n');

    git('checkout', '-q', '-b', 'feature');
    commit('feature.ts', 'export const b = 2;\n');
    const head = commit('feature.test.ts', 'test("b", () => {});\n');

    // Another pull request lands on the base branch while this one is open.
    git('checkout', '-q', 'base');
    const movedBase = commit('foreign.test.ts', 'test("foreign", () => {});\n');

    // The --base fallback, used by workflow_dispatch and local runs, where HEAD
    // is the branch itself. Three-dot is what keeps a base branch that has moved
    // on out of the range there; a two-dot range would report `foreign.test.ts`
    // as a file this branch deleted.
    git('checkout', '-q', head);
    assert.deepEqual(changedFiles(movedBase, git), ['feature.test.ts', 'feature.ts']);
    git('checkout', '-q', 'base');

    // refs/pull/<n>/merge, recomputed against the base branch as it is NOW.
    git('merge', '-q', '--no-ff', '--no-verify', 'feature');
    const parents = parentsOf('HEAD', git);

    const base = baseFromMergeCommit(parents, head);
    assert.equal(base, parents[0]);
    assert.deepEqual(changedFiles(base, git), ['feature.test.ts', 'feature.ts']);

    // The control. The same range taken from the event's base sha hands the
    // gate a test this branch never wrote, whose failure it would report as
    // this branch proving itself. Without this the assertion above could be
    // passing on a fixture incapable of reproducing the bug.
    assert.ok(
      changedFiles(baseShaAtEventTime, git).includes('foreign.test.ts'),
      'the fixture must be able to reproduce the misattribution'
    );
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
