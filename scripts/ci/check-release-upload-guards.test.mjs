// Tests for the store-submission gate. Reading the real workflows is what the CI step
// does, so that case is pinned first — but every other case is a fixture, because the
// defect this exists to catch is one the repo no longer has and a test that can only
// read the current tree could never fail.
//
// The shapes below are the real ones. `mobile-release.yml` shipped for months with
// both upload steps carrying no condition at all, on a workflow whose jobs are
// reachable from `workflow_dispatch` by design.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyStep,
  isTagOnly,
  findUnguardedSubmissions,
  checkRepo,
} from './check-release-upload-guards.mjs';

/** A one-job workflow around `steps`, indented to match. */
const workflow = (steps) => `
name: fixture
on:
  push:
    tags: ['mobile-v*']
  workflow_dispatch: {}
jobs:
  android:
    runs-on: ubuntu-latest
    environment: release
    steps:
${steps}
`;

const PLAY_UNGUARDED = `      - name: Upload to Play internal track
        uses: r0adkll/upload-google-play@e738b9dd8f2476ea806d921b64aacd24f34515a5 # v1.1.5
        with:
          track: internal
          status: completed`;

const PLAY_GUARDED = `      - name: Upload to Play internal track (tag pushes only)
        if: github.event_name == 'push'
        uses: r0adkll/upload-google-play@e738b9dd8f2476ea806d921b64aacd24f34515a5 # v1.1.5
        with:
          track: internal
          status: completed`;

const TESTFLIGHT_UNGUARDED = `      - name: Upload to TestFlight
        run: |
          xcrun altool --upload-app -f "\${RUNNER_TEMP}/export/app.ipa" -t ios`;

const TESTFLIGHT_GUARDED = `      - name: Upload to TestFlight (tag pushes only)
        if: github.event_name == 'push'
        run: |
          xcrun altool --upload-app -f "\${RUNNER_TEMP}/export/app.ipa" -t ios`;

test('the repo has no unguarded store submissions', () => {
  assert.deepEqual(checkRepo(), []);
});

test('an unguarded Play upload is caught', () => {
  const findings = findUnguardedSubmissions(workflow(PLAY_UNGUARDED), 'fixture.yml');
  assert.equal(findings.length, 1);
  assert.equal(findings[0].store, 'Google Play');
  assert.equal(findings[0].job, 'android');
  assert.equal(findings[0].condition, null);
});

test('an unguarded TestFlight upload is caught', () => {
  const findings = findUnguardedSubmissions(workflow(TESTFLIGHT_UNGUARDED), 'fixture.yml');
  assert.equal(findings.length, 1);
  assert.equal(findings[0].store, 'App Store Connect');
});

test('both unguarded uploads are reported, not just the first', () => {
  const source = workflow(`${PLAY_UNGUARDED}\n${TESTFLIGHT_UNGUARDED}`);
  assert.equal(findingsStores(source).join(','), 'Google Play,App Store Connect');
});

test('the guard as shipped clears both', () => {
  const source = workflow(`${PLAY_GUARDED}\n${TESTFLIGHT_GUARDED}`);
  assert.deepEqual(findUnguardedSubmissions(source, 'fixture.yml'), []);
});

test('a ref-based guard clears them too, so tightening later does not red the build', () => {
  const source = workflow(
    PLAY_GUARDED.replace("github.event_name == 'push'", "startsWith(github.ref, 'refs/tags/')")
  );
  assert.deepEqual(findUnguardedSubmissions(source, 'fixture.yml'), []);
});

test('a condition that is not tag-only does not count as a guard', () => {
  // `if: always()` is the shape used by the secret-cleanup steps in the same job, so
  // a copy-paste of the wrong one is the realistic mistake here.
  const source = workflow(
    PLAY_UNGUARDED.replace('        uses:', '        if: always()\n        uses:')
  );
  const findings = findUnguardedSubmissions(source, 'fixture.yml');
  assert.equal(findings.length, 1);
  assert.equal(findings[0].condition, 'always()');
});

test('renaming the step does not shake the check off', () => {
  const source = workflow(PLAY_UNGUARDED.replace('Upload to Play internal track', 'Ship it'));
  assert.equal(findUnguardedSubmissions(source, 'fixture.yml').length, 1);
});

test('bumping the action pin does not shake the check off', () => {
  const source = workflow(
    PLAY_UNGUARDED.replace(/@[0-9a-f]{40}/, '@0000000000000000000000000000000000000000')
  );
  assert.equal(findUnguardedSubmissions(source, 'fixture.yml').length, 1);
});

test('an ordinary step is not mistaken for a submission', () => {
  // The negative control. A gate that fires on `pnpm install` gets deleted in a week.
  const source = workflow(`      - name: Install dependencies
        run: pnpm install --frozen-lockfile`);
  assert.deepEqual(findUnguardedSubmissions(source, 'fixture.yml'), []);
});

test('classifyStep and isTagOnly answer on their own', () => {
  assert.equal(classifyStep({ uses: 'r0adkll/upload-google-play@v1' })?.store, 'Google Play');
  assert.equal(classifyStep({ uses: 'actions/checkout@v4' }), null);
  assert.equal(
    classifyStep({ run: 'xcrun altool --upload-app -f x.ipa' })?.store,
    'App Store Connect'
  );
  assert.equal(classifyStep({ run: 'xcrun altool --validate-app -f x.ipa' }), null);
  assert.equal(classifyStep(null), null);
  assert.equal(isTagOnly("github.event_name == 'push'"), true);
  assert.equal(isTagOnly('always()'), false);
  assert.equal(isTagOnly(undefined), false);
});

function findingsStores(source) {
  return findUnguardedSubmissions(source, 'fixture.yml').map((f) => f.store);
}
