// Jest early setup: mock AsyncStorage before modules load.
// This ensures redux-persist gets a storage implementation whose
// methods return Promises during module initialization.
jest.mock('@react-native-async-storage/async-storage', () => {
  const asMock = require('@react-native-async-storage/async-storage/jest/async-storage-mock');
  // Ensure ES module shape so `import AsyncStorage from '...';` gets the mock as default
  return {
    __esModule: true,
    default: asMock,
    ...asMock,
  };
});
