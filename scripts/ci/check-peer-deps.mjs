#!/usr/bin/env node
/**
 * Fails when an installed package's peer dependency is not satisfied.
 *
 * `.npmrc` sets `auto-install-peers = true`, which makes pnpm resolve missing
 * peers quietly, and an explicit pin in a workspace package overrides whatever
 * the peer range asked for. The combination is silent: pnpm prints a warning
 * that nothing fails on.
 *
 * That is how mobile 1.6.0 shipped. react-native@0.81.6 declares
 * `peerDependencies.react: ^19.1.4`, apps/mobileAppYC pinned `react: 19.1.0`,
 * and React refuses to run against a renderer built for a different version,
 * so every Release build died on launch. The mismatch was declared in the
 * dependency tree the whole time.
 *
 *   node scripts/ci/check-peer-deps.mjs [--json]
 *
 * Exits non-zero if any peer range is unsatisfied.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const semver = require('semver');

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Peers we knowingly do not satisfy, each with the reason. Keep this list
 * short and justified: an entry here is a bug that is being tolerated, not a
 * bug that has been fixed.
 */
const ALLOWED = new Map([
  // Deprecated and unmaintained past React 17. Still imported by a number of
  // hook tests; @testing-library/react-native provides renderHook as the
  // replacement, so this clears once those tests are migrated.
  ['@testing-library/react-hooks@react', 'deprecated, pending migration to RNTL renderHook'],
]);

/**
 * Classifies one peer requirement. Exported so the decision that reds a build
 * is testable without an installed dependency tree.
 *
 * @returns {'ok'|'unsatisfied'|'unparseable'}
 */
export const classifyPeer = (installed, range) => {
  // Some packages publish ranges semver cannot parse (@gorhom/bottom-sheet
  // ships '>=3.16.0 || >=4.0.0-'). Nothing satisfies an invalid range, so
  // checking one would report a mismatch that does not exist.
  if (semver.validRange(range, { includePrerelease: true }) === null) {
    return 'unparseable';
  }
  return semver.satisfies(installed, range, { includePrerelease: true }) ? 'ok' : 'unsatisfied';
};

/**
 * Reads a package manifest. Every caller passes a path built from `repoRoot`
 * or from Node's own module resolution, never from user input.
 */
const readManifest = (manifestPath) => {
  try {
    return JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {
    return null;
  }
};

const workspaces = () => {
  const yaml = readFileSync(join(repoRoot, 'pnpm-workspace.yaml'), 'utf8');
  const globs = [...yaml.matchAll(/^\s*-\s*['"]?([^'"\n]+)['"]?\s*$/gm)].map((m) => m[1].trim());
  const dirs = [];
  for (const glob of globs) {
    if (!glob.endsWith('/*')) continue;
    const base = join(repoRoot, glob.slice(0, -2));
    if (!existsSync(base)) continue;
    for (const entry of readdirSync(base)) {
      const pkg = join(base, entry, 'package.json');
      if (existsSync(pkg)) dirs.push(join(base, entry));
    }
  }
  return dirs;
};

const problems = [];
const unparseable = [];

/** Resolves an installed package's manifest from a given directory, or null. */
const resolveManifest = (name, fromDir) => {
  try {
    return readManifest(require.resolve(`${name}/package.json`, { paths: [fromDir] }));
  } catch {
    // Not resolvable from here: optional, or a types-only package.
    return null;
  }
};

/** Every non-optional peer a dependency declares, paired with its range. */
const requiredPeers = (depManifest) => {
  const peers = depManifest?.peerDependencies ?? {};
  const meta = depManifest?.peerDependenciesMeta ?? {};
  return Object.entries(peers).filter(([name]) => !meta[name]?.optional);
};

/** Checks one dependency's peers, recording anything unsatisfied. */
const checkDependency = (workspaceName, dir, depName) => {
  const depManifest = resolveManifest(depName, dir);
  if (!depManifest) return;

  for (const [peerName, range] of requiredPeers(depManifest)) {
    if (ALLOWED.has(`${depName}@${peerName}`)) continue;

    // auto-install-peers handles an absent peer; only a present, wrong one
    // is a problem here.
    const installed = resolveManifest(peerName, dir)?.version;
    if (!installed) continue;

    const verdict = classifyPeer(installed, range);
    if (verdict === 'unparseable') {
      unparseable.push({ dependency: depName, peer: peerName, range });
    } else if (verdict === 'unsatisfied') {
      problems.push({
        workspace: workspaceName,
        dependency: `${depName}@${depManifest.version}`,
        peer: peerName,
        wanted: range,
        installed,
      });
    }
  }
};

const checkWorkspace = (dir) => {
  const manifest = readManifest(join(dir, 'package.json'));
  if (!manifest) return;
  const declared = {
    ...(manifest.dependencies ?? {}),
    ...(manifest.devDependencies ?? {}),
  };
  for (const depName of Object.keys(declared)) {
    checkDependency(manifest.name ?? dir, dir, depName);
  }
};

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  for (const dir of workspaces()) checkWorkspace(dir);
}

const report = () => {
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(problems, null, 2));
  }

  for (const u of unparseable) {
    console.log(
      `note: ${u.dependency} declares an unparseable peer range for ${u.peer} (${u.range}); skipped`
    );
  }

  if (problems.length === 0) {
    console.log('peer dependencies: all satisfied');
    return 0;
  }

  console.error(`\n${problems.length} unsatisfied peer dependency(ies):\n`);
  for (const p of problems) {
    console.error(`  ${p.workspace}`);
    console.error(`    ${p.dependency} needs ${p.peer}@${p.wanted}`);
    console.error(`    installed: ${p.peer}@${p.installed}\n`);
  }
  console.error(
    'Align the version in the workspace package.json, or add a justified entry to\n' +
      'ALLOWED in scripts/ci/check-peer-deps.mjs.\n'
  );
  return 1;
};

if (isMain) {
  process.exit(report());
}
