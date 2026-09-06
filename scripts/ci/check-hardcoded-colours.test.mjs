import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SELFTEST_CASES,
  compare,
  findColours,
  scan,
  selftest,
  stripComments,
} from './check-hardcoded-colours.mjs';

test('the scanner finds each shape of colour literal', () => {
  assert.deepEqual(
    findColours('const a = { color: "#ff0000", border: "1px solid #abc" };').map((f) => f.text),
    ['#ff0000', '#abc']
  );
  assert.equal(findColours('background: rgba(12, 34, 56, 0.5);').length, 1);
  assert.equal(findColours('background: hsl(210, 50%, 40%);').length, 1);
  assert.equal(findColours('color: var(--blue-strong);').length, 0);
});

test('an eight-digit hex is one finding and not two', () => {
  // #rrggbbaa also matches #rrggbb as a prefix; the alternation has to prefer
  // the longest form or the same literal is counted twice and the baseline
  // drifts against a file nobody edited.
  assert.deepEqual(
    findColours('const a = "#1657c9ff";').map((f) => f.text),
    ['#1657c9ff']
  );
});

test('a literal inside a comment is not a finding', () => {
  // The comments in this repository record why a colour was rejected. A gate
  // that counted them would be satisfied by deleting the reasoning.
  assert.equal(findColours('/* #8b8173 was 3.78:1 on --inset */').length, 0);
  assert.equal(findColours('// #007cf5 is only 4.04:1 under white').length, 0);
  assert.equal(
    findColours('a { /* #ff0000 rejected */ color: var(--x); }', { css: true }).length,
    0
  );
});

test('a URL does not blank the rest of its line', () => {
  // `//` inside a string is not a comment. Getting this wrong lowers the count
  // silently, which is the failure that looks most like success.
  const source = 'const u = "https://example.com/docs"; const c = "#ff0000";';
  assert.equal(findColours(source).length, 1);
  assert.match(stripComments(source), /https:\/\/example\.com/);
});

test('CSS has no line comments, so an unquoted url() survives', () => {
  const source = 'a { background: url(https://x.test/i.png); color: #ff0000; }';
  assert.equal(findColours(source, { css: true }).length, 1);
  // And the TypeScript reading of the same bytes loses the colour, which is
  // exactly why the comment style follows the file.
  assert.equal(findColours(source, { css: false }).length, 0);
});

test('stripComments preserves length and line numbering', () => {
  const source = 'a\n/* x */\nb\n';
  const stripped = stripComments(source);
  assert.equal(stripped.length, source.length);
  assert.equal(stripped.split('\n').length, source.split('\n').length);
});

test('line numbers point at the line the literal is on', () => {
  const findings = findColours('const a = 1;\nconst b = "#ff0000";\n');
  assert.deepEqual(findings, [{ line: 2, text: '#ff0000' }]);
});

test('the selftest passes and covers both comment styles', () => {
  assert.deepEqual(selftest(), []);
  assert.ok(SELFTEST_CASES.length >= 10);
  assert.ok(SELFTEST_CASES.some(([, expected]) => expected === 0));
  assert.ok(SELFTEST_CASES.some(([, expected]) => expected > 0));
});

test('the selftest fails when the scanner stops seeing comments', () => {
  // A selftest that cannot fail is a decoration. This drives the case table
  // through a deliberately broken scanner and requires it to notice.
  const blind = (source) =>
    (source.match(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-fA-F\w])/g) ?? []).length;
  const missed = SELFTEST_CASES.filter(([source, expected]) => blind(source) !== expected);
  assert.ok(missed.length > 0, 'a comment-blind scanner must fail at least one case');
});

test('compare reports an increase against the baseline', () => {
  const { increased, decreased } = compare({ 'package.json': 3 }, { 'package.json': 1 });
  assert.deepEqual(increased, [{ file: 'package.json', was: 1, now: 3 }]);
  assert.deepEqual(decreased, []);
});

test('a file absent from the baseline may not carry any literal', () => {
  const { increased } = compare({ 'package.json': 1 }, {});
  assert.deepEqual(increased, [{ file: 'package.json', was: 0, now: 1 }]);
});

test('compare reports an improvement so the ratchet has to tighten', () => {
  const { increased, decreased } = compare({ 'package.json': 1 }, { 'package.json': 4 });
  assert.deepEqual(decreased, [{ file: 'package.json', was: 4, now: 1 }]);
  assert.deepEqual(increased, []);
});

test('compare reports a baselined file that no longer exists', () => {
  const { vanished } = compare({}, { 'no/such/file.tsx': 2 });
  assert.deepEqual(vanished, [{ file: 'no/such/file.tsx', was: 2 }]);
});

test('a clean tree against its own counts is silent', () => {
  const { increased, decreased, vanished } = compare({ 'package.json': 2 }, { 'package.json': 2 });
  assert.deepEqual([increased, decreased, vanished], [[], [], []]);
});

test('the walk reaches the frontend and returns a non-empty corpus', () => {
  // A scan that walks nothing reports clean. This is the control that makes a
  // zero from the real gate worth reading.
  const { scanned, findings } = scan();
  assert.ok(scanned > 200, `walked only ${scanned} files`);
  assert.ok(findings.length > 0, 'the tree is known to contain literals today');
  assert.ok(
    findings.every((f) => f.file.startsWith('apps/frontend/src')),
    'findings must be inside the declared scan roots'
  );
});

test('the scan excludes the token source and the test files', () => {
  const { findings } = scan();
  assert.ok(!findings.some((f) => f.file.endsWith('app/globals.css')));
  assert.ok(!findings.some((f) => /__tests__|\.test\.tsx?$/.test(f.file)));
});
