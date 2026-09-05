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
import { mkdtempSync, writeFileSync } from 'node:fs';
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
} from './forbidden-terms.mjs';

const SCRIPT = path.join(import.meta.dirname, 'forbidden-terms.mjs');
const PROSE = path.join(import.meta.dirname, 'forbidden-terms-allowed-prose.txt');

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
    ['diff', '--unified=0', '--diff-filter=ACMR', 'HEAD~1', 'HEAD'],
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
// The self-test
// ---------------------------------------------------------------------------

const passCorpus = ['open an issue', 'open standards', 'the door opens'];

test('a healthy pattern and corpus produce no problems', () => {
  assert.deepEqual(
    selfTest({ pattern, blockCorpus: ['acmehealth', 'acme health'], passCorpus, minCorpus: 2 }),
    []
  );
});

test('a known positive the pattern misses is a problem, reported by position', () => {
  const problems = selfTest({
    pattern,
    blockCorpus: ['acmehealth', 'acme  health'],
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
  const problems = selfTest({ pattern, blockCorpus: ['acmehealth'], passCorpus, minCorpus: 2 });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /1 entries, fewer than the 2/);
});

test('a pattern that matches this repository own prose is a problem', () => {
  const broad = compilePattern('open[ -]?[a-z]+');
  const problems = selfTest({
    pattern: broad,
    blockCorpus: ['open acme'],
    passCorpus,
    minCorpus: 1,
  });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /line\(s\) 1, 2, 3/);
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

test('a directory that does not exist exits 2, not 0', () => {
  // Treating an unreadable surface as empty is how a guard reports clean about
  // something it never looked at.
  const result = run(['scan', '--dir', '/nonexistent/surfaces'], {
    FORBIDDEN_TERMS_PATTERN_B64: b64(SYNTHETIC),
  });
  assert.equal(result.code, 2);
  assert.match(result.stderr, /Cannot read the 'diff' surface/);
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
  const prose = execFileSync('cat', [PROSE], { encoding: 'utf8' });
  const dir = surfaceDir({ body: prose, messages: prose, title: prose });
  const result = run(['scan', '--dir', dir], { FORBIDDEN_TERMS_PATTERN_B64: b64(SYNTHETIC) });
  assert.equal(result.code, 0);
  assert.match(result.stdout, /clean/);
});

// ---------------------------------------------------------------------------
// The must-pass corpus is what it claims to be
// ---------------------------------------------------------------------------

test('every must-pass line is real prose from a tracked file', () => {
  // The corpus is only evidence if it is the repository's own writing. Invented
  // near-misses drift towards what the author imagines the pattern does, and a
  // corpus of those proves nothing about the documentation a false positive
  // would actually fire on.
  const lines = corpusLines(execFileSync('cat', [PROSE], { encoding: 'utf8' }));
  assert.ok(lines.length >= 20, `expected a corpus worth having, got ${lines.length} lines`);

  const missing = lines.filter((line) => {
    try {
      // EXCLUDING the corpus itself. Without the pathspec this file is a tracked
      // file, so every line in it proves its own presence and an invented
      // sentence passes - the assertion satisfied by the very document it is
      // meant to be checking. Found by mutation: appending a sentence that
      // appears nowhere else left all 26 cases green.
      execFileSync(
        'git',
        ['grep', '-qF', '--', line, ':(exclude)scripts/ci/forbidden-terms-allowed-prose.txt'],
        {
          cwd: path.join(import.meta.dirname, '..', '..'),
          stdio: 'ignore',
        }
      );
      return false;
    } catch {
      return true;
    }
  });
  assert.deepEqual(missing, [], 'these corpus lines appear in no tracked file');
});
