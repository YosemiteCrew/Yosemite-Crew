import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import {
  BASELINE_PATH,
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
  // #rrggbbaa contains #rrggbb as a prefix. What keeps it one finding is the
  // trailing lookahead rather than the order of the alternation: a six-digit
  // match followed by another hex character is rejected and the engine
  // backtracks to the eight-digit branch. Reordering the alternation therefore
  // changes nothing, which is worth stating because it looks like it would.
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

test('a URL does not blank the rest of its line, in any quote style', () => {
  // `//` inside a string is not a comment. Getting this wrong lowers the count
  // silently, which is the failure that looks most like success. All three
  // quote styles are here because covering only one leaves two branches of the
  // state machine unmeasured - a scanner that stopped tracking single quotes
  // passed this test when it named only the double-quoted case.
  for (const quote of ['"', "'", '`']) {
    const source = `const u = ${quote}https://example.com/docs${quote}; const c = "#ff0000";`;
    assert.equal(findColours(source).length, 1, `broke on ${quote}`);
    // Whole-string equality, and neither a regex nor a substring test. This
    // source contains no comment, so a correct strip is a no-op on every byte -
    // a stronger claim than "the host is still in there somewhere", and one
    // that says nothing about URLs, so it cannot be read as sanitising one.
    // The two weaker forms were each flagged, in opposite directions: the regex
    // for being unanchored over a URL, the substring for incomplete URL
    // sanitisation. Both findings were pointing at the same thing - the
    // assertion was matching a URL when its subject was the strip.
    assert.equal(stripComments(source), source, `broke on ${quote}`);
  }
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
    (source.match(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?!\w)/g) ?? []).length;
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
  // Two checks, not one alternation. `$` binds to the last alternative only, so
  // `/__tests__|\.test\.tsx?$/` reads as end-anchored throughout when half of it
  // is not; grouping that to say so is then flagged as redundant grouping, and
  // both readings are right about the pattern. Splitting it removes the
  // question rather than answering it, and it states the predicate the scanner
  // actually uses: a separator-bounded directory OR a test-file suffix.
  const inTestDirectory = (file) => file.split('/').includes('__tests__');
  const isTestFile = (file) => file.endsWith('.test.ts') || file.endsWith('.test.tsx');
  assert.ok(!findings.some((f) => inTestDirectory(f.file) || isTestFile(f.file)));

  // The predicate above must be able to say yes, or the assertion is a matcher
  // that cannot match and the empty result means nothing.
  assert.ok(inTestDirectory('apps/frontend/src/app/__tests__/a.ts'));
  assert.ok(isTestFile('a/b.test.tsx'));
  assert.ok(!inTestDirectory('apps/frontend/src/app/my__tests__notadir/a.ts'));
  assert.ok(!isTestFile('a/b.tsx'));
});

/* ---------------------------------------------------------------------------
   The justified list.

   These tests exist because an allowlist is the part of a gate that decays. The
   failure is never "someone wrote a bad reason"; it is that the list quietly
   becomes a ceiling, and a literal nobody chose slips in underneath a sentence
   written about a different one.
   --------------------------------------------------------------------------- */

test('a justified file is exempt from the debt arms', () => {
  const justified = { 'a.tsx': { n: 2, why: 'x'.repeat(30) } };
  const { increased, decreased } = compare({ 'a.tsx': 2 }, { 'a.tsx': 1 }, justified);
  assert.deepEqual([increased, decreased], [[], []]);
});

test('a justified file is pinned in BOTH directions, not capped', () => {
  // The load-bearing half is the increase. A ceiling would accept 2 -> 1 AND
  // 1 -> 2, and the second is a new literal hiding behind an old reason.
  //
  // The path has to be one that EXISTS. Written against 'a.tsx' all three arms
  // pass vacuously: compare checks existence first and files a missing
  // justified path as `vanished`, so the drift branch under test is never
  // reached and `drifted` is empty for the right-looking reason.
  const real = 'package.json';
  const justified = { [real]: { n: 1, why: 'x'.repeat(30) } };

  const gained = compare({ [real]: 2 }, {}, justified);
  assert.deepEqual(
    gained.drifted.map(({ file, was, now }) => ({ file, was, now })),
    [{ file: real, was: 1, now: 2 }]
  );

  const lost = compare({ [real]: 0 }, {}, justified);
  assert.deepEqual(
    lost.drifted.map(({ file, was, now }) => ({ file, was, now })),
    [{ file: real, was: 1, now: 0 }]
  );

  const held = compare({ [real]: 1 }, {}, justified);
  assert.deepEqual(held.drifted, []);
});

test('a justified path that no longer exists is reported, not silently held', () => {
  const { vanished, drifted } = compare(
    {},
    {},
    { 'no/such/file.tsx': { n: 1, why: 'x'.repeat(30) } }
  );
  assert.deepEqual(vanished, [{ file: 'no/such/file.tsx', was: 1 }]);
  assert.deepEqual(drifted, []);
});

test('the drift report carries the reason on record, not just the numbers', () => {
  // The reader of a failing gate has to decide whether the new literal belongs
  // under the old reason. They cannot do that from "1 -> 2".
  const why = 'Stripe Connect renders in its own iframe and cannot read our custom properties.';
  const { drifted } = compare({ 'package.json': 2 }, {}, { 'package.json': { n: 1, why } });
  assert.equal(drifted[0].why, why);
});

test('every justified entry in the shipped baseline names a file that exists', () => {
  // A reason attached to a deleted path is an exemption with no subject, and it
  // reads as a considered decision for as long as nobody opens the file.
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  const justified = Object.keys(baseline.justified ?? {});
  assert.ok(justified.length > 0, 'the fixture for this test is the baseline itself');
  for (const file of justified) {
    assert.ok(existsSync(join(dirname(BASELINE_PATH), '../..', file)), `missing: ${file}`);
  }
});

test('a justified path is not also carried as debt', () => {
  // Counted twice, the total is wrong in the direction that looks like progress.
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  for (const file of Object.keys(baseline.justified ?? {})) {
    assert.ok(!(file in baseline.files), `${file} is in both justified and files`);
  }
});

test('the shipped baseline totals agree with its own rows', () => {
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  const summed = Object.values(baseline.files).reduce((n, c) => n + c, 0);
  assert.equal(baseline.total, summed);
});

test('every reason in the shipped baseline is long enough to be a reason', () => {
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  for (const [file, entry] of Object.entries(baseline.justified ?? {})) {
    assert.ok(entry.why.trim().length >= 20, `${file}: "${entry.why}" is not a reason`);
    assert.ok(Number.isInteger(entry.n) && entry.n > 0, `${file}: n must be a positive integer`);
  }
});
