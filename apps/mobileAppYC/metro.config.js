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
      const appModulePath = path.join(projectRoot, 'node_modules', name);
      if (fs.existsSync(appModulePath)) return appModulePath;
      return path.join(workspaceRoot, 'node_modules', name);
    },
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
