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

// The job that contains the upload step is gated like this, 78 lines above it. A
// substring implementation of isTagOnly accepts it, and it submits on a plain
// dispatch - `A || B` runs whenever B alone is true. Copying this condition down
// onto the step is the most natural edit anyone will make to the file, so it is
// the mutant the suite has to catch.
const JOB_CONDITION = "github.event_name == 'push' || inputs.platform == 'android'";

test('the job condition copied onto the upload step is NOT accepted as a guard', () => {
  const source = workflow(PLAY_GUARDED.replace("github.event_name == 'push'", JOB_CONDITION));
  const findings = findUnguardedSubmissions(source, 'fixture.yml');
  assert.equal(findings.length, 1);
  assert.equal(findings[0].store, 'Google Play');
  assert.equal(findings[0].condition, JOB_CONDITION);
});

test('a disjunction is rejected whichever side the accepted guard is on', () => {
  assert.equal(isTagOnly(JOB_CONDITION), false);
  assert.equal(isTagOnly("always() || github.event_name == 'push'"), false);
  assert.equal(
    isTagOnly("startsWith(github.ref, 'refs/tags/') || inputs.platform == 'ios'"),
    false
  );
});

test('a conjunction is accepted, so tightening the guard later does not red the build', () => {
  assert.equal(
    isTagOnly("github.event_name == 'push' && startsWith(github.ref, 'refs/tags/')"),
    true
  );
  assert.equal(isTagOnly("github.event_name == 'push' && inputs.platform == 'android'"), true);
});

test('an expression that cannot be classified fails closed', () => {
  // Not an exhaustive list - the point is that anything unrecognised is a finding
  // rather than a pass, so a red build puts a human in front of it.
  assert.equal(isTagOnly("github.event_name=='push'"), false);
  assert.equal(isTagOnly("${{ github.event_name == 'push' }}"), false);
  assert.equal(isTagOnly(''), false);
});

test('a workflow path that escapes the repository is refused', () => {
  assert.throws(() => checkRepo(process.cwd(), ['../../../etc/hosts']), /escapes the repository/);
});

// Desktop guards at the JOB and mobile guards at the STEP. Reading only steps
// waved through a `publish` job whose own guard had been deleted - found by a
// peer running the mutation this fixture now pins.
const jobWorkflow = (jobIf, steps) => `
name: fixture
on:
  push:
    tags: ['v*']
  workflow_dispatch: {}
jobs:
  publish:
${jobIf === null ? '' : `    if: ${jobIf}\n`}    runs-on: ubuntu-latest
    steps:
${steps}
`;

const PUBLISH_STEP = `      - name: Publish the release
        run: |
          gh release edit "$TAG" --repo "$GITHUB_REPOSITORY" --draft=false --latest=true`;

test('a job-level tag guard covers a step that carries none', () => {
  // The shipped desktop shape: `publish` holds the condition, its step does not.
  const source = jobWorkflow("github.event_name == 'push'", PUBLISH_STEP);
  assert.deepEqual(findUnguardedSubmissions(source, 'fixture.yml'), []);
});

test('deleting the job-level guard is caught', () => {
  const findings = findUnguardedSubmissions(jobWorkflow(null, PUBLISH_STEP), 'fixture.yml');
  assert.equal(findings.length, 1);
  assert.equal(findings[0].store, 'a public GitHub Release');
  assert.equal(findings[0].job, 'publish');
});

test('a job-level guard widened with || does not rescue the step either', () => {
  const source = jobWorkflow("github.event_name == 'push' || inputs.force == true", PUBLISH_STEP);
  assert.equal(findUnguardedSubmissions(source, 'fixture.yml').length, 1);
});

test('a job-level || does not rescue a step whose own guard was deleted', () => {
  // The mobile shape, and the regression this change could have caused: the
  // `android` job's condition contains an accepted guard inside a disjunction,
  // so reading the job level must not turn that into a pass.
  const source = workflow(PLAY_UNGUARDED).replace(
    '    environment: release',
    "    environment: release\n    if: github.event_name == 'push' || inputs.platform == 'android'"
  );
  assert.equal(findUnguardedSubmissions(source, 'fixture.yml').length, 1);
});

test('action-gh-release is a submission unless the release is a draft', () => {
  const step = (draft) => `      - name: Create GitHub Release
        uses: softprops/action-gh-release@3d0d9888cb7fd7b750713d6e236d1fcb99157228
        with:
${draft === null ? '' : `          draft: ${draft}\n`}          tag_name: manual-v1`;
  const count = (draft) =>
    findUnguardedSubmissions(jobWorkflow(null, step(draft)), 'fixture.yml').length;
  assert.equal(count(true), 0, 'draft: true is not outward-facing');
  assert.equal(count(false), 1, 'draft: false publishes');
  assert.equal(count(null), 1, 'no draft key publishes');
});

function findingsStores(source) {
  return findUnguardedSubmissions(source, 'fixture.yml').map((f) => f.store);
}
