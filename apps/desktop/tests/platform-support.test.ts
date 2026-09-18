import fs from 'node:fs';
import path from 'node:path';

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

describe('supported platforms', () => {
  it('declares the macOS 13 Ventura floor that Electron 44 requires', () => {
    // electron-builder writes this into Info.plist as LSMinimumSystemVersion, so
    // macOS 12 and older refuse to open the app with a system message instead of
    // it crashing at launch. See issue #3260.
    expect(pkg.build.mac.minimumSystemVersion).toBe('13.0');
  });

  it('pins that floor to the Electron major it was read from', () => {
    // The configured key overrides the LSMinimumSystemVersion that ships inside
    // Electron.app, so a later Electron that raises its floor would otherwise
    // be packaged still claiming 13.0. When this fails, read the key from the
    // new Electron.app/Contents/Info.plist, then update mac.minimumSystemVersion,
    // the "Supported platforms" section of the README and both tests here.
    expect(pkg.devDependencies.electron).toMatch(/^\D*44\./);
  });
});
