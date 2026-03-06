// Jest early setup: mock AsyncStorage before modules load.
// This ensures redux-persist gets a storage implementation whose
// methods return Promises during module initialization.

// Reduce very noisy warnings that occur during third-party setup files.
const originalConsoleWarn = console.warn.bind(console);
console.warn = (...args) => {
  const first = args[0];
  if (
    typeof first === 'string' &&
    first.includes('Unable to resolve ../../../lib/commonjs/spec/NativeDocumentPicker')
  ) {
    return;
  }
  return originalConsoleWarn(...args);
};

jest.mock('@react-native-async-storage/async-storage', () => {
  const asMock = require('@react-native-async-storage/async-storage/jest/async-storage-mock');
  // Ensure ES module shape so `import AsyncStorage from '...';` gets the mock as default
  return {
    __esModule: true,
    default: asMock,
    ...asMock,
  };
});
