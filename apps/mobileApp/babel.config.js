module.exports = {
  presets: [
    'module:@react-native/babel-preset',
    '@babel/preset-typescript',
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
    'react-native-reanimated/plugin',
  ],
};