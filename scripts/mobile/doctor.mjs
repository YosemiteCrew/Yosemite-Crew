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
// These are gitignored, so they never arrive in a fresh worktree. Recovery is
// usually a copy rather than a console round-trip, so look for a real copy
// before sending anyone to Firebase.
//
// Presence is NOT enough. The repo ships placeholder templates with the same
// filenames, and they propagate between worktrees exactly like real config.
// An APK built against them compiles and installs: the Google Services plugin
// validates shape and package name, not values. Push, auth and Maps are simply
// dead at runtime. Checking only for existence reports OK on those, which is
// worse than reporting nothing.
const PLACEHOLDER = /YOUR_[A-Z_]+|CHANGE_?ME|REPLACE_?ME|<[A-Z_]+>/;

// Returns true, false, or null for "could not read". Collapsing unreadable to
// false would report OK for a file nobody can open, which is the failure shape
// this check exists to remove.
const isPlaceholder = (file) => {
  try {
    if (file.includes('..') || path.isAbsolute(file)) {
      return null;
    }
    return PLACEHOLDER.test(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
};

const siblingWorktrees = () => {
  const repoRoot = dirname(dirname(root));
  try {
    return readdirSync(dirname(repoRoot))
      .map((d) => join(dirname(repoRoot), d, 'apps/mobileAppYC'))
      .filter((d) => d !== root && existsSync(d));
  } catch {
    return [];
  }
};
const siblings = siblingWorktrees();

// Opt-in via env var. This repository is public, so hardcoding the location of
// anyone's secrets store would publish its name and layout to every reader, and
// the path is machine-specific besides. Point this at a directory holding real
// config to have the doctor suggest it:
//   export YC_MOBILE_SECRETS_BACKUP="/path/to/backup/mobileAppYC"
const BACKUP_ROOT = process.env.YC_MOBILE_SECRETS_BACKUP ?? '';
const findInBackup = (rel) => {
  if (!BACKUP_ROOT || !existsSync(BACKUP_ROOT)) return null;
  const wanted = rel.split('/').pop();
  // Collect every match and take the shallowest. Returning the first hit made
  // the answer depend on readdir order, so a deeper file could beat a
  // shallower one and two real configs would resolve arbitrarily.
  const found = [];
  const walk = (dir, depth = 0) => {
    if (depth > 4) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isFile() && e.name === wanted && isPlaceholder(full) === false) {
        found.push({ full, depth });
      } else if (e.isDirectory()) {
        walk(full, depth + 1);
      }
    }
  };
  walk(BACKUP_ROOT);
  if (found.length === 0) return null;
  found.sort((a, b) => a.depth - b.depth);
  if (found.length > 1) {
    warn(rel, `${found.length} candidates in the backup; suggesting the shallowest`);
  }
  return found[0].full;
};

/** exists -> not a placeholder -> sibling worktree -> secrets backup -> console. */
const checkFile = (rel, fallbackHow, level) => {
  const here = join(root, rel);
  if (existsSync(here)) {
    const placeholder = isPlaceholder(here);
    if (placeholder === false) {
      ok(rel);
      return;
    }
    if (placeholder === null) {
      level(rel, 'exists but could not be read; check permissions');
      return;
    }
  }
  const source =
    siblings.map((w) => join(w, rel)).find((f) => existsSync(f) && isPlaceholder(f) === false) ??
    findInBackup(rel);
  const problem = existsSync(here) ? 'is a PLACEHOLDER template' : 'missing';
  level(
    rel,
    source ? `${problem}; copy the real one from ${source}` : `${problem}; ${fallbackHow}`
  );
};

for (const [rel, how] of [
  [
    'android/gradle.properties',
    'cp android/gradle.properties.example android/gradle.properties, then put signing in ~/.gradle/gradle.properties',
  ],
  ['android/app/google-services.json', 're-download from the Firebase console'],
  ['android/app/src/main/res/values/strings.xml', 'ask a maintainer'],
]) {
  checkFile(rel, how, bad);
}
for (const [rel, how] of [
  ['ios/GoogleService-Info.plist', 're-download from the Firebase console'],
  ['ios/mobileAppYC/Secrets.xcconfig', 'ask a maintainer'],
]) {
  checkFile(rel, how, warn);
}
// Its absence makes an iOS build impossible, so it blocks rather than warns.
checkFile('ios/mobileAppYC/Info.plist', 'ask a maintainer', bad);

// Android Maps silently renders a blank map with no key, and this one is empty
// even on machines that have every other file.
const localProps = join(root, 'android/local.properties');
if (!existsSync(localProps)) {
  // Saying nothing reads as "fine".
  warn('MAPS_API_KEY', 'android/local.properties is missing; Android maps will render blank');
} else {
  const maps = /^MAPS_API_KEY=(.*)$/m.exec(readFileSync(localProps, 'utf8'))?.[1]?.trim();
  // Presence is not enough here either: local.properties.example ships
  // MAPS_API_KEY=YOUR_ANDROID_GOOGLE_MAPS_API_KEY, which is truthy.
  if (maps && !PLACEHOLDER.test(maps)) ok('MAPS_API_KEY', 'set');
  else if (maps)
    warn('MAPS_API_KEY', 'is still the placeholder value; Android maps will render blank');
  else warn('MAPS_API_KEY', 'empty in android/local.properties; Android maps will render blank');
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
  // Fabric spec trees are shallow; the cap only guards against a pathological
  // or symlinked tree taking the process down with a stack overflow.
  const MAX_DEPTH = 12;
  const walk = (dir, depth = 0) => {
    if (depth > MAX_DEPTH) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.resolve(dir, entry.name);
      const relative = path.relative(fabric, full);
      if (relative.startsWith('..') || path.isAbsolute(relative)) continue;
      if (entry.isDirectory()) walk(full, depth + 1);
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

// --- release gate ------------------------------------------------------------
// `--require-app-config` guards src/config/variables.local.ts, which supplies
// appleServiceId, appleRedirectUri, googleWebClientId and facebookAppId. The
// file is gitignored, and variables.ts swallows its absence SILENTLY when
// CI=true, so a release build without it produces binaries that install and run
// but whose social sign-in cannot succeed. Nothing else in the build says so.
//
// The templates in variables.ts read `com.yourAppName.mobile.auth` and
// `https://yourDomain.firebaseapp.com/...`. PLACEHOLDER targets SHOUTING
// markers and deliberately does not match those, so they are matched here.
const APP_CONFIG_TEMPLATE = /yourAppName|yourDomain/;
const REQUIRED_APP_CONFIG = [
  'appleServiceId',
  'appleRedirectUri',
  'googleWebClientId',
  'facebookAppId',
];

const appConfigProblems = () => {
  const rel = 'src/config/variables.local.ts';
  const file = join(root, rel);

  if (!existsSync(file)) {
    return [`${rel} missing; the MOBILE_VARIABLES_LOCAL_TS secret did not restore`];
  }

  const body = readFileSync(file, 'utf8');
  const problems = [];

  if (APP_CONFIG_TEMPLATE.test(body)) {
    problems.push(`${rel} still carries variables.ts template values`);
  }
  for (const key of REQUIRED_APP_CONFIG) {
    const match = new RegExp(`${key}\\s*:\\s*'([^']*)'`).exec(body);
    if (!match) {
      problems.push(`${key} is absent from ${rel}`);
    } else if (match[1].trim() === '') {
      problems.push(`${key} is empty in ${rel}`);
    }
  }
  return problems;
};

if (process.argv.includes('--require-app-config')) {
  const problems = appConfigProblems();
  for (const problem of problems) {
    console.log(`MISSING  ${problem}`);
  }
  if (problems.length === 0) {
    console.log('OK       src/config/variables.local.ts present, social sign-in values set');
  }
  process.exit(problems.length === 0 ? 0 : 1);
}

// --- report ----------------------------------------------------------------
// `--self-test` pins the placeholder vocabulary against the shipped templates
// for the files this tool actually inspects, so an edit that makes the regex
// too narrow (missing a real placeholder) or too broad (condemning real
// config) fails loudly rather than silently reporting OK.
//
// Only these six are asserted. Other templates in config-templates/ are
// instructional or carry no secret values, so they legitimately contain no
// placeholder markers and flagging them would be wrong.
if (process.argv.includes('--self-test')) {
  const templates = join(root, 'config-templates');
  const mustFlag = [
    'android/google-services.example.json',
    'android/strings.example.xml',
    'android/local.properties.example',
    'ios/GoogleService-Info.example.plist',
    'ios/Info.plist.example',
    'ios/Secrets.xcconfig.example',
  ];
  let failures = 0;
  for (const rel of mustFlag) {
    const full = join(templates, rel);
    const flagged = isPlaceholder(full);
    if (flagged === null) {
      console.log(`ABSENT   ${rel}`);
      failures += 1;
    } else if (flagged) {
      console.log(`FLAGGED  ${rel}`);
    } else {
      console.log(`MISSED   ${rel}  <- regex no longer catches this template`);
      failures += 1;
    }
  }
  // Real config must not be condemned: that is the opposite failure and would
  // tell someone their working setup is broken.
  const filled = [
    '{"project_info":{"project_id":"yosemite-crew"},"api_key":"AIzaSyReal"}',
    '<resources><string name="app_name">Yosemite Crew</string></resources>',
    'MAPS_API_KEY=AIzaSyRealLookingKey123',
  ];
  // The app-config vocabulary is pinned the same way: it must catch the
  // variables.ts templates and must not condemn the real values.
  const appTemplates = [
    "appleServiceId: 'com.yourAppName.mobile.auth',",
    "appleRedirectUri: 'https://yourDomain.firebaseapp.com/__/auth/handler',",
  ];
  const appReal = [
    "appleServiceId: 'com.yosemitecrew.mobile.auth',",
    "appleRedirectUri: 'https://yosemite-crew.firebaseapp.com/__/auth/handler',",
  ];
  for (const sample of appTemplates) {
    if (APP_CONFIG_TEMPLATE.test(sample)) {
      console.log(`FLAGGED  ${sample.slice(0, 40)}`);
    } else {
      console.log(`MISSED   ${sample.slice(0, 40)}  <- app-config regex too narrow`);
      failures += 1;
    }
  }
  const appFalse = appReal.filter((c) => APP_CONFIG_TEMPLATE.test(c));
  if (appFalse.length > 0) {
    console.log(`FALSE POSITIVE on ${appFalse.length} real app-config sample(s)`);
    failures += appFalse.length;
  }

  const falsePositives = filled.filter((c) => PLACEHOLDER.test(c));
  if (falsePositives.length > 0) {
    console.log(`FALSE POSITIVE on ${falsePositives.length} realistic config sample(s)`);
    failures += falsePositives.length;
  }
  console.log(`\nself-test: ${failures === 0 ? 'passed' : failures + ' failure(s)'}`);
  process.exit(failures === 0 ? 0 : 1);
}

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
