// apps/mobileAppYC/metro.config.js
const path = require('path');
const fs = require('fs');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..', '..');

const extraNodeModules = new Proxy(
  {},
  {
    get: (_target, name) => {
      if (name === 'react' || name === 'react-native') {
        return path.join(projectRoot, 'node_modules', name);
      }
      const appModuleBase = path.resolve(projectRoot, 'node_modules');
      const appModulePath = path.resolve(appModuleBase, name);
      const appModuleRelative = path.relative(appModuleBase, appModulePath);
      if (!appModuleRelative.startsWith('..') && !path.isAbsolute(appModuleRelative) && fs.existsSync(appModulePath)) return appModulePath;
      return path.join(workspaceRoot, 'node_modules', name);
    },
  },
);

const defaultConfig = getDefaultConfig(projectRoot);

module.exports = mergeConfig(defaultConfig, {
  projectRoot,
  watchFolders: [workspaceRoot],
  resolver: {
    extraNodeModules,
    disableHierarchicalLookup: true,
    nodeModulesPaths: [
      path.join(projectRoot, 'node_modules'),
      path.join(workspaceRoot, 'node_modules'),
    ],
    unstable_enableSymlinks: true,
    // Bundle short looping .mp4 backgrounds (splash / onboarding) as assets.
    assetExts: [...defaultConfig.resolver.assetExts, 'mp4'],
  },
});
