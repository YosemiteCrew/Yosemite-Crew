// apps/mobileAppYC/metro.config.js
const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..', '..');

const extraNodeModules = new Proxy(
  {},
  {
    get: (_target, name) => path.join(projectRoot, 'node_modules', name),
  },
);

module.exports = mergeConfig(getDefaultConfig(projectRoot), {
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
  },
});
