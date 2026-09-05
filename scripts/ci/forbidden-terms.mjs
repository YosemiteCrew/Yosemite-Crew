#!/usr/bin/env node
// Forbidden-terms gate.
//
// Both repositories are public. Prior art may be studied freely; the source may
// never be NAMED - not in code, comments, tests, fixtures, docs, commit
// messages, branch names, or pull-request text. Until this script existed the
// rule was enforced by a git hook on three laptops, and a hook is a reminder
// rather than a gate: `pnpm install` runs husky's `prepare`, which rewrites
// `core.hooksPath` for the whole clone, and the guard is disarmed until somebody
// notices. That happened seven times in one day and reached a commit once.
//
// WHAT THIS SCRIPT MUST NEVER DO
//
//   * print a match, or any substring of one
//   * print the pattern, decoded or encoded
//   * write either to a file, an output, or a job summary
//
// A guard whose failure output is the list of terms is worse than no guard: the
// run log of a public repository is a published artifact in a way a terminal is
// not. Findings therefore carry a SURFACE, a FILE and a LINE and nothing else.
// That is enough to act on, because the author knows what they wrote.
//
// WHY THE PATTERN IS AN ENVIRONMENT VARIABLE AND NOT A FILE
//
// The pattern is the term list. Committing it to a public repository publishes
// exactly what it exists to withhold, so it arrives as a base64 blob in a
// repository secret and is decoded here. The must-block corpus is a second blob
// for the same reason. The must-PASS corpus is checked in
// (forbidden-terms-allowed-prose.txt) because it names nothing.
//
// ERRORING IS NOT FINDING. Exit 2 means the guard could not run - no pattern, a
// pattern that will not compile, a corpus that came back short, a self-test that
// failed. Exit 1 means it ran and found something. Exit 0 means it ran and did
// not. A caller that treats 2 as clean has reintroduced the failure this whole
// script exists to remove.
//
// Usage:
//   node scripts/ci/forbidden-terms.mjs selftest --min-corpus <n>
//   node scripts/ci/forbidden-terms.mjs scan --dir <directory>
//
// The directory holds one file per surface, named for it: diff, names,
// messages, branch, title, body. ALL SIX are read and a missing one is exit 2 -
// the caller does not get to choose which surfaces are checked, because a
// caller that can omit one is a caller that will. `diff` expects unified diff
// text and reports the file and line of the ADDED line, which is why it is a
// surface of its own rather than another blob of text.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const PATTERN_ENV = 'FORBIDDEN_TERMS_PATTERN_B64';
const CORPUS_ENV = 'FORBIDDEN_TERMS_CORPUS_B64';

const ALLOWED_PROSE = path.join(import.meta.dirname, 'forbidden-terms-allowed-prose.txt');

const SURFACES = new Set(['diff', 'names', 'messages', 'branch', 'title', 'body']);

/** Raised for anything that means "the guard could not run" - always exit 2. */
class GuardError extends Error {}

/**
 * Decodes a base64 blob from the environment.
 *
 * An absent or empty value is an ERROR and not an empty pattern. `new
 * RegExp('')` matches every line and `grep -E ''` matches every line, while
 * some formulations match nothing: one fails every pull request and the other
 * passes every pull request silently. Both are wrong, and the silent one is the
 * failure mode this script was written to end.
 */
function decodeRequired(name) {
  const raw = process.env[name];
  if (!raw || raw.trim() === '') {
    throw new GuardError(`${name} is unset or empty. The gate cannot run without it.`);
  }
  let decoded;
  try {
    decoded = Buffer.from(raw.trim(), 'base64').toString('utf8');
  } catch {
    throw new GuardError(`${name} is not valid base64.`);
  }
  if (decoded.trim() === '') {
    throw new GuardError(`${name} decoded to nothing. A rotated or truncated secret is an error.`);
  }
  return decoded.trim();
}

/**
 * The pattern, compiled case-insensitively because the terms are words.
 *
 * Deliberately NOT global. `RegExp.prototype.test` on a `g` regex carries
 * `lastIndex` between calls, so adding `g` here would make every other entry in
 * `scanSurface`'s filter invisible - a guard that checks half its input and says
 * nothing about the half it skipped.
 */
export function compilePattern(source) {
  try {
    return new RegExp(source, 'i');
  } catch (error) {
    // The message of a failed RegExp constructor QUOTES THE PATTERN. Never let
    // it out - report that it did not compile and nothing about what it was.
    throw new GuardError(`The pattern does not compile as a regular expression: ${error.name}.`);
  }
}

/** Non-comment, non-blank lines. Shared by both corpora. */
export function corpusLines(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));
}

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

/**
 * Added lines of a unified diff, carrying the file and line they land on.
 *
 * Only added lines, because a term being REMOVED is the fix, not the offence.
 *
 * `+++ b/path` is the header rather than an addition, and it is told apart from
 * an addition BY POSITION, not by content: git writes an added line whose text
 * begins `++ ` as `+++ `, which `startsWith('+++ ')` cannot distinguish from a
 * header. The first version of this function did exactly that, and it failed in
 * both directions at once - the line carrying the term was never scanned, and
 * `file` became a line of the pull request's own diff, which the report then
 * PRINTED. A guard that publishes diff content into a public log on an unusual
 * input is worse than one that misses, because the miss is at least silent.
 *
 * Position is taken from the hunk header's own declared counts rather than from
 * `diff --git`, which needs no assumption about which optional lines git chose
 * to emit: `@@ -a,b +c,d @@` says how many lines the hunk owns, so a `+++ `
 * inside that debt is an addition and one after it is discharged is a header.
 *
 * Found in review by Claude L2, against real `git diff --unified=0` output
 * rather than a fixture - which is also why the fixtures here are approximations
 * that the naive positional fix appears to fail.
 */
export function addedLines(diff) {
  const out = [];
  let file = '';
  let lineNumber = 0;
  // How many old-side and new-side lines the current hunk still owes. Zero on
  // both means we are between hunks, which is the only place a header can be.
  let owedOld = 0;
  let owedNew = 0;

  for (const line of diff.split('\n')) {
    const hunk = /^@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (hunk) {
      // A count omitted from the header means one line, not none.
      owedOld = hunk[1] === undefined ? 1 : Number(hunk[1]);
      lineNumber = Number(hunk[2]);
      owedNew = hunk[3] === undefined ? 1 : Number(hunk[3]);
      continue;
    }

    if (owedOld <= 0 && owedNew <= 0) {
      // Between hunks: `diff --git`, `index`, `--- a/path`, `+++ b/path`.
      if (line.startsWith('+++ ')) {
        const target = line.slice(4).trim();
        file = target === '/dev/null' ? '' : target.replace(/^b\//, '');
      }
      continue;
    }

    if (line.startsWith('+')) {
      out.push({ file: file || '(unknown file)', line: lineNumber, text: line.slice(1) });
      lineNumber += 1;
      owedNew -= 1;
      continue;
    }
    // A removed line does not advance the new-file counter.
    if (line.startsWith('-')) {
      owedOld -= 1;
      continue;
    }
    // `\ No newline at end of file` belongs to neither side.
    if (line.startsWith('\\')) continue;
    // Context: it advances both sides.
    lineNumber += 1;
    if (owedNew > 0) owedNew -= 1;
    if (owedOld > 0) owedOld -= 1;
  }
  return out;
}

/** Every surface reduces to this: a list of {file, line, text} to match against. */
function entriesFor(surface, text) {
  if (surface === 'diff') return addedLines(text);
  return text
    .split('\n')
    .map((value, index) => ({ file: surface, line: index + 1, text: value }))
    .filter((entry) => entry.text.trim() !== '');
}

/**
 * Findings carry where and never what. `text` is deliberately dropped here
 * rather than at the print site: a value that is never returned cannot be
 * logged by a later edit that forgets why.
 */
export function scanSurface(pattern, surface, text) {
  return entriesFor(surface, text)
    .filter((entry) => pattern.test(entry.text))
    .map((entry) => ({ surface, file: entry.file, line: entry.line }));
}

// ---------------------------------------------------------------------------
// Self-test: the job asserts itself before it asserts anything about the diff
// ---------------------------------------------------------------------------

/**
 * Proves the guard is armed. Without this an empty, rotated or truncated secret
 * is a silently green pull request, which is failure mode six of the six this
 * gate replaces - the fix having the same defect as the thing it fixed.
 *
 * `minCorpus` is written in the workflow IN THE CLEAR. A number is not a term
 * list, and it turns "the secret lost half its entries" from silent into red.
 */
export function selfTest({ pattern, blockCorpus, passCorpus, minCorpus }) {
  const problems = [];

  if (blockCorpus.length < minCorpus) {
    problems.push(
      `the must-block corpus decoded to ${blockCorpus.length} entries, fewer than the ${minCorpus} ` +
        'this workflow expects: the secret is truncated, rotated or stale'
    );
  }

  // Known positives: every one must be caught. Reported by INDEX, never by value.
  const missed = blockCorpus
    .map((entry, index) => (pattern.test(entry) ? null : index + 1))
    .filter((index) => index !== null);
  if (missed.length > 0) {
    problems.push(
      `the pattern does not match must-block corpus entries at position(s) ${missed.join(', ')}`
    );
  }

  // Known negatives: the repository's own prose. A hit here is an over-broad
  // pattern, which is the failure that gets a gate switched off.
  const tripped = passCorpus
    .map((entry, index) => (pattern.test(entry) ? index + 1 : null))
    .filter((index) => index !== null);
  if (tripped.length > 0) {
    problems.push(
      `the pattern matches this repository's own prose at ${ALLOWED_PROSE} ` +
        `line(s) ${tripped.join(', ')}: it is too broad, and a gate that fires on ` +
        'ordinary documentation is a gate somebody switches off'
    );
  }

  return problems;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function readAllowedProse() {
  try {
    return corpusLines(readFileSync(ALLOWED_PROSE, 'utf8'));
  } catch {
    throw new GuardError(`Cannot read the must-pass corpus at ${ALLOWED_PROSE}.`);
  }
}

function runSelfTest(argv) {
  const flag = argv.indexOf('--min-corpus');
  const minCorpus = flag === -1 ? Number.NaN : Number(argv[flag + 1]);
  if (!Number.isInteger(minCorpus) || minCorpus < 1) {
    throw new GuardError(
      'selftest needs --min-corpus <n>, a positive integer written in the clear.'
    );
  }
  const pattern = compilePattern(decodeRequired(PATTERN_ENV));
  const blockCorpus = corpusLines(decodeRequired(CORPUS_ENV));
  const passCorpus = readAllowedProse();

  const problems = selfTest({ pattern, blockCorpus, passCorpus, minCorpus });
  if (problems.length > 0) {
    for (const problem of problems) process.stderr.write(`forbidden-terms: ${problem}\n`);
    throw new GuardError(
      'The guard failed its own self-test and has reported nothing about this pull request.'
    );
  }
  process.stdout.write(
    `forbidden-terms: armed - pattern compiled, ${blockCorpus.length} known positives all matched, ` +
      `${passCorpus.length} lines of this repository's own prose all clean.\n`
  );
  return 0;
}

/**
 * Reads a DIRECTORY and scans every surface in SURFACES, by fixed name.
 *
 * It took a list of `<surface>=<file>` pairs first, and that was the same
 * defect as the ones this repository spent the day finding: the caller decided
 * what got checked, nothing asserted the caller passed them all, and dropping
 * `body=` from the workflow left the scan reporting
 * "clean - no named external product on any checked surface" while the pull
 * request body carried one. The word "checked" was doing silent work.
 *
 * A directory of fixed names cannot be short-passed. There is no argument to
 * omit, so the coverage is a property of this file rather than of the workflow
 * that calls it - and a surface the collector failed to write is an unreadable
 * file, which is already exit 2.
 */
function runScan(argv) {
  const flag = argv.indexOf('--dir');
  const dir = flag === -1 ? '' : (argv[flag + 1] ?? '');
  if (dir === '') {
    throw new GuardError('scan needs --dir <directory> holding one file per surface.');
  }
  const pattern = compilePattern(decodeRequired(PATTERN_ENV));

  const findings = [];
  for (const surface of SURFACES) {
    const file = path.join(dir, surface);
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      // A surface that cannot be read is an error. Treating it as empty is how
      // a guard reports "clean" about something it never looked at.
      throw new GuardError(`Cannot read the '${surface}' surface from ${file}.`);
    }
    findings.push(...scanSurface(pattern, surface, text));
  }

  if (findings.length === 0) {
    process.stdout.write(
      `forbidden-terms: clean - ${SURFACES.size} surfaces read, no named external product on any of them.\n`
    );
    return 0;
  }

  process.stderr.write(
    `forbidden-terms: BLOCKED - a named external product appears on ${findings.length} line(s).\n\n`
  );
  for (const finding of findings) {
    // Only the diff surface has a file of its own; for the others the "file" IS
    // the surface, and `[names] names:1` reads worse than `[names] entry 1`.
    const where =
      finding.file === finding.surface
        ? `entry ${finding.line}`
        : `${finding.file}:${finding.line}`;
    process.stderr.write(`  [${finding.surface}] ${where}\n`);
  }
  process.stderr.write(
    '\nThese repositories are public. Draw on prior art freely; never name the source in code,\n' +
      'comments, tests, fixtures, docs, commit messages, branch names or pull-request text.\n' +
      'Describe the behaviour and the clinical need instead.\n\n' +
      'The match itself is deliberately not printed: this log is public.\n'
  );
  return 1;
}

function main(argv) {
  const [command, ...rest] = argv;
  try {
    if (command === 'selftest') return runSelfTest(rest);
    if (command === 'scan') return runScan(rest);
    process.stderr.write(
      'Usage: forbidden-terms.mjs selftest --min-corpus <n> | scan --dir <directory>\n'
    );
    return 2;
  } catch (error) {
    if (error instanceof GuardError) {
      process.stderr.write(`forbidden-terms: ${error.message}\n`);
      return 2;
    }
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  process.exit(main(process.argv.slice(2)));
}
