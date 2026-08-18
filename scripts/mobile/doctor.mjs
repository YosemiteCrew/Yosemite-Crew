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
import { existsSync, readFileSync, readdirSync } from 'node:fs';
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
// These are gitignored, so they never arrive in a fresh worktree. They usually
// DO exist in a sibling checkout though, which makes recovery a copy rather
// than a console round-trip - so look there before sending anyone to Firebase.
const siblingWorktrees = () => {
  const repoRoot = root.replace(/\/apps\/mobileAppYC$/, '');
  try {
    return readdirSync(dirname(repoRoot))
      .map((d) => join(dirname(repoRoot), d, 'apps/mobileAppYC'))
      .filter((d) => d !== root && existsSync(d));
  } catch {
    return [];
  }
};
const siblings = siblingWorktrees();

const checkFile = (rel, fallbackHow, level) => {
  if (existsSync(join(root, rel))) {
    ok(rel);
    return;
  }
  const found = siblings.find((w) => existsSync(join(w, rel)));
  level(rel, found ? `copy it from ${join(found, rel)}` : fallbackHow);
};

for (const [rel, how] of [
  [
    'android/gradle.properties',
    'cp android/gradle.properties.example android/gradle.properties, then put signing in ~/.gradle/gradle.properties',
  ],
  [
    'android/app/google-services.json',
    'not in any sibling worktree; re-download from the Firebase console',
  ],
  ['android/app/src/main/res/values/strings.xml', 'not in any sibling worktree; ask a maintainer'],
]) {
  checkFile(rel, how, bad);
}
for (const [rel, how] of [
  [
    'ios/GoogleService-Info.plist',
    'not in any sibling worktree; re-download from the Firebase console',
  ],
  ['ios/mobileAppYC/Secrets.xcconfig', 'not in any sibling worktree; ask a maintainer'],
]) {
  checkFile(rel, how, warn);
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

// --- codegen-incompatible native specs ------------------------------------
// RN 0.81's codegen cannot parse React.ComponentRef in a Fabric spec. Assert
// that condition directly rather than pinning a version number: a version is
// only a proxy, and it goes stale the moment upstream fixes it in a later
// release or backports the fix to a patch. Checking the invariant also catches
// the same breakage arriving from a different library.
// Occurrences outside src/fabric/ are harmless - they are not codegen specs.
const componentRefSpecs = (pkgDir) => {
  const fabric = join(pkgDir, 'src/fabric');
  if (!existsSync(fabric)) return [];
  const hits = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
        try {
          if (readFileSync(full, 'utf8').includes('React.ComponentRef')) {
            hits.push(full.slice(fabric.length + 1));
          }
        } catch {
          /* unreadable file is not a finding */
        }
      }
    }
  };
  try {
    walk(fabric);
  } catch {
    return [];
  }
  return hits;
};

try {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const rn = pkg.dependencies?.['react-native'] ?? '';
  const rnMinor = Number(/0\.(\d+)/.exec(rn)?.[1] ?? 99);
  const screensDir = join(root, '../../node_modules/react-native-screens');
  const resolved = existsSync(screensDir) ? screensDir : null;
  if (!resolved) {
    warn('react-native-screens', 'not installed; run pnpm install before building');
  } else {
    const hits = componentRefSpecs(resolved);
    if (hits.length > 0 && rnMinor < 82) {
      bad(
        'react-native-screens',
        `${hits.length} Fabric spec(s) use React.ComponentRef, which the RN ${rn} codegen cannot parse (${hits.slice(0, 2).join(', ')}${hits.length > 2 ? ', ...' : ''}). Pin a version whose src/fabric/ is free of it.`
      );
    } else if (hits.length > 0) {
      ok(
        'react-native-screens',
        `${hits.length} Fabric spec(s) use React.ComponentRef, supported by RN ${rn}`
      );
    } else {
      ok('react-native-screens', 'no Fabric spec uses React.ComponentRef');
    }
    // Installed state can be fine while the declared range still drifts on the
    // next install, which is exactly how this broke the first time.
    const declared = pkg.dependencies?.['react-native-screens'] ?? '';
    if (/^[\^~]/.test(declared)) {
      warn(
        'react-native-screens range',
        `${declared} floats; it drifted into a codegen-incompatible version once already. Prefer an exact pin.`
      );
    }
  }
} catch {
  warn('react-native-screens', 'could not evaluate; is package.json readable?');
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
