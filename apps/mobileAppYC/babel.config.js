module.exports = {
  presets: [
    ['module:@react-native/babel-preset', {enableBabelRuntime: '^7.25.0'}],
  ],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        extensions: ['.ios.js', '.android.js', '.js', '.ts', '.tsx', '.json'],
        alias: {
          '@': './src',
        },
      },
    ],
    'react-native-worklets/plugin',
  ],
};
