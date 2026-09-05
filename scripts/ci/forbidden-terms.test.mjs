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
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
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
  const prose = readFileSync(PROSE, 'utf8');
  const dir = surfaceDir({ body: prose, messages: prose, title: prose });
  const result = run(['scan', '--dir', dir], { FORBIDDEN_TERMS_PATTERN_B64: b64(SYNTHETIC) });
  assert.equal(result.code, 0);
  assert.match(result.stdout, /clean/);
});

// ---------------------------------------------------------------------------
// The pull_request_target acceptance
// ---------------------------------------------------------------------------

test('the pull_request_target job runs nothing the head can choose', () => {
  // The workflow header argues that this trigger is safe because the job runs
  // no install, no build, no head-provided script and no action pinned by the
  // head. That argument IS the control, and until this case existed it was a
  // paragraph: the next person adding a step reads it, agrees, and is still the
  // only thing enforcing it.
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
    /^\s*pull_request_target:$/mu,
    'the job body does not declare pull_request_target: this test is reading the wrong thing'
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
      `the job runs \`${token}\`, which voids the pull_request_target acceptance: ${cost}`
    );
  }

  assert.doesNotMatch(
    body,
    /^\s*ref:/mu,
    'the checkout takes a ref: the guard would come from the tree it is meant to be checking'
  );
  assert.match(
    body,
    /^\s*persist-credentials:\s*false$/mu,
    'the checkout leaves a credential in the tree for later steps to reach'
  );
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
