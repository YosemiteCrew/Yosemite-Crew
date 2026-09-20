/**
 * REACT AND THE RENDERER REACT NATIVE SHIPS MUST BE THE SAME VERSION, EXACTLY.
 *
 * `react-native@0.81.6` declares `peerDependencies.react: ^19.1.4`, so a bump
 * to 19.3.0 satisfies the range and nothing refuses it. The renderer React
 * Native ships enforces something narrower. In
 * `Libraries/Renderer/implementations/ReactNativeRenderer-prod.js` the check is
 * a literal string compare against the version the renderer was built on:
 *
 *   if ("19.1.4" !== isomorphicReactPackageVersion) throw Error(
 *     'Incompatible React versions: The "react" and "react-native-renderer"
 *      packages must have the exact same version...')
 *
 * That threw on the first render of the iOS Release build and the app
 * terminated before its first screen, with nothing in CI able to see it: jest
 * never mounts through the native renderer, the peer range is not violated so
 * the install is clean, and the release workflow builds and uploads the app
 * without launching it.
 *
 * So the comparison the renderer makes at runtime is made here instead, off
 * the same two files a device would load. A patch is as fatal as a minor -
 * 19.1.5 fails this exactly as 19.3.0 did.
 */

import {createRequire} from 'node:module';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '..', '..');

// jest's resolver is configured for React Native; the question here is which
// files a native bundle would load, so package resolution goes through node.
const nodeRequire = createRequire(path.join(projectRoot, 'package.json'));

const reactNativeRoot = path.dirname(
  nodeRequire.resolve('react-native/package.json'),
);
const implementationsDir = path.join(
  reactNativeRoot,
  'Libraries',
  'Renderer',
  'implementations',
);

// `var isomorphicReactPackageVersion = React.version;` sits above it in every
// build flavour that carries the guard.
const GUARD = /if \("([^"]+)" !== isomorphicReactPackageVersion\)/g;

const versionsRequiredBy = (file: string): string[] => {
  const source = readFileSync(path.join(implementationsDir, file), 'utf8');
  return [...source.matchAll(GUARD)].map(match => match[1]);
};

describe('react and react-native-renderer', () => {
  const installedReactVersion = nodeRequire('react/package.json')
    .version as string;

  const rendererFiles = existsSync(implementationsDir)
    ? readdirSync(implementationsDir).filter(file => file.endsWith('.js'))
    : [];

  const guarded = rendererFiles.filter(
    file => versionsRequiredBy(file).length > 0,
  );

  it('ships renderer builds that carry the version guard', () => {
    // Without this the suite passes by finding nothing - a moved directory or a
    // renamed guard would read as agreement instead of as an unread file.
    expect(rendererFiles.length).toBeGreaterThan(0);
    expect(guarded.length).toBeGreaterThan(0);
  });

  it.each(guarded)('%s is built on the installed react', file => {
    const required = versionsRequiredBy(file);
    expect(required.length).toBe(1);
    expect(required[0]).toBe(installedReactVersion);
  });

  it('pins react to a single version, not a range', () => {
    // `^19.1.4` would let an install resolve 19.3.0 on its own, with no commit
    // to review and no dependabot PR to hold back.
    const manifest = JSON.parse(
      readFileSync(path.join(projectRoot, 'package.json'), 'utf8'),
    );
    expect(manifest.dependencies.react).toBe(installedReactVersion);
    expect(manifest.devDependencies['react-test-renderer']).toBe(
      installedReactVersion,
    );
  });
});
