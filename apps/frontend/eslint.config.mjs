import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [
      '.next/**',
      'coverage/**',
      'playwright-report/**',
      'storybook-static/**',
      'test-results/**',
      'public/dev-docs/**',
      'next-env.d.ts',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'react/display-name': 'off',
      // Auth boundary guard (#1672): the legacy provider SDK is gone.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['amazon-cognito-identity-js', 'amazon-cognito-identity-js/*'],
              message: 'The legacy auth provider SDK was decommissioned (#1672).',
            },
          ],
        },
      ],
    },
  },
  {
    // Test files mock next/image with a raw <img> (you cannot mock next/image
    // with itself), so this production-image performance rule is a false
    // positive here. It stays enforced in app code.
    files: ['**/__tests__/**', '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    rules: {
      '@next/next/no-img-element': 'off',
    },
  },
];

export default eslintConfig;
