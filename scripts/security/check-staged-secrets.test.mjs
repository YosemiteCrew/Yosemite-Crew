import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const scanner = resolve('scripts/check-staged-secrets.js');

const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' });

const createRepository = () => {
  const cwd = mkdtempSync(join(tmpdir(), 'staged-secrets-'));
  const plistDirectory = join(cwd, 'apps/mobileAppYC/ios/mobileAppYC');
  mkdirSync(plistDirectory, { recursive: true });
  git(cwd, ['init', '--quiet']);
  git(cwd, ['config', 'user.name', 'Scanner Test']);
  git(cwd, ['config', 'user.email', 'scanner@example.invalid']);
  return { cwd, plist: join(plistDirectory, 'Info.plist') };
};

const runScanner = (cwd) => spawnSync(process.execPath, [scanner], { cwd, encoding: 'utf8' });

test('allows deletion-only changes to a blocked local file', () => {
  const { cwd, plist } = createRepository();
  writeFileSync(plist, '<array>\n<string>RetiredFont.otf</string>\n</array>\n');
  git(cwd, ['add', '.']);
  git(cwd, ['commit', '--quiet', '-m', 'baseline']);

  writeFileSync(plist, '<array>\n</array>\n');
  git(cwd, ['add', '.']);

  const result = runScanner(cwd);
  assert.equal(result.status, 0, result.stderr);
});

test('rejects additions to a blocked local file', () => {
  const { cwd, plist } = createRepository();
  writeFileSync(plist, '<array>\n</array>\n');
  git(cwd, ['add', '.']);
  git(cwd, ['commit', '--quiet', '-m', 'baseline']);

  writeFileSync(plist, '<array>\n<string>NewFont.otf</string>\n</array>\n');
  git(cwd, ['add', '.']);

  const result = runScanner(cwd);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /local secrets file/);
});
