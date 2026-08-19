#!/usr/bin/env node
/**
 * Keep the two platform versions in step, and stop a release going out with a
 * version the stores will refuse.
 *
 * Android and iOS carry their versions in different files and had drifted badly:
 * Android sat at 1.0.12 (identical to the live Play listing, which Play rejects)
 * while iOS sat at 1.0.7 against a live App Store build of 1.5. Neither is
 * something you notice until an upload is rejected.
 *
 *   node scripts/version.mjs --check          report both platforms and exit 1 if they disagree
 *   node scripts/version.mjs --set 1.6.0      set the marketing version on both, bump both build numbers
 *   node scripts/version.mjs --bump patch     1.0.12 -> 1.0.13 on both, bump both build numbers
 *
 * Build numbers (Android versionCode, iOS CURRENT_PROJECT_VERSION) always move
 * to max(current)+1 across both platforms, so they never collide or go
 * backwards regardless of which platform was ahead.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';

// Resolved from the script path rather than cwd, so these run correctly
// whether invoked from the repo root or the mobile workspace.
const root = join(dirname(process.argv[1]), '../../apps/mobileAppYC');
const GRADLE = join(root, 'android/app/build.gradle');
const PBXPROJ = join(root, 'ios/mobileAppYC.xcodeproj/project.pbxproj');

const read = (p) => {
  const base = resolve(root);
  const target = resolve(p);
  const rel = relative(base, target);
  if (rel.startsWith('..') || resolve(rel) === rel) {
    throw new Error('Invalid file path');
  }
  return readFileSync(target, 'utf8');
};

const parseAndroid = (src) => ({
  versionCode: Number(/versionCode\s+(\d+)/.exec(src)?.[1]),
  versionName: /versionName\s+"([^"]+)"/.exec(src)?.[1],
});

// Xcode repeats these per build configuration, so every occurrence must agree
// and every occurrence must be rewritten.
const parseIos = (src) => {
  const marketing = [...src.matchAll(/MARKETING_VERSION = ([^;]+);/g)].map((m) => m[1].trim());
  const project = [...src.matchAll(/CURRENT_PROJECT_VERSION = ([^;]+);/g)].map((m) => m[1].trim());
  return {
    marketing: [...new Set(marketing)],
    project: [...new Set(project)],
  };
};

const fail = (msg) => {
  console.error(`version: ${msg}`);
  process.exit(1);
};

const load = () => {
  const gradleSrc = read(GRADLE);
  const iosSrc = read(PBXPROJ);
  const android = parseAndroid(gradleSrc);
  const ios = parseIos(iosSrc);
  if (!android.versionName || !Number.isFinite(android.versionCode)) {
    fail('could not read versionCode/versionName from build.gradle');
  }
  if (ios.marketing.length !== 1) {
    fail(`iOS MARKETING_VERSION disagrees across configurations: ${ios.marketing.join(', ')}`);
  }
  if (ios.project.length !== 1) {
    fail(`iOS CURRENT_PROJECT_VERSION disagrees across configurations: ${ios.project.join(', ')}`);
  }
  return {
    gradleSrc,
    iosSrc,
    android,
    ios: { marketing: ios.marketing[0], project: Number(ios.project[0]) },
  };
};

const report = ({ android, ios }) => {
  console.log(`  android  versionName ${android.versionName}  versionCode ${android.versionCode}`);
  console.log(
    `  ios      MARKETING_VERSION ${ios.marketing}  CURRENT_PROJECT_VERSION ${ios.project}`
  );
};

const write = (state, nextVersion, nextBuild) => {
  const gradle = state.gradleSrc
    .replace(/versionCode\s+\d+/, `versionCode ${nextBuild}`)
    .replace(/versionName\s+"[^"]+"/, `versionName "${nextVersion}"`);
  const ios = state.iosSrc
    .replaceAll(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${nextVersion};`)
    .replaceAll(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${nextBuild};`);
  writeFileSync(GRADLE, gradle);
  writeFileSync(PBXPROJ, ios);
};

const bump = (version, part) => {
  const nums = version.split('.').map(Number);
  while (nums.length < 3) nums.push(0);
  if (nums.some((n) => !Number.isFinite(n))) fail(`cannot bump non-numeric version "${version}"`);
  const idx = { major: 0, minor: 1, patch: 2 }[part];
  if (idx === undefined) fail(`unknown bump part "${part}" (use major, minor or patch)`);
  nums[idx] += 1;
  for (let i = idx + 1; i < nums.length; i += 1) nums[i] = 0;
  return nums.join('.');
};

const main = () => {
  const [flag, value] = process.argv.slice(2);
  const state = load();

  if (!flag || flag === '--check') {
    console.log('version: current');
    report(state);
    if (state.android.versionName !== state.ios.marketing) {
      console.error(
        `\nversion: platforms disagree - android ${state.android.versionName} vs ios ${state.ios.marketing}.` +
          `\nRun --set <version> to bring them in line before releasing.`
      );
      process.exit(1);
    }
    console.log('\nversion: both platforms agree.');
    return;
  }

  const nextBuild = Math.max(state.android.versionCode, state.ios.project) + 1;
  let nextVersion;
  if (flag === '--set') {
    if (!value) fail('--set needs a version, e.g. --set 1.6.0');
    if (!/^\d+(\.\d+){0,2}$/.test(value)) fail(`"${value}" is not a numeric version`);
    nextVersion = value;
  } else if (flag === '--bump') {
    // Bump from whichever platform is further ahead, so a release never lands
    // on a version the other store has already published.
    const ahead = [state.android.versionName, state.ios.marketing].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    );
    nextVersion = bump(ahead[ahead.length - 1], value ?? 'patch');
  } else {
    fail(`unknown flag "${flag}" (use --check, --set <version> or --bump <part>)`);
  }

  console.log('version: before');
  report(state);
  write(state, nextVersion, nextBuild);
  console.log(`\nversion: set both platforms to ${nextVersion}, build ${nextBuild}`);
  console.log('\nversion: after');
  report(load());
};

main();
