'use strict';

const fs = require('node:fs');
const path = require('node:path');

// Writes the macOS floor into the auto-update feed so electron-updater refuses a
// release the running Mac cannot open.
//
// The problem (issue #3280): v0.1.0-beta.5 shipped on Electron 43, which runs on
// macOS 12 Monterey. From Electron 44 the app requires macOS 13 Ventura. A
// Monterey user on beta.5 is offered the next release by the updater, installs
// it, and then macOS refuses to launch it - they are left with nothing that runs.
//
// electron-updater already has the guard. AppUpdater `checkIfUpdateSupported`
// reads `updateInfo.minimumSystemVersion` and returns false when
// `semver.lt(os.release(), minimumSystemVersion)`, which drops the release before
// `update-available` fires, so nothing downloads. What is missing is the value:
// electron-builder 26 writes `mac.minimumSystemVersion` into Info.plist as
// LSMinimumSystemVersion and into .pkg requirements (out/targets/pkg.js) and
// nowhere else, so the feed it publishes never carries the key.
//
// `os.release()` on macOS is the DARWIN kernel version, not the product version,
// so the feed value has to be a Darwin semver - 22.0.0 for Ventura, not 13.0.
//
// The mapping is a table and not arithmetic on purpose. macOS 11-15 happen to sit
// at Darwin major + 9, and macOS 26 Tahoe breaks it: it is Darwin 25, one BELOW
// what the offset predicts. A formula would have silently published a floor a
// whole release too high. Every row below was read from the matching
// actions/runner-images image manifest:
//
//   macOS 12.7.6  Darwin 21.6.0   images/macos/macos-12-Readme.md @19c84748
//   macOS 13.7.6  Darwin 22.6.0   images/macos/macos-13-Readme.md @71f01578
//   macOS 14.8.7  Darwin 23.6.0   images/macos/macos-14-Readme.md (main)
//   macOS 15.7.9  Darwin 24.6.0   images/macos/macos-15-Readme.md (main)
//   macOS 26.6.1  Darwin 25.6.0   images/macos/macos-26-Readme.md (main)
//
// An unmapped major is a hard failure rather than a guess: publishing a wrong
// floor either strands users who could have updated or lets through the exact
// install this exists to prevent, and neither is visible from the release run.
const MACOS_MAJOR_TO_DARWIN_MAJOR = Object.freeze({
  12: 21,
  13: 22,
  14: 23,
  15: 24,
  26: 25,
});

// Only the macOS feed. On Windows `os.release()` is a Windows version (10.0.x),
// so stamping a Darwin floor into latest.yml would make every Windows client
// consider the release unsupported forever.
const MAC_FEED_NAME = /^latest-mac(-[A-Za-z0-9._-]+)?\.yml$/;

const KEY = 'minimumSystemVersion';
const EXISTING_KEY_LINE = new RegExp(`^${KEY}:.*$`, 'm');

/** The Darwin semver electron-updater compares `os.release()` against. */
const darwinFloorFor = (macosFloor) => {
  if (typeof macosFloor !== 'string' || !/^\d+(\.\d+)*$/.test(macosFloor)) {
    throw new Error(
      `build.mac.minimumSystemVersion is ${JSON.stringify(macosFloor)}; expected a version like "13.0".`
    );
  }
  const major = Number(macosFloor.split('.')[0]);
  const darwinMajor = MACOS_MAJOR_TO_DARWIN_MAJOR[major];
  if (darwinMajor === undefined) {
    throw new Error(
      `No Darwin kernel version recorded for macOS ${major}. Read "Kernel Version" from the ` +
        `actions/runner-images macos-${major} image manifest and add the row to ` +
        `MACOS_MAJOR_TO_DARWIN_MAJOR in ${path.basename(__filename)}. Do not compute it: ` +
        `macOS 26 is Darwin 25, which breaks the offset the earlier releases follow.`
    );
  }
  return `${darwinMajor}.0.0`;
};

/** The floor electron-builder was told to package with. */
const macFloorFrom = (pkg) => {
  const floor = pkg?.build?.mac?.minimumSystemVersion;
  if (!floor) {
    throw new Error(
      'build.mac.minimumSystemVersion is not set in package.json, so there is no floor to publish.'
    );
  }
  return floor;
};

/**
 * Returns the feed with the key set. Idempotent: re-running replaces the line
 * rather than adding a second one, which YAML would resolve to the last.
 */
const stampFeed = (contents, darwinFloor) => {
  if (!/^version:/m.test(contents) || !/^files:/m.test(contents)) {
    throw new Error(
      'That file has no top-level `version:` and `files:` keys, so it is not an electron-builder update feed.'
    );
  }
  const line = `${KEY}: ${darwinFloor}`;
  if (EXISTING_KEY_LINE.test(contents)) {
    return contents.replace(EXISTING_KEY_LINE, line);
  }
  return `${line}\n${contents}`;
};

const main = (argv, deps = {}) => {
  const readFile = deps.readFileSync ?? fs.readFileSync;
  const writeFile = deps.writeFileSync ?? fs.writeFileSync;
  const log = deps.log ?? console.log;
  const error = deps.error ?? console.error;
  const packageJsonPath = deps.packageJsonPath ?? path.join(__dirname, '..', 'package.json');

  const feedPath = argv[2];
  if (!feedPath) {
    error('Usage: node scripts/stamp-update-feed-min-os.js <path-to-latest-mac.yml>');
    return 1;
  }

  try {
    if (!MAC_FEED_NAME.test(path.basename(feedPath))) {
      throw new Error(
        `${path.basename(feedPath)} is not a macOS update feed. This stamps a Darwin kernel ` +
          'version, which is only meaningful in latest-mac.yml.'
      );
    }
    const darwinFloor = darwinFloorFor(macFloorFrom(JSON.parse(readFile(packageJsonPath, 'utf8'))));
    const stamped = stampFeed(readFile(feedPath, 'utf8'), darwinFloor);
    writeFile(feedPath, stamped);
    log(`[stamp-update-feed-min-os] ${feedPath}: ${KEY}: ${darwinFloor}`);
    return 0;
  } catch (thrown) {
    error(`[stamp-update-feed-min-os] ${thrown.message || thrown}`);
    return 1;
  }
};

module.exports = {
  MACOS_MAJOR_TO_DARWIN_MAJOR,
  MAC_FEED_NAME,
  darwinFloorFor,
  macFloorFrom,
  main,
  stampFeed,
};

if (require.main === module) {
  process.exitCode = main(process.argv);
}
