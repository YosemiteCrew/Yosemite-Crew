// Tests for the forbidden-terms gate.
//
// The real pattern is a repository secret and is deliberately not available
// here. That is not a gap: these tests pin the MACHINERY with a synthetic
// pattern, in the open, where the assertions can be read. The real pattern's
// behaviour is pinned by the `selftest` command, which runs in CI where the
// secret exists and asserts the pattern against both corpora before the job
// looks at a single line of the pull request.
//
// Splitting it that way is the point: everything testable without the secret is
// tested without the secret.

import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { lstatSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import test from 'node:test';

import {
  addedLines,
  compilePattern,
  corpusLines,
  scanSurface,
  selfTest,
  SURFACES,
} from './forbidden-terms.mjs';

const ROOT = path.join(import.meta.dirname, '..', '..');
const SCRIPT = path.join(import.meta.dirname, 'forbidden-terms.mjs');
const PROSE = path.join(import.meta.dirname, 'forbidden-terms-allowed-prose.txt');
/**
 * The corpus, excluded from its own verbatim check. DERIVED from {@link PROSE}
 * rather than written out a second time: a `:(exclude)` pathspec matching no
 * file is not an error to git, so a second spelling of this path could quietly
 * stop excluding anything and every corpus line would prove its own presence
 * again - the defect this exclusion exists to fix, restored by the fix.
 */
const PROSE_PATHSPEC = `:(exclude)${path.relative(ROOT, PROSE)}`;
const WORKFLOW = path.join(ROOT, '.github', 'workflows', 'forbidden-terms.yml');

/** The only action the job may run, pinned by SHA. */
const PINNED_CHECKOUT = 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1';

/**
 * Tokens that must not appear in the job body, and what each one would cost.
 *
 * NOT a general workflow linter, and it must not become one. The whole list is
 * "things that run code the pull-request head can choose", because that is the
 * single condition the `pull_request_target` argument rests on. A broader
 * version would be a second, worse check wearing the same name.
 */
const VOIDS_THE_ACCEPTANCE = [
  // `pnpm` before `npm `, because 'pnpm install' contains 'npm ' and the
  // message should name the token the line actually uses.
  ['pnpm', "an install runs the head's package.json and its lifecycle scripts"],
  ['npm ', "an install runs the head's package.json and its lifecycle scripts"],
  ['yarn ', "an install runs the head's package.json and its lifecycle scripts"],
  ['npx ', 'npx fetches and executes a package the head can name'],
  ['set -x', 'tracing prints the decoded pattern before masking can help'],
];

/** Stands in for the real term list. Names nothing that exists. */
const SYNTHETIC = 'acmehealth|acme health|acme-health';
const pattern = compilePattern(SYNTHETIC);

/** Runs the CLI and returns its exit code and streams. */
function run(args, env = {}) {
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT, ...args], {
      encoding: 'utf8',
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, stdout, stderr: '' };
  } catch (error) {
    return { code: error.status, stdout: error.stdout ?? '', stderr: error.stderr ?? '' };
  }
}

const b64 = (value) => Buffer.from(value, 'utf8').toString('base64');

/**
 * Writes a full set of surface files and returns the directory.
 *
 * Every surface is written even when a case only cares about one, because that
 * is what the CLI now requires - and requiring it is the point: a caller that
 * can leave one out is a caller that will.
 */
function surfaceDir(overrides = {}) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'forbidden-terms-'));
  for (const surface of ['diff', 'names', 'messages', 'branch', 'title', 'body']) {
    writeFileSync(path.join(dir, surface), overrides[surface] ?? '');
  }
  return dir;
}

// ---------------------------------------------------------------------------
// The diff surface
// ---------------------------------------------------------------------------

test('added lines carry the file and the line they land on', () => {
  const diff = [
    'diff --git a/docs/one.md b/docs/one.md',
    '--- a/docs/one.md',
    '+++ b/docs/one.md',
    '@@ -10,2 +10,3 @@',
    ' context line',
    '+added on eleven',
    ' another context line',
    '@@ -40,1 +41,2 @@',
    '-removed line',
    '+added on forty-one',
    '',
  ].join('\n');

  assert.deepEqual(addedLines(diff), [
    { file: 'docs/one.md', line: 11, text: 'added on eleven' },
    { file: 'docs/one.md', line: 41, text: 'added on forty-one' },
  ]);
});

test('a removed line does not advance the new-file line number', () => {
  // Without this the numbers drift by one per deletion, and a finding sends the
  // author to a line that says something else - which reads as a false positive
  // and gets the gate distrusted rather than the term removed.
  const diff = ['+++ b/a.ts', '@@ -1,4 +1,3 @@', ' one', '-two', '-three', '+two prime', ''].join(
    '\n'
  );
  assert.deepEqual(addedLines(diff), [{ file: 'a.ts', line: 2, text: 'two prime' }]);
});

test('the +++ header is not itself an added line', () => {
  // It starts with '+' and names a path. Matching it would report every renamed
  // file as a finding.
  const diff = [
    '--- /dev/null',
    '+++ b/acmehealth-notes.md',
    '@@ -0,0 +1,1 @@',
    '+content',
    '',
  ].join('\n');
  const found = scanSurface(pattern, 'diff', diff);
  assert.deepEqual(found, []);
});

test('an added line whose own content starts with ++ is an addition, not a header', () => {
  // The case that separates the two readings. `the +++ header is not itself an
  // added line` above is satisfied by BOTH a parser that skips headers and one
  // that skips anything shaped like one, because it only ever presents a real
  // header. This one presents an addition git wrote as `+++ `.
  //
  // The broken reading failed in both directions at once: the line carrying the
  // term went unscanned, AND `file` became that line of the diff, which the
  // report prints - publishing pull-request content into a public log.
  const diff = [
    'diff --git a/a.md b/a.md',
    '--- a/a.md',
    '+++ b/a.md',
    '@@ -2,0 +3,2 @@ two',
    // git writes an added line as `+` plus its content, so a line whose text
    // begins `++ ` reaches the parser as `+++ ` - indistinguishable from the
    // header by content, which is the whole defect.
    '+++ this line names acmehealth',
    '+plain acme health line',
    '',
  ].join('\n');

  assert.deepEqual(addedLines(diff), [
    { file: 'a.md', line: 3, text: '++ this line names acmehealth' },
    { file: 'a.md', line: 4, text: 'plain acme health line' },
  ]);

  // Both lines are found, and no finding carries diff content as its file.
  const found = scanSurface(pattern, 'diff', diff);
  assert.deepEqual(found, [
    { surface: 'diff', file: 'a.md', line: 3 },
    { surface: 'diff', file: 'a.md', line: 4 },
  ]);
});

test('a hunk header with an omitted count owns one line', () => {
  // git writes `@@ -1,0 +2 @@` rather than `+2,1`. Reading the absent count as
  // zero ends the hunk before its only addition, and the addition is then
  // header territory.
  const diff = ['+++ b/b.md', '@@ -1,0 +2 @@ b one', '+acmehealth in b', ''].join('\n');
  assert.deepEqual(addedLines(diff), [{ file: 'b.md', line: 2, text: 'acmehealth in b' }]);
});

test('the parse agrees with real git diff output, not just with fixtures', () => {
  // Every other case here is a hand-written approximation of git, and the
  // defect this file now pins was found against real output and hidden by a
  // fixture. So one case pays for a repository.
  const repo = mkdtempSync(path.join(os.tmpdir(), 'forbidden-terms-git-'));
  const git = (...args) => execFileSync('git', args, { cwd: repo, stdio: 'pipe' });
  git('init', '-q', '-b', 'main', '.');
  git('config', 'user.email', 'guard@example.invalid');
  git('config', 'user.name', 'Guard Test');
  writeFileSync(path.join(repo, 'a.md'), 'one\ntwo\n');
  writeFileSync(path.join(repo, 'b.md'), 'b one\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'base');
  writeFileSync(path.join(repo, 'a.md'), 'one\ntwo\n++ names acmehealth\nplain acme health\n');
  writeFileSync(path.join(repo, 'b.md'), 'b one\nacme-health in b\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'change');

  const diff = execFileSync(
    'git',
    ['diff', '--unified=0', '--diff-filter=ACMRT', 'HEAD~1', 'HEAD'],
    {
      cwd: repo,
      encoding: 'utf8',
    }
  );

  assert.deepEqual(scanSurface(pattern, 'diff', diff), [
    { surface: 'diff', file: 'a.md', line: 3 },
    { surface: 'diff', file: 'a.md', line: 4 },
    { surface: 'diff', file: 'b.md', line: 2 },
  ]);
});

test('a file REPLACED BY A SYMLINK is a type change, and T is what sees it', () => {
  // The filter the workflow passes is the guard's real reach, so it is pinned
  // against real git rather than against a fixture that agrees with it.
  //
  // Replacing a regular file with a symlink is `T`. Without T in the filter the
  // path is not new so it never reaches `names`, its content never reaches
  // `diff`, and the scanner is handed nothing to be silent about - a green run
  // that wrote its `scanned` receipt having looked at neither surface. The
  // symlink TARGET carries the term.
  //
  // Both halves are asserted: ACMR sees NOTHING, which is the defect, and
  // ACMRT sees the path and the target. An assertion on ACMRT alone cannot
  // tell this fix from not making it.
  const repo = mkdtempSync(path.join(os.tmpdir(), 'forbidden-terms-symlink-'));
  const git = (...args) => execFileSync('git', args, { cwd: repo, stdio: 'pipe' });
  git('init', '-q', '-b', 'main', '.');
  git('config', 'user.email', 'guard@example.invalid');
  git('config', 'user.name', 'Guard Test');
  writeFileSync(path.join(repo, 'note.md'), 'harmless\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'base');
  rmSync(path.join(repo, 'note.md'));
  symlinkSync('acmehealth-prior-art.md', path.join(repo, 'note.md'));
  git('add', '-A');
  git('commit', '-q', '-m', 'type change');

  const surfaces = (filter) => ({
    diff: execFileSync(
      'git',
      ['diff', '--unified=0', `--diff-filter=${filter}`, 'HEAD~1', 'HEAD'],
      { cwd: repo, encoding: 'utf8' }
    ),
    names: execFileSync(
      'git',
      ['diff', '--name-only', `--diff-filter=${filter}`, 'HEAD~1', 'HEAD'],
      { cwd: repo, encoding: 'utf8' }
    ),
  });

  // git agrees this is a type change and not something else.
  assert.equal(
    execFileSync('git', ['diff', '--name-status', 'HEAD~1', 'HEAD'], {
      cwd: repo,
      encoding: 'utf8',
    }).trim(),
    'T\tnote.md'
  );

  // The defect: the old filter hands the scanner two empty surfaces.
  const before = surfaces('ACMR');
  assert.equal(before.diff, '');
  assert.equal(before.names, '');
  assert.deepEqual(scanSurface(pattern, 'diff', before.diff), []);
  assert.deepEqual(scanSurface(pattern, 'names', before.names), []);

  // The fix. Note WHICH surface catches it: the path `note.md` is innocent, so
  // `names` correctly finds nothing even with T - it is the symlink TARGET that
  // names the term, and that reaches the scanner only as an added line on the
  // diff surface. Asserting a `names` finding here would have been asserting
  // the wrong mechanism and would pass for the wrong reason on any path that
  // happened to be named badly.
  const after = surfaces('ACMRT');
  assert.equal(after.names.trim(), 'note.md');
  assert.deepEqual(scanSurface(pattern, 'names', after.names), []);
  assert.deepEqual(scanSurface(pattern, 'diff', after.diff), [
    { surface: 'diff', file: 'note.md', line: 1 },
  ]);
});

test('a file NAMED after a forbidden term is caught by the names surface', () => {
  // Which is why `names` exists: the diff surface deliberately ignores the
  // header that carries the path, so the path is checked as its own surface.
  const found = scanSurface(pattern, 'names', 'docs/acmehealth-notes.md\ndocs/fine.md\n');
  assert.deepEqual(found, [{ surface: 'names', file: 'names', line: 1 }]);
});

test('multiple files in one diff each report their own path', () => {
  const diff = [
    '+++ b/first.ts',
    '@@ -1,0 +1,1 @@',
    '+see acme health for prior art',
    '+++ b/second.ts',
    '@@ -5,0 +5,1 @@',
    '+also acmehealth',
    '',
  ].join('\n');
  assert.deepEqual(scanSurface(pattern, 'diff', diff), [
    { surface: 'diff', file: 'first.ts', line: 1 },
    { surface: 'diff', file: 'second.ts', line: 5 },
  ]);
});

// ---------------------------------------------------------------------------
// What a finding may contain
// ---------------------------------------------------------------------------

test('a finding carries where and never what', () => {
  // The load-bearing assertion of the whole file. This log is public: a finding
  // that carried the matched text would publish the term list one blocked pull
  // request at a time.
  const [finding] = scanSurface(pattern, 'title', 'feat(api): port the acme health chart layout');
  assert.deepEqual(Object.keys(finding).sort(), ['file', 'line', 'surface']);
  assert.equal(JSON.stringify(finding).toLowerCase().includes('acme'), false);
});

test('the whole blocked-run output never contains the term', () => {
  const dir = surfaceDir({ body: 'ported from acme health, which is the thing not to write' });
  const result = run(['scan', '--dir', dir], { FORBIDDEN_TERMS_PATTERN_B64: b64(SYNTHETIC) });
  assert.equal(result.code, 1);
  assert.equal(`${result.stdout}${result.stderr}`.toLowerCase().includes('acme'), false);
});

test('a surface left out of the directory is exit 2, not a clean run', () => {
  // The defect this CLI shape exists to remove. When `scan` took a list of
  // `<surface>=<file>` pairs, dropping one from the workflow left the run
  // reporting clean while that surface carried the term - the caller decided
  // the coverage and nothing asserted it had passed them all.
  const dir = surfaceDir({ body: 'acmehealth' });
  execFileSync('rm', [path.join(dir, 'body')]);
  const result = run(['scan', '--dir', dir], { FORBIDDEN_TERMS_PATTERN_B64: b64(SYNTHETIC) });
  assert.equal(result.code, 2);
  assert.match(result.stderr, /Cannot read the 'body' surface/);
});

test('a clean run says how many surfaces it read', () => {
  // "no named external product on any CHECKED surface" was true of a run that
  // checked five of six. The count is what makes the sentence answerable.
  const result = run(['scan', '--dir', surfaceDir()], {
    FORBIDDEN_TERMS_PATTERN_B64: b64(SYNTHETIC),
  });
  assert.equal(result.code, 0);
  assert.match(result.stdout, /6 surfaces read/);
});

test('every surface is a bare filename', () => {
  // `runScan` builds each path as path.join(dir, surface), so an entry carrying
  // a separator or a `..` reads a file the collector never wrote. Cardinality
  // pins WHICH surfaces are read; nothing above pins their SHAPE. `../body` is
  // caught several other ways because the file does not exist under the fixture
  // root - a fact about where the test writes its files, not about this set.
  // `./title` is the case that shows what this assertion is for: it resolves to
  // the SAME file, every other test stays green (28 / 1), and only a statement
  // about the shape of the entry sees it at all. NOT `./body`, which is 27 / 2
  // because it also trips the exit-2 test - and that one matches
  // `Cannot read the 'body' surface`, a hardcoded name in an error message
  // rather than anything about containment.
  //
  // HALF of the argument that the file-inclusion finding on that join is
  // unreachable, and the half that is checked. The join has two operands. This
  // pins the set: every entry is a bare name, so no entry can escape `dir`. It
  // says NOTHING about the call site - a second caller-controlled operand added
  // to the same `path.join` leaves this suite at 29/0. No assertion here can
  // reach that: a dormant variable has no behaviour to observe, and a source
  // regex over `path.join(dir, surface)` goes red on renaming the loop variable,
  // which is a legal edit. That half is held by review and by nothing else.
  assert.notEqual(SURFACES.size, 0, 'no surfaces: this test is reading nothing');
  for (const surface of SURFACES) {
    assert.equal(path.basename(surface), surface, `'${surface}' is not a bare filename`);
    assert.equal(
      surface === '.' || surface === '..',
      false,
      `'${surface}' resolves outside the surface directory`
    );
  }
});

test('a pattern that does not compile is reported without quoting the pattern', () => {
  // The RegExp constructor's own message quotes the source. Letting it out
  // would publish the term list on the one run where the secret is malformed.
  assert.throws(
    () => compilePattern('acme(health'),
    (error) =>
      !error.message.toLowerCase().includes('acme') && /does not compile/.test(error.message)
  );
});

// ---------------------------------------------------------------------------
// The flags, which PATTERN_SHAPE cannot see
// ---------------------------------------------------------------------------
//
// The shape predicate constrains the PATTERN. `compilePattern`'s flags are the
// other half of what the guard matches with, and one of them acts on the
// HAYSTACK, where no constraint on the pattern can reach it. Found by mutating
// the module against this file: `'i'` -> `'iu'` was green on all 47 tests.
//
// `g` and `y` are already pinned, because both carry `lastIndex` between calls
// and the surface tests go red. `s`, `m` and `d` are invisible and that is
// CORRECT rather than a gap: `s` changes only `.`, `m` changes only `^` and
// `$`, and `d` changes only what `exec` returns, so inside the accepted
// alphabet all three are inert - the shape predicate doing exactly its job.
// `u` is the exception, because it changes CASE FOLDING, and folding reads the
// input rather than the pattern.

/**
 * Code points that ONLY full Unicode case folding maps onto an ASCII letter.
 *
 * Written as escapes rather than literally, because the assertion is about a
 * specific code point and a raw one is indistinguishable on screen from the
 * letter it folds to - a fixture nobody can check by reading it.
 */
const FOLD_ONLY_TO_ASCII = [
  ['KELVIN SIGN', '\u212A', 'k'],
  ['LATIN SMALL LETTER LONG S', '\u017F', 's'],
];

for (const [name, char, ascii] of FOLD_ONLY_TO_ASCII) {
  test(`case folding stops at ASCII: ${name}`, () => {
    const p = compilePattern(`acme${ascii}are`);

    // Positive controls: `i` is present and doing its job, so a `false` below
    // is this code point and not a pattern that matches nothing.
    assert.equal(p.test(`acme${ascii}are`), true, 'the ASCII spelling must match');
    assert.equal(p.test(`ACME${ascii.toUpperCase()}ARE`), true, 'upper case must match');

    // The assertion. `u` folds this code point onto its ASCII letter, and the
    // guard would then match a string the machine-local `grep -inE` does not -
    // making the secret a TRANSLATION between the two implementations rather
    // than one value used twice, which is the whole argument for PATTERN_SHAPE.
    assert.equal(p.test(`acme${char}are`), false, `${name} must not fold onto '${ascii}'`);

    // ...and the control that earns that `false`. Built from a literal `'iu'`
    // rather than from `compilePattern`, so it cannot inherit the change it
    // exists to detect. Without it, a code point that folds under NEITHER flag
    // would pass this test while proving nothing about `u`.
    assert.equal(
      new RegExp(`acme${ascii}are`, 'iu').test(`acme${char}are`),
      true,
      `fixture is vacuous: ${name} does not fold onto '${ascii}' even with the u flag`
    );
  });
}

test('the pattern is matched case-insensitively', () => {
  // Named for the flag it is about. Dropping the `i` does redden one row of the
  // accepted-shape table below, but that row is called `the shape accepts upper
  // case` and is about the ALPHABET - so the only test that currently sees this
  // mutation reports the wrong cause for it.
  const p = compilePattern('acmekare|acme care');
  for (const spelling of ['ACMEKARE', 'AcMeKaRe', 'ACME CARE', 'Acme Care']) {
    assert.equal(p.test(spelling), true, `${spelling} must match`);
  }
  assert.equal(p.test('acme fare'), false, 'control: not every string matches');
});

// ---------------------------------------------------------------------------
// The self-test
// ---------------------------------------------------------------------------

const passCorpus = ['open an issue', 'open standards', 'the door opens'];

test('a healthy pattern and corpus produce no problems', () => {
  assert.deepEqual(
    selfTest({
      pattern,
      // One entry per alternative. It was two against a three-alternative
      // pattern until the arity check was added and reddened this very case -
      // the guard's own fixture was an instance of the gap it now closes.
      blockCorpus: ['acmehealth', 'acme health', 'acme-health'],
      passCorpus,
      minCorpus: 2,
    }),
    []
  );
});

test('a known positive the pattern misses is a problem, reported by position', () => {
  const problems = selfTest({
    pattern,
    // Entry 2 is deliberately mangled so the pattern misses it. Every
    // alternative still needs an entry of its OWN behind it, or the
    // per-alternative check fires too and this case stops being about the
    // missed positive - which is what happened when that check was added.
    blockCorpus: ['acmehealth', 'acme  health', 'acme-health', 'acme health'],
    passCorpus,
    minCorpus: 2,
  });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /position\(s\) 2/);
  assert.equal(problems[0].toLowerCase().includes('acme'), false);
});

test('a corpus shorter than the declared minimum is a problem', () => {
  // The truncated-secret case. Nothing else notices it: a short corpus still
  // passes every entry it has.
  //
  // The corpus is long enough for the ARITY check on purpose - one entry per
  // alternative - so the single problem below is the floor and only the floor.
  // A two-entry corpus would fire both and `problems.length === 1` would be
  // asserting that two independent checks happen to be one.
  const problems = selfTest({
    pattern,
    blockCorpus: ['acmehealth', 'acme health', 'acme-health'],
    passCorpus,
    minCorpus: 5,
  });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /3 entries, fewer than the 5/);
});

test('a pattern that matches this repository own prose is a problem', () => {
  // Over-broad WITHIN the accepted shape, which is the realistic version: a
  // term that is also an ordinary phrase in this repository's own writing. The
  // previous fixture used `open[ -]?[a-z]+`, and once the shape assertion
  // existed that raised two problems - so the case would have been asserting
  // that over-breadth and a bad shape are one thing.
  const broad = compilePattern('open an issue|open standards');
  const problems = selfTest({
    pattern: broad,
    // Matched by the pattern, so the known-positives pass stays silent and the
    // one problem below is over-breadth alone. Two entries for two alternatives.
    blockCorpus: ['open an issue now', 'open standards body'],
    passCorpus,
    minCorpus: 1,
  });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /line\(s\) 1, 2/);
  assert.doesNotMatch(problems[0], /plain alternation/u, 'this case must not be a shape failure');
});

test('the compiled pattern folds case the way the other implementation does', () => {
  // `'i'` and NOT `'iu'`, pinned behaviourally rather than by reading the flags
  // string - the flags are two characters that read like a tidy-up next to the
  // `/u` on PATTERN_SHAPE twenty lines away, and PATTERN_SHAPE cannot see this
  // because `u` changes folding on the HAYSTACK rather than on the pattern.
  //
  // Under `iu`, `k` matches U+212A KELVIN SIGN. Under `i` it does not, and
  // neither does the machine-local hook's POSIX `grep -inE`. So the missing `u`
  // is what makes "one secret used in two implementations" true rather than
  // "two implementations that agree on ASCII". Raised in review.
  const kelvin = 'a\u212Ab';

  // The haystack asserted by its BYTES. A literal that silently degraded to
  // ASCII would make every row below pass for the wrong reason - which is how
  // this was first measured wrongly.
  assert.equal(Buffer.from(kelvin, 'utf8').toString('hex'), '61e284aa62');

  assert.equal(compilePattern('k').test(kelvin), false, 'the u flag has been added');
  // Controls: the same pattern on an ordinary capital, and on a letter it must
  // never match. Without them a compiled pattern that matches nothing at all
  // would satisfy the row above.
  assert.equal(compilePattern('k').test('aKb'), true);
  assert.equal(compilePattern('k').test('azb'), false);
});

// ---------------------------------------------------------------------------
// The direction the corpus pass cannot see
// ---------------------------------------------------------------------------

test('an alternative no corpus entry exercises is a problem, reported by position', () => {
  // The gap the COUNT cannot see, and the count is green on exactly this input.
  // Three entries against three alternatives satisfies `3 >= 3` while two
  // alternatives are matched by nothing - three spellings of one term and none
  // of another, which is what a corpus of variants naturally drifts into.
  // Raised in review after the count shipped.
  const problems = selfTest({
    pattern,
    blockCorpus: ['acmehealth', 'acmehealth ltd', 'a acmehealth thing'],
    passCorpus,
    minCorpus: 1,
  });
  assert.equal(problems.length, 1, 'the count must stay silent here, or this proves nothing');
  assert.match(problems[0], /alternative\(s\) at position\(s\) 2, 3/);
  assert.equal(problems[0].toLowerCase().includes('acme'), false);
});

test('an alternative is exercised only if the pattern MATCHES the entry, not if it contains it', () => {
  // Substring containment looks strictly simpler here and cannot throw, which
  // is why it is the tempting shape. It fails OPEN in the one check whose job
  // is to find unexercised alternatives: `'k'` is contained in nothing here,
  // but U+212A KELVIN SIGN is a character `includes` sees as different and a
  // case-folding `includes()` implementation would not.
  //
  // Driven the other way round, which is the version that fails: the entry
  // holds the KELVIN SIGN, the alternative is `k`. `entry.includes('k')` is
  // false and so is the regex, so both agree - the divergence needs the FOLDING
  // that `includes` does not do. So the case that separates them is an entry
  // differing only by case, where `includes` says unexercised and the pattern
  // matches it.
  //
  // Without this the substitution is still caught, but by a case about the
  // ACCEPTED ALPHABET, which names the wrong cause. Raised against my own
  // matrix.
  const problems = selfTest({
    pattern: compilePattern('acmehealth'),
    blockCorpus: ['ACMEHEALTH'],
    passCorpus,
    minCorpus: 1,
  });
  assert.deepEqual(problems, [], 'a case-differing entry exercises the alternative');
});

test('a corpus shorter than the alternation is a problem even when all of it is exercised', () => {
  // The count's own separating input, and it is what shows the two checks are
  // not one. A single entry containing every term exercises all three
  // alternatives, so the per-alternative check is silent - and the corpus is
  // still one entry against three terms, which is what the count is for.
  const problems = selfTest({
    pattern,
    blockCorpus: ['acmehealth and acme health and acme-health'],
    passCorpus,
    minCorpus: 1,
  });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /claims 3 alternatives and the must-block corpus has 1/);
});

test('a corpus ONE short of the alternation fires, which is the boundary itself', () => {
  // Weakening the count to `< claimed - 1` was green on everything until this
  // existed: the two-short case below still fires under that mutation, and the
  // equal case is silent under both, so nothing sat on the boundary. Two
  // entries covering all three alternatives keeps the per-alternative check
  // quiet, so the single problem is the count and only the count.
  const problems = selfTest({
    pattern,
    blockCorpus: ['acmehealth and acme health', 'acme-health'],
    passCorpus,
    minCorpus: 1,
  });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /claims 3 alternatives and the must-block corpus has 2/);
});

test('a corpus two short of the alternation still fires, which separates removed from off-by-one', () => {
  // Every other fixture is exactly one short, so deleting the count and
  // weakening it to `< claimed - 1` redden an identical set and the two are
  // indistinguishable. At two short the weakened form still fires and the
  // deleted one does not. Raised in review; six lines of fixture.
  const problems = selfTest({
    pattern: compilePattern('acmehealth|acme health|acme-health|acme  health'),
    blockCorpus: ['acmehealth and acme health and acme-health and acme  health'],
    passCorpus,
    minCorpus: 1,
  });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /claims 4 alternatives and the must-block corpus has 1/);
});

test('the floor, the count and the per-alternative check are three checks, not one', () => {
  // Each fires alone on an input the other two are silent on. Without this the
  // three could be one check wearing three messages, which is what the count
  // alone looked like until the per-alternative check was driven.

  // BOTH secrets truncating together: a pattern cut to one alternative against
  // a corpus cut to one entry satisfies `1 >= 1` and exercises that
  // alternative, so only the literal floor in the workflow sees the shrink.
  const bothShrank = selfTest({
    pattern: compilePattern('acmehealth'),
    blockCorpus: ['acmehealth'],
    passCorpus,
    minCorpus: 3,
  });
  assert.equal(bothShrank.length, 1);
  assert.match(bothShrank[0], /1 entries, fewer than the 3/);

  // A corpus over the floor and long enough for the count, piling on one
  // alternative: only the per-alternative check sees it.
  const pileup = selfTest({
    pattern,
    blockCorpus: ['acmehealth', 'acmehealth ltd', 'a acmehealth thing'],
    passCorpus,
    minCorpus: 1,
  });
  assert.equal(pileup.length, 1);
  assert.match(pileup[0], /position\(s\) 2, 3/);

  // One entry exercising every alternative: only the count sees it.
  const short = selfTest({
    pattern,
    blockCorpus: ['acmehealth and acme health and acme-health'],
    passCorpus,
    minCorpus: 1,
  });
  assert.equal(short.length, 1);
  assert.match(short[0], /must-block corpus has 1/);
});

// ---------------------------------------------------------------------------
// The shape predicate itself
// ---------------------------------------------------------------------------
//
// PATTERN_SHAPE is now load-bearing for two separate checks - one value read in
// two regular-expression dialects, and `alternativesIn` splitting on `|` - so a
// predicate that quietly admits one more construct makes both unsound while
// every other test stays green.
//
// One fixture cannot pin it. The case above violates the shape in three ways at
// once (a leading `(`, a trailing `)`, a group), so a predicate that has lost
// only its `^`, only its `$` or only one excluded character still rejects it and
// the case still passes. These tables are one row per construct and one row per
// anchor, so a single lost admission has somewhere to show up.

const REJECTED_SHAPES = [
  // Splitting on `|` is inexact for all of these: the escaped pipe is ONE
  // alternative that splits into two, and a class or a group can hide a pipe.
  ['an escaped pipe', String.raw`acme\|health`, 'acme|health'],
  ['a character class', 'acme[ -]health|acme health', 'acme health'],
  ['a quantifier', 'acmes?health|acme health', 'acmehealth'],
  ['a wildcard', 'acme.health|acme health', 'acmexhealth'],
  // Anchors, one end each. Both ends bad at once cannot separate them.
  // An ordinary character that is simply not in the alphabet, so these two rows
  // are about the ANCHOR and nothing else - a metacharacter here would redden
  // for a second reason and stop separating a lost `^` from a lost `$`.
  ['an excluded character at the start only', '_acmehealth|acme health', '_acmehealth'],
  ['an excluded character at the end only', 'acmehealth|acme health_', 'acmehealth'],
];

for (const [construct, source, entry] of REJECTED_SHAPES) {
  test(`the shape refuses ${construct}`, () => {
    const problems = selfTest({
      pattern: compilePattern(source),
      // Matched by the pattern, so known-positives stays silent and the single
      // problem is the shape alone.
      blockCorpus: [entry],
      passCorpus,
      minCorpus: 1,
    });
    assert.equal(problems.length, 1);
    assert.match(problems[0], /plain alternation of literal words/);
    assert.equal(problems[0].toLowerCase().includes('acme'), false);
  });
}

const ACCEPTED_SHAPES = [
  // The positive half. Without it the predicate can narrow to admit only what
  // SYNTHETIC happens to use - which is letters, a space and a hyphen, and no
  // digit at all - and nothing notices.
  ['a digit', 'acme2health', 'acme2health'],
  ['a space', 'acme health', 'acme health'],
  ['a hyphen', 'acme-health', 'acme-health'],
  ['a leading hyphen', '-acmehealth', '-acmehealth'],
  ['a trailing hyphen', 'acmehealth-', 'acmehealth-'],
  ['upper case', 'AcmeHealth', 'acmehealth'],
];

for (const [construct, source, entry] of ACCEPTED_SHAPES) {
  test(`the shape accepts ${construct}`, () => {
    assert.deepEqual(
      selfTest({
        pattern: compilePattern(source),
        blockCorpus: [entry],
        passCorpus,
        minCorpus: 1,
      }),
      []
    );
  });
}

test('a corpus with more entries than alternatives is fine', () => {
  // The arity check reads "at LEAST one entry per alternative", and nothing
  // pinned the "at least". Every other fixture has the corpus exactly equal to
  // the alternative count or exactly short of it, so `<` and `!==` are the same
  // check on all of them - and `!==` would go red on a corpus that carries two
  // spellings of one term, with a message saying an alternative is unchecked
  // when the opposite is true.
  assert.deepEqual(
    selfTest({
      pattern,
      blockCorpus: ['acmehealth', 'acme health', 'acme-health', 'the acmehealth product'],
      passCorpus,
      minCorpus: 1,
    }),
    []
  );
});

test('a pattern outside the accepted shape is refused, and says why without quoting it', () => {
  // Fails CLOSED. Counting alternatives by splitting on `|` is exact for a plain
  // alternation and wrong for a group, an escaped pipe or a class containing
  // one - and the same alphabet is what lets one value serve both this
  // `new RegExp(source, 'i')` and the machine-local hook's POSIX `grep -inE`.
  // So the shape carries two jobs and a pattern outside it makes neither sound.
  const problems = selfTest({
    pattern: compilePattern('(acmehealth|acme health)'),
    blockCorpus: ['acmehealth', 'acme health'],
    passCorpus,
    minCorpus: 1,
  });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /plain alternation of literal words/);
  // Never quote the pattern, the same rule the failed-compile path follows.
  assert.equal(problems[0].toLowerCase().includes('acme'), false);
});

// ---------------------------------------------------------------------------
// Erroring is not finding
// ---------------------------------------------------------------------------

for (const [name, env] of [
  ['absent', {}],
  ['empty', { FORBIDDEN_TERMS_PATTERN_B64: '' }],
  ['whitespace', { FORBIDDEN_TERMS_PATTERN_B64: '   ' }],
  ['decoding to nothing', { FORBIDDEN_TERMS_PATTERN_B64: b64('   ') }],
]) {
  test(`a pattern that is ${name} exits 2, not 0`, () => {
    // An empty pattern is not a no-op: one formulation matches every line and
    // another matches none. The second is a silently green pull request on
    // exactly the contributions that most need checking.
    const result = run(['scan', '--dir', surfaceDir()], {
      FORBIDDEN_TERMS_PATTERN_B64: undefined,
      ...env,
    });
    assert.equal(result.code, 2);
    assert.match(result.stderr, /unset or empty|decoded to nothing/);
  });
}

test('a directory that does not exist exits 2 and names the DIRECTORY', () => {
  // Treating an unreadable surface as empty is how a guard reports clean about
  // something it never looked at.
  const result = run(['scan', '--dir', '/nonexistent/surfaces'], {
    FORBIDDEN_TERMS_PATTERN_B64: b64(SYNTHETIC),
  });
  assert.equal(result.code, 2);
  assert.match(result.stderr, /Cannot read the surface directory/);
  // The absence is the point. This used to report `Cannot read the 'diff'
  // surface` - the first name the loop happened to touch - which sends whoever
  // reads it looking for a file when the whole directory is missing. Asserting
  // only the new message would stay green if the old one came back alongside
  // it.
  assert.doesNotMatch(result.stderr, /Cannot read the '\w+' surface/u);
});

test('a surface that is a SYMLINK exits 2 rather than being followed', () => {
  // `readFileSync` follows links, so without the `lstat` check this run reads
  // the link's target, finds nothing in it, and exits 0 with
  // "clean - 6 surfaces read". The target here is deliberately clean and the
  // real surface deliberately is not: a guard that reports clean about a file
  // nobody collected is the exact failure this script exists to remove, and it
  // arrives through the filesystem rather than through an argument.
  const dir = surfaceDir({ body: 'acmehealth is named here' });
  const elsewhere = path.join(mkdtempSync(path.join(os.tmpdir(), 'ft-target-')), 'clean.txt');
  writeFileSync(elsewhere, 'nothing named in this file\n');
  rmSync(path.join(dir, 'body'));
  symlinkSync(elsewhere, path.join(dir, 'body'));

  const result = run(['scan', '--dir', dir], { FORBIDDEN_TERMS_PATTERN_B64: b64(SYNTHETIC) });

  assert.equal(result.code, 2);
  assert.match(result.stderr, /The 'body' surface is not a regular file/);
  // Not 0 AND not 1: following the link is exit 0 here, so asserting "not
  // clean" alone would also pass on a run that found the term through some
  // other path. This pins that the LINK was refused.
  assert.doesNotMatch(result.stdout, /clean/);
});

test('invoked through a SYMLINK the CLI still runs', () => {
  // Node resolves the ESM main entry to its realpath while `process.argv[1]`
  // keeps the path as typed, so an entry-point guard comparing them with
  // `path.resolve` is FALSE through a link: `main` never runs and the process
  // exits 0 having done nothing.
  //
  // Exit 0 is the failure here, which is why the assertion is on a case that
  // must be NON-zero. A clean scan would also exit 0 and could not separate the
  // two. `scan` with no `--dir` is exit 2 when the CLI runs at all, and silence
  // with status 0 when it does not - and status 0 is what the workflow's
  // `scanned` receipt used to read as evidence of a scan.
  const link = path.join(mkdtempSync(path.join(os.tmpdir(), 'ft-link-')), 'forbidden-terms.mjs');
  symlinkSync(SCRIPT, link);

  let code = 0;
  let stderr = '';
  try {
    execFileSync(process.execPath, [link, 'scan'], {
      encoding: 'utf8',
      env: { ...process.env, FORBIDDEN_TERMS_PATTERN_B64: b64(SYNTHETIC) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    code = error.status;
    stderr = error.stderr ?? '';
  }

  assert.equal(code, 2, 'the CLI did not run at all through the link: it exited 0 in silence');
  assert.match(stderr, /--dir/u);
});

test('invoked through a symlinked PARENT DIRECTORY the CLI still runs', () => {
  // The script does not have to be the link. `path.resolve` never touches the
  // filesystem, so a REAL script reached through a linked parent fails the same
  // comparison - with nothing linked inside the repository and nothing in the
  // diff to notice. This one is separating rather than additional: a guard that
  // resolves only the script's own last component passes the case above and
  // still no-ops here.
  //
  // There is a live instance of this layout on every machine here, which is how
  // it was found: `$TMPDIR` sits behind `/var -> /private/var` on macOS, so a
  // rig placed there reproduces the bug with nothing linked at all.
  const linkedParent = path.join(mkdtempSync(path.join(os.tmpdir(), 'ft-dir-')), 'ci');
  symlinkSync(path.dirname(SCRIPT), linkedParent);
  const viaParent = path.join(linkedParent, path.basename(SCRIPT));
  assert.equal(
    lstatSync(viaParent).isSymbolicLink(),
    false,
    'this case is meant to reach a REAL file through a linked parent; the file itself is a link, ' +
      'so it cannot separate an ancestor-aware guard from a last-component one'
  );

  let code = 0;
  let stderr = '';
  try {
    execFileSync(process.execPath, [viaParent, 'scan'], {
      encoding: 'utf8',
      env: { ...process.env, FORBIDDEN_TERMS_PATTERN_B64: b64(SYNTHETIC) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    code = error.status;
    stderr = error.stderr ?? '';
  }

  assert.equal(code, 2, 'the CLI did not run through the linked parent: it exited 0 in silence');
  assert.match(stderr, /--dir/u);
});

test('scan without --dir exits 2', () => {
  const result = run(['scan'], { FORBIDDEN_TERMS_PATTERN_B64: b64(SYNTHETIC) });
  assert.equal(result.code, 2);
  assert.match(result.stderr, /--dir/);
});

test('selftest without --min-corpus exits 2', () => {
  // The number is the only thing standing between a truncated secret and a
  // green run, so it is required rather than defaulted.
  const result = run(['selftest'], {
    FORBIDDEN_TERMS_PATTERN_B64: b64(SYNTHETIC),
    FORBIDDEN_TERMS_CORPUS_B64: b64('acmehealth'),
  });
  assert.equal(result.code, 2);
  assert.match(result.stderr, /--min-corpus/);
});

test("this repository's own prose passes every surface", () => {
  const prose = readFileSync(PROSE, 'utf8');
  const dir = surfaceDir({ body: prose, messages: prose, title: prose });
  const result = run(['scan', '--dir', dir], { FORBIDDEN_TERMS_PATTERN_B64: b64(SYNTHETIC) });
  assert.equal(result.code, 0);
  assert.match(result.stdout, /clean/);
});

// ---------------------------------------------------------------------------
// The trigger, and the guard coming from the reviewed tree
// ---------------------------------------------------------------------------

test('the job is unprivileged and runs nothing the head can choose', () => {
  // The workflow header argues that this job runs no install, no build, no
  // head-provided script and no action pinned by the head. That argument IS the
  // control, and until this case existed it was a paragraph: the next person
  // adding a step reads it, agrees, and is still the only thing enforcing it.
  //
  // An exemption is the cheapest place to put an unchecked claim, because the
  // claim is the reason you are allowed to skip the check. Half of this one is
  // a fact a machine can settle, so it is settled here - with no dependency,
  // because the job's own test step deliberately runs before any install.
  const workflow = readFileSync(WORKFLOW, 'utf8');

  // Comments stripped first, so the header may keep DISCUSSING `set -x` without
  // this check firing on the very sentence explaining why not to write it. A
  // guard that scans a file for a token will find the prose about the token,
  // which is a hazard specific to a codebase that writes its reasoning down.
  const body = workflow
    .split('\n')
    .filter((line) => !/^\s*#/u.test(line))
    .join('\n');

  // The canary. A moved or renamed workflow throws on read, which is loud; this
  // catches the quiet one - a body that is no longer this trigger, leaving every
  // assertion below true of something else.
  assert.match(
    body,
    /^\s*pull_request:$/mu,
    'the job body does not declare pull_request: this test is reading the wrong thing'
  );
  // The regression this whole change exists to prevent. `pull_request_target`
  // runs in the base context WITH secrets on a fork, which is why it was here -
  // and why CodeQL called it `actions/untrusted-checkout/high`. Reinstating it
  // hands a fork the pattern the moment any step touches head-provided code,
  // and the assertion above cannot see it: `pull_request_target:` does not match
  // `pull_request:$`, so without this line a revert is silently green.
  assert.doesNotMatch(
    body,
    /^\s*pull_request_target:/mu,
    'the job is back on pull_request_target: the secret is reachable from a fork again'
  );

  const uses = [...body.matchAll(/^\s*uses:\s*(\S+)/gmu)].map((match) => match[1]);
  assert.deepEqual(
    uses,
    [PINNED_CHECKOUT],
    `this job may run one action and only ${PINNED_CHECKOUT}: anything else, or the same ` +
      'action unpinned, is code this workflow does not control running beside the secret'
  );

  for (const [token, cost] of VOIDS_THE_ACCEPTANCE) {
    assert.ok(
      !body.includes(token),
      `the job runs \`${token}\`, which voids the acceptance for running beside the secret: ${cost}`
    );
  }

  // INVERTED by the move off `pull_request_target`, and the inversion is the
  // point. That trigger checks out the base by default, so a bare checkout was
  // correct and a `ref:` was the hazard. `pull_request` checks out the MERGE
  // ref by default - the head's version of this guard and of this very test -
  // so here the bare checkout is the hazard and the pin is the control.
  assert.match(
    body,
    /^\s*ref:\s*\$\{\{\s*github\.event\.pull_request\.base\.sha\b/mu,
    'the checkout is not pinned to the base commit: the guard would come from the tree ' +
      'it is meant to be checking, and a pull request could pass itself'
  );
  assert.match(
    body,
    /^\s*persist-credentials:\s*false$/mu,
    'the checkout leaves a credential in the tree for later steps to reach'
  );
});

test('every diff the job collects passes a filter that includes type changes', () => {
  // The symlink case above proves what `T` buys, against real git - but it
  // hardcodes the filter, so reverting the workflow to `ACMR` leaves it green.
  // That is the same shape as a guard that enumerates only the doors it already
  // knows about: the behaviour is pinned and the USE of it is not.
  //
  // So this reads the filter the job actually passes. Keyed on `--diff-filter=`
  // rather than on the exact string, because the set may legitimately grow -
  // what may not happen is `T` leaving it.
  const workflow = readFileSync(WORKFLOW, 'utf8');
  const body = workflow
    .split('\n')
    .filter((line) => !/^\s*#/u.test(line))
    .join('\n');

  const filters = [...body.matchAll(/--diff-filter=([A-Za-z]+)/gu)].map((match) => match[1]);

  // Zero rather than a threshold, and it is the canary that matters most here:
  // a rename of the step, a move to a script, or a filter dropped entirely all
  // land as an empty list, and an empty list satisfies a `for` loop silently.
  assert.notEqual(
    filters.length,
    0,
    'no --diff-filter found in the job: this test is reading nothing, and a diff with no filter ' +
      'at all is a different defect than the one below'
  );

  for (const filter of filters) {
    assert.ok(
      filter.includes('T'),
      `--diff-filter=${filter} omits T: a file replaced by a symlink is a type change, so its ` +
        'path never reaches `names` and its target never reaches `diff`, and the run is green ' +
        'having looked at neither'
    );
  }
});

test('the step that refuses a run which scanned nothing is not itself skippable', () => {
  // `No `if:`, deliberately` is the enforcement, and it is a paragraph three
  // lines above the fact it asserts. Adding that one line is the likeliest edit
  // in the file rather than a contrived one: every other step concerning the
  // pull request carries exactly that `if:`, the refusal is the single step
  // without one, and adding it makes the job MORE internally consistent. The
  // job then checks out, arms, self-tests, skips all three scan steps, skips
  // the refusal, and reports clean having read nothing.
  //
  // Keyed on the marker rather than on the step's name: the name is prose and
  // can be reworded, the marker is the mechanism.
  const workflow = readFileSync(WORKFLOW, 'utf8');
  const body = workflow
    .split('\n')
    .filter((line) => !/^\s*#/u.test(line))
    .join('\n');

  const steps = body.split(/^ {6}- name: /mu).slice(1);

  // Zero rather than a threshold. Any count above zero also fires when the
  // split read FEWER steps than expected, which is a different defect with a
  // better message below, so it would steal the failure from the assertion
  // that names the cause.
  assert.notEqual(steps.length, 0, 'no steps parsed out of the job: this test is reading nothing');

  // The same defect one scope out, and the one this file could not previously
  // see. Everything below reasons about STEPS; a job-level `if:` skips all of
  // them at once, and a SKIPPED job SATISFIES a required status check - only a
  // context that never reports blocks. So the check goes green having run
  // nothing, which is strictly worse than the step-level version below because
  // there is not even a red step to notice.
  //
  // It is also the likeliest edit for a good reason rather than a contrived
  // one: this gate is red on every fork pull request by design, and
  // `if: github.event.pull_request.head.repo.fork == false` is what somebody
  // reaches for to make that stop. It will look like tidying up.
  //
  // Job keys sit at four spaces here; a step's own `if:` is at eight, so this
  // cannot fire on the three that legitimately carry one.
  assert.doesNotMatch(
    body,
    /^ {4}if:/mu,
    'the job carries a job-level `if:`: a skipped job satisfies a required check, so the ' +
      'gate would report green having scanned nothing'
  );

  const MARKER = '"${RUNNER_TEMP}/scanned"';
  const writes = steps.filter((step) => step.includes(`touch ${MARKER}`));
  const reads = steps.filter((step) => step.includes(`-f ${MARKER}`));

  assert.equal(
    writes.length,
    1,
    'exactly one step may write the scanned marker: a second one records a scan that did not happen'
  );
  assert.equal(
    reads.length,
    1,
    'exactly one step must read the scanned marker: with none, a run that scanned nothing reports clean'
  );
  assert.doesNotMatch(
    reads[0],
    /^\s*if:/mu,
    'the step refusing a run that scanned nothing is itself conditional, so the run it exists ' +
      'to catch skips it too and the job reports clean having read no surface'
  );
  // `if:` is not the only line that unmakes this step. `continue-on-error: true`
  // leaves it running, leaves it red in the log, and concludes the JOB as
  // success - so the refusal still reports "nothing was scanned" and the check
  // beside it is green anyway. Both edits end in a clean report over an unread
  // pull request; only the first one is visible in the step's condition.
  assert.doesNotMatch(
    reads[0],
    /^\s*continue-on-error:/mu,
    'the step refusing a run that scanned nothing cannot fail the job, so its refusal is ' +
      'printed into a log nothing reads and the check reports clean regardless'
  );

  // The reader being unconditional and the writer being the step that actually
  // scans are two halves of one property, and only the first half was asserted.
  // Move the `touch` into the unconditional self-test step and every assertion
  // above still holds - one writer, one reader, reader carries no `if:` - while a
  // `workflow_dispatch` run records a scan it never ran and the refusal passes.
  //
  // Keyed on the scan command rather than on the step's `if:`, for the same reason
  // the marker was preferred to the step name: the trigger expression is one
  // rewording away, the scan invocation is the mechanism.
  // Not `mjs scan` adjacently: reordering the subcommand after the flag is a
  // legal, behaviour-preserving edit of the same command, and rejecting it
  // would be a false red on a correct workflow - the failure mode that gets a
  // check deleted rather than the one that lets a defect through. `\bscan\b`
  // does not match the marker path `.../scanned`, which is the only other
  // occurrence in any step.
  const invocation = /forbidden-terms\.mjs\b[\s\S]*?\bscan\b/u.exec(writes[0]);
  assert.ok(
    invocation,
    'the scanned marker is written by a step that does not run the scan, so it records that ' +
      'a run reached that line rather than that a scan succeeded, and the refusal below passes'
  );

  // The comment beside the `touch` makes two claims and the assertion above
  // pins only the first. `Written only after a clean exit, so it records a scan
  // rather than an attempt` is the second, and it is the ORDER of two lines in
  // one step - the cheapest thing in this file to change by accident.
  //
  // Neither half is a defect alone. `touch` above the scan is still red today,
  // because a failing scan fails the step and the refusal never gets to decide;
  // `continue-on-error: true` on the scan step is still red today, because
  // `set -e` skips the `touch` and the refusal turns the job red on the missing
  // marker. Together they are fail-open: the marker is already written, the
  // failure is swallowed, and the job reports CLEAN on a run that found a term.
  // The order is the half that is free to move, which is why it must not be the
  // unchecked one.
  assert.ok(
    invocation.index < writes[0].indexOf(`touch ${MARKER}`),
    'the scanned marker is written before the scan runs, so it records an attempt rather than ' +
      'a clean exit and any later edit that stops a failed scan failing the step reports clean'
  );

  // A CLEAN EXIT IS NOT A SCAN, and the two assertions above cannot tell them
  // apart: both are satisfied by `node ...; touch marker`, which records that a
  // process reached that line. A `node` invocation that never reaches `main`
  // exits 0 having read nothing, `set -e` sees success, and the refusal below
  // finds the marker and passes. So the receipt must key on something only a
  // real scan produces.
  //
  // Paired deliberately with the run below. Asserting only that the workflow
  // mentions the sentence pins the workflow against a string the script might
  // not print - which fails closed rather than open, but is still a gate nobody
  // can pass. Asserting only that the script prints it pins nothing about the
  // receipt. Together they say: the thing the workflow waits for is the thing
  // the script emits.
  const CLEAN_SENTENCE = 'surfaces read';
  assert.ok(
    writes[0].includes(CLEAN_SENTENCE),
    'the scanned marker is written without checking what the scan REPORTED, so a run that ' +
      'exited 0 without reading a surface records a scan and the refusal below passes'
  );
  const clean = run(['scan', '--dir', surfaceDir()], {
    FORBIDDEN_TERMS_PATTERN_B64: b64(SYNTHETIC),
  });
  assert.equal(clean.code, 0);
  assert.ok(
    clean.stdout.includes(CLEAN_SENTENCE),
    'the script no longer prints the sentence the workflow gates its receipt on, so every ' +
      'clean run now exits 2 on a scan that actually happened'
  );
});

// ---------------------------------------------------------------------------
// The must-pass corpus is what it claims to be
// ---------------------------------------------------------------------------

test('every must-pass line is real prose from a tracked file', () => {
  // The corpus is only evidence if it is the repository's own writing. Invented
  // near-misses drift towards what the author imagines the pattern does, and a
  // corpus of those proves nothing about the documentation a false positive
  // would actually fire on.
  const lines = corpusLines(readFileSync(PROSE, 'utf8'));
  assert.ok(lines.length >= 20, `expected a corpus worth having, got ${lines.length} lines`);

  // The exclusion has to exclude THIS file, and two ways it stops doing so are
  // both silent: a pathspec naming a path nothing tracks is a no-op to git, and
  // one naming a different tracked file excludes the wrong thing. Either way
  // every corpus line proves its own presence again, and a rail that excludes
  // nothing looks exactly like one with nothing to exclude.
  //
  // Asserted off PROSE_PATHSPEC itself rather than off PROSE, because the value
  // that can be wrong is the one the search will use. A property of the correct
  // value says nothing about the value actually being evaluated.
  const excludedPath = PROSE_PATHSPEC.replace(/^:\(exclude\)/u, '');
  assert.equal(
    excludedPath,
    path.relative(ROOT, PROSE),
    'the corpus exclusion names some other file, so the corpus is still searching itself'
  );
  assert.notEqual(
    execFileSync('git', ['ls-files', '--', excludedPath], { cwd: ROOT, encoding: 'utf8' }).trim(),
    '',
    `${PROSE_PATHSPEC} names a path git does not track: the exclusion is a no-op`
  );

  const missing = lines.filter((line) => {
    try {
      // EXCLUDING the corpus itself. Without the pathspec this file is a tracked
      // file, so every line in it proves its own presence and an invented
      // sentence passes - the assertion satisfied by the very document it is
      // meant to be checking. Found by mutation: appending a sentence that
      // appears nowhere else left all 26 cases green.
      execFileSync('git', ['grep', '-qF', '--', line, PROSE_PATHSPEC], {
        cwd: ROOT,
        stdio: 'ignore',
      });
      return false;
    } catch {
      return true;
    }
  });
  assert.deepEqual(missing, [], 'these corpus lines appear in no tracked file');
});
