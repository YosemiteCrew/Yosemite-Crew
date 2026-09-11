import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('../check-staged-secrets.js', import.meta.url));
const systemPath = '/usr/bin:/bin';

const createRepository = () => {
  const root = mkdtempSync(join(tmpdir(), 'staged-secret-test-'));
  execFileSync('git', ['init', '--quiet'], { cwd: root });
  return root;
};

const stageFile = (root, file, content = 'ordinary test prose\n') => {
  const path = join(root, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  execFileSync('git', ['add', '-f', file], { cwd: root });
};

const runScanner = (root) =>
  spawnSync(process.execPath, [script], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, PATH: systemPath },
  });

test('warns when the optional gitleaks scan is unavailable', (t) => {
  const root = createRepository();
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const result = runScanner(root);

  assert.equal(result.status, 0);
  assert.match(result.stderr, /Optional gitleaks scan skipped: gitleaks is not installed\./);
});

test('blocks dotenv derivatives outside frontend and mobile roots', (t) => {
  const root = createRepository();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  stageFile(root, 'apps/backend/.env.probe');

  const result = runScanner(root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /apps\/backend\/\.env\.probe:1 \(local secrets file\)/);
});

test('allows dotenv examples outside frontend and mobile roots', (t) => {
  const root = createRepository();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  stageFile(root, 'packages/database/.env.example');

  const result = runScanner(root);

  assert.equal(result.status, 0);
  assert.doesNotMatch(result.stderr, /local secrets file/);
});
