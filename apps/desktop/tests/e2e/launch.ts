import electronPath from 'electron';
import path from 'node:path';

export const APP_ROOT = path.resolve(__dirname, '..', '..');
export const ELECTRON_EXECUTABLE = electronPath as unknown as string;

// Chromium's mock keystore, and the reason every spec in this suite launches
// through this module rather than building its own argv.
//
// src/main.ts calls app.setName(), so Electron's safeStorage keys the OS
// keychain on the product name: every checkout and every packaged build on one
// machine read the SAME "<product> Safe Storage" item. As soon as a second
// binary reads an item the first one wrote, macOS raises the keychain ACL
// confirmation dialog - and it raises it inside the synchronous
// SecItemCopyMatching that app.whenReady() performs before any window exists.
// The main thread then blocks in mach_msg indefinitely: no window, no DevTools
// endpoint, no log line. The port is open and never answers, so the spec dies
// at `electron.launch` with a bare "Test timeout of 30000ms exceeded" and a
// trace whose only entry is "BEFORE Launch electron". A fresh CI runner never
// sees it, because it creates the item itself and is therefore trusted for it.
//
// The mock keystore is a working keystore - safeStorage still reports
// encryption available and still round-trips, including across relaunches with
// the same profile - so the specs that assert encrypted-at-rest behaviour keep
// asserting it. What it does not do is touch the developer's login keychain.
//
// See issue #3422.
export const MOCK_KEYCHAIN_SWITCH = '--use-mock-keychain';

export type ElectronLaunchArgs = {
  // Node flags Electron must see before the app path, e.g. ['-r', preloadFile].
  nodeArgs?: readonly string[];
};

// Spread into electron.launch(); each spec still supplies its own `env`.
export const electronLaunchOptions = ({ nodeArgs = [] }: ElectronLaunchArgs = {}): {
  executablePath: string;
  args: string[];
} => ({
  executablePath: ELECTRON_EXECUTABLE,
  args: [...nodeArgs, APP_ROOT, MOCK_KEYCHAIN_SWITCH],
});
