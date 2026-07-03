import eslint from "@eslint/js";
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
