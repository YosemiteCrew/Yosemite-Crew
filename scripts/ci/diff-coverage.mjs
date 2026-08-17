#!/usr/bin/env node
// Gate the coverage of the lines a pull request actually adds or changes.
//
// Usage:
//   node scripts/ci/diff-coverage.mjs --coverage <coverage-final.json> \
//                                     --diff <unified diff> --floor <pct> [--app-dir <dir>]
//
//   --coverage  merged istanbul coverage map (merge-coverage.mjs --out writes one)
//   --diff      unified diff produced with --unified=0, or '-' to read stdin
//   --floor     minimum share of added executable lines that must be covered
//   --app-dir   restrict the gate to files under this directory
//
// Why this exists alongside the aggregate floor in merge-coverage.mjs: the
// aggregate is a whole-repository number, so a new file lands as a rounding
// error against tens of thousands of already-covered lines. frontend measures
// ~98% against a floor of 80, which leaves eighteen points of slack for
// uncovered code to accumulate in before anything fails; backend and mobile
// carry `lines=1`, which is a tripwire rather than a floor. Neither arrangement
// can answer "is the code this PR adds tested", and that is the only coverage
// question a reviewer needs answered.
//
// The gate is on ADDED LINES, not on changed files. Gating whole files would
// mean that touching one line of a legacy file makes covering the entire file
// this PR's problem, which is how coverage gates get switched off. Only lines
// the diff introduces are counted, so the cost of the gate always matches the
// size of the change.
//
// Lines that are not executable (blank lines, comments, type declarations) never
// appear in the coverage map's statementMap and are excluded from both sides of
// the ratio, so a documentation-heavy diff is not punished for it.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function fail(message) {
  console.error(`diff-coverage: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { coverage: '', diff: '', floor: '', 'app-dir': '' };
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (!['--coverage', '--diff', '--floor', '--app-dir'].includes(flag))
      fail(`unknown argument '${flag}'`);
    if (value === undefined) fail(`${flag} requires a value`);
    args[flag.slice(2)] = value;
  }
  if (!args.coverage || !args.diff || !args.floor)
    fail('usage: --coverage <json> --diff <diff|-> --floor <pct> [--app-dir <dir>]');
  const floor = Number(args.floor);
  if (Number.isNaN(floor) || floor < 0 || floor > 100) fail(`bad floor value '${args.floor}'`);
  return { ...args, floor };
}

// Added lines per file, from a diff generated with --unified=0.
//
// The `+++ b/<path>` header names the post-image path, which is the one the
// coverage map is keyed by and the one that survives a rename. Hunk headers
// carry the post-image start line, so counting '+' lines from there gives exact
// line numbers without re-reading the file.
export function parseDiff(text) {
  const added = new Map();
  let file = null;
  let line = 0;

  for (const raw of text.split('\n')) {
    if (raw.startsWith('+++ ')) {
      const target = raw.slice(4).trim().replace(/\t.*$/, '');
      // A deletion has no post-image; skip until the next file's header.
      file = target === '/dev/null' ? null : target.replace(/^b\//, '');
      continue;
    }
    if (raw.startsWith('--- ')) continue;

    if (raw.startsWith('@@')) {
      // @@ -12,3 +14,5 @@ optional section heading
      const match = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(raw);
      if (!match) fail(`cannot parse hunk header: ${raw}`);
      line = Number(match[1]);
      continue;
    }

    if (file === null) continue;

    if (raw.startsWith('+')) {
      if (!added.has(file)) added.set(file, new Set());
      added.get(file).add(line);
      line += 1;
    }
    // With --unified=0 there are no context lines, and '-' lines do not advance
    // the post-image counter. Anything else is diff furniture ("\ No newline at
    // end of file", "diff --git", index lines) and is ignored.
  }

  return added;
}

// line number -> times executed, for every executable line in one file's entry.
//
// A line is counted once even when several statements start on it, and it counts
// as covered when any of them ran, which is how lcov's DA records are derived.
export function lineHits(entry) {
  const hits = new Map();
  const statements = entry?.statementMap ?? {};
  for (const [id, location] of Object.entries(statements)) {
    const lineNumber = location?.start?.line;
    if (typeof lineNumber !== 'number') continue;
    const count = entry.s?.[id] ?? 0;
    hits.set(lineNumber, Math.max(hits.get(lineNumber) ?? 0, count));
  }
  return hits;
}

// Coverage maps are keyed by the absolute path of the machine that produced
// them; diffs are always repository-relative. Normalise the map onto the diff's
// vocabulary, keeping a suffix index so a report generated under a different
// workspace root still matches.
export function indexCoverage(coverage, cwd) {
  const byPath = new Map();
  const prefix = `${cwd.replace(/\/$/, '')}/`;
  for (const [key, entry] of Object.entries(coverage)) {
    const normalised = key.startsWith(prefix) ? key.slice(prefix.length) : key;
    byPath.set(normalised, entry);
  }
  return {
    get(file) {
      const direct = byPath.get(file);
      if (direct) return direct;
      for (const [key, entry] of byPath) {
        if (key.endsWith(`/${file}`)) return entry;
      }
      return undefined;
    },
  };
}

export function evaluate({ added, coverage, appDir, cwd = process.cwd() }) {
  const index = indexCoverage(coverage, cwd);
  const scope = appDir ? `${appDir.replace(/\/$/, '')}/` : '';

  const measured = [];
  const unmeasured = [];
  let total = 0;
  let covered = 0;

  for (const [file, lines] of [...added].sort(([a], [b]) => a.localeCompare(b))) {
    if (scope && !file.startsWith(scope)) continue;

    const entry = index.get(file);
    // Not in the coverage map means the file is outside collectCoverageFrom -
    // a test file, a type declaration, an explicitly excluded path. There is
    // nothing to measure, so it is reported but never gated.
    if (!entry) {
      unmeasured.push(file);
      continue;
    }

    const hits = lineHits(entry);
    const executable = [...lines].filter((line) => hits.has(line)).sort((a, b) => a - b);
    if (executable.length === 0) continue;

    const uncovered = executable.filter((line) => (hits.get(line) ?? 0) === 0);
    total += executable.length;
    covered += executable.length - uncovered.length;
    measured.push({ file, executable: executable.length, uncovered });
  }

  return { measured, unmeasured, total, covered };
}

// Ranges read far better than eighty comma-separated line numbers when the
// failure lands in a reviewer's log.
function formatLines(lines) {
  const ranges = [];
  for (const line of lines) {
    const last = ranges[ranges.length - 1];
    if (last && line === last[1] + 1) last[1] = line;
    else ranges.push([line, line]);
  }
  return ranges.map(([from, to]) => (from === to ? `${from}` : `${from}-${to}`)).join(', ');
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  let diffText;
  try {
    diffText = readFileSync(args.diff === '-' ? 0 : args.diff, 'utf8');
  } catch (error) {
    fail(`cannot read diff '${args.diff}': ${error.message}`);
  }

  let coverage;
  try {
    coverage = JSON.parse(readFileSync(args.coverage, 'utf8'));
  } catch (error) {
    fail(`cannot read coverage '${args.coverage}': ${error.message}`);
  }
  if (!coverage || typeof coverage !== 'object' || Object.keys(coverage).length === 0)
    fail(`coverage map '${args.coverage}' contains no files`);

  const result = evaluate({
    added: parseDiff(diffText),
    coverage,
    appDir: args['app-dir'],
    cwd: process.cwd(),
  });

  for (const { file, executable, uncovered } of result.measured) {
    const status = uncovered.length === 0 ? 'ok  ' : 'MISS';
    const detail = uncovered.length === 0 ? '' : `  uncovered: ${formatLines(uncovered)}`;
    console.log(`  ${status} ${file}  (${executable - uncovered.length}/${executable})${detail}`);
  }
  if (result.unmeasured.length > 0)
    console.log(`  not instrumented (excluded from coverage): ${result.unmeasured.length} file(s)`);

  // A diff that adds no executable lines - documentation, configuration, a pure
  // rename - has nothing to prove. Passing here is not a hole: the aggregate
  // floor in merge-coverage.mjs still applies to the app as a whole.
  if (result.total === 0) {
    console.log('diff-coverage: no added executable lines to measure, nothing to gate');
    return;
  }

  const pct = Math.round((result.covered / result.total) * 10000) / 100;
  console.log(
    `diff-coverage: ${result.covered}/${result.total} added executable lines covered (${pct}%), floor ${args.floor}%`
  );

  if (pct < args.floor) {
    fail(
      `added lines are ${pct}% covered, below the ${args.floor}% floor. ` +
        'Cover the lines marked MISS above, or move the change behind an existing tested path.'
    );
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
) {
  main();
}
