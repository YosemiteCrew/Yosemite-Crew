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
import {
  evaluate,
  findUnrunSpecs,
  listSpecs,
  specsNamedInRun,
  specsNamedInWorkflow,
} from './check-e2e-spec-coverage.mjs';

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

test('listSpecs reaches a spec in a subdirectory', () => {
  // `testDir` discovery is recursive, so a spec parked one level down is
  // exactly as invisible to the workflow list as one at the top.
  assert.ok(
    listSpecs().every((spec) => spec.startsWith('e2e/')),
    'spec paths are relative to apps/frontend'
  );
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
  const { code, errors } = evaluate({
    specs: ['e2e/smoke.spec.ts', 'e2e/session-write-replay.spec.ts'],
    named: new Set(['e2e/smoke.spec.ts']),
    unrun: ['e2e/session-write-replay.spec.ts'],
  });
  assert.equal(code, 1);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /apps\/frontend\/e2e\/session-write-replay\.spec\.ts/);
});

test('an empty spec inventory is could-not-run, not a pass', () => {
  const { code } = evaluate({ specs: [], named: new Set(['e2e/smoke.spec.ts']), unrun: [] });
  assert.equal(code, 2);
});

test('workflows naming no spec at all is could-not-run, not a pass', () => {
  const { code } = evaluate({ specs: ['e2e/smoke.spec.ts'], named: new Set(), unrun: [] });
  assert.equal(code, 2);
});

test('a fully covered tree passes', () => {
  const { code, errors } = evaluate({
    specs: ['e2e/smoke.spec.ts'],
    named: new Set(['e2e/smoke.spec.ts']),
    unrun: [],
  });
  assert.equal(code, 0);
  assert.deepEqual(errors, []);
});
