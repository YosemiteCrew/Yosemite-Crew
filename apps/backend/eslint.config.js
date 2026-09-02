import eslint from "@eslint/js";
import sonarjs from "eslint-plugin-sonarjs";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "dist/**",
      "eslint.config.js",
      "src/scripts/**",
      "scripts/**",
      "jest.config.cjs",
      "src/middlewares/**",
      "src/utils/**",
      "test/**",
      "node_modules/",
      "dist/",
      "coverage/",
      ".scannerwork",
    ],
  },
  ...tseslint.config(
    eslint.configs.recommended,
    tseslint.configs.recommendedTypeChecked,
    {
      languageOptions: {
        parserOptions: {
          projectService: true,
          tsconfigRootDir: import.meta.dirname,
        },
      },
    },
  ),
  /*
    Sonar smells, locally (#2565). The backend gate runs with an issues ceiling
    of 0, so a single MAJOR smell blocks the merge - and until now the first
    sight of one was a red `sonar` check about ten minutes into CI.

    It is a proxy, not SonarCloud. Each rule turned off below was measured
    against this repo and shown to fire where SonarCloud does not; leaving them
    on would make `lint` red over findings the gate never raises, which teaches
    people to ignore the linter.
  */
  {
    ...sonarjs.configs.recommended,
    files: ["**/*.ts"],
  },
  {
    files: ["**/*.ts"],
    rules: {
      /* Fires on canonical system URIs, which are identifiers rather than
         requests: "http://snomed.info/sct" in clinical-terms.service.ts is a
         fixed string defined by SNOMED CT, and rewriting it to https breaks
         FHIR conformance. */
      "sonarjs/no-clear-text-protocols": "off",
      /* SonarCloud honours NOSONAR and eslint does not, so this reports the
         PassKit SHA-1 in wallet-pass.service.ts that already carries a NOSONAR
         and an explanation - Apple's manifest format mandates SHA-1. */
      "sonarjs/hashing": "off",
      // app.ts calls app.disable("x-powered-by") and mounts helmet.
      "sonarjs/x-powered-by": "off",
      // Duplicates @typescript-eslint's own unused-vars, already enforced.
      "sonarjs/no-unused-vars": "off",
      /* Warnings, not errors: SonarCloud does not raise these on this project,
         so failing the build on them would make `lint` red over findings the
         gate never asks about. They are left visible because some are worth
         looking at.

         different-types-comparison is the clearest example of why. It fires on
         `value === null` where the parameter is typed `value?: string | number
         | Date` - by the type, null is impossible, so the check "can never be
         true". These are controllers reading untrusted input, where a null very
         much can arrive at runtime, so the check is correct and the type is
         simply narrower than reality. */
      "sonarjs/different-types-comparison": "warn",
      "sonarjs/function-return-type": "warn",
      "sonarjs/use-type-alias": "warn",
      "sonarjs/no-redundant-optional": "warn",
    },
  },
  {
    /* The one remaining deprecation is documenso.documents.createV0, which
       already carries a NOSONAR and an explanation there - SonarCloud honours
       that comment and eslint does not. Migrating it is #2643, and it cannot be
       verified without a live Documenso instance, so it is scoped off here
       rather than suppressed inline. Delete this block when #2643 lands. */
    files: ["src/services/documenso.service.ts"],
    rules: {
      "sonarjs/deprecation": "off",
    },
  },
  {
    // Auth boundary guard (#1672): product code must use the provider-neutral
    // boundary from @yosemite-crew/auth. Provider SDKs may only be imported
    // inside packages/auth providers/ (and the migration tool under scripts/,
    // which is outside src/).
    files: ["src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["supertokens-node", "supertokens-node/*"],
              message:
                "Import the provider-neutral boundary from @yosemite-crew/auth instead of the SuperTokens SDK.",
            },
            {
              group: [
                "amazon-cognito-identity-js",
                "@aws-sdk/client-cognito-identity-provider",
                "aws-jwt-verify",
              ],
              message:
                "The legacy auth provider SDKs were decommissioned (#1672).",
            },
          ],
        },
      ],
    },
  },
];
