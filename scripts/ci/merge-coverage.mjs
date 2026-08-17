#!/usr/bin/env node
// Merge per-shard coverage into one report per app, and enforce the app's floor.
//
// Usage:
//   node scripts/ci/merge-coverage.mjs --shards <dir> --out <dir> [--floor spec]
//
//   --shards  directory containing the downloaded shard artifacts; every
//             coverage-final.json beneath it is merged
//   --out     directory to write lcov.info into
//   --floor   e.g. statements=80,branches=70,functions=78,lines=80
//
// Shards are merged as istanbul JSON rather than as lcov text. lcov merging
// looks simpler but loses data: lcov-result-merger drops FN/FNDA records
// entirely, so function coverage silently disappears and a functions floor
// evaluates against nothing. Merging the istanbul coverage maps keeps all four
// metrics intact, and lcov is generated once from the merged map for Sonar.
//
// The merged istanbul map is also written back out as coverage-final.json, so
// the PR-only diff-coverage gate can read per-line hit counts (lcov keeps them
// too, but the map is the shape diff-coverage.mjs already consumes).
//
// A floor is enforced here rather than through jest's own coverageThreshold
// because a sharded run gives each shard only a slice of the files; a global
// threshold would fail on every shard regardless of the real total.

import { readdirSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { resolveWithin } from './safe-path.mjs';
import libCoverage from 'istanbul-lib-coverage';
import libReport from 'istanbul-lib-report';
import reports from 'istanbul-reports';

const METRICS = ['statements', 'branches', 'functions', 'lines'];

function fail(message) {
  console.error(`merge-coverage: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { shards: '', out: '', floor: '' };
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (!['--shards', '--out', '--floor'].includes(flag)) fail(`unknown argument '${flag}'`);
    if (!value) fail(`${flag} requires a value`);
    args[flag.slice(2)] = value;
  }
  if (!args.shards || !args.out) fail('usage: --shards <dir> --out <dir> [--floor spec]');
  return args;
}

function findCoverageFiles(dir) {
  const found = [];
  const root = path.resolve(dir);
  const walk = (current) => {
    for (const entry of readdirSync(current)) {
      // readdirSync yields bare names, so this cannot escape today; asserting it
      // keeps that true if the traversal ever reads names from elsewhere.
      const full = resolveWithin(root, path.relative(root, path.join(current, entry)));
      if (full === null) continue;
      if (statSync(full).isDirectory()) walk(full);
      else if (entry === 'coverage-final.json') found.push(full);
    }
  };
  try {
    walk(dir);
  } catch (error) {
    fail(`cannot read shard directory '${dir}': ${error.message}`);
  }
  return found.sort();
}

function parseFloor(spec) {
  const floors = new Map();
  if (!spec) return floors;
  for (const part of spec.split(',')) {
    const [metric, value] = part.split('=');
    const parsed = Number(value);
    if (!METRICS.includes(metric?.trim()))
      fail(`unknown metric '${metric}', expected one of ${METRICS.join(', ')}`);
    if (Number.isNaN(parsed)) fail(`bad floor value in '${part}'`);
    floors.set(metric.trim(), parsed);
  }
  return floors;
}

const args = parseArgs(process.argv.slice(2));
const files = findCoverageFiles(args.shards);

// No shard reports means the upload or download silently produced nothing.
// Writing an empty report here would hand Sonar a 0% measurement it accepts
// without complaint, so stop instead.
if (files.length === 0) fail(`no coverage-final.json found under '${args.shards}'`);

const map = libCoverage.createCoverageMap({});
for (const file of files) {
  try {
    map.merge(JSON.parse(readFileSync(file, 'utf8')));
  } catch (error) {
    fail(`cannot merge ${file}: ${error.message}`);
  }
}

const covered = map.files().length;
if (covered === 0) fail('merged coverage map contains no files');

mkdirSync(args.out, { recursive: true });
writeFileSync(path.join(args.out, 'coverage-final.json'), JSON.stringify(map.toJSON()));
reports
  .create('lcovonly', { file: 'lcov.info' })
  .execute(libReport.createContext({ dir: args.out, coverageMap: map }));

const summary = map.getCoverageSummary();
console.log(`merge-coverage: merged ${files.length} shard report(s), ${covered} files`);
for (const metric of METRICS) {
  const { pct, covered: hit, total } = summary[metric];
  console.log(`  ${metric.padEnd(11)} ${String(pct).padStart(6)}%  (${hit}/${total})`);
}

const floors = parseFloor(args.floor);
const failures = [];
for (const [metric, floor] of floors) {
  const { pct } = summary[metric];
  if (pct < floor) failures.push(`${metric} ${pct}% < ${floor}%`);
}
if (failures.length > 0) fail(`merged coverage below floor: ${failures.join(', ')}`);
