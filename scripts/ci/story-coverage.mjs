#!/usr/bin/env node
// Fails when a pull request adds a new React component under apps/frontend
// without a sibling Storybook story.
//
// Why this exists: nothing else in CI checks this. Chromatic only visually
// diffs stories that already exist (`onlyChanged`), and the Storybook
// interactions job (storybook-interactions.yml) only runs `play` functions on
// existing stories - neither one has any way to notice a component that was
// never given a story in the first place. A 2026-09 documentation/QA pass
// found real UI bugs (an inconsistent empty-state button, a native <select>
// that never got themed) that had sat unreviewed because nobody - human or
// CI - ever looked at the component in isolation. This gate is the fix: it
// does not require a story from every one of the hundreds of pre-existing
// components (that backlog is real and this gate does not attempt to clear
// it), only from files a PR *adds*, so the cost of the gate always matches
// the size of the change - the same shape as diff-coverage.mjs.
//
// Detection is a deliberately simple heuristic, not a TypeScript/AST parse:
// a component file default- or named-exports a capitalised identifier and
// its body contains a JSX closing tag ("</"). That is enough to separate a
// real component from a hook, a service, a type-only file or a barrel
// re-export, and false positives have a cheap, visible escape hatch (see
// NO_STORY_MARKER) rather than needing the detector to be perfect.
//
//   node scripts/ci/story-coverage.mjs --base <sha> --head <sha> [--dir <app-dir>]
//   node scripts/ci/story-coverage.mjs --files <path...>   # check specific files, for local/test use

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_APP_DIR = 'apps/frontend/src/app';

// A component opts out with a one-line comment naming why, so a suppression
// is greppable and reviewable instead of silent - the same shape as a
// NOSONAR comment elsewhere in this codebase.
const NO_STORY_MARKER = /\/\/\s*no-story:\s*\S/;

const EXCLUDE_PATTERNS = [/\.stories\.tsx$/, /\.test\.tsx$/, /(^|\/)__tests__\//, /\.d\.ts$/];

// A capitalised name declared as a function or a const, anywhere in the file -
// deliberately not anchored to `export`, because this codebase commonly
// declares a component as a plain `const Foo = (...) => ...` and exports it
// several lines later with a standalone `export default Foo;` (found via a
// real historical miss: DocumentsListPanel.tsx uses exactly this shape and an
// export-anchored regex silently never matched it).
const DECLARATION_PATTERN =
  /\b(?:async\s+)?function\s+([A-Z]\w*)|\bconst\s+([A-Z]\w*)\s*(?::[^=]+)?=/g;

const isExported = (content, name) =>
  new RegExp(`export\\s+default\\s+(?:async\\s+)?function\\s+${name}\\b`).test(content) ||
  new RegExp(`export\\s+const\\s+${name}\\b`).test(content) ||
  new RegExp(`export\\s+default\\s+${name}\\s*;`).test(content) ||
  new RegExp(`export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`).test(content);

/** Every capitalised name this file both declares and actually exports. */
const exportedComponentNames = (content) => {
  const names = new Set();
  for (const match of content.matchAll(DECLARATION_PATTERN)) {
    const name = match[1] ?? match[2];
    if (name) names.add(name);
  }
  return [...names].filter((name) => isExported(content, name));
};

function fail(message) {
  console.error(`story-coverage: ${message}`);
  process.exit(1);
}

export function parseArgs(argv) {
  const args = { base: '', head: '', dir: DEFAULT_APP_DIR, files: [] };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--base') args.base = argv[++i];
    else if (flag === '--head') args.head = argv[++i];
    else if (flag === '--dir') args.dir = argv[++i];
    else if (flag === '--files') {
      // Consumes every remaining argument, so it must stop the loop rather
      // than let the next iteration re-read a file path as an unknown flag.
      args.files = argv.slice(i + 1);
      break;
    } else fail(`unknown argument '${flag}'`);
  }
  if (args.files.length === 0 && (!args.base || !args.head))
    fail('usage: --base <sha> --head <sha> [--dir <app-dir>]  OR  --files <path...>');
  return args;
}

/** Files added (never present at `base`) between base and head, under `dir`. */
export function addedFiles({ base, head, dir, cwd = REPO_ROOT }) {
  const out = execFileSync(
    'git',
    ['diff', '--name-status', '--diff-filter=A', `${base}...${head}`, '--', dir],
    { cwd, encoding: 'utf8' }
  );
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split('\t').pop())
    .filter((file) => file.endsWith('.tsx'));
}

/** True if the file's content looks like a real, exported React component. */
export function looksLikeComponent(content) {
  if (NO_STORY_MARKER.test(content)) return false;
  if (exportedComponentNames(content).length === 0) return false;
  if (!content.includes('</')) return false; // no JSX closing tag anywhere
  const codeLines = content.split('\n').filter((l) => l.trim().length > 0).length;
  return codeLines >= 6;
}

export function storyPathFor(componentFile) {
  return componentFile.replace(/\.tsx$/, '.stories.tsx');
}

// `files` comes from `git diff` output or a `--files` CLI argument, neither
// of which this script should trust to stay under `cwd` - a relative path
// containing `..` (or an absolute path) could otherwise make readFileSync
// walk outside the repo. Returns null for anything that escapes `cwd`.
function resolveWithin(cwd, file) {
  const base = path.resolve(cwd);
  const fullPath = path.resolve(base, file);
  const relative = path.relative(base, fullPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return fullPath;
}

export function evaluate({ files, cwd = REPO_ROOT }) {
  const missing = [];
  const skipped = [];
  const checked = [];

  for (const file of files) {
    if (EXCLUDE_PATTERNS.some((re) => re.test(file))) {
      skipped.push(file);
      continue;
    }
    const fullPath = resolveWithin(cwd, file);
    if (!fullPath || !existsSync(fullPath)) {
      // Added then deleted again within the same PR range - nothing to check.
      skipped.push(file);
      continue;
    }
    const content = readFileSync(fullPath, 'utf8');
    if (!looksLikeComponent(content)) {
      skipped.push(file);
      continue;
    }
    checked.push(file);
    const storyFile = storyPathFor(file);
    const storyFullPath = resolveWithin(cwd, storyFile);
    if (!storyFullPath || !existsSync(storyFullPath)) {
      missing.push({ file, expected: storyFile });
    }
  }

  return { missing, skipped, checked };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const files = args.files.length > 0 ? args.files : addedFiles(args);
  const { missing, skipped, checked } = evaluate({ files });

  console.log(
    `story-coverage: ${files.length} added .tsx file(s), ${checked.length} look like components, ${skipped.length} excluded`
  );

  if (missing.length === 0) {
    console.log('story-coverage: every new component has a story');
    return;
  }

  console.error(
    `\nstory-coverage: ${missing.length} new component(s) added with no Storybook story:`
  );
  for (const { file, expected } of missing) {
    console.error(`  ${file}\n    expected: ${expected}`);
  }
  console.error(
    '\nAdd a story next to the component, or if it genuinely does not need one (a trivial ' +
      'wrapper, something only ever exercised inside a parent story), add a comment explaining ' +
      'why: // no-story: <reason>'
  );
  process.exit(1);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
) {
  main();
}
