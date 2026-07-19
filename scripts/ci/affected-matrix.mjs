#!/usr/bin/env node
// Build the CI job matrix from Turborepo's affected-package graph.
//
// Usage:
//   node .github/scripts/affected-matrix.mjs --workspaces ws.json --dry affected.json
//   node .github/scripts/affected-matrix.mjs --workspaces ws.json --all
//
//   --workspaces  `pnpm ls -r --depth -1 --json` output (name + absolute path
//                 for every workspace, including the repo root, which is dropped)
//   --dry         `turbo run ... --dry=json` output; affected packages are its
//                 distinct tasks[].package
//   --all         treat every workspace as affected (lockfile change, or the
//                 base-SHA resolver reported run_all)
//
// Emits key=value lines on stdout for the caller to append to $GITHUB_OUTPUT:
//   matrix={"include":[{workspace,dir,app_key,has_lint,has_type_check,has_build,has_test,needs_prisma}]}
//   has_any=<bool>
//   frontend=<bool>
//
// Fail-closed contract: malformed or unreadable input throws a non-zero exit
// rather than degrading to an empty matrix. An empty matrix is indistinguishable
// from "nothing to do" and would silently skip all of CI.

import { readFileSync } from 'node:fs';
import path from 'node:path';

// Single source of truth for the workspace -> Sonar/coverage app key mapping.
// _test derives apps-with-coverage from this, and _sonar maps those keys back to
// project directories, so producer and consumer cannot drift apart.
const APP_KEYS = new Map([
  ['frontend', 'frontend'],
  ['backend', 'backend'],
  ['mobileAppYC', 'mobile'],
  ['@yosemite-crew/desktop', 'desktop'],
]);

// Workspaces whose jobs need a generated Prisma client before anything compiles.
const NEEDS_PRISMA = new Set(['backend', '@yosemite-crew/database']);

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const args = { workspaces: '', dry: '', all: false };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--all') {
      args.all = true;
    } else if (flag === '--workspaces' || flag === '--dry') {
      const value = argv[i + 1];
      if (!value) fail(`${flag} requires a file path`);
      args[flag.slice(2)] = value;
      i += 1;
    } else {
      fail(`unknown argument '${flag}'`);
    }
  }
  if (!args.workspaces) fail('--workspaces is required');
  if (!args.all && !args.dry) fail('one of --dry or --all is required');
  return args;
}

function readJson(file) {
  let raw;
  try {
    raw = readFileSync(file, 'utf8');
  } catch (error) {
    fail(`cannot read ${file}: ${error.message}`);
  }
  if (raw.trim() === '') fail(`${file} is empty`);
  try {
    return JSON.parse(raw);
  } catch (error) {
    fail(`${file} is not valid JSON: ${error.message}`);
  }
}

// pnpm reports absolute paths; the matrix needs repo-relative ones. The entry
// whose path is the repo root is the workspace root itself, which has no jobs.
function readWorkspaces(file) {
  const entries = readJson(file);
  if (!Array.isArray(entries)) fail(`${file} is not a pnpm workspace list`);

  const root = entries
    .map((entry) => entry.path)
    .filter(Boolean)
    .reduce((shortest, candidate) => (candidate.length < shortest.length ? candidate : shortest));

  const workspaces = new Map();
  for (const entry of entries) {
    if (!entry?.name || !entry?.path) fail(`${file} has an entry missing name or path`);
    if (entry.path === root) continue;
    workspaces.set(entry.name, path.relative(root, entry.path));
  }
  if (workspaces.size === 0) fail(`${file} listed no workspaces besides the root`);
  return workspaces;
}

// Turbo lists a package's task even when the script is absent, marking the
// command '<NONEXISTENT>'. Those entries still prove the package is in the
// affected set (it may need lint or type-check), so they are kept here; whether
// a script exists is answered by package.json below, not by the task graph.
function readAffected(file) {
  const dry = readJson(file);
  if (!Array.isArray(dry?.tasks)) fail(`${file} has no tasks array`);
  return new Set(dry.tasks.map((task) => task?.package).filter(Boolean));
}

function scriptsFor(dir) {
  const pkg = readJson(path.join(dir, 'package.json'));
  return pkg.scripts ?? {};
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const workspaces = readWorkspaces(args.workspaces);
  const affected = args.all ? new Set(workspaces.keys()) : readAffected(args.dry);

  const include = [];
  for (const name of [...affected].sort((a, b) => a.localeCompare(b))) {
    const dir = workspaces.get(name);
    // Turbo's root package ('//') has no directory of its own and no jobs.
    if (dir === undefined) continue;

    const scripts = scriptsFor(dir);
    include.push({
      workspace: name,
      dir,
      app_key: APP_KEYS.get(name) ?? '',
      has_lint: Boolean(scripts.lint),
      has_type_check: Boolean(scripts['type-check']),
      has_build: Boolean(scripts.build),
      has_test: Boolean(scripts.test),
      needs_prisma: NEEDS_PRISMA.has(name),
    });
  }

  const lines = [
    `matrix=${JSON.stringify({ include })}`,
    `has_any=${include.length > 0}`,
    `frontend=${include.some((entry) => entry.workspace === 'frontend')}`,
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
}

main();
