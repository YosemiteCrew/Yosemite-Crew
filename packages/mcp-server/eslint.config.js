import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      'eslint.config.js',
      'jest.config.cjs',
      'test/**',
    ],
  },
  ...tseslint.config(eslint.configs.recommended, tseslint.configs.recommendedTypeChecked, {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  }),
];
