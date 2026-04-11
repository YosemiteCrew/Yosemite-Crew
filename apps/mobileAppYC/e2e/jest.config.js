module.exports = {
  testTimeout: 120000,
  testRunner: 'jest-circus/runner',
  testMatch: ['**/?(*.)+(e2e).[jt]s?(x)'],
  reporters: ['detox/runners/jest/reporter'],
  setupFilesAfterEnv: ['detox/runners/jest/setup'],
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  verbose: true,
};
