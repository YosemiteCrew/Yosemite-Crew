import { createRequire } from 'node:module';

type StampModule = {
  MACOS_MAJOR_TO_DARWIN_MAJOR: Record<string, number>;
  MAC_FEED_NAME: RegExp;
  darwinFloorFor: (macosFloor: unknown) => string;
  macFloorFrom: (pkg: unknown) => string;
  main: (argv: string[], deps?: Record<string, unknown>) => number;
  stampFeed: (contents: string, darwinFloor: string) => string;
};

const requireFromHere = createRequire(__filename);
const stamp: StampModule = requireFromHere('../scripts/stamp-update-feed-min-os.js');
const desktopPkg = requireFromHere('../package.json') as {
  build: { mac: { minimumSystemVersion?: string } };
};

const FEED = [
  'version: 0.1.0-beta.6',
  'files:',
  '  - url: Yosemite Crew PIMS-0.1.0-beta.6-mac-arm64.zip',
  '    sha512: notarealdigest==',
  '    size: 104857600',
  'path: Yosemite Crew PIMS-0.1.0-beta.6-mac-arm64.zip',
  'sha512: notarealdigest==',
  "releaseDate: '2026-09-18T12:00:00.000Z'",
  '',
].join('\n');

describe('darwinFloorFor', () => {
  it('maps the macOS product version to the Darwin kernel version', () => {
    expect(stamp.darwinFloorFor('13.0')).toBe('22.0.0');
    expect(stamp.darwinFloorFor('12.0')).toBe('21.0.0');
    expect(stamp.darwinFloorFor('14.5')).toBe('23.0.0');
  });

  it('does not extrapolate the offset across the macOS 26 renumbering', () => {
    // macOS 11-15 sit at Darwin major + 9. Tahoe is macOS 26 / Darwin 25, one
    // below what that offset predicts, which is why this is a table.
    expect(stamp.darwinFloorFor('26.0')).toBe('25.0.0');
  });

  it('refuses a macOS major it has no recorded kernel version for', () => {
    // The next unrecorded release must stop the release run, not be guessed at.
    expect(() => stamp.darwinFloorFor('16.0')).toThrow(/No Darwin kernel version recorded/);
    expect(() => stamp.darwinFloorFor('16.0')).toThrow(/runner-images/);
  });

  it('refuses a value that is not a version', () => {
    expect(() => stamp.darwinFloorFor('Ventura')).toThrow(/expected a version/);
    expect(() => stamp.darwinFloorFor(undefined)).toThrow(/expected a version/);
  });

  it('has a row for the floor this app actually packages with', () => {
    // The guard that makes the next Electron bump loud here: raising
    // build.mac.minimumSystemVersion to an unrecorded major fails this test.
    const floor = desktopPkg.build.mac.minimumSystemVersion;
    expect(floor).toBeDefined();
    expect(() => stamp.darwinFloorFor(floor)).not.toThrow();
  });
});

describe('macFloorFrom', () => {
  it('reads the packaged floor', () => {
    expect(stamp.macFloorFrom({ build: { mac: { minimumSystemVersion: '13.0' } } })).toBe('13.0');
  });

  it('refuses a config with no floor to publish', () => {
    expect(() => stamp.macFloorFrom({ build: { mac: {} } })).toThrow(/is not set/);
  });
});

describe('stampFeed', () => {
  it('adds the key to a feed that has none', () => {
    const stamped = stamp.stampFeed(FEED, '22.0.0');
    expect(stamped).toContain('minimumSystemVersion: 22.0.0');
    // Everything the updater needs to resolve the download must survive.
    expect(stamped).toContain('version: 0.1.0-beta.6');
    expect(stamped).toContain('sha512: notarealdigest==');
    expect(stamped.split('\n').filter((l) => l.startsWith('minimumSystemVersion:'))).toHaveLength(
      1
    );
  });

  it('replaces an existing key instead of adding a second one', () => {
    // YAML resolves a duplicate key to the last one, so appending would publish
    // whichever copy happened to land last.
    const once = stamp.stampFeed(FEED, '21.0.0');
    const twice = stamp.stampFeed(once, '22.0.0');
    expect(twice.split('\n').filter((l) => l.startsWith('minimumSystemVersion:'))).toHaveLength(1);
    expect(twice).toContain('minimumSystemVersion: 22.0.0');
    expect(twice).not.toContain('21.0.0');
  });

  it('refuses a file that is not an update feed', () => {
    expect(() => stamp.stampFeed('publisherName: someone\n', '22.0.0')).toThrow(/not an .*feed/);
    expect(() => stamp.stampFeed('version: 1.0.0\n', '22.0.0')).toThrow(/not an .*feed/);
  });
});

describe('main', () => {
  const harness = (contents: string | null) => {
    const written: Array<[string, string]> = [];
    const logged: string[] = [];
    const errored: string[] = [];
    const deps = {
      packageJsonPath: '/fake/package.json',
      readFileSync: (target: string) => {
        if (target === '/fake/package.json') {
          return JSON.stringify({ build: { mac: { minimumSystemVersion: '13.0' } } });
        }
        if (contents === null) {
          throw new Error(`ENOENT: no such file or directory, open '${target}'`);
        }
        return contents;
      },
      writeFileSync: (target: string, data: string) => {
        written.push([target, data]);
      },
      log: (message: string) => logged.push(message),
      error: (message: string) => errored.push(message),
    };
    return { deps, written, logged, errored };
  };

  it('stamps the feed and reports what it wrote', () => {
    const h = harness(FEED);
    expect(stamp.main(['node', 'script', 'dist/latest-mac.yml'], h.deps)).toBe(0);
    expect(h.written).toHaveLength(1);
    expect(h.written[0][0]).toBe('dist/latest-mac.yml');
    expect(h.written[0][1]).toContain('minimumSystemVersion: 22.0.0');
    expect(h.logged.join('\n')).toContain('22.0.0');
  });

  it('accepts an arch-suffixed mac feed', () => {
    const h = harness(FEED);
    expect(stamp.main(['node', 'script', 'dist/latest-mac-arm64.yml'], h.deps)).toBe(0);
    expect(h.written).toHaveLength(1);
  });

  it('refuses the Windows feed and writes nothing', () => {
    // os.release() on Windows is 10.0.x, so a Darwin floor there would make every
    // Windows client treat the release as unsupported forever.
    const h = harness(FEED);
    expect(stamp.main(['node', 'script', 'dist/latest.yml'], h.deps)).toBe(1);
    expect(h.written).toHaveLength(0);
    expect(h.errored.join('\n')).toMatch(/not a macOS update feed/);
  });

  it('refuses the Linux feed and writes nothing', () => {
    const h = harness(FEED);
    expect(stamp.main(['node', 'script', 'dist/latest-linux.yml'], h.deps)).toBe(1);
    expect(h.written).toHaveLength(0);
  });

  it('reports usage when given no path', () => {
    const h = harness(FEED);
    expect(stamp.main(['node', 'script'], h.deps)).toBe(1);
    expect(h.written).toHaveLength(0);
    expect(h.errored.join('\n')).toMatch(/Usage:/);
  });

  it('fails when the feed is missing rather than writing a new one', () => {
    const h = harness(null);
    expect(stamp.main(['node', 'script', 'dist/latest-mac.yml'], h.deps)).toBe(1);
    expect(h.written).toHaveLength(0);
    expect(h.errored.join('\n')).toMatch(/ENOENT/);
  });
});
