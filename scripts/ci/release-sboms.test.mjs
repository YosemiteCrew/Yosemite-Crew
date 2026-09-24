// Every published release carries its SBOMs, and no release build leaves CI before the
// Supply Chain run on its commit has passed.
//
// release-notes.yml and desktop-release.yml publish with GITHUB_TOKEN, which emits no
// `release` event, so supply-chain.yml never attached SBOMs to those releases on its own.
// Each now dispatches it from the tag once the release is published. The real workflow
// steps and scripts/ci/wait-for-supply-chain.sh run here against a stub `gh`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parse } from 'yaml';

const REPO = 'YosemiteCrew/Yosemite-Crew';
const SHA = 'a'.repeat(40);
const workflow = (name) => parse(readFileSync(`.github/workflows/${name}`, 'utf8'));

// Records every call. `gh api` answers from a sequence of JSON bodies (the last repeats)
// through the caller's own --jq, as gh does; ERR is a failed request.
const STUB = `#!/bin/bash
printf '%s\\n' "gh $*" >> "$STUB_DIR/calls"
if [ "$1" = api ]; then
  n=$(cat "$STUB_DIR/n" 2>/dev/null || echo 0)
  read -r -a seq <<< "$RUNS_SEQ"
  i=$(( n < \${#seq[@]} ? n : \${#seq[@]} - 1 ))
  echo $((n + 1)) > "$STUB_DIR/n"
  [ "\${seq[$i]}" = ERR ] && { echo "HTTP 502" >&2; exit 1; }
  while [ $# -gt 0 ]; do [ "$1" = --jq ] && JQ=$2; shift; done
  jq -r "$JQ" "$STUB_DIR/\${seq[$i]}.json"
  exit $?
fi
[ "$1 $2" = "workflow run" ] && exit 0
exit 1
`;

/** Runs a script with the stub first on PATH. `runs` maps a fixture name to its runs. */
const withStub = (script, { env = {}, runs = {}, seq = '' } = {}) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'release-sboms-'));
  writeFileSync(path.join(dir, 'gh'), STUB);
  chmodSync(path.join(dir, 'gh'), 0o755);
  writeFileSync(path.join(dir, 'calls'), '');
  for (const [name, list] of Object.entries(runs)) {
    writeFileSync(path.join(dir, `${name}.json`), JSON.stringify({ workflow_runs: list }));
  }
  const run = spawnSync('bash', ['-e', '-c', script], {
    encoding: 'utf8',
    env: {
      PATH: `${dir}:${process.env.PATH}`,
      STUB_DIR: dir,
      RUNS_SEQ: seq,
      GITHUB_REPOSITORY: REPO,
      ...env,
    },
  });
  const calls = readFileSync(path.join(dir, 'calls'), 'utf8').trim().split('\n').filter(Boolean);
  return { code: run.status, out: run.stdout + run.stderr, calls };
};

const run = (status, conclusion, createdAt, id) => ({
  status,
  conclusion,
  created_at: createdAt,
  html_url: `https://github.com/${REPO}/actions/runs/${id}`,
});

const wait = (seq, runs) =>
  withStub('bash scripts/ci/wait-for-supply-chain.sh', {
    env: { SHA, POLLS: '3', INTERVAL: '0' },
    runs,
    seq,
  });

test('the wait passes once the latest push run on the commit succeeds', () => {
  const r = wait('none busy green', {
    none: [],
    busy: [run('in_progress', null, '2026-09-23T20:45:00Z', 1)],
    green: [
      run('completed', 'failure', '2026-09-23T20:40:00Z', 1),
      run('completed', 'success', '2026-09-23T20:45:00Z', 2),
    ],
  });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Supply Chain passed for a{40}: .*\/runs\/2$/m);
  assert.equal(r.calls.length, 3);
  // Only push runs are the verdict, so the SBOM dispatch on the same commit is not.
  assert.match(r.calls[0], new RegExp(`runs\\?head_sha=${SHA}&event=push&`));
});

test('the wait refuses a commit whose latest push run failed', () => {
  const r = wait('red', {
    red: [
      run('completed', 'success', '2026-09-23T20:40:00Z', 1),
      run('completed', 'failure', '2026-09-23T20:45:00Z', 2),
    ],
  });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /concluded 'failure' .*\/runs\/2/);
});

test('the wait refuses a finished run that did not succeed, whatever the reason', () => {
  for (const conclusion of ['cancelled', 'timed_out', 'skipped']) {
    const r = wait('done', { done: [run('completed', conclusion, '2026-09-23T20:45:00Z', 1)] });
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, new RegExp(`concluded '${conclusion}'`));
  }
});

test('the wait gives up, red, when no run finishes in time', () => {
  const r = wait('busy', { busy: [run('queued', null, '2026-09-23T20:45:00Z', 1)] });
  assert.equal(r.code, 1, r.out);
  assert.equal(r.calls.length, 3);
  assert.match(r.out, /No completed Supply Chain run for a{40} after 3 checks/);
});

test('the wait fails when it cannot read the runs', () => {
  const r = wait('ERR', {});
  assert.notEqual(r.code, 0, r.out);
  assert.doesNotMatch(r.out, /passed/);
});

test('desktop publishes, and mobile builds, only after the wait', () => {
  const desktop = workflow('desktop-release.yml').jobs.publish;
  const names = desktop.steps.map((s) => s.name);
  const waitAt = desktop.steps.findIndex(
    (s) => s.run === 'bash scripts/ci/wait-for-supply-chain.sh'
  );
  assert.ok(waitAt >= 0 && waitAt < names.indexOf('Publish the release'));
  const checkoutAt = desktop.steps.findIndex((s) => String(s.uses).startsWith('actions/checkout@'));
  assert.ok(checkoutAt >= 0 && checkoutAt < waitAt, 'the publish job checks out the wait script');
  assert.match(desktop.steps[waitAt].env.SHA, /^\$\{\{ github\.sha \}\}$/);
  assert.equal(desktop.permissions.actions, 'read');

  const mobile = workflow('mobile-release.yml');
  const step = mobile.jobs.preflight.steps.find(
    (s) => s.run === 'bash scripts/ci/wait-for-supply-chain.sh'
  );
  assert.ok(step, 'mobile preflight waits for the Supply Chain verdict');
  assert.equal(step.if, "github.event_name == 'push'");
  assert.match(step.env.SHA, /^\$\{\{ github\.sha \}\}$/);
  assert.equal(mobile.jobs.preflight.permissions.actions, 'read');
  for (const job of ['android', 'ios']) {
    assert.deepEqual([mobile.jobs[job].needs].flat(), ['preflight']);
  }
});

for (const [file, publisher] of [
  ['release-notes.yml', 'generate-notes'],
  ['desktop-release.yml', 'publish'],
]) {
  test(`${file} attaches SBOMs to the release it publishes`, () => {
    const job = workflow(file).jobs['attach-sboms'];
    assert.ok(job, `${file} has an attach-sboms job`);
    assert.deepEqual([job.needs].flat(), [publisher]);
    assert.equal(job.permissions.actions, 'write');
    const [step] = job.steps;
    const r = withStub(step.run, { env: { TAG: 'pims-v2.6.0-beta' } });
    assert.equal(r.code, 0, r.out);
    assert.deepEqual(r.calls, [
      `gh workflow run supply-chain.yml --repo ${REPO} --ref pims-v2.6.0-beta -f release_tag=pims-v2.6.0-beta`,
    ]);
    assert.match(step.env.TAG, /^\$\{\{ github\.ref_name \}\}$/);
  });
}

test('supply-chain.yml takes that dispatch and attaches only from the tag itself', () => {
  const sc = workflow('supply-chain.yml');
  assert.equal(sc.on.workflow_dispatch.inputs.release_tag.type, 'string');
  const job = sc.jobs['publish-release-sboms'];
  assert.match(job.if, /github\.event_name == 'workflow_dispatch' && inputs\.release_tag != ''/);
  const check = job.steps.find((s) => s.name === 'Ensure the dispatched ref is the release tag');
  const tag = 'mobile-v1.8.0';
  const ok = withStub(check.run, { env: { REF: `refs/tags/${tag}`, TAG: tag } });
  assert.equal(ok.code, 0, ok.out);
  const wrong = withStub(check.run, { env: { REF: 'refs/heads/dev', TAG: tag } });
  assert.equal(wrong.code, 1, wrong.out);
});

test('the SBOM dispatch cannot cancel the tag push run on the same ref', () => {
  const { group } = workflow('supply-chain.yml').concurrency;
  assert.match(group, /\$\{\{ github\.event_name \}\}/);
});
