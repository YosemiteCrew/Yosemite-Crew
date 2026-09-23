/** @type {import('ts-jest').JestConfigWithTsJest} */

/*
 * Tests compile to CommonJS even though the package ships ESM, matching
 * packages/mcp-server. The build is unaffected: tsconfig.build.json still emits
 * NodeNext ESM.
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
