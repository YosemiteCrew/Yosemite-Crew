#!/usr/bin/env node
/**
 * Fails when a root `pnpm.overrides` entry contradicts what a workspace declares.
 *
 * An override forces resolution regardless of any manifest, which is what makes it
 * the right tool for a CVE floor and also what makes it a trap. When a dependency
 * bump raises a manifest and the override is left behind, one of two things happens
 * and no existing gate notices either, because the overrides map and `pnpm-lock.yaml`
 * stay consistent with each other. Only the manifests end up disagreeing with the
 * installed tree.
 *
 *   pins-below-declared  The override pins BELOW a declared range, so the bump
 *                        installs nothing. axios was raised ^1.19.0 -> ^1.20.0 in
 *                        four manifests while the override held "1.19.0"; the
 *                        lockfile resolved only 1.19.0 and every workspace ran the
 *                        old copy while claiming the new one. `validator` sat at
 *                        13.15.26 against three manifests declaring ^13.15.35 for
 *                        long enough to reach dev.
 *
 *   splits-tree          The override pins a version the lockfile resolves alongside
 *                        a higher one, so the package is installed twice. Two copies
 *                        are two distinct nominal types to TypeScript and two module
 *                        instances at runtime. i18next split this way when mobile
 *                        moved to ^26.4.0 against an override holding 26.3.6.
 *
 * Pinning ABOVE a declared range is NOT reported: that is the CVE-floor pattern this
 * repo relies on deliberately.
 *
 * This runs offline against the manifests and the lockfile, with no `pnpm audit` and
 * no network, so unlike check-override-advisories.mjs it can be a hard gate. That
 * script answers "is the pinned version vulnerable"; this one answers "does the pin
 * still agree with what the repo asks for".
 *
 * Every exported function is pure and takes already-read content. All file reads live
 * in readRepo() against module constants, so no caller-supplied path reaches a read.
 *
 *   node scripts/ci/check-override-drift.mjs [--json]
 *
 * Exits non-zero if any override contradicts a declaration.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const semver = require('semver');

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const ROOT_MANIFEST = join(REPO_ROOT, 'package.json');
const LOCKFILE = join(REPO_ROOT, 'pnpm-lock.yaml');
const WORKSPACE_GROUPS = ['apps', 'packages'];

/**
 * Drift we knowingly tolerate, each with the reason. An entry here is a bug being
 * tolerated, not a bug that has been fixed, so keep it short and justified.
 *
 * Keyed `<package>@<pinned>`, so raising the pin retires the entry automatically
 * rather than leaving a stale exemption behind.
 */
export const ALLOWED = new Map();

/**
 * A bare package name forces EVERY consumer. A selector carrying its own range
 * (`pkg@3`, `pkg@<0.8.15`, `parent>child`) only rewrites resolutions inside that
 * range, so it cannot hold a newer declaration back and is not drift.
 */
export function isBareName(key) {
  if (key.includes('>')) return false;
  return key.indexOf('@', 1) === -1;
}

/**
 * Compare one override against one declaration.
 * Returns null when they agree, or a finding when they do not.
 */
export function classify(name, pinned, declared, file) {
  if (!semver.valid(pinned)) return null;
  if (typeof declared !== 'string' || declared.startsWith('workspace:')) return null;
  if (!semver.validRange(declared)) return null;
  if (semver.satisfies(pinned, declared)) return null;

  const min = semver.minVersion(declared);
  // Forcing above a declared range is the CVE-floor pattern and is deliberate.
  // Only forcing below it makes the declaration a lie.
  if (min && semver.lt(pinned, min)) {
    return { kind: 'pins-below-declared', name, pinned, declared, file, minimum: min.version };
  }
  return null;
}

/**
 * Every version the lockfile resolves, indexed by package name.
 *
 * Takes the lockfile TEXT rather than a path: one read per run instead of one per
 * override, no caller-supplied path, and the parsing is testable without a fixture
 * directory.
 *
 * Deliberately not derived from `node_modules/.pnpm`, which retains
 * previously-installed versions until pruned. An early draft read that directory and
 * reported validator 13.15.26 and 13.15.35 as coexisting when only one was resolved.
 * A gate that fires on a stale working tree trains people to ignore it.
 */
export function parseLockfileVersions(text) {
  const index = new Map();
  // Entries are `  /<name>@<version>(peers...):` at two-space indent. The version
  // capture stops before any peer suffix, which would otherwise make it unparseable
  // and silently disable split detection.
  const re = /^ {2}\/((?:@[^/@\s]+\/)?[^@\s/]+)@([0-9][^()\s:]*)/gm;
  for (const m of text.matchAll(re)) {
    if (!semver.valid(m[2])) continue;
    if (!index.has(m[1])) index.set(m[1], new Set());
    index.get(m[1]).add(m[2]);
  }
  return index;
}

/** package name -> [{file, range}] across every first-party manifest. */
export function collectDeclarations(manifests) {
  const declarations = new Map();
  for (const { file, json } of manifests) {
    for (const field of ['dependencies', 'devDependencies', 'optionalDependencies']) {
      for (const [name, range] of Object.entries(json[field] ?? {})) {
        if (typeof range !== 'string') continue;
        if (!declarations.has(name)) declarations.set(name, []);
        declarations.get(name).push({ file, range });
      }
    }
  }
  return declarations;
}

/** Pure: everything it needs is already read. */
export function findDrift({ overrides, manifests, lockText = '' }) {
  const declarations = collectDeclarations(manifests);
  const resolved = parseLockfileVersions(lockText);
  const findings = [];

  for (const [key, pinned] of Object.entries(overrides)) {
    if (!isBareName(key)) continue;
    if (ALLOWED.has(`${key}@${pinned}`)) continue;

    const declared = declarations.get(key) ?? [];
    for (const decl of declared) {
      const finding = classify(key, pinned, decl.range, decl.file);
      if (finding) findings.push(finding);
    }

    // A split needs the lockfile rather than the manifests: an override and a
    // declaration can both be satisfied and still produce two copies. Report only
    // when the pin is one of several resolved versions, which is the shape that is
    // the override's own fault.
    const present = resolved.get(key);
    if (!declared.length || !present || present.size < 2 || !present.has(pinned)) continue;
    const higher = [...present].filter((v) => semver.gt(v, pinned)).sort(semver.compare);
    if (higher.length) {
      findings.push({
        kind: 'splits-tree',
        name: key,
        pinned,
        others: higher,
        file: declared[0].file,
      });
    }
  }
  return findings;
}

export function formatFinding(f) {
  if (f.kind === 'pins-below-declared') {
    return [
      `  ${f.name}: the override pins ${f.pinned}, but ${f.file} declares ${f.declared}.`,
      `    Nothing installs ${f.declared}: the override wins, so the declaration is a lie`,
      `    and any fix in ${f.minimum} or later is absent from the tree.`,
      `    Fix: raise the override to ${f.minimum} or later, or lower the declaration.`,
    ].join('\n');
  }
  return [
    `  ${f.name}: the override pins ${f.pinned}, but ${f.others.join(', ')} ${
      f.others.length > 1 ? 'are' : 'is'
    } also resolved.`,
    '    Two copies of one package are two distinct types to TypeScript and two',
    '    module instances at runtime.',
    `    Fix: raise the override to ${f.others[f.others.length - 1]} so the tree collapses.`,
  ].join('\n');
}

/** The only function that touches the filesystem, and only via module constants. */
export function readRepo() {
  const rootPkg = JSON.parse(readFileSync(ROOT_MANIFEST, 'utf8'));
  // The root manifest is a manifest too. `aws-cdk-lib` is both a root devDependency
  // and a root override, so leaving it out made exactly the drift this gate exists
  // for invisible in the one file the overrides live in.
  const manifests = [{ file: 'package.json', json: rootPkg }];
  for (const group of WORKSPACE_GROUPS) {
    const dir = join(REPO_ROOT, group);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      const abs = join(dir, name, 'package.json');
      if (!existsSync(abs)) continue;
      manifests.push({
        file: `${group}/${name}/package.json`,
        json: JSON.parse(readFileSync(abs, 'utf8')),
      });
    }
  }
  const lockText = existsSync(LOCKFILE) ? readFileSync(LOCKFILE, 'utf8') : '';
  return { overrides: rootPkg.pnpm?.overrides ?? {}, manifests, lockText };
}

function main(argv) {
  const repo = readRepo();
  const findings = findDrift(repo);

  if (argv.includes('--json')) {
    console.log(JSON.stringify({ findings }, null, 2));
    process.exitCode = findings.length ? 1 : 0;
    return;
  }

  console.log(
    `check-override-drift: ${Object.keys(repo.overrides).length} override entries checked`
  );
  if (!findings.length) {
    console.log('  no override contradicts a workspace declaration');
    return;
  }

  const below = findings.filter((f) => f.kind === 'pins-below-declared');
  const splits = findings.filter((f) => f.kind === 'splits-tree');
  console.error(
    `\ncheck-override-drift: ${below.length} override(s) pinning below a declared range,` +
      ` and ${splits.length} splitting the tree\n`
  );
  for (const f of findings) {
    console.error(formatFinding(f));
    console.error('');
  }
  console.error('A pnpm override beats every manifest, so these do not show up in');
  console.error('`pnpm install --frozen-lockfile`, lint or type-check: the overrides map');
  console.error('and the lockfile agree with each other, and only the manifests disagree');
  console.error('with what is installed. Read the resolution, not the manifest:');
  console.error('');
  console.error(
    "  grep -oE '^  /<pkg>@[0-9.]+' pnpm-lock.yaml | sort -u    # want exactly one line"
  );
  process.exitCode = 1;
}

if (process.argv[1] && process.argv[1].endsWith('check-override-drift.mjs')) {
  main(process.argv.slice(2));
}
