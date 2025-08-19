const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const {
  wrapWithReanimatedMetroConfig,
} = require('react-native-reanimated/metro-config');
const path = require('path');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const customConfig = {
  resolver: {
    unstable_enableSymlinks: true,
  },
  watchFolders: [path.join(__dirname, '..', '..')],
};

const mergedConfig = mergeConfig(getDefaultConfig(__dirname), customConfig);

module.exports = wrapWithReanimatedMetroConfig(mergedConfig);
