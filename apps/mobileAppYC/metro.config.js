// apps/mobileAppYC/metro.config.js
const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..', '..');

// Only the two packages that must resolve to exactly one copy. React throws at
// runtime if a second copy is loaded, and react-native's Haste names collide,
// so both are pinned to this app's own node_modules.
//
// It is deliberately a whitelist and not a catch-all. A Proxy that answered for
// every name redirected every transitive dependency of every nested package to
// whatever single version `shamefully-hoist` had put at the workspace root,
// which is not what those packages declare: stream-chat-react-native depends on
// mime ^4.0.7 and has 4.1.0 in its own node_modules, but the root copy is the
// 1.6.0 that server-side packages pull in, and 1.6.0 requires `fs`. That took
// the whole release bundle down with "Unable to resolve module fs". The loud
// failures need a Node builtin; the quiet ones just get the wrong major.
const PINNED_TO_ONE_COPY = ['react', 'react-native'];

const extraNodeModules = new Proxy(
  {},
  {
    get: (_target, name) =>
      PINNED_TO_ONE_COPY.includes(name)
        ? path.join(projectRoot, 'node_modules', name)
        : undefined,
    has: (_target, name) => PINNED_TO_ONE_COPY.includes(name),
  },
);

const defaultConfig = getDefaultConfig(projectRoot);

module.exports = mergeConfig(defaultConfig, {
  projectRoot,
  watchFolders: [workspaceRoot],
  resolver: {
    extraNodeModules,
    // Metro's default, stated because setting it to true is what made the
    // whitelist above insufficient on its own: with the upward walk disabled,
    // `extraNodeModules` and `nodeModulesPaths` are the only places Metro
    // looks, so it can never see a nested node_modules and every package gets
    // the root's hoisted copy. Leaving the walk on lets a package resolve its
    // own declared dependency, and the paths below remain the fallback.
    disableHierarchicalLookup: false,
    nodeModulesPaths: [
      path.join(projectRoot, 'node_modules'),
      path.join(workspaceRoot, 'node_modules'),
    ],
    unstable_enableSymlinks: true,
    // Bundle short looping .mp4 backgrounds (splash / onboarding) as assets.
    assetExts: [...defaultConfig.resolver.assetExts, 'mp4'],
  },
});
