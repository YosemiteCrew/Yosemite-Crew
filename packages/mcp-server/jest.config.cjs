/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/test"],
  testMatch: ["**/?(*.)+(spec|test).ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  collectCoverageFrom: [
    "<rootDir>/src/**/*.ts",
    // Entry point: stdio bootstrap wiring only, exercised via the real binary, not unit tests.
    "!<rootDir>/src/index.ts",
  ],
  coverageDirectory: "<rootDir>/coverage",
  coverageProvider: "v8",
  moduleNameMapper: {
    // The package is ESM (NodeNext) so source imports carry .js extensions;
    // strip them for ts-jest's CommonJS transform, same as apps/backend.
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        // Tests run as CommonJS regardless of the package's ESM build settings.
        tsconfig: {
          target: "ES2022",
          module: "commonjs",
          moduleResolution: "node",
          strict: true,
          skipLibCheck: true,
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          isolatedModules: true,
        },
        diagnostics: false,
      },
    ],
  },
};
