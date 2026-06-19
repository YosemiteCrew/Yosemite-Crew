module.exports = {
  root: true,
  extends: '@react-native',
  ignorePatterns: [
    'node_modules/',
    'babel.config.js',
    'metro.config.js',
    '.eslintrc.js',
    'jest.config.js',
    'jest.setup.js',
    'coverage/',
    'index.js',
    'react-native.config.js',
    'jest.setup-before-env.js',
  ],
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      rules: {
        // Allow intentionally-unused caught errors when named with a leading
        // underscore, matching the argsIgnorePattern: '^_' convention already
        // used by @react-native for unused arguments.
        '@typescript-eslint/no-unused-vars': [
          'error',
          {
            argsIgnorePattern: '^_',
            destructuredArrayIgnorePattern: '^_',
            caughtErrorsIgnorePattern: '^_',
          },
        ],
      },
    },
    {
      files: ['e2e/**/*.e2e.js'],
      env: {
        jest: true,
      },
      globals: {
        device: 'readonly',
        element: 'readonly',
        by: 'readonly',
      },
    },
  ],
};
