/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/?(*.)+(spec|test).ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        // The package itself compiles with module NodeNext (ESM), but jest
        // runs the transformed sources as CommonJS, matching how
        // apps/backend runs ts-jest. Inline options keep the two concerns
        // separate.
        tsconfig: {
          target: 'ES2022',
          module: 'commonjs',
          moduleResolution: 'node',
          esModuleInterop: true,
          strict: true,
          skipLibCheck: true,
          types: ['node', 'jest'],
          isolatedModules: true,
        },
        diagnostics: false,
      },
    ],
  },
};
