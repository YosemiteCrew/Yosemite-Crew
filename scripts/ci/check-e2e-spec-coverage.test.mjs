// Tests for the e2e spec coverage gate.
//
// The real tree is pinned first, because reading it is what the CI step does.
// Everything else is a fixture: the defect is one the repo is being fixed of in
// the same change, so a test that could only read the current tree would pass
// for the rest of time without ever having been able to fail.
//
// The comment cases are not hypothetical. `frontend-e2e.yml` carries a comment
// telling you how to reproduce the authenticated job locally, and that comment
// contains two spec paths verbatim - so a text search over the file credits
// those specs whether or not any step still runs them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluate,
  excludesPullRequest,
  findUnrunSpecs,
  listSpecs,
  POST_MERGE_ONLY_SPECS,
  preMergeSpecsInWorkflow,
  pullRequestJobs,
  SPEC_DIR,
  specsNamedInRun,
  specsNamedInWorkflow,
} from './check-e2e-spec-coverage.mjs';

/** The real `testDir`, derived the same way the script derives it. */
const SPEC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..', SPEC_DIR);

/**
 * Where the recursion case plants its spec. Named so a copy left behind by a
 * killed run is obviously not a real spec; the gate would report it as unrun,
 * which is the safe direction.
 */
const PROBE_DIR = '__coverage-probe__';

/** A one-job workflow whose single step carries `run`. */
const workflow = (run) => `
name: fixture
on: { pull_request: {} }
jobs:
  public:
    runs-on: ubuntu-latest
    steps:
${run}
`;

test('every spec in the repo is named by a workflow', () => {
  assert.deepEqual(findUnrunSpecs().unrun, []);
});

test('the repo has specs and workflows that name them', () => {
  // Without this the case above passes on an empty inventory, which is the
  // shape of a broken walk rather than a clean repo.
  const { specs, named } = findUnrunSpecs();
  assert.ok(specs.length >= 10, `expected the frontend e2e inventory, got ${specs.length}`);
  assert.ok(named.size >= 10, `expected workflows to name specs, got ${named.size}`);
});

test('listSpecs reaches a spec parked in a subdirectory', () => {
  // `testDir` discovery is recursive, so a spec one level down is exactly as
  // invisible to the workflow list as one at the top - and a walk that stopped
  // at the top level would still return paths under `e2e/`, so asserting the
  // prefix proves nothing about the recursion. The spec has to be planted and
  // then found, and removed again before any other case reads the inventory -
  // an unlisted spec is exactly what the coverage cases are there to fail on.
  const nested = path.join(SPEC_ROOT, PROBE_DIR);
  mkdirSync(nested, { recursive: true });
  try {
    writeFileSync(path.join(nested, 'probe.spec.ts'), '');
    const specs = listSpecs();
    assert.ok(
      specs.includes(`e2e/${PROBE_DIR}/probe.spec.ts`),
      `the planted spec was not returned: ${specs.join(', ')}`
    );
  } finally {
    rmSync(nested, { recursive: true, force: true });
  }
});

test('a spec named in a command counts', () => {
  assert.deepEqual(specsNamedInRun('pnpm exec playwright test e2e/smoke.spec.ts'), [
    'e2e/smoke.spec.ts',
  ]);
});

test('a spec named only in a YAML comment does not count', () => {
  const source = workflow(`      # Reproduce locally with \`playwright test e2e/auth-flow.spec.ts
      # e2e/developer-portal.spec.ts\` using your own credentials.
      - name: Run the public flows
        run: pnpm exec playwright test e2e/smoke.spec.ts`);
  assert.deepEqual([...specsNamedInWorkflow(source)], ['e2e/smoke.spec.ts']);
});

test('a spec named only in a shell comment inside run does not count', () => {
  // A YAML comment is dropped by the parser; one inside a block scalar is not,
  // so it has to be dropped here.
  const source = workflow(`      - name: Run the public flows
        run: |
          # e2e/auth-flow.spec.ts needs a session and runs in the other job
          pnpm exec playwright test e2e/smoke.spec.ts`);
  assert.deepEqual([...specsNamedInWorkflow(source)], ['e2e/smoke.spec.ts']);
});

test('a spec in a different directory does not credit this one', () => {
  assert.deepEqual(specsNamedInRun('pnpm exec playwright test my-e2e/smoke.spec.ts'), []);
});

test('a step with no run is not read for specs', () => {
  const source = workflow(`      - name: Checkout
        uses: actions/checkout@v7`);
  assert.deepEqual([...specsNamedInWorkflow(source)], []);
});

test('an unnamed spec is a finding, and the message names the file', () => {
  const { code, errors } = evaluate(
    {
      specs: ['e2e/smoke.spec.ts', 'e2e/session-write-replay.spec.ts'],
      named: new Set(['e2e/smoke.spec.ts']),
      preMerge: new Set(['e2e/smoke.spec.ts']),
      unrun: ['e2e/session-write-replay.spec.ts'],
    },
    {}
  );
  assert.equal(code, 1);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /apps\/frontend\/e2e\/session-write-replay\.spec\.ts/);
});

test('an empty spec inventory is could-not-run, not a pass', () => {
  const { code } = evaluate({
    specs: [],
    named: new Set(['e2e/smoke.spec.ts']),
    preMerge: new Set(['e2e/smoke.spec.ts']),
    unrun: [],
  });
  assert.equal(code, 2);
});

test('workflows naming no spec at all is could-not-run, not a pass', () => {
  const { code } = evaluate({
    specs: ['e2e/smoke.spec.ts'],
    named: new Set(),
    preMerge: new Set(),
    unrun: [],
  });
  assert.equal(code, 2);
});

test('a fully covered tree passes', () => {
  const { code, errors } = evaluate(
    {
      specs: ['e2e/smoke.spec.ts'],
      named: new Set(['e2e/smoke.spec.ts']),
      preMerge: new Set(['e2e/smoke.spec.ts']),
      unrun: [],
    },
    {}
  );
  assert.equal(code, 0);
  assert.deepEqual(errors, []);
});

// --- pre-merge reachability (#3546) -----------------------------------------
//
// Being named by a workflow is not being run before a merge. These cases drive
// the classifier that tells the two apart, and the findings it feeds.

/** A two-job workflow: `public` always runs, `gated` carries `condition`. */
const gatedWorkflow = ({ trigger = '{ pull_request: {} }', condition, needs = '' }) => `
name: fixture
on: ${trigger}
jobs:
  public:
    runs-on: ubuntu-latest
    steps:
      - run: pnpm exec playwright test e2e/smoke.spec.ts
  gated:
${needs}${condition === undefined ? '' : `    if: ${condition}\n`}    runs-on: ubuntu-latest
    steps:
      - run: pnpm exec playwright test e2e/auth-flow.spec.ts
`;

test('an if that excludes pull_request is read as excluding it', () => {
  assert.equal(excludesPullRequest("github.event_name != 'pull_request'"), true);
  assert.equal(
    excludesPullRequest(
      "needs.preflight.outputs.x == 'true' && github.event_name != 'pull_request'"
    ),
    true
  );
  // The other spelling the workflows here use - naming the events it does run
  // on. pull_request_target is a different event, so it excludes too.
  assert.equal(excludesPullRequest("github.event_name == 'push'"), true);
  assert.equal(excludesPullRequest("github.event_name == 'pull_request_target'"), true);
});

test('an if that admits pull_request is not read as excluding it', () => {
  // The Sonar and Chromatic shape: the exclusion is one alternative of an `||`,
  // so the job still runs on a same-repo pull request. Requiring every
  // alternative to exclude is what keeps this from reading as a skip.
  assert.equal(
    excludesPullRequest(
      "github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository"
    ),
    false
  );
  assert.equal(excludesPullRequest("github.event_name == 'pull_request'"), false);
  assert.equal(excludesPullRequest("needs.changes.outputs.frontend == 'true'"), false);
  assert.equal(excludesPullRequest(undefined), false);
});

test('a job excluded from pull_request contributes no pre-merge spec', () => {
  const source = gatedWorkflow({ condition: "github.event_name != 'pull_request'" });
  // Named either way - that is the ceiling this change is about.
  assert.deepEqual([...specsNamedInWorkflow(source)].sort(), [
    'e2e/auth-flow.spec.ts',
    'e2e/smoke.spec.ts',
  ]);
  assert.deepEqual([...preMergeSpecsInWorkflow(source)], ['e2e/smoke.spec.ts']);
});

test('the same job without the exclusion does contribute one', () => {
  // The counterpart to the case above: with only the `if` changed, the spec
  // moves. Without this the case above passes on a classifier that returns the
  // public job and nothing else whatever the condition says.
  const source = gatedWorkflow({ condition: "needs.changes.outputs.frontend == 'true'" });
  assert.deepEqual([...preMergeSpecsInWorkflow(source)].sort(), [
    'e2e/auth-flow.spec.ts',
    'e2e/smoke.spec.ts',
  ]);
});

test('a job inherits its dependencies exclusion', () => {
  // frontend-e2e.yml's real shape: playwright-auth needs preflight, and
  // skipping preflight on a pull request is what actually skips it. Reading
  // only the job's own `if` would call this one reachable.
  const source = `
name: fixture
on: { pull_request: {} }
jobs:
  preflight:
    if: github.event_name != 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - run: echo preflight
  gated:
    needs: [preflight]
    runs-on: ubuntu-latest
    steps:
      - run: pnpm exec playwright test e2e/auth-flow.spec.ts
`;
  assert.deepEqual([...pullRequestJobs(source)], []);
  assert.deepEqual([...preMergeSpecsInWorkflow(source)], []);
});

test('a needs cycle terminates and still reports the exclusion inside it', () => {
  // Actions rejects a cycle, so this is about a malformed file not hanging the
  // walk. Removing the `seen` guard makes this spin forever rather than fail, so
  // what is pinned here is the answer: the guard that stops the revisit must not
  // lose the exclusion the cycle contains. `blocked` is unreachable on a pull
  // request and so is `spun`, which needs it, though each is reached from the other.
  const cyclic = (condition) => `
name: fixture
on: { pull_request: {} }
jobs:
  spun:
    needs: [blocked]
    runs-on: ubuntu-latest
    steps:
      - run: echo spun
  blocked:
    needs: [spun]
${condition === undefined ? '' : `    if: ${condition}\n`}    runs-on: ubuntu-latest
    steps:
      - run: echo blocked
`;
  assert.deepEqual([...pullRequestJobs(cyclic(undefined))].sort(), ['blocked', 'spun']);
  assert.deepEqual([...pullRequestJobs(cyclic("github.event_name != 'pull_request'"))], []);
});

test('a workflow without the pull_request trigger contributes no pre-merge spec', () => {
  const source = gatedWorkflow({ trigger: '{ push: { branches: [dev] } }', condition: undefined });
  assert.deepEqual([...pullRequestJobs(source)], []);
  assert.deepEqual([...preMergeSpecsInWorkflow(source)], []);
  // The list form of `on:` is the same trigger written differently.
  assert.deepEqual([...pullRequestJobs(gatedWorkflow({ trigger: '[pull_request]' }))].sort(), [
    'gated',
    'public',
  ]);
});

test('a spec that runs only after merge is a finding unless it is recorded', () => {
  const found = {
    specs: ['e2e/smoke.spec.ts', 'e2e/no-js.spec.ts'],
    named: new Set(['e2e/smoke.spec.ts', 'e2e/no-js.spec.ts']),
    preMerge: new Set(['e2e/smoke.spec.ts']),
    unrun: [],
  };
  const { code, errors } = evaluate(found, {});
  assert.equal(code, 1);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /apps\/frontend\/e2e\/no-js\.spec\.ts/);
  assert.match(errors[0], /never runs before a merge/);
});

test('a recorded spec that runs only after merge is not a finding', () => {
  const recorded = 'e2e/auth-flow.spec.ts';
  const { code, errors } = evaluate(
    {
      specs: ['e2e/smoke.spec.ts', recorded],
      named: new Set(['e2e/smoke.spec.ts', recorded]),
      preMerge: new Set(['e2e/smoke.spec.ts']),
      unrun: [],
    },
    { [recorded]: 'signs in' }
  );
  assert.equal(code, 0);
  assert.deepEqual(errors, []);
});

test('a recorded spec that has started running pre-merge is a stale entry', () => {
  const recorded = 'e2e/auth-flow.spec.ts';
  const { code, errors } = evaluate(
    {
      specs: ['e2e/smoke.spec.ts', recorded],
      named: new Set(['e2e/smoke.spec.ts', recorded]),
      preMerge: new Set(['e2e/smoke.spec.ts', recorded]),
      unrun: [],
    },
    { [recorded]: 'signs in' }
  );
  assert.equal(code, 1);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /now runs on a pull_request/);
});

test('a recorded spec that no longer exists is a stale entry', () => {
  const { code, errors } = evaluate(
    {
      specs: ['e2e/smoke.spec.ts'],
      named: new Set(['e2e/smoke.spec.ts']),
      preMerge: new Set(['e2e/smoke.spec.ts']),
      unrun: [],
    },
    { 'e2e/deleted.spec.ts': 'gone' }
  );
  assert.equal(code, 1);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /no longer exists/);
});

test('no pre-merge spec at all is could-not-run, not a pass', () => {
  const { code, errors } = evaluate(
    {
      specs: ['e2e/smoke.spec.ts'],
      named: new Set(['e2e/smoke.spec.ts']),
      preMerge: new Set(),
      unrun: [],
    },
    {}
  );
  assert.equal(code, 2);
  assert.match(errors[0], /could not run/);
});

test('the real tree splits into a non-empty pre-merge set and exactly the recorded rest', () => {
  // Pins both halves. Asserting only that the tree passes would also pass on a
  // classifier that called every spec pre-merge, which is the reading this
  // change exists to end.
  const found = findUnrunSpecs();
  const postMerge = found.specs.filter((spec) => !found.preMerge.has(spec));
  assert.ok(found.preMerge.size > 0, 'no spec was found to run on a pull request');
  assert.ok(postMerge.length > 0, 'the authenticated job names no spec of its own');
  assert.deepEqual(postMerge.sort(), Object.keys(POST_MERGE_ONLY_SPECS).sort());
  assert.equal(evaluate(found).code, 0);
});
