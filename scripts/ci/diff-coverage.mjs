#!/usr/bin/env node
// Enforce coverage on the executable lines a pull request ADDS, not the project
// as a whole.
//
// Usage:
//   node scripts/ci/diff-coverage.mjs \
//     --diff <patch> --map <coverage-final.json> --root <dir> --floor <pct>
//
//   --diff   a unified diff (git diff base...HEAD) naming the lines this branch
//            adds
//   --map    the merged istanbul map merge-coverage.mjs writes, which records a
//            hit count per executable line
//   --root   the repository root the map's paths and the diff's paths share, so
//            one can be matched against the other
//   --floor  the minimum share of added executable lines that must be covered
//
// The aggregate floors in merge-coverage.mjs answer "is the whole app above the
// bar", which a change can satisfy while adding a block of untested lines: the
// project was already well above the floor, so the new gap does not drag the
// total under it. This measures only the lines the diff adds, so a single PR's
// untested code fails on its own account regardless of the project total.
//
// Only executable lines count. A line the diff adds that istanbul never
// instrumented - a comment, a blank line, a file with no coverage report at all
// such as a doc or a config - is not measured and does not count against the
// floor. A new source file with no test, by contrast, is instrumented with
// every line at zero hits (its app collects coverage from uncovered files), so
// it fails as it should.
//
// Fails closed: a missing, empty or unparseable map fails rather than passing
// unmeasured, the same reasoning merge-coverage.mjs and lcov-check.mjs apply to
// a coverage report that measured nothing.
//
// Dependency-light by design, like the other scripts here: only Node and
// istanbul-lib-coverage, which the merge step already installs.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import libCoverage from 'istanbul-lib-coverage';
import { resolveWithin } from './safe-path.mjs';

function fail(message) {
  console.error(`diff-coverage: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { diff: '', map: '', root: '', floor: '' };
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (!['--diff', '--map', '--root', '--floor'].includes(flag))
      fail(`unknown argument '${flag}'`);
    if (!value) fail(`${flag} requires a value`);
    args[flag.slice(2)] = value;
  }
  if (!args.diff || !args.map || !args.root || !args.floor)
    fail('usage: --diff <patch> --map <coverage-final.json> --root <dir> --floor <pct>');
  return args;
}

// git prefixes the two sides of a diff with a/ and b/. A rename or a plain edit
// keeps them; strip whichever is present so the path matches the map's.
function stripDiffPrefix(target) {
  if (target.startsWith('a/') || target.startsWith('b/')) return target.slice(2);
  return target;
}

/**
 * Parse a unified diff into the set of line numbers each file gains.
 *
 * The new-file side is tracked: `+++ b/<path>` names the file (a `+++ /dev/null`
 * is a deletion and adds nothing), each `@@ -a,b +c,d @@` header resets the
 * counter to the hunk's new-file start, and from there a `+` line records the
 * current line and advances it while a context line only advances it. Deleted
 * (`-`) lines belong to the old side and never move the new-file counter.
 */
export function parseUnifiedDiff(text) {
  const addedLinesByFile = new Map();
  let file = null;
  let newLine = 0;
  let inHunk = false;

  for (const raw of text.split('\n')) {
    if (raw.startsWith('+++ ')) {
      const target = raw.slice(4).trim();
      file = target === '/dev/null' ? null : stripDiffPrefix(target);
      inHunk = false;
      continue;
    }
    if (raw.startsWith('--- ')) continue;

    const header = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
    if (header) {
      newLine = Number(header[1]);
      inHunk = true;
      continue;
    }

    if (!inHunk || file === null) continue;
    if (raw.startsWith('+')) {
      let lines = addedLinesByFile.get(file);
      if (!lines) {
        lines = new Set();
        addedLinesByFile.set(file, lines);
      }
      lines.add(newLine);
      newLine += 1;
    } else if (raw.startsWith(' ')) {
      newLine += 1;
    }
  }
  return addedLinesByFile;
}

/**
 * Measure the added lines against the merged coverage map.
 *
 * The map is keyed by absolute path; it is indexed by path relative to `root`
 * so the diff's repo-relative paths can address it, and an entry that escapes
 * `root` is dropped rather than resolved. An added line is measured only if the
 * file's line coverage records it - a non-executable line is absent and skipped
 * - and counts as covered when its hit count is above zero.
 */
export function evaluateDiffCoverage({ coverageMapJson, addedLinesByFile, root }) {
  const map = libCoverage.createCoverageMap(coverageMapJson);

  const byRelPath = new Map();
  for (const filePath of map.files()) {
    const relative = path.relative(root, filePath);
    if (resolveWithin(root, relative) === null) continue;
    byRelPath.set(relative, filePath);
  }

  let measured = 0;
  let covered = 0;
  const uncoveredByFile = new Map();

  for (const [file, lines] of addedLinesByFile) {
    const filePath = byRelPath.get(file);
    if (!filePath) continue;
    const lineCoverage = map.fileCoverageFor(filePath).getLineCoverage();
    const uncovered = [];
    for (const line of lines) {
      const hits = lineCoverage[line];
      if (hits === undefined) continue;
      measured += 1;
      if (hits > 0) covered += 1;
      else uncovered.push(line);
    }
    if (uncovered.length > 0)
      uncoveredByFile.set(
        file,
        uncovered.sort((a, b) => a - b)
      );
  }

  const pct = measured === 0 ? 100 : (covered / measured) * 100;
  return { measured, covered, pct, uncoveredByFile };
}

/** Collapse a sorted line list into a compact `a-b,c` string for the report. */
export function formatRanges(sortedLines) {
  const ranges = [];
  let start = null;
  let prev = null;
  for (const line of sortedLines) {
    if (start === null) {
      start = line;
      prev = line;
    } else if (line === prev + 1) {
      prev = line;
    } else {
      ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
      start = line;
      prev = line;
    }
  }
  if (start !== null) ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
  return ranges.join(',');
}

function main(argv) {
  const args = parseArgs(argv);

  const floor = Number(args.floor);
  if (Number.isNaN(floor) || floor < 0 || floor > 100)
    fail(`bad floor '${args.floor}', expected a number between 0 and 100`);

  if (!existsSync(args.diff)) fail(`diff '${args.diff}' does not exist`);
  const addedLinesByFile = parseUnifiedDiff(readFileSync(args.diff, 'utf8'));

  if (!existsSync(args.map)) fail(`coverage map '${args.map}' does not exist`);
  const rawMap = readFileSync(args.map, 'utf8');
  if (rawMap.trim() === '') fail(`coverage map '${args.map}' is empty`);
  let coverageMapJson;
  try {
    coverageMapJson = JSON.parse(rawMap);
  } catch (error) {
    fail(`cannot parse coverage map '${args.map}': ${error.message}`);
  }
  if (
    !coverageMapJson ||
    typeof coverageMapJson !== 'object' ||
    Object.keys(coverageMapJson).length === 0
  )
    fail(`coverage map '${args.map}' records no files, so it measures nothing`);

  const { measured, covered, pct, uncoveredByFile } = evaluateDiffCoverage({
    coverageMapJson,
    addedLinesByFile,
    root: args.root,
  });

  if (measured === 0) {
    console.log('diff-coverage: no added executable lines to measure; nothing to gate.');
    return 0;
  }

  console.log(`diff-coverage: ${covered}/${measured} added executable line(s) covered`);
  console.log(`  coverage: ${pct.toFixed(2)}%  (floor ${floor}%)`);
  for (const [file, lines] of uncoveredByFile) {
    console.log(`  uncovered ${file}: ${formatRanges(lines)}`);
  }

  if (pct < floor) {
    console.error(
      `diff-coverage: added-line coverage ${pct.toFixed(2)}% is below the ${floor}% floor`
    );
    return 1;
  }
  console.log('diff-coverage: added lines meet the floor.');
  return 0;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
) {
  process.exit(main(process.argv.slice(2)));
}
