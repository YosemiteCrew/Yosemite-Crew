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
  // Metro's babel transformer sets BABEL_ENV to 'production' for release bundles
  // (options.dev === false), so this only strips console calls from release builds.
  // `error`/`warn` are kept to match the console-silencing block in App.tsx, which
  // preserves them for crash diagnostics.
  env: {
    production: {
      plugins: [['transform-remove-console', {exclude: ['error', 'warn']}]],
    },
  },
};
