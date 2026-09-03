/** @type {import('ts-jest').JestConfigWithTsJest} */

/*
 * Tests compile to CommonJS even though the package ships ESM.
 *
 * ts-jest's ESM transpiler reaches for TypeScript's JSDocParsingMode.ParseAll,
 * which only exists from TS 5.3. This repo pins typescript 5.0.4 everywhere, so
 * the ESM preset dies with "Cannot read properties of undefined (reading
 * 'ParseAll')" before a single test runs. Compiling to CJS for tests avoids
 * that path without skewing the TypeScript version for one package.
 *
 * The build is unaffected: tsconfig.build.json still emits NodeNext ESM, which
 * is what actually ships and what the stdio entry point needs.
 */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/test"],
  testMatch: ["**/?(*.)+(spec|test).ts"],
  // Source imports carry explicit .js specifiers, required by NodeNext at
  // runtime; strip them so Jest resolves the .ts files.
  moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      { tsconfig: { module: "CommonJS", moduleResolution: "Node", isolatedModules: true } },
    ],
  },
  collectCoverageFrom: ["<rootDir>/src/**/*.ts", "!<rootDir>/src/index.ts"],
  coverageDirectory: "<rootDir>/coverage",
};
