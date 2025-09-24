const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const path = require('path');

/**
 * Metro configuration
 * <https://reactnative.dev/docs/metro>
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  resolver: {
    unstable_enableSymlinks: true, // this enable the use of Symlinks
  },
  // this specifies the folder where are located the node_modules for the project
  watchFolders: [path.join(__dirname, '..', '..')],
};
module.exports = mergeConfig(getDefaultConfig(__dirname), config);