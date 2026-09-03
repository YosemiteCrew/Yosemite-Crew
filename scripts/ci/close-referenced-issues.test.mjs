// Tests for the closing-keyword parser. The gh-driven side effects are exercised
// by the workflow itself; what is pinned here is that the parser mirrors GitHub's
// own rule - so this never closes an issue GitHub would have left open.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { closedIssues } from './close-referenced-issues.mjs';

test('matches every keyword GitHub recognises', () => {
  for (const kw of [
    'close',
    'closes',
    'closed',
    'fix',
    'fixes',
    'fixed',
    'resolve',
    'resolves',
    'resolved',
  ]) {
    assert.deepEqual(closedIssues(`${kw} #7`), [7], kw);
    assert.deepEqual(closedIssues(`${kw.toUpperCase()} #7`), [7], kw);
  }
});

test('accepts the optional colon GitHub allows', () => {
  assert.deepEqual(closedIssues('Closes: #12'), [12]);
});

test('a bare mention with no keyword closes nothing', () => {
  assert.deepEqual(closedIssues('See #99 for context'), []);
  assert.deepEqual(closedIssues('#99'), []);
});

test('the keyword must sit on each reference, as on GitHub', () => {
  // GitHub closes only #1 here - the keyword does not carry to #2.
  assert.deepEqual(closedIssues('Closes #1, #2'), [1]);
  assert.deepEqual(closedIssues('Closes #1 and closes #2'), [1, 2]);
});

test('does not match a cross-repo reference', () => {
  assert.deepEqual(closedIssues('Fixes owner/repo#5'), []);
});

test('deduplicates and handles an empty body', () => {
  assert.deepEqual(closedIssues('Fixes #3 and fixes #3'), [3]);
  assert.deepEqual(closedIssues(''), []);
  assert.deepEqual(closedIssues(undefined), []);
  assert.deepEqual(closedIssues(null), []);
});

test('reads keywords from a realistic multi-line PR body', () => {
  const body = [
    '## What changed',
    'Reworked the thing.',
    '',
    'Closes #2554. Also fixes #2552.',
    'Mentions #2603 as related follow-up.',
  ].join('\n');
  assert.deepEqual(
    closedIssues(body).sort((a, b) => a - b),
    [2552, 2554]
  );
});
