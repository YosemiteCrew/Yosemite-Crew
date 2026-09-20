import fs from 'node:fs';
import path from 'node:path';

// `apply-fuses.js` requires @electron/fuses at module scope and that package is
// ESM-only, so it cannot be loaded into this CJS suite for real. The factory
// below means jest never evaluates it: `FuseV1Options` only has to answer the
// computed member accesses the hook makes, and `flipFuses` is never called by
// the path tests. This is what lets `getExecutablePath` be exercised directly
// rather than only scanned as text.
jest.mock('@electron/fuses', () => ({
  flipFuses: jest.fn(),
  FuseVersion: { V1: '1' },
  FuseV1Options: new Proxy({}, { get: (_target, prop) => String(prop) }),
}));

interface FakeAfterPackContext {
  appOutDir: string;
  electronPlatformName: string;
  packager: { appInfo: { productFilename: string }; executableName?: string };
}

const { getExecutablePath } = jest.requireActual<{
  getExecutablePath: (context: FakeAfterPackContext) => string;
}>('../scripts/apply-fuses.js');

// electron-builder derives these two names from different fields: productFilename
// from `productName`, and the Linux packager's executableName from `name` (or an
// explicit `build.linux.executableName`). They are deliberately different here so
// that an assertion on one cannot pass by reading the other.
const OUT_DIR = '/tmp/out';
const PRODUCT_FILENAME = 'Product Filename';
const EXECUTABLE_NAME = 'executable-name';

const contextFor = (electronPlatformName: string): FakeAfterPackContext => ({
  appOutDir: OUT_DIR,
  electronPlatformName,
  packager: {
    appInfo: { productFilename: PRODUCT_FILENAME },
    executableName: EXECUTABLE_NAME,
  },
});

/**
 * `apply-fuses.js` sets `strictlyRequireAllFuses: true`, so @electron/fuses
 * refuses to build when a fuse is left unconfigured. That is the right default,
 * but the failure only surfaced at release time: the 2.1 bump added
 * `WasmTrapHandlers`, and the v0.1.0-beta.4 tag failed on both runners after the
 * signed-build jobs had already been approved and started.
 *
 * This turns it into a PR-time failure. The fuse list is read from the INSTALLED
 * package rather than hardcoded, so a bump that adds another fuse fails here.
 * It is read as text because @electron/fuses is ESM-only and this suite is CJS.
 */
describe('apply-fuses', () => {
  const desktopRoot = path.join(__dirname, '..');
  const source = fs.readFileSync(path.join(desktopRoot, 'scripts', 'apply-fuses.js'), 'utf8');
  const fuseTypes = fs.readFileSync(
    path.join(desktopRoot, 'node_modules', '@electron', 'fuses', 'dist', 'config.d.ts'),
    'utf8'
  );

  const declaredFuses = (): string[] => {
    const block = /export declare enum FuseV1Options \{([^}]*)\}/.exec(fuseTypes);
    if (!block) throw new Error('FuseV1Options enum not found in @electron/fuses types');
    return [...block[1]!.matchAll(/^\s*([A-Za-z0-9]+)\s*=/gm)].map((m) => m[1]!);
  };

  it('reads a non-empty fuse list from the installed package', () => {
    // Guards the regex above: if it ever matches nothing, the completeness
    // assertion below would pass vacuously.
    expect(declaredFuses().length).toBeGreaterThanOrEqual(8);
  });

  it('configures every fuse the installed @electron/fuses knows about', () => {
    const missing = declaredFuses().filter((name) => !source.includes(`FuseV1Options.${name}`));
    expect(missing).toEqual([]);
  });

  it('still requires all fuses explicitly', () => {
    // If this is relaxed the check above stops meaning anything: an
    // unconfigured fuse would take its default silently instead of failing.
    expect(source).toContain('strictlyRequireAllFuses: true');
  });
});

/**
 * Issue #3261. The hook computed the binary to flip fuses on from
 * `appInfo.productFilename` on every platform that is not macOS or Windows. On
 * Linux electron-builder renames the unpacked binary to the Linux packager's
 * `executableName` instead, so the hook named a file that does not exist and
 * @electron/fuses (which opens the path with no existence check) aborted every
 * `--linux` build with ENOENT. No CI job builds for Linux, so nothing caught it.
 */
describe('getExecutablePath', () => {
  it('uses the Linux packager executableName, not productFilename', () => {
    expect(getExecutablePath(contextFor('linux'))).toBe(path.join(OUT_DIR, EXECUTABLE_NAME));
  });

  it('never points at the productFilename path on Linux', () => {
    // The positive assertion above would still hold if someone made the two
    // names equal in config. This one fails on the original expression itself.
    expect(getExecutablePath(contextFor('linux'))).not.toBe(path.join(OUT_DIR, PRODUCT_FILENAME));
  });

  it.each(['darwin', 'mas'])('uses the %s .app bundle from productFilename', (platform) => {
    expect(getExecutablePath(contextFor(platform))).toBe(
      path.join(OUT_DIR, `${PRODUCT_FILENAME}.app`)
    );
  });

  it('uses the Windows .exe from productFilename', () => {
    expect(getExecutablePath(contextFor('win32'))).toBe(
      path.join(OUT_DIR, `${PRODUCT_FILENAME}.exe`)
    );
  });
});

describe('linux build configuration', () => {
  const linuxBuild = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'))
    .build.linux;

  it('names the Linux executable explicitly', () => {
    // Without this, electron-builder falls back to the sanitised, lowercased
    // package name — which for `@yosemite-crew/desktop` is `@yosemite-crewdesktop`.
    // That is what the AppImage and deb would install and what the .desktop
    // entry would exec.
    expect(linuxBuild.executableName).toMatch(/^[a-z0-9][a-z0-9-]*$/);
  });
});
