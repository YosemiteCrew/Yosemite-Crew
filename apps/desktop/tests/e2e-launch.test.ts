'use strict';

import fs from 'node:fs';
import path from 'node:path';
import {
  APP_ROOT,
  ELECTRON_EXECUTABLE,
  MOCK_KEYCHAIN_SWITCH,
  electronLaunchOptions,
} from './e2e/launch';

const E2E_DIR = path.join(__dirname, 'e2e');

const specSources = (): Array<{ name: string; source: string }> =>
  fs
    .readdirSync(E2E_DIR)
    .filter((name) => name.endsWith('.e2e.ts'))
    .map((name) => ({ name, source: fs.readFileSync(path.join(E2E_DIR, name), 'utf8') }));

describe('e2e Electron launch options', () => {
  it('launches the app root with the mock keystore switch', () => {
    const { executablePath, args } = electronLaunchOptions();

    expect(executablePath).toBe(ELECTRON_EXECUTABLE);
    // Spelled out rather than compared against the exported constant: a
    // fixture built from the constant cannot pin the constant, and Chromium
    // ignores an unknown switch silently.
    expect(args).toEqual([APP_ROOT, '--use-mock-keychain']);
    expect(MOCK_KEYCHAIN_SWITCH).toBe('--use-mock-keychain');
  });

  it('keeps node flags ahead of the app root', () => {
    const recorder = path.join('/tmp', 'record-shortcuts.js');

    expect(electronLaunchOptions({ nodeArgs: ['-r', recorder] }).args).toEqual([
      '-r',
      recorder,
      APP_ROOT,
      '--use-mock-keychain',
    ]);
  });

  // The switch only holds if EVERY spec gets it. One spec that assembles its
  // own argv is one spec that hangs forever at electron.launch on a machine
  // whose "<product> Safe Storage" keychain item was written by a different
  // build - with a bare timeout and an empty trace. See issue #3422.
  it('is how every spec in the suite launches Electron', () => {
    const launching = specSources().filter(({ source }) => source.includes('electron.launch('));

    // A filter over an empty list reports no offenders, so the check would
    // pass on a suite this guard could not see. Pin that it saw specs at all.
    expect(launching.length).toBeGreaterThan(0);

    const offenders = launching
      .filter(
        ({ source }) =>
          !source.includes('electronLaunchOptions(') || source.includes('executablePath:')
      )
      .map(({ name }) => name);

    expect(offenders).toEqual([]);
  });
});
