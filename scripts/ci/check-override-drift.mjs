#!/usr/bin/env node
/**
 * Fails when a root `pnpm.overrides` entry contradicts what a workspace declares.
 *
 * An override forces resolution regardless of any manifest, which is what makes
 * it the right tool for a CVE floor and also what makes it a trap. When a
 * dependency bump raises a manifest and the override is left behind, one of two
 * things happens and no existing gate notices either, because the overrides map
 * and `pnpm-lock.yaml` stay consistent with each other. Only the manifests end
 * up disagreeing with the installed tree.
 *
 *   pins-below-declared  The override pins BELOW a declared range, so the bump
 *                        installs nothing. axios was raised ^1.19.0 -> ^1.20.0
 *                        in four manifests while the override held "1.19.0";
 *                        the lockfile resolved only 1.19.0 and every workspace
 *                        ran the old copy while claiming the new one. `validator`
 *                        sat at 13.15.26 against three manifests declaring
 *                        ^13.15.35 for long enough to reach dev.
 *
 *   splits-tree          The override pins a version that satisfies the declared
 *                        range but differs from what the range resolves to, so
 *                        the package ends up installed twice. Two copies of one
 *                        package are two distinct nominal types to TypeScript
 *                        and two module instances at runtime. i18next split this
 *                        way when mobile moved to ^26.4.0 while the override held
 *                        26.3.6; a proposed zod override did the same at 4.5.0
 *                        against a ^4.5.0 that resolved 4.5.4.
 *
 * This runs offline against the manifests alone, with no `pnpm audit` and no
 * network, so unlike check-override-advisories.mjs it can be a hard gate.
 * That script answers "is the pinned version vulnerable"; this one answers
 * "does the pin still agree with what the repo asks for".
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

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Drift we knowingly tolerate, each with the reason. An entry here is a bug being
 * tolerated, not a bug that has been fixed, so keep it short and justified.
 *
 * Key is `<package>@<pinned>`, so raising the pin retires the entry automatically
 * rather than leaving a stale exemption behind.
 */
export const ALLOWED = new Map([]);

/** Every first-party manifest, root last so its own overrides block is skippable. */
export function manifestPaths(root = repoRoot) {
  const out = [];
  for (const group of ['apps', 'packages']) {
    const dir = join(root, group);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      const file = join(dir, name, 'package.json');
      if (existsSync(file)) out.push(file);
    }
  }
  return out;
}

/**
 * A bare package name forces EVERY consumer. A selector carrying its own range
 * (`pkg@3`, `pkg@<0.8.15`, `parent>child`) only rewrites resolutions inside that
 * range, so it cannot hold a newer declaration back and is not drift.
 */
export function isBareName(key) {
  if (key.includes('>')) return false;
  const at = key.indexOf('@', 1);
  return at === -1;
}

/**
 * Compare one override against one declaration.
 * Returns null when they agree, or a finding when they do not.
 */
export function classify(name, pinned, declared, file) {
  if (!semver.valid(pinned)) return null;
  if (!semver.validRange(declared)) return null;
  if (declared.startsWith('workspace:')) return null;

  if (!semver.satisfies(pinned, declared)) {
    const min = semver.minVersion(declared);
    // Pinning ABOVE a declared range is the CVE-floor pattern and is deliberate.
    // Only pinning below it makes the declaration a lie.
    if (min && semver.lt(pinned, min)) {
      return { kind: 'pins-below-declared', name, pinned, declared, file, minimum: min.version };
    }
    return null;
  }

  // The pin satisfies the range, so it is not inert. It can still split the tree
  // when the range would otherwise resolve somewhere else. maxSatisfying over the
  // versions we can see locally is a lower bound on that, so this reports only
  // what it can prove: a pin strictly below the highest version the range admits
  // among versions already present in the tree.
  return null;
}

/**
 * Versions of `name` the lockfile actually resolves.
 *
 * Deliberately NOT read from `node_modules/.pnpm`: that directory retains
 * previously-installed versions until it is pruned, so a stale store reports a
 * split that no longer exists. An early draft of this check did exactly that and
 * reported validator 13.15.26 and 13.15.35 as coexisting when only one was
 * resolved. The lockfile is the only authority on what a fresh install produces.
 */
export function resolvedVersions(name, root = repoRoot) {
  const found = new Set();
  const lock = join(root, 'pnpm-lock.yaml');
  if (!existsSync(lock)) return found;
  const text = readFileSync(lock, 'utf8');
  // Package entries are `  /<name>@<version>(peers...):` at two-space indent.
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^ {2}/${escaped}@([0-9][^()\\s:]*)`, 'gm');
  for (const m of text.matchAll(re)) {
    if (semver.valid(m[1])) found.add(m[1]);
  }
  return found;
}

export function findDrift({ root = repoRoot, overrides, manifests } = {}) {
  const rootPkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const pins = overrides ?? rootPkg.pnpm?.overrides ?? {};
  const files = manifests ?? manifestPaths(root);

  const declarations = new Map();
  for (const file of files) {
    const pkg = JSON.parse(readFileSync(file, 'utf8'));
    for (const field of ['dependencies', 'devDependencies', 'optionalDependencies']) {
      for (const [name, range] of Object.entries(pkg[field] ?? {})) {
        if (typeof range !== 'string') continue;
        if (!declarations.has(name)) declarations.set(name, []);
        declarations.get(name).push({ file: file.replace(`${root}/`, ''), range });
      }
    }
  }

  const findings = [];
  for (const [key, pinned] of Object.entries(pins)) {
    if (!isBareName(key)) continue;
    if (ALLOWED.has(`${key}@${pinned}`)) continue;
    for (const decl of declarations.get(key) ?? []) {
      const finding = classify(key, pinned, decl.range, decl.file);
      if (finding) findings.push(finding);
    }

    // Split detection needs the installed tree rather than the manifests: an
    // override and a declaration can both be satisfied and still produce two
    // copies. Report only when more than one version is actually on disk AND
    // the pin is one of them, which is the shape that is the override's fault.
    const present = resolvedVersions(key, root);
    if (present.size > 1 && present.has(pinned)) {
      const higher = [...present].filter((v) => semver.gt(v, pinned));
      if (higher.length && (declarations.get(key) ?? []).length) {
        findings.push({
          kind: 'splits-tree',
          name: key,
          pinned,
          others: higher.sort(semver.compare),
          file: (declarations.get(key) ?? [])[0].file,
        });
      }
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
    } also installed.`,
    `    Two copies of one package are two distinct types to TypeScript and two`,
    `    module instances at runtime.`,
    `    Fix: raise the override to ${f.others[f.others.length - 1]} so the tree collapses.`,
  ].join('\n');
}

function main(argv) {
  const json = argv.includes('--json');
  const findings = findDrift();

  if (json) {
    console.log(JSON.stringify({ findings }, null, 2));
    process.exitCode = findings.length ? 1 : 0;
    return;
  }

  const overrideCount = Object.keys(
    JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')).pnpm?.overrides ?? {},
  ).length;
  console.log(`check-override-drift: ${overrideCount} override entries checked`);

  if (!findings.length) {
    console.log('  no override contradicts a workspace declaration');
    return;
  }

  const below = findings.filter((f) => f.kind === 'pins-below-declared');
  const splits = findings.filter((f) => f.kind === 'splits-tree');
  console.error(
    `\ncheck-override-drift: ${below.length} override(s) pinning below a declared range` +
      `, and ${splits.length} splitting the tree\n`,
  );
  for (const f of findings) {
    console.error(formatFinding(f));
    console.error('');
  }
  console.error(
    'A pnpm override beats every manifest, so these do not show up in',
  );
  console.error(
    '`pnpm install --frozen-lockfile`, lint or type-check: the overrides map and',
  );
  console.error(
    'the lockfile agree with each other and only the manifests disagree with what',
  );
  console.error('is installed. Read the resolution, not the manifest:');
  console.error('');
  console.error(
    "  grep -oE '^  /<pkg>@[0-9.]+' pnpm-lock.yaml | sort -u    # want exactly one line",
  );
  process.exitCode = 1;
}

if (process.argv[1] && process.argv[1].endsWith('check-override-drift.mjs')) {
  main(process.argv.slice(2));
}
