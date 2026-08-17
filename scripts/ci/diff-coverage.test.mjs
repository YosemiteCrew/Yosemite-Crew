// Tests for the PR-only diff-coverage gate. The pure functions carry the
// acceptance criteria; main() is exercised as a subprocess so the fail-closed
// exit codes are pinned too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseUnifiedDiff, evaluateDiffCoverage, formatRanges } from './diff-coverage.mjs';

const script = join(dirname(fileURLToPath(import.meta.url)), 'diff-coverage.mjs');
const ROOT = '/repo';

// Build one istanbul file-coverage entry: a statement per line with the given
// hit count, which is exactly the shape getLineCoverage() reads a line hit from.
function fileCoverage(filePath, lineHits) {
  const statementMap = {};
  const s = {};
  let index = 0;
  for (const [line, hits] of Object.entries(lineHits)) {
    statementMap[index] = {
      start: { line: Number(line), column: 0 },
      end: { line: Number(line), column: 20 },
    };
    s[index] = hits;
    index += 1;
  }
  return { path: filePath, statementMap, s, fnMap: {}, f: {}, branchMap: {}, b: {} };
}

function coverageMap(entries) {
  const map = {};
  for (const [relative, lineHits] of Object.entries(entries)) {
    const filePath = join(ROOT, relative);
    map[filePath] = fileCoverage(filePath, lineHits);
  }
  return map;
}

function runMain(args) {
  try {
    const stdout = execFileSync('node', [script, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, stdout, stderr: '' };
  } catch (error) {
    return {
      status: error.status,
      stdout: `${error.stdout ?? ''}`,
      stderr: `${error.stderr ?? ''}`,
    };
  }
}

function withTemp(diffText, mapJson, run) {
  const dir = mkdtempSync(join(tmpdir(), 'diff-cov-'));
  try {
    const diffPath = join(dir, 'diff.patch');
    const mapPath = join(dir, 'coverage-final.json');
    writeFileSync(diffPath, diffText);
    if (mapJson !== null) writeFileSync(mapPath, mapJson);
    return run({ dir, diffPath, mapPath });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('(1) an added uncovered line fails and names the line range', () => {
  const diff = [
    'diff --git a/apps/frontend/src/foo.ts b/apps/frontend/src/foo.ts',
    '--- a/apps/frontend/src/foo.ts',
    '+++ b/apps/frontend/src/foo.ts',
    '@@ -1,3 +1,5 @@',
    ' const a = 1;',
    '+const b = 2;',
    '+const c = 3;',
    ' const d = 4;',
    ' const e = 5;',
    '',
  ].join('\n');
  const added = parseUnifiedDiff(diff);
  assert.deepEqual([...added.get('apps/frontend/src/foo.ts')], [2, 3]);

  const map = coverageMap({ 'apps/frontend/src/foo.ts': { 2: 0, 3: 0 } });
  const result = evaluateDiffCoverage({
    coverageMapJson: map,
    addedLinesByFile: added,
    root: ROOT,
  });
  assert.equal(result.measured, 2);
  assert.equal(result.covered, 0);
  assert.equal(formatRanges(result.uncoveredByFile.get('apps/frontend/src/foo.ts')), '2-3');

  withTemp(diff, JSON.stringify(map), ({ diffPath, mapPath }) => {
    const r = runMain(['--diff', diffPath, '--map', mapPath, '--root', ROOT, '--floor', '90']);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /uncovered apps\/frontend\/src\/foo\.ts: 2-3/);
  });
});

test('(2) touching a legacy file measures only its added lines', () => {
  const diff = [
    'diff --git a/apps/frontend/src/legacy.ts b/apps/frontend/src/legacy.ts',
    '--- a/apps/frontend/src/legacy.ts',
    '+++ b/apps/frontend/src/legacy.ts',
    '@@ -9,2 +9,3 @@',
    ' existing();',
    '+added();',
    ' more();',
    '',
  ].join('\n');
  const added = parseUnifiedDiff(diff);
  assert.deepEqual([...added.get('apps/frontend/src/legacy.ts')], [10]);

  // Line 5 is an untested legacy line; only the added line 10 (covered) counts.
  const map = coverageMap({ 'apps/frontend/src/legacy.ts': { 5: 0, 10: 4 } });
  const result = evaluateDiffCoverage({
    coverageMapJson: map,
    addedLinesByFile: added,
    root: ROOT,
  });
  assert.equal(result.measured, 1);
  assert.equal(result.covered, 1);
  assert.equal(result.pct, 100);
  assert.equal(result.uncoveredByFile.size, 0);
});

test('(3) a new untested source file fails - every added line is zero-hit', () => {
  const diff = [
    'diff --git a/apps/frontend/src/new.ts b/apps/frontend/src/new.ts',
    'new file mode 100644',
    '--- /dev/null',
    '+++ b/apps/frontend/src/new.ts',
    '@@ -0,0 +1,3 @@',
    '+export function untested() {',
    '+  return 1;',
    '+}',
    '',
  ].join('\n');
  const added = parseUnifiedDiff(diff);
  assert.deepEqual([...added.get('apps/frontend/src/new.ts')], [1, 2, 3]);

  const map = coverageMap({ 'apps/frontend/src/new.ts': { 1: 0, 2: 0, 3: 0 } });
  const result = evaluateDiffCoverage({
    coverageMapJson: map,
    addedLinesByFile: added,
    root: ROOT,
  });
  assert.equal(result.measured, 3);
  assert.equal(result.covered, 0);
  assert.equal(result.pct, 0);

  withTemp(diff, JSON.stringify(map), ({ diffPath, mapPath }) => {
    const r = runMain(['--diff', diffPath, '--map', mapPath, '--root', ROOT, '--floor', '90']);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /uncovered apps\/frontend\/src\/new\.ts: 1-3/);
  });
});

test('(4) a docs and comment-only diff passes - nothing executable is added', () => {
  const diff = [
    'diff --git a/docs/ci/coverage.md b/docs/ci/coverage.md',
    '--- a/docs/ci/coverage.md',
    '+++ b/docs/ci/coverage.md',
    '@@ -1,1 +1,2 @@',
    ' # Coverage',
    '+A new paragraph.',
    'diff --git a/apps/frontend/src/foo.ts b/apps/frontend/src/foo.ts',
    '--- a/apps/frontend/src/foo.ts',
    '+++ b/apps/frontend/src/foo.ts',
    '@@ -3,2 +3,3 @@',
    ' const kept = 1;',
    '+// a clarifying comment',
    ' const also = 2;',
    '',
  ].join('\n');
  const added = parseUnifiedDiff(diff);
  // docs is absent from the map entirely; the comment line 4 is non-executable.
  const map = coverageMap({ 'apps/frontend/src/foo.ts': { 3: 5, 5: 5 } });
  const result = evaluateDiffCoverage({
    coverageMapJson: map,
    addedLinesByFile: added,
    root: ROOT,
  });
  assert.equal(result.measured, 0);
  assert.equal(result.pct, 100);

  withTemp(diff, JSON.stringify(map), ({ diffPath, mapPath }) => {
    const r = runMain(['--diff', diffPath, '--map', mapPath, '--root', ROOT, '--floor', '90']);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /nothing to gate/);
  });
});

test('(5) a missing, empty or unparseable map fails rather than passing unmeasured', () => {
  const diff = [
    '--- a/apps/frontend/src/foo.ts',
    '+++ b/apps/frontend/src/foo.ts',
    '@@ -1,1 +1,2 @@',
    ' const a = 1;',
    '+const b = 2;',
    '',
  ].join('\n');

  withTemp(diff, null, ({ dir, diffPath }) => {
    const r = runMain([
      '--diff',
      diffPath,
      '--map',
      join(dir, 'absent.json'),
      '--root',
      ROOT,
      '--floor',
      '90',
    ]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /does not exist/);
  });
  withTemp(diff, '', ({ diffPath, mapPath }) => {
    const r = runMain(['--diff', diffPath, '--map', mapPath, '--root', ROOT, '--floor', '90']);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /is empty/);
  });
  withTemp(diff, '{ not json', ({ diffPath, mapPath }) => {
    const r = runMain(['--diff', diffPath, '--map', mapPath, '--root', ROOT, '--floor', '90']);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /cannot parse coverage map/);
  });
  withTemp(diff, '{}', ({ diffPath, mapPath }) => {
    const r = runMain(['--diff', diffPath, '--map', mapPath, '--root', ROOT, '--floor', '90']);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /records no files/);
  });
});

test('(6) coverage exactly on the floor passes', () => {
  const diff = [
    '--- a/apps/frontend/src/edge.ts',
    '+++ b/apps/frontend/src/edge.ts',
    '@@ -1,1 +1,3 @@',
    ' const a = 1;',
    '+const covered = 2;',
    '+const missed = 3;',
    '',
  ].join('\n');
  const added = parseUnifiedDiff(diff);
  assert.deepEqual([...added.get('apps/frontend/src/edge.ts')], [2, 3]);

  const map = coverageMap({ 'apps/frontend/src/edge.ts': { 2: 1, 3: 0 } });
  const result = evaluateDiffCoverage({
    coverageMapJson: map,
    addedLinesByFile: added,
    root: ROOT,
  });
  assert.equal(result.pct, 50);

  withTemp(diff, JSON.stringify(map), ({ diffPath, mapPath }) => {
    const r = runMain(['--diff', diffPath, '--map', mapPath, '--root', ROOT, '--floor', '50']);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /meet the floor/);
  });
});

test('(7) the parser handles multiple hunks, dev-null deletions and renames', () => {
  const diff = [
    'diff --git a/a.ts b/a.ts',
    '--- a/a.ts',
    '+++ b/a.ts',
    '@@ -1,2 +1,3 @@',
    ' x',
    '+y',
    ' z',
    '@@ -10,2 +11,3 @@',
    ' p',
    '+q',
    ' r',
    'diff --git a/gone.ts b/gone.ts',
    'deleted file mode 100644',
    '--- a/gone.ts',
    '+++ /dev/null',
    '@@ -1,2 +0,0 @@',
    '-old1',
    '-old2',
    'diff --git a/old-name.ts b/new-name.ts',
    'similarity index 90%',
    'rename from old-name.ts',
    'rename to new-name.ts',
    '--- a/old-name.ts',
    '+++ b/new-name.ts',
    '@@ -5,3 +5,4 @@',
    ' m',
    '+n',
    ' o',
    ' p',
    '',
  ].join('\n');
  const added = parseUnifiedDiff(diff);
  assert.deepEqual([...added.get('a.ts')], [2, 12]);
  assert.deepEqual([...added.get('new-name.ts')], [6]);
  assert.equal(added.has('gone.ts'), false);
});

test('formatRanges collapses runs and keeps singletons', () => {
  assert.equal(formatRanges([1, 2, 3, 7, 9, 10]), '1-3,7,9-10');
  assert.equal(formatRanges([5]), '5');
  assert.equal(formatRanges([]), '');
});

test('an unknown flag and a bad floor both fail closed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'diff-cov-'));
  try {
    const diffPath = join(dir, 'd.patch');
    const mapPath = join(dir, 'm.json');
    writeFileSync(diffPath, '');
    writeFileSync(mapPath, '{}');
    const unknown = runMain(['--bogus', 'x']);
    assert.equal(unknown.status, 1);
    assert.match(unknown.stderr, /unknown argument/);
    const badFloor = runMain([
      '--diff',
      diffPath,
      '--map',
      mapPath,
      '--root',
      ROOT,
      '--floor',
      'high',
    ]);
    assert.equal(badFloor.status, 1);
    assert.match(badFloor.stderr, /bad floor/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
