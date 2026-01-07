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
  // Use React Native's resolver so platform extensions (.ios/.android) resolve correctly
  resolver: require.resolve('react-native/jest/resolver'),
  setupFiles: [
    '<rootDir>/jest.setup-before-env.js',
  ],
  setupFilesAfterEnv: [
    // Load RN's setup after env so it is transformed by Babel (ESM in RN >=0.81)
    'react-native/jest/setup',
    './node_modules/@react-native-documents/picker/jest/build/jest/setup.js',
    '<rootDir>/jest.setup.js',
  ],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', {configFile: './babel.config.js'}],
  },
  // Allow RN and related packages to be transformed, even within pnpm's virtual store
  transformIgnorePatterns: [
    'node_modules/(?!(\\.pnpm/[^/]+/node_modules/)?(react|react-dom|react-native|react-native-blob-util|@react-native|@react-native-community|@react-native-documents|react-clone-referenced-element|@react-navigation|react-native-gesture-handler|react-native-reanimated|react-native-worklets|react-native-safe-area-context|react-native-screens|react-native-vector-icons|@react-native-async-storage|@react-native-firebase|react-redux|redux|@reduxjs|immer|@callstack/liquid-glass|uuid|stream-chat-react-native|react-native-markdown-package|react-native-url-polyfill|mime)/)'
  ],
  moduleFileExtensions: [
    'ios.js',
    'android.js',
    'native.js',
    'ts',
    'tsx',
    'js',
    'jsx',
    'json',
    'node',
  ],
  moduleNameMapper: {
    // Support `@/` alias used by babel-plugin-module-resolver
    '^@/(.*)$': '<rootDir>/src/$1',
    // Redirect any relative `setup/mockTheme` imports to the shared test helper
    '.*/setup/mockTheme$': '<rootDir>/__tests__/setup/mockTheme.ts',
    // Mock amplify_outputs.json (gitignored file, safe mock for CI/CD)
    '^.*/amplify_outputs\\.json$': '<rootDir>/__mocks__/amplify_outputs.json',
    // Stub asset imports if needed
    '\\.(svg)$': '<rootDir>/__mocks__/svgMock.js',
    '\\.(png|jpg|jpeg|gif|webp|bmp)$': '<rootDir>/__mocks__/fileMock.js',
    '^react-native/Libraries/Image/Image$': 'react-native/Libraries/Image/Image.ios.js',
    '^react-native-permissions$': '<rootDir>/__mocks__/react-native-permissions.ts',
    '^@react-native-community/datetimepicker$': '<rootDir>/__mocks__/@react-native-community/datetimepicker.js',
    '^@react-native-community/geolocation$': '<rootDir>/__mocks__/react-native-geolocation.js',
    '^react-native-webview$': '<rootDir>/__mocks__/react-native-webview.js',
    '^react-native-pdf$': '<rootDir>/__mocks__/react-native-pdf.js',
    '^react-native-calendar-events$': '<rootDir>/__mocks__/react-native-calendar-events.js',
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/android/',
    '<rootDir>/ios/',
    '<rootDir>/coverage/',
    '<rootDir>/__tests__/setup/',
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
  // `text` reporter prints a huge table; keep a concise summary by default.
  coverageReporters: ['lcov', 'text-summary', 'html', 'json-summary'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/android/',
    '/ios/',
    '/__tests__/',
    '/coverage/',
  ],
  // Ensure lingering native timers/handles from mocks don't hang the runner
  forceExit: true,
};
