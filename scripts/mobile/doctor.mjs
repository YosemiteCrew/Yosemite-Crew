#!/usr/bin/env node
/**
 * Reports whether this machine can actually build the mobile app.
 *
 * The Android build needs several files that are deliberately untracked
 * (they carry Firebase config or signing credentials), so a fresh clone fails
 * partway through a long Gradle run with an error that names one missing file
 * at a time. This reports every prerequisite at once, before the build.
 *
 *   node scripts/doctor.mjs
 *
 * Never prints a secret value: only whether something is present.
 */
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';

// Resolved from the script path rather than cwd, so these run correctly
// whether invoked from the repo root or the mobile workspace.
const root = join(dirname(process.argv[1]), '../../apps/mobileAppYC');
const rows = [];
const ok = (what, detail = '') => rows.push({ level: 'OK', what, detail });
const warn = (what, detail) => rows.push({ level: 'WARN', what, detail });
const bad = (what, detail) => rows.push({ level: 'MISSING', what, detail });

// `java -version` writes to stderr even on success, so both streams must be
// read or the detail comes back blank.
const bin = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  if (r.error) return null;
  const merged = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim();
  return merged || null;
};

// --- toolchain -------------------------------------------------------------
const javaHome = process.env.JAVA_HOME;
if (javaHome && existsSync(join(javaHome, 'bin/java'))) {
  ok('JAVA_HOME', bin(join(javaHome, 'bin/java'), ['-version'])?.split('\n')[0] ?? javaHome);
} else {
  bad('JAVA_HOME', 'not set, or does not contain bin/java. Android builds cannot run.');
}

const androidHome = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
if (androidHome && existsSync(androidHome)) ok('ANDROID_HOME', androidHome);
else bad('ANDROID_HOME', 'not set. Install the Android SDK and export ANDROID_HOME.');

const xcode = bin('xcodebuild', ['-version']);
if (xcode) ok('Xcode', xcode.split('\n')[0]);
else
  warn(
    'Xcode',
    'xcodebuild not found. iOS builds are unavailable (fine if you only build Android).'
  );

// --- untracked files the build requires ------------------------------------
// Each is gitignored on purpose, so a clone will not have it.
const required = [
  [
    'android/gradle.properties',
    'copy from android/gradle.properties.example, then add signing to ~/.gradle/gradle.properties',
  ],
  ['android/app/google-services.json', 'download from the Firebase console for the Android app'],
  ['android/app/src/main/res/values/strings.xml', 'holds app name and API keys; ask a maintainer'],
];
const iosRequired = [
  ['ios/GoogleService-Info.plist', 'download from the Firebase console for the iOS app'],
  ['ios/mobileAppYC/Secrets.xcconfig', 'ask a maintainer; required for a device or archive build'],
];
for (const [rel, how] of required) {
  if (existsSync(join(root, rel))) ok(rel);
  else bad(rel, how);
}
for (const [rel, how] of iosRequired) {
  if (existsSync(join(root, rel))) ok(rel);
  else warn(rel, how);
}

// --- release signing -------------------------------------------------------
// Presence only. Values are never read or printed.
const SIGNING = [
  'YC_RELEASE_STORE_FILE',
  'YC_RELEASE_STORE_PASSWORD',
  'YC_RELEASE_KEY_ALIAS',
  'YC_RELEASE_KEY_PASSWORD',
];
const gradleHome = join(process.env.HOME ?? '', '.gradle/gradle.properties');
const sources = [join(root, 'android/gradle.properties'), gradleHome].filter(existsSync);
const declared = new Set();
for (const f of sources) {
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    const key = line.split('=')[0]?.trim();
    if (SIGNING.includes(key)) declared.add(key);
  }
}
for (const k of SIGNING) if (process.env[k]) declared.add(k);
const missingSigning = SIGNING.filter((k) => !declared.has(k));
if (missingSigning.length === 0) {
  ok('release signing', 'all four properties present (values not read)');
} else {
  warn(
    'release signing',
    `${missingSigning.length} of 4 missing (${missingSigning.join(', ')}). Debug builds still work; assembleRelease will not.`
  );
}

// --- known-incompatible dependency ----------------------------------------
// react-native-screens >= 4.26 ships codegen specs using React.ComponentRef,
// which the RN 0.81 codegen rejects. The peer range does not catch it: 4.26.1
// and 4.27.0 both declare "*".
try {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const rn = pkg.dependencies?.['react-native'] ?? '';
  const screens = pkg.dependencies?.['react-native-screens'] ?? '';
  const screensMajorMinor = /(\d+)\.(\d+)/.exec(screens);
  const rnMinor = /0\.(\d+)/.exec(rn);
  const risky =
    screensMajorMinor &&
    rnMinor &&
    Number(rnMinor[1]) < 82 &&
    (Number(screensMajorMinor[1]) > 4 || Number(screensMajorMinor[2]) >= 26);
  if (risky) {
    bad(
      'react-native-screens',
      `${screens} ships codegen specs that RN ${rn} cannot parse. Pin 4.24.0 until React Native is upgraded.`
    );
  } else if (screens.startsWith('^') || screens.startsWith('~')) {
    warn(
      'react-native-screens',
      `${screens} is a floating range; it drifted into an incompatible version once already. Prefer an exact pin.`
    );
  } else {
    ok('react-native-screens', screens);
  }
} catch {
  warn('react-native-screens', 'could not read package.json');
}

// --- report ----------------------------------------------------------------
const width = Math.max(...rows.map((r) => r.what.length));
for (const { level, what, detail } of rows) {
  console.log(`${level.padEnd(8)} ${what.padEnd(width)}  ${detail}`);
}
const blocking = rows.filter((r) => r.level === 'MISSING');
console.log('');
if (blocking.length === 0) {
  console.log('doctor: no blocking problems. `cd android && ./gradlew assembleDebug` should run.');
} else {
  console.log(
    `doctor: ${blocking.length} blocking problem(s). The Android build will fail until each is resolved.`
  );
  process.exitCode = 1;
}
