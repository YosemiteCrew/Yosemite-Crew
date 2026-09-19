#!/usr/bin/env node
// React Native ships a renderer that refuses to run against a `react` it was not
// built for, and the refusal is a throw at startup, not a build error:
//
//   var isomorphicReactPackageVersion = React.version;
//   if ("19.1.4" !== isomorphicReactPackageVersion)
//     throw Error('Incompatible React versions: ...')
//
// Because the comparison is against a literal baked into the renderer bundle, a
// PATCH breaks it exactly as a minor does. Nothing else in CI can see it: the
// declared peer range is not violated so the install is clean, jest never mounts
// through the native renderer, and the release workflow builds and uploads the
// app without launching it. The app installs, launches, and terminates before
// its first screen.
//
// `.github/dependabot.yml` holds `react` and `react-dom` for that reason, but an
// ignore entry is a version-update rule only - every block in that file sets
// `target-branch`, which carves security updates out of the block as a unit - so
// an advisory can still open a bump, and a hand-written change was never covered
// at all. This is the check that does not depend on how the bump arrives (#3345).
//
//   node scripts/mobile/check-react-renderer-pin.mjs
//
// Exit 1: the versions disagree. Exit 2: the check could not run, which is a
// failure for the same reason - an unrunnable gate has not been passed.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const root = join(dirname(process.argv[1]), '../../apps/mobileAppYC');

// The Paper renderer is the bundle that carries the compare. ReactFabric-prod.js
// has no equivalent guard (measured: 0 occurrences of the error text), so reading
// it instead would produce a check that can never fail.
export const RENDERER =
  'node_modules/react-native/Libraries/Renderer/implementations/ReactNativeRenderer-prod.js';

const THROW_MESSAGE = 'Incompatible React versions';
// Long enough to contain the compare and the assignment above it in the real
// bundle (measured: 78 characters between them), short enough that unrelated
// code cannot reach in.
const WINDOW = 400;

/**
 * The react version the renderer bundle was built against.
 *
 * Anchored on the thrown message rather than on the surrounding variable name:
 * the bundle is minified, so the identifier is the part most likely to be
 * renamed between releases, while the message is user-facing text. Only the
 * short run of source immediately before the message is searched, so an
 * unrelated version comparison elsewhere in a 350 KB bundle cannot be read as
 * this one.
 *
 * Returns null - never a guess - when the shape is not found OR when the window
 * holds more than one candidate. Callers must treat null as "cannot run" rather
 * than "nothing to report": an ambiguous read is how this check would go on
 * reporting green against the wrong literal.
 */
export const rendererExpectation = (source) => {
  const at = source.indexOf(THROW_MESSAGE);
  if (at === -1) return null;
  const window = source.slice(Math.max(0, at - WINDOW), at);
  const compare = /["']([0-9][^"']*)["']\s*!==|!==\s*["']([0-9][^"']*)["']/g;
  const candidates = new Set([...window.matchAll(compare)].map((m) => m[1] ?? m[2]));
  return candidates.size === 1 ? [...candidates][0] : null;
};

const RANGE = /[\^~><*]|\bx\b/;

/**
 * Everything wrong with the react pin, in the order a reader should act on it.
 *
 * `declared` is checked for exactness as well as for value: a range pin is how a
 * hold stops holding without anyone editing the version - `^19.1.4` admits every
 * later 19.x, so the next unrelated lockfile refresh can move react on its own.
 */
export const problems = ({ declared, installed, expected }) => {
  const found = [];
  if (RANGE.test(declared)) {
    found.push(
      `apps/mobileAppYC/package.json pins react as "${declared}", which is a range. ` +
        'It must be an exact version, or react can move without anyone changing this file'
    );
  }
  if (installed !== expected) {
    found.push(
      `react ${installed} is installed but react-native's bundled renderer was built ` +
        `against ${expected}. The release app throws "${THROW_MESSAGE}" at startup ` +
        'and terminates before its first screen'
    );
  }
  if (!RANGE.test(declared) && declared !== installed) {
    found.push(
      `apps/mobileAppYC/package.json pins react to ${declared} but ${installed} is ` +
        'installed, so the lockfile has drifted from the pin'
    );
  }
  return found;
};

// Exit early when imported by the tests rather than run.
if (process.argv[1] && resolve(process.argv[1]).endsWith('check-react-renderer-pin.mjs')) {
  const cannotRun = (why) => {
    console.error(`::error::react renderer pin check could not run: ${why}`);
    process.exit(2);
  };

  const rendererPath = join(root, RENDERER);
  const reactManifest = join(root, 'node_modules/react/package.json');
  const appManifest = join(root, 'package.json');

  if (!existsSync(rendererPath)) {
    cannotRun(`${RENDERER} is missing. Run pnpm install before this check`);
  }
  if (!existsSync(reactManifest)) {
    cannotRun('node_modules/react/package.json is missing. Run pnpm install before this check');
  }

  const expected = rendererExpectation(readFileSync(rendererPath, 'utf8'));
  if (expected === null) {
    cannotRun(
      `no single version comparison found in ${RENDERER} - the source just before the ` +
        'throw held either none or more than one, and a guess between two is exactly ' +
        'what this check must not make. React Native may have changed the guard: ' +
        'confirm the version by hand, then update rendererExpectation'
    );
  }

  const installed = JSON.parse(readFileSync(reactManifest, 'utf8')).version;
  const declared = JSON.parse(readFileSync(appManifest, 'utf8')).dependencies?.react;
  if (!declared) {
    cannotRun('apps/mobileAppYC/package.json declares no react dependency');
  }

  const found = problems({ declared, installed, expected });
  if (found.length > 0) {
    for (const problem of found) console.error(`::error::${problem}`);
    process.exit(1);
  }
  console.log(
    `react ${installed} matches the ${expected} baked into react-native's renderer, ` +
      `and is pinned exactly as ${declared}.`
  );
}
