// eslint-config-next ships flat configs from v16, so these are imported
// directly rather than bridged through FlatCompat. The bridge cannot be used
// any more: @eslint/eslintrc validates whatever it loads by JSON.stringify-ing
// it, and v16 exposes live plugin objects, which are circular.
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import sonarjs from 'eslint-plugin-sonarjs';

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
  ...nextCoreWebVitals,
  ...nextTypescript,
  /*
    Sonar smells, locally (#2565). The plugin was a declared dependency that no
    config referenced, so the first sight of a smell was a red `sonar` check on
    the PR - about ten minutes of CI to learn something eslint can say in under a
    second. The backend gate runs with an issues ceiling of 0, so one MAJOR smell
    blocks the merge.

    It is a proxy, not SonarCloud. The rules turned off below were each measured
    against this repo and shown to fire where SonarCloud does not; leaving them on
    would make `lint` red over findings the gate does not raise, which teaches
    people to ignore it.
  */
  {
    ...sonarjs.configs.recommended,
    files: ['**/*.ts', '**/*.tsx'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // Duplicates @typescript-eslint/no-unused-vars, which is already 'error'
      // below with this repo's ^_ ignore patterns. Measured 60 duplicate reports.
      'sonarjs/no-unused-vars': 'off',
      /* Fires on canonical system URIs, which are identifiers rather than
         requests: 'http://snomed.info/sct' and 'http://www.whocc.no/atcvet' are
         fixed strings defined by those standards, and rewriting them to https
         breaks FHIR conformance. */
      'sonarjs/no-clear-text-protocols': 'off',
      /* SonarCloud honours NOSONAR and eslint does not, so this reports the
         PassKit SHA-1 in wallet-pass.service.ts that is already suppressed and
         explained there - Apple's manifest format mandates SHA-1. */
      'sonarjs/hashing': 'off',
      // The app calls app.disable('x-powered-by') and mounts helmet in app.ts.
      'sonarjs/x-powered-by': 'off',
      /* A warning rather than an error, per #2565's own guidance to land the
         config without blocking on a cleanup. Three call sites exceed the
         4-level nest, all React callbacks-in-callbacks. SonarCloud's frontend
         gate is green today, so it is not raising them, and refactoring three
         unrelated components is its own change rather than part of wiring up a
         linter. */
      'sonarjs/no-nested-functions': 'warn',
    },
  },
  {
    /* Test-file rules. sonar-project.properties sets sonar.test.inclusions, so
       SonarCloud analyses tests AS tests under a different rule set and raises
       none of these - measured 123 findings here against 0 on the real scan.
       Enforcing them locally would mean chasing a backlog the gate never asks
       for. */
    files: [
      '**/__tests__/**',
      '**/*.test.{ts,tsx}',
      '**/*.spec.{ts,tsx}',
      '**/*.stories.{ts,tsx}',
      'e2e/**',
      '.storybook/**',
    ],
    rules: {
      'sonarjs/no-skipped-tests': 'off',
      'sonarjs/hooks-before-test-cases': 'off',
      'sonarjs/no-invariant-returns': 'off',
      'sonarjs/no-empty-group': 'off',
      'sonarjs/reduce-initial-value': 'off',
      'sonarjs/assertions-in-tests': 'off',
      'sonarjs/prefer-specific-assertions': 'off',
      'sonarjs/no-trivial-assertions': 'off',
      'sonarjs/parameterized-tests': 'off',
      'sonarjs/no-nested-functions': 'off',
      'sonarjs/no-identical-functions': 'off',
      'sonarjs/no-hardcoded-passwords': 'off',
      'sonarjs/no-floating-point-equality': 'off',
      'sonarjs/no-extra-arguments': 'off',
      'sonarjs/void-use': 'off',
      'sonarjs/super-linear-regex': 'off',
      'sonarjs/no-nested-conditional': 'off',
      'sonarjs/no-globals-shadowing': 'off',
      'sonarjs/no-os-command-from-path': 'off',
      'sonarjs/cognitive-complexity': 'off',
      'sonarjs/regex-complexity': 'off',
      'sonarjs/no-unused-vars': 'off',
    },
  },
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
