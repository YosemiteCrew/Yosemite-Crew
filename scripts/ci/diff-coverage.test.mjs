#!/usr/bin/env node
// Unit tests for the added-line coverage gate.
//
// The failure modes worth testing are the ones that produce a plausible number
// rather than an error: a hunk header misread by one line blames the wrong line,
// a rename counted under its old path silently measures nothing, an absolute
// coverage key that fails to match makes an untested file look like an excluded
// one, and counting non-executable lines drags a documentation diff below the
// floor. Each of those gets a test, as does the pass/fail boundary itself.
//
// Run with `node --test scripts/ci/diff-coverage.test.mjs`, or as part of
// `pnpm run test:scripts` (which is what the _core CI stage runs).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { evaluate, indexCoverage, lineHits, parseDiff } from './diff-coverage.mjs';

// A coverage entry whose statements are one-per-line, so the fixtures read as
// "these lines are executable, these counts are their hits".
function entry(hitsByLine) {
  const statementMap = {};
  const s = {};
  let id = 0;
  for (const [line, count] of Object.entries(hitsByLine)) {
    statementMap[id] = {
      start: { line: Number(line), column: 0 },
      end: { line: Number(line), column: 10 },
    };
    s[id] = count;
    id += 1;
  }
  return { statementMap, s };
}

describe('parseDiff', () => {
  it('numbers added lines from the hunk header', () => {
    const diff = [
      'diff --git a/src/a.ts b/src/a.ts',
      '--- a/src/a.ts',
      '+++ b/src/a.ts',
      '@@ -10,0 +11,2 @@',
      '+const a = 1;',
      '+const b = 2;',
    ].join('\n');

    assert.deepEqual(parseDiff(diff), new Map([['src/a.ts', new Set([11, 12])]]));
  });

  it('reads a single-line hunk header that omits the count', () => {
    const diff = ['+++ b/src/a.ts', '@@ -3 +3 @@', '+const a = 1;'].join('\n');

    assert.deepEqual(parseDiff(diff), new Map([['src/a.ts', new Set([3])]]));
  });

  it('does not let removed lines advance the post-image counter', () => {
    // Deletions carry no post-image line. Counting them would shift every
    // subsequent added line number in the same file.
    const diff = [
      '+++ b/src/a.ts',
      '@@ -5,2 +5,1 @@',
      '-const gone = 1;',
      '-const also = 2;',
      '+const kept = 3;',
    ].join('\n');

    assert.deepEqual(parseDiff(diff), new Map([['src/a.ts', new Set([5])]]));
  });

  it('tracks several hunks in several files', () => {
    const diff = [
      '+++ b/src/a.ts',
      '@@ -1,0 +2,1 @@',
      '+const a = 1;',
      '@@ -20,0 +30,2 @@',
      '+const b = 2;',
      '+const c = 3;',
      '+++ b/src/b.ts',
      '@@ -0,0 +1,1 @@',
      '+const d = 4;',
    ].join('\n');

    assert.deepEqual(
      parseDiff(diff),
      new Map([
        ['src/a.ts', new Set([2, 30, 31])],
        ['src/b.ts', new Set([1])],
      ])
    );
  });

  it('attributes a rename to the post-image path', () => {
    const diff = [
      'diff --git a/src/old.ts b/src/new.ts',
      '--- a/src/old.ts',
      '+++ b/src/new.ts',
      '@@ -0,0 +1,1 @@',
      '+const a = 1;',
    ].join('\n');

    assert.deepEqual(parseDiff(diff), new Map([['src/new.ts', new Set([1])]]));
  });

  it('ignores a deleted file, which has no post-image to cover', () => {
    const diff = ['--- a/src/gone.ts', '+++ /dev/null', '@@ -1,2 +0,0 @@', '-const a = 1;'].join(
      '\n'
    );

    assert.deepEqual(parseDiff(diff), new Map());
  });

  it('strips the tab-separated timestamp some diff producers append', () => {
    const diff = [
      '+++ b/src/a.ts\t2026-08-17 10:00:00.000000000 +0000',
      '@@ -0,0 +1 @@',
      '+const a = 1;',
    ].join('\n');

    assert.deepEqual(parseDiff(diff), new Map([['src/a.ts', new Set([1])]]));
  });
});

describe('lineHits', () => {
  it('treats a line as covered when any statement on it ran', () => {
    const covered = {
      statementMap: {
        0: { start: { line: 7 }, end: { line: 7 } },
        1: { start: { line: 7 }, end: { line: 7 } },
      },
      s: { 0: 0, 1: 3 },
    };

    assert.equal(lineHits(covered).get(7), 3);
  });

  it('reports a missing hit count as zero rather than dropping the line', () => {
    const partial = { statementMap: { 0: { start: { line: 4 }, end: { line: 4 } } }, s: {} };

    assert.equal(lineHits(partial).get(4), 0);
  });

  it('returns an empty map for an entry with no statements', () => {
    assert.equal(lineHits({}).size, 0);
  });
});

describe('indexCoverage', () => {
  it('strips the producing workspace root from absolute keys', () => {
    const index = indexCoverage(
      { '/home/runner/work/Yosemite-Crew/Yosemite-Crew/apps/frontend/src/a.ts': entry({ 1: 1 }) },
      '/home/runner/work/Yosemite-Crew/Yosemite-Crew'
    );

    assert.ok(index.get('apps/frontend/src/a.ts'));
  });

  it('still matches when the report was produced under a different root', () => {
    // Shard artifacts are generated on one runner and merged on another. A
    // mismatch here would silently reclassify every changed file as "not
    // instrumented" and the gate would pass having measured nothing.
    const index = indexCoverage(
      { '/some/other/root/apps/frontend/src/a.ts': entry({ 1: 1 }) },
      '/home/runner/work/Yosemite-Crew/Yosemite-Crew'
    );

    assert.ok(index.get('apps/frontend/src/a.ts'));
  });

  it('accepts keys that are already repository-relative', () => {
    const index = indexCoverage({ 'apps/frontend/src/a.ts': entry({ 1: 1 }) }, '/workspace');

    assert.ok(index.get('apps/frontend/src/a.ts'));
  });
});

describe('evaluate', () => {
  const cwd = '/workspace';

  it('counts only added lines that are executable', () => {
    // Lines 2 and 4 are executable; 3 is a comment and appears in no
    // statementMap, so it belongs to neither side of the ratio.
    const result = evaluate({
      added: new Map([['apps/frontend/src/a.ts', new Set([2, 3, 4])]]),
      coverage: { 'apps/frontend/src/a.ts': entry({ 2: 1, 4: 0 }) },
      cwd,
    });

    assert.equal(result.total, 2);
    assert.equal(result.covered, 1);
    assert.deepEqual(result.measured[0].uncovered, [4]);
  });

  it('ignores untouched lines of a file the diff only partly changes', () => {
    // The whole point of gating added lines: line 99 is uncovered but this
    // change did not introduce it, so it is not this PR's failure.
    const result = evaluate({
      added: new Map([['apps/frontend/src/a.ts', new Set([2])]]),
      coverage: { 'apps/frontend/src/a.ts': entry({ 2: 5, 99: 0 }) },
      cwd,
    });

    assert.equal(result.total, 1);
    assert.equal(result.covered, 1);
  });

  it('reports a file outside the coverage map as unmeasured, not as uncovered', () => {
    const result = evaluate({
      added: new Map([['apps/frontend/src/a.test.ts', new Set([1])]]),
      coverage: { 'apps/frontend/src/a.ts': entry({ 1: 1 }) },
      cwd,
    });

    assert.deepEqual(result.unmeasured, ['apps/frontend/src/a.test.ts']);
    assert.equal(result.total, 0);
  });

  it('counts a brand new untested file as entirely uncovered', () => {
    // collectCoverageFrom puts untested source files in the map with zero hits,
    // which is what stops "add a file, write no test" from evading the gate.
    const result = evaluate({
      added: new Map([['apps/frontend/src/new.ts', new Set([1, 2, 3])]]),
      coverage: { 'apps/frontend/src/new.ts': entry({ 1: 0, 2: 0, 3: 0 }) },
      cwd,
    });

    assert.equal(result.total, 3);
    assert.equal(result.covered, 0);
  });

  it('restricts the gate to the app under test', () => {
    const result = evaluate({
      added: new Map([
        ['apps/frontend/src/a.ts', new Set([1])],
        ['apps/backend/src/b.ts', new Set([1])],
      ]),
      coverage: {
        'apps/frontend/src/a.ts': entry({ 1: 1 }),
        'apps/backend/src/b.ts': entry({ 1: 0 }),
      },
      appDir: 'apps/frontend',
      cwd,
    });

    assert.equal(result.total, 1);
    assert.equal(result.covered, 1);
    assert.deepEqual(
      result.measured.map((m) => m.file),
      ['apps/frontend/src/a.ts']
    );
  });

  it('does not let one app directory match another by prefix', () => {
    // 'apps/frontend' must not swallow 'apps/frontend-e2e'.
    const result = evaluate({
      added: new Map([['apps/frontend-e2e/src/a.ts', new Set([1])]]),
      coverage: { 'apps/frontend-e2e/src/a.ts': entry({ 1: 0 }) },
      appDir: 'apps/frontend',
      cwd,
    });

    assert.equal(result.total, 0);
  });

  it('measures nothing for a diff that adds no executable lines', () => {
    const result = evaluate({
      added: new Map([['docs/readme.md', new Set([1, 2])]]),
      coverage: { 'apps/frontend/src/a.ts': entry({ 1: 1 }) },
      cwd,
    });

    assert.equal(result.total, 0);
    assert.equal(result.covered, 0);
  });
});
