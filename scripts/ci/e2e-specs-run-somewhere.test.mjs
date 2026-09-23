import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const SPEC_DIR = 'apps/frontend/e2e';
const WORKFLOW_DIR = '.github/workflows';

// The Playwright jobs name their specs explicitly rather than running the whole
// directory, so a spec that nobody adds to a run list is not skipped - it is
// invisible, and the job it should have failed reports green. frontend-e2e.yml
// already carries a comment asking for the spec and the run-list entry in one
// commit; #3502 and #3428 both shipped without it anyway, and #3428's spec sat
// unrun for long enough to rot. A comment is not a gate; this is.
const withoutComments = (text) =>
  text
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n');

const specFiles = () => readdirSync(SPEC_DIR).filter((name) => name.endsWith('.spec.ts'));

const workflowSource = () =>
  readdirSync(WORKFLOW_DIR)
    .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
    .map((name) => withoutComments(readFileSync(`${WORKFLOW_DIR}/${name}`, 'utf8')))
    .join('\n');

test('a commented-out spec name does not count as a run', () => {
  const source = withoutComments(
    ['jobs:', '  # e2e/ghost.spec.ts', '  run: e2e/real.spec.ts'].join('\n')
  );

  assert.equal(source.includes('e2e/ghost.spec.ts'), false);
  assert.equal(source.includes('e2e/real.spec.ts'), true);
});

test('every Playwright spec is named in a workflow', () => {
  const files = specFiles();
  const source = workflowSource();

  // Liveness. Both reads can come back empty - a moved spec directory, a
  // renamed workflow directory - and the membership check below passes
  // vacuously on either. Pin a spec that is known to run, so an empty corpus
  // fails here instead of reporting the gate as held.
  assert.ok(files.length > 0, `no *.spec.ts found under ${SPEC_DIR}`);
  assert.ok(
    source.includes('e2e/smoke.spec.ts'),
    `no workflow under ${WORKFLOW_DIR} names e2e/smoke.spec.ts`
  );

  const missing = files.filter((name) => !source.includes(`e2e/${name}`));

  assert.deepEqual(
    missing,
    [],
    `these specs are in no workflow, so their tests never run in CI: ${missing.join(', ')}`
  );
});
