import type { Config } from 'jest';
import nextJest from 'next/jest';

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig: Config = {
  transformIgnorePatterns: [
    '/node_modules/(?!(@iconify/react)/)',
    '^.+\\.module\\.(css|sass|scss)$',
  ],
  

  // A file to run before each test file
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  // Use jsdom for a browser-like environment
  testEnvironment: 'jest-environment-jsdom',

  // Handle module aliases
  moduleNameMapper: {
    // Handle Next.js aliases
    '^@/(.*)$': '<rootDir>/src/$1',
    // Handle local monorepo packages
    '^@yosemite-crew/fhir$': '<rootDir>/../../packages/fhir/src',
    '^@yosemite-crew/types$': '<rootDir>/../../packages/types/src',
  },

  // --- Options from your original config file ---
  clearMocks: true,
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageProvider: 'v8',
};

// createJestConfig is exported this way to ensure next/jest can load the Next.js config
export default createJestConfig(customJestConfig);

