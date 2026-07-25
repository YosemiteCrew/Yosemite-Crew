// Jest early setup: mock AsyncStorage before modules load.
// This ensures redux-persist gets a storage implementation whose
// methods return Promises during module initialization.

// React 19 reports errors it catches outside a boundary through
// `reportGlobalError`, which prefers a global `reportError` and otherwise
// builds a `window.ErrorEvent` and calls `window.dispatchEvent`. Jest 30's node
// environment exposes ErrorEvent but its `window` is a plain object with no
// dispatchEvent, so that fallback throws "window.dispatchEvent is not a
// function" and the useless TypeError lands on whichever test is running.
// React captures reportGlobalError at module load, so this has to be a
// setupFiles entry, not setupFilesAfterEnv.
if (typeof globalThis.reportError !== 'function') {
  globalThis.reportError = error => {
    console.error(error);
  };
}

// Reduce very noisy warnings that occur during third-party setup files.
const originalConsoleWarn = console.warn.bind(console);
console.warn = (...args) => {
  const first = args[0];
  if (
    typeof first === 'string' &&
    first.includes(
      'Unable to resolve ../../../lib/commonjs/spec/NativeDocumentPicker',
    )
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
