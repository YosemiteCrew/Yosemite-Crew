/**
 * Jest configuration for React Native (RN 0.81) inside a pnpm monorepo.
 * Key points:
 * - Use RN preset for environment + transforms
 * - Explicitly transform RN and related packages from node_modules (pnpm layout)
 * - Avoid RN's ESM setup in `setupFiles` by replacing with local setup run after env
 */
module.exports = {
  // Use RN's test environment without importing its ESM setup file
  testEnvironment: require.resolve('react-native/jest/react-native-env.js'),
  setupFiles: [],
  setupFilesAfterEnv: [
    // Load RN's setup after env so it is transformed by Babel (ESM in RN >=0.81)
    'react-native/jest/setup',
    '<rootDir>/jest.setup.js',
  ],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': [
      'babel-jest',
      {presets: ['module:@react-native/babel-preset']},
    ],
  },
  // Allow RN and related packages to be transformed, even within pnpm's virtual store
  transformIgnorePatterns: [
    'node_modules/(?!(\\.pnpm/[^/]+/node_modules/)?(react|react-dom|react-native|@react-native|@react-native-community|react-clone-referenced-element|@react-navigation|react-native-gesture-handler|react-native-reanimated|react-native-worklets|react-native-safe-area-context|react-native-screens|react-native-vector-icons|@react-native-async-storage|@react-native-firebase|react-redux|redux|@reduxjs|immer|@callstack/liquid-glass)/)'
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    // Support `@/` alias used by babel-plugin-module-resolver
    '^@/(.*)$': '<rootDir>/src/$1',
    // Stub asset imports if needed
    '\\.(svg)$': '<rootDir>/__mocks__/svgMock.js',
    '\\.(png|jpg|jpeg|gif|webp|bmp)$': '<rootDir>/__mocks__/fileMock.js',
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/android/',
    '<rootDir>/ios/',
    '<rootDir>/coverage/',
  ],
  watchPathIgnorePatterns: [
    '<rootDir>/node_modules/.pnpm/',
    '<rootDir>/.jest-cache/',
  ],
  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{ts,tsx,js,jsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx,js,jsx}',
    '!src/**/*.spec.{ts,tsx,js,jsx}',
    '!**/node_modules/**',
    '!**/vendor/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['lcov', 'text', 'html', 'json-summary'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/android/',
    '/ios/',
    '/__tests__/',
    '/coverage/',
  ],
};
