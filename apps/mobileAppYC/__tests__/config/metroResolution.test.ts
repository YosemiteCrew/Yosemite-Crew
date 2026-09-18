/**
 * THE BUNDLER MUST LET A PACKAGE RESOLVE ITS OWN DECLARED DEPENDENCY.
 *
 * `.npmrc` sets `shamefully-hoist=true`, so the workspace root holds one copy
 * of every transitive dependency in the repo - including packages that only
 * server-side workspaces need. A nested package keeps its own copy at its own
 * version, and the two disagree often.
 *
 * Metro only sees the nested copy if it is allowed to walk up from the module
 * doing the requiring. Turning that walk off and supplying an
 * `extraNodeModules` Proxy that answers for every name replaces every nested
 * dependency with the root's single hoisted version. That is how the release
 * bundle broke: stream-chat-react-native declares mime ^4.0.7, the root copy
 * was the 1.6.0 that server-side packages pull in, and 1.6.0 opens with
 * `require('fs')`, which React Native has no equivalent for.
 *
 * `react` and `react-native` genuinely must be one copy, and those stay pinned.
 * Nothing else may be.
 */

import {createRequire} from 'node:module';
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import path from 'node:path';

const metroConfig = require('../../metro.config.js');

const projectRoot = path.resolve(__dirname, '..', '..');
const workspaceRoot = path.resolve(projectRoot, '..', '..');

// jest's resolver is configured for React Native, so package metadata is read
// through node's own resolution instead - the question here is what is on disk.
const nodeRequire = createRequire(path.join(projectRoot, 'package.json'));

const {extraNodeModules, disableHierarchicalLookup} = metroConfig.resolver;

const majorOf = (version: string) => version.split('.')[0];

const versionAt = (dir: string): string | undefined => {
  const manifest = path.join(dir, 'package.json');
  if (!existsSync(manifest)) return undefined;
  try {
    return JSON.parse(readFileSync(manifest, 'utf8')).version;
  } catch {
    return undefined;
  }
};

/**
 * Where a package's own dependencies sit.
 *
 * Not `<pkg>/node_modules`: pnpm lays a package out as
 * `.pnpm/<pkg>@<ver>_<hash>/node_modules/<pkg>/`, and puts that package's
 * dependencies beside it in the same `node_modules` directory rather than
 * inside it. Looking only inside is how the first version of this test found
 * nothing at all and its control caught it. A scoped package sits one level
 * deeper, so walk up to the nearest `node_modules` instead of counting levels.
 */
const dependencyDirOf = (packageDir: string): string | undefined => {
  let current = packageDir;
  for (let i = 0; i < 4; i++) {
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    if (path.basename(parent) === 'node_modules') return parent;
    current = parent;
  }
  return undefined;
};

/**
 * Names where a package's own copy and the root's hoisted copy are different
 * majors.
 *
 * Scoped to the direct dependencies of this app, which is enough to make the
 * point without walking the whole graph. `mime` is the member that broke the
 * bundle, but the list is derived from the installed tree rather than written
 * out, so it keeps working when the offending pair changes.
 */
const divergentNames = (): string[] => {
  const manifest = JSON.parse(
    readFileSync(path.join(projectRoot, 'package.json'), 'utf8'),
  );
  const direct = Object.keys(manifest.dependencies ?? {});
  const found = new Set<string>();

  for (const dep of direct) {
    let depDir: string;
    try {
      depDir = path.dirname(nodeRequire.resolve(`${dep}/package.json`));
    } catch {
      continue; // not every package exposes its manifest as a subpath
    }
    const nested = dependencyDirOf(depDir);
    if (!nested || !existsSync(nested)) continue;

    for (const entry of readdirSync(nested)) {
      if (entry.startsWith('.')) continue;
      const names = entry.startsWith('@')
        ? readdirSync(path.join(nested, entry)).map(sub => `${entry}/${sub}`)
        : [entry];

      for (const name of names) {
        const nestedVersion = versionAt(path.join(nested, name));
        const rootVersion = versionAt(
          path.join(workspaceRoot, 'node_modules', name),
        );
        if (!nestedVersion || !rootVersion) continue;
        if (majorOf(nestedVersion) !== majorOf(rootVersion)) found.add(name);
      }
    }
  }
  return [...found].sort();
};

describe('metro resolution in the pnpm workspace', () => {
  it('pins react and react-native to this app so only one copy is bundled', () => {
    for (const name of ['react', 'react-native']) {
      expect(extraNodeModules[name]).toBe(
        path.join(projectRoot, 'node_modules', name),
      );
    }
  });

  // THE guard. The assertion above passes whether the Proxy is a whitelist or a
  // catch-all, because a catch-all returns the same two paths for these two
  // names - so on its own it would not notice the catch-all coming back.
  it('claims no other module name, so nested dependencies resolve normally', () => {
    const diverging = divergentNames();

    // The control. With an empty list this test asserts nothing at all, and
    // would keep passing after someone restored a catch-all Proxy.
    expect(diverging.length).toBeGreaterThan(0);

    for (const name of diverging) {
      expect(extraNodeModules[name]).toBeUndefined();
    }
  });

  it('leaves the upward node_modules walk on', () => {
    // A configuration pin rather than a behavioural proof: producing the real
    // failure means bundling the whole app, which is far too slow for this
    // suite. Setting this back to true is sufficient on its own to send every
    // nested dependency to the root's hoisted copy, whitelist or not, so the
    // value is worth holding still where a reviewer can see it.
    expect(disableHierarchicalLookup).not.toBe(true);
  });

  it('keeps the workspace root as a fallback rather than a first choice', () => {
    expect(metroConfig.resolver.nodeModulesPaths).toEqual([
      path.join(projectRoot, 'node_modules'),
      path.join(workspaceRoot, 'node_modules'),
    ]);
  });
});
