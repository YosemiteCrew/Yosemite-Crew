// Runs the real "Publish to GitHub Release" step of release-notes.yml against a stub `gh`.
//
// On 2026-09-23 the 2.5.0-beta releases went out labelled "Pre-release" because this
// step asked for it on every -beta tag. The policy now is: no release is ever labelled
// Pre-release, a suffixed tag never holds Latest, and the step reads the release back
// and fails when GitHub's record disagrees. Each case below is a GitHub state the step
// must report, so a change that quietly drops one of those checks turns this red.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parse } from 'yaml';

const workflow = parse(readFileSync('.github/workflows/release-notes.yml', 'utf8'));
const step = workflow.jobs['generate-notes'].steps.find(
  (s) => s.name === 'Publish to GitHub Release'
);
// The retry pause is the only edit: it keeps the failing cases fast.
const script = step.run.replaceAll('sleep 5', 'sleep 0');

// Answers come from per-call sequences; the last one repeats. ERR is a failed read (a 502
// body on stdout, as gh prints it), 404 is GitHub's "no Latest release" answer.
const STUB = `#!/bin/bash
echo "gh $*" >> "$STUB_DIR/calls"
next() {
  local n; n=$(cat "$STUB_DIR/$1.n" 2>/dev/null || echo 0)
  read -r -a seq <<< "$2"
  local i=$(( n < \${#seq[@]} ? n : \${#seq[@]} - 1 ))
  echo $((n + 1)) > "$STUB_DIR/$1.n"
  echo "\${seq[$i]}"
}
if [ "$1 $2" = "release view" ] && [ "$4" = "--json" ]; then
  v=$(next view "$VIEW_SEQ")
  [ "$v" = ERR ] && { echo "HTTP 502" >&2; exit 1; }
  echo "\${v/_/ }"; exit 0
fi
if [ "$1 $2" = "release view" ]; then [ "$EXISTS" = 1 ]; exit $?; fi
if [ "$1 $2" = "release edit" ] || [ "$1 $2" = "release create" ]; then exit 0; fi
if [ "$1" = api ]; then
  v=$(next latest "$LATEST_SEQ")
  case "$v" in
    ERR) echo '{"message":"Server Error","status":"502"}'; exit 1 ;;
    404) echo '{"message":"Not Found","status":"404"}'; exit 1 ;;
    *) echo "$v"; exit 0 ;;
  esac
fi
exit 1
`;

/**
 * @param {object} o
 * @param {string} o.tag
 * @param {boolean} [o.exists] a release already exists (the edit path)
 * @param {string} o.view "prerelease_draft" answers for the read-back, space separated
 * @param {string} o.latest tag names, ERR or 404 for /releases/latest, space separated
 */
const publish = ({ tag, exists = false, view, latest }) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'release-notes-publish-'));
  writeFileSync(path.join(dir, 'gh'), STUB);
  chmodSync(path.join(dir, 'gh'), 0o755);
  writeFileSync(path.join(dir, 'calls'), '');
  const suffixed = /-beta|-alpha|-rc/.test(tag) ? 'true' : 'false';
  const run = spawnSync('bash', ['-e', '-c', script], {
    encoding: 'utf8',
    env: {
      PATH: `${dir}:${process.env.PATH}`,
      STUB_DIR: dir,
      TAG: tag,
      SUFFIXED: suffixed,
      EXISTS: exists ? '1' : '0',
      VIEW_SEQ: view,
      LATEST_SEQ: latest,
      GITHUB_REPOSITORY: 'YosemiteCrew/Yosemite-Crew',
    },
  });
  const calls = readFileSync(path.join(dir, 'calls'), 'utf8');
  const write = calls.split('\n').find((l) => /^gh release (create|edit) /.test(l)) ?? '';
  return { code: run.status, out: run.stdout + run.stderr, write };
};

test('a new beta is created as a full release that cannot take Latest', () => {
  const r = publish({ tag: 'pims-v2.6.0-beta', view: 'false_false', latest: 'mobile-v1.7.0' });
  assert.equal(r.code, 0, r.out);
  assert.match(
    r.write,
    /^gh release create pims-v2\.6\.0-beta .*--prerelease=false --latest=false$/
  );
});

test('an existing beta (made by hand in the UI) has its label cleared on the edit path', () => {
  const r = publish({
    tag: 'backend-v2.6.0-beta',
    exists: true,
    view: 'false_false',
    latest: 'mobile-v1.7.0',
  });
  assert.equal(r.code, 0, r.out);
  assert.match(
    r.write,
    /^gh release edit backend-v2\.6\.0-beta .*--prerelease=false --latest=false$/
  );
});

test('an unsuffixed tag is a full release and keeps GitHub default Latest handling', () => {
  const r = publish({ tag: 'mobile-v1.8.0', view: 'false_false', latest: 'mobile-v1.8.0' });
  assert.equal(r.code, 0, r.out);
  assert.match(r.write, /--prerelease=false$/);
  assert.doesNotMatch(r.write, /--latest/);
});

test('no step path ever asks GitHub for a Pre-release label', () => {
  assert.doesNotMatch(step.run, /--prerelease=true|--prerelease(?!=false)/);
});

test('a 404 from /releases/latest means no Latest, not a failed read', () => {
  const r = publish({ tag: 'pims-v2.6.0-beta', view: 'false_false', latest: '404' });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Latest: none/);
});

test('a release still labelled Pre-release fails the run', () => {
  const r = publish({
    tag: 'pims-v2.6.0-beta',
    exists: true,
    view: 'true_false',
    latest: 'mobile-v1.7.0',
  });
  assert.equal(r.code, 1);
  assert.match(r.out, /::error::pims-v2\.6\.0-beta is still labelled Pre-release/);
});

test('a release left as a draft fails the run and says how to publish it', () => {
  const r = publish({
    tag: 'pims-v2.6.0-beta',
    exists: true,
    view: 'false_true',
    latest: 'mobile-v1.7.0',
  });
  assert.equal(r.code, 1);
  assert.match(
    r.out,
    /is still a draft\. Publish it with: gh release edit pims-v2\.6\.0-beta --draft=false --latest=false/
  );
});

test('a suffixed tag holding Latest fails the run', () => {
  const r = publish({ tag: 'pims-v2.6.0-beta', view: 'false_false', latest: 'pims-v2.6.0-beta' });
  assert.equal(r.code, 1);
  assert.match(r.out, /carries a pre-release suffix but holds the repo-wide Latest badge/);
});

test('a Latest read that keeps failing fails the run instead of passing', () => {
  const r = publish({ tag: 'pims-v2.6.0-beta', view: 'false_false', latest: 'ERR' });
  assert.equal(r.code, 1);
  assert.match(r.out, /Could not read the repository's Latest release/);
});

test('failed and stale reads are retried, not fatal', () => {
  for (const [view, latest] of [
    ['ERR false_false', 'mobile-v1.7.0'],
    ['true_false false_false', 'mobile-v1.7.0'],
    ['false_false', 'ERR mobile-v1.7.0'],
  ]) {
    const r = publish({ tag: 'pims-v2.6.0-beta', view, latest });
    assert.equal(r.code, 0, `${view} / ${latest}: ${r.out}`);
  }
});

test('a release that can never be read back fails the run', () => {
  const r = publish({ tag: 'mobile-v1.8.0', view: 'ERR', latest: 'mobile-v1.8.0' });
  assert.equal(r.code, 1);
  assert.match(r.out, /Could not read mobile-v1\.8\.0 back from GitHub/);
});

test('the desktop publish step never leaves the Pre-release label either', () => {
  const desktop = parse(readFileSync('.github/workflows/desktop-release.yml', 'utf8'));
  const publishStep = desktop.jobs.publish.steps.find((s) => s.name === 'Publish the release');
  assert.match(publishStep.run, /--prerelease=false/);
});
