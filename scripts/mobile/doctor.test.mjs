import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

// doctor.mjs resolves its workspace from its own path (`process.argv[1]/../../apps/mobileAppYC`),
// so a fixture is just a copy of the script inside a throwaway tree. That keeps the
// script free of a test-only root override.
const here = dirname(fileURLToPath(import.meta.url));
const DOCTOR = join(here, 'doctor.mjs');

const plist = (fonts) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>UIAppFonts</key>
\t<array>
${fonts.map((f) => `\t\t<string>${f}</string>`).join('\n')}
\t</array>
</dict>
</plist>
`;

/** Build a fixture repo and return doctor's stdout. */
const runDoctor = ({ assetFonts, registered, plistBody, extraFiles = {} }) => {
  const root = mkdtempSync(join(tmpdir(), 'yc-doctor-'));
  try {
    mkdirSync(join(root, 'scripts/mobile'), { recursive: true });
    cpSync(DOCTOR, join(root, 'scripts/mobile/doctor.mjs'));
    // doctor imports its placeholder vocabulary from this sibling module.
    cpSync(join(here, 'check-ios-secrets.mjs'), join(root, 'scripts/mobile/check-ios-secrets.mjs'));
    const app = join(root, 'apps/mobileAppYC');
    mkdirSync(join(app, 'assets/fonts'), { recursive: true });
    mkdirSync(join(app, 'ios/mobileAppYC'), { recursive: true });
    for (const f of assetFonts) writeFileSync(join(app, 'assets/fonts', f), '');
    writeFileSync(join(app, 'ios/mobileAppYC/Info.plist'), plistBody ?? plist(registered));
    for (const [rel, body] of Object.entries(extraFiles)) writeFileSync(join(app, rel), body);
    // doctor reports on many unrelated things and exits non-zero when the host
    // lacks a JDK or an Android SDK, so the exit code says nothing about the
    // font gate. Read stdout and ignore the status.
    try {
      return execFileSync(process.execPath, [join(root, 'scripts/mobile/doctor.mjs')], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch (err) {
      return err.stdout ?? '';
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

const fontLine = (out) =>
  out.split('\n').find((l) => l.includes('UIAppFonts')) ?? '(no UIAppFonts line)';

test('passes when every bundled and icon font is registered', () => {
  const out = runDoctor({
    assetFonts: ['Satoshi-Regular.otf', 'Newsreader-Regular.ttf'],
    registered: [
      'Satoshi-Regular.otf',
      'Newsreader-Regular.ttf',
      'Ionicons.ttf',
      'MaterialIcons.ttf',
    ],
  });
  assert.match(fontLine(out), /^OK\s+UIAppFonts/);
});

// The exact defect that shipped: the font file reaches the bundle via the pod,
// but an unregistered font is one iOS silently refuses to load.
test('fails when an icon font is missing, which is the shipped bug', () => {
  const out = runDoctor({
    assetFonts: ['Satoshi-Regular.otf'],
    registered: ['Satoshi-Regular.otf', 'MaterialIcons.ttf'],
  });
  const line = fontLine(out);
  assert.match(line, /MISSING\s+UIAppFonts/);
  assert.match(line, /Ionicons\.ttf/);
});

test('fails when a newly added asset font is not registered', () => {
  const out = runDoctor({
    assetFonts: ['Satoshi-Regular.otf', 'BrandNew-Bold.otf'],
    registered: ['Satoshi-Regular.otf', 'Ionicons.ttf', 'MaterialIcons.ttf'],
  });
  const line = fontLine(out);
  assert.match(line, /MISSING\s+UIAppFonts/);
  assert.match(line, /BrandNew-Bold\.otf/);
});

test('reports every missing font, not just the first', () => {
  const out = runDoctor({
    assetFonts: ['A.otf', 'B.otf'],
    registered: [],
  });
  const line = fontLine(out);
  assert.match(line, /4 font\(s\)/);
  for (const f of ['A.otf', 'B.otf', 'Ionicons.ttf', 'MaterialIcons.ttf']) {
    assert.ok(line.includes(f), `expected ${f} in: ${line}`);
  }
});

// A plist with no UIAppFonts array at all parses to an empty list rather than
// throwing, so the gate still reports the missing fonts instead of crashing and
// taking every other check down with it.
test('treats a plist with no UIAppFonts array as registering nothing', () => {
  const out = runDoctor({
    assetFonts: ['Satoshi-Regular.otf'],
    plistBody: '<?xml version="1.0"?>\n<plist version="1.0"><dict/></plist>\n',
  });
  const line = fontLine(out);
  assert.match(line, /MISSING\s+UIAppFonts/);
  assert.match(line, /Satoshi-Regular\.otf/);
});

test('ignores non-font files sitting in assets/fonts', () => {
  const out = runDoctor({
    assetFonts: ['Satoshi-Regular.otf', 'README.md', '.DS_Store'],
    registered: ['Satoshi-Regular.otf', 'Ionicons.ttf', 'MaterialIcons.ttf'],
  });
  assert.match(fontLine(out), /^OK\s+UIAppFonts/);
});

// --- Amplify outputs ---------------------------------------------------------
// The shipped template holds EXAMPLE ids. A copy of it must read as not
// configured, and a file with real-shaped ids must not be condemned.
const amplifyOutputs = (userPoolId, clientId) =>
  JSON.stringify({ auth: { user_pool_id: userPoolId, user_pool_client_id: clientId } });
const amplifyLine = (out) =>
  out.split('\n').find((l) => l.includes('devamplify_outputs.json')) ?? '(no amplify line)';
const fonts = { assetFonts: [], registered: ['Ionicons.ttf', 'MaterialIcons.ttf'] };

test('reports an Amplify outputs copy that still holds EXAMPLE ids as not configured', () => {
  const out = runDoctor({
    ...fonts,
    extraFiles: {
      'devamplify_outputs.json': amplifyOutputs('eu-central-1_EXAMPLE01', 'EXAMPLECLIENTID02'),
    },
  });
  assert.match(amplifyLine(out), /^WARN\s+devamplify_outputs\.json\s+is a PLACEHOLDER template/);
  assert.match(amplifyLine(out), /not configured/);
});

test('accepts an Amplify outputs file with real-shaped ids', () => {
  const out = runDoctor({
    ...fonts,
    extraFiles: {
      'devamplify_outputs.json': amplifyOutputs(
        'eu-central-1_abcDEF123',
        'a1b2c3d4e5f6g7h8i9j0k1l2m3'
      ),
    },
  });
  assert.match(amplifyLine(out), /^OK\s+devamplify_outputs\.json/);
});

test('says nothing about Amplify outputs when no copy exists', () => {
  const out = runDoctor(fonts);
  assert.equal(amplifyLine(out), '(no amplify line)');
});

test('the shipped Amplify template passes the placeholder self-test', () => {
  const out = execFileSync(process.execPath, [DOCTOR, '--self-test'], { encoding: 'utf8' });
  assert.match(out, /FLAGGED\s+amplify\/amplify_outputs\.example\.json/);
  assert.match(out, /self-test: passed/);
});

// --- --require-production-api ----------------------------------------------
// The gate the tag workflow runs before it uploads to TestFlight and Play.
// `variables.local.ts` is gitignored and restored wholesale from a secret, so
// the only thing standing between a stale `USE_DEV_API = true` and a signed
// store build pointed at devapi is this check. It exits before the rest of the
// report, so unlike the font gate its exit code is the whole answer.
const runProductionApiGate = (variablesLocal) => {
  const root = mkdtempSync(join(tmpdir(), 'yc-doctor-api-'));
  try {
    mkdirSync(join(root, 'scripts/mobile'), { recursive: true });
    cpSync(DOCTOR, join(root, 'scripts/mobile/doctor.mjs'));
    cpSync(join(here, 'check-ios-secrets.mjs'), join(root, 'scripts/mobile/check-ios-secrets.mjs'));
    const config = join(root, 'apps/mobileAppYC/src/config');
    mkdirSync(config, { recursive: true });
    if (variablesLocal !== null) {
      writeFileSync(join(config, 'variables.local.ts'), variablesLocal);
    }
    try {
      const stdout = execFileSync(
        process.execPath,
        [join(root, 'scripts/mobile/doctor.mjs'), '--require-production-api'],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
      );
      return { status: 0, stdout };
    } catch (err) {
      return { status: err.status, stdout: err.stdout ?? '' };
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

test('passes when USE_DEV_API is declared false', () => {
  const { status, stdout } = runProductionApiGate('const USE_DEV_API = false;\n');
  assert.equal(status, 0);
  assert.match(stdout, /^OK\s+src\/config\/variables\.local\.ts routes this build/m);
});

test('passes when the declaration is exported', () => {
  const { status } = runProductionApiGate('export const USE_DEV_API = false;\n');
  assert.equal(status, 0);
});

// The failure the gate exists for: a secret left on dev.
test('fails when USE_DEV_API is declared true', () => {
  const { status, stdout } = runProductionApiGate('const USE_DEV_API = true;\n');
  assert.equal(status, 1);
  assert.match(stdout, /WRONG\s+USE_DEV_API is true/);
});

// "I could not find it" must never read the same as "it is correct".
test('fails when USE_DEV_API is absent rather than treating absence as a pass', () => {
  const { status, stdout } = runProductionApiGate('export const OTHER = 1;\n');
  assert.equal(status, 1);
  assert.match(stdout, /WRONG\s+USE_DEV_API not declared/);
});

test('fails when variables.local.ts did not restore at all', () => {
  const { status, stdout } = runProductionApiGate(null);
  assert.equal(status, 1);
  assert.match(stdout, /WRONG\s+src\/config\/variables\.local\.ts missing/);
});

// A substring search over the whole file reports OK on this, because the
// commented line matches first while the live declaration routes the build at
// devapi. The declaration is anchored to the start of an uncommented line.
test('fails when a commented-out false sits above a live true', () => {
  const { status, stdout } = runProductionApiGate(
    '// const USE_DEV_API = false;\nconst USE_DEV_API = true;\n'
  );
  assert.equal(status, 1);
  assert.match(stdout, /WRONG\s+USE_DEV_API is true/);
});

// The other direction: a multi-line block comment can put a bare `const ... =
// true;` at the start of its own line, where the anchor alone cannot tell it
// from live code. Stripping block comments first keeps the gate from failing a
// file that is actually correct.
test('passes when a block-commented true is only commentary above a live false', () => {
  const { status, stdout } = runProductionApiGate(
    '/*\nconst USE_DEV_API = true;\n*/\nconst USE_DEV_API = false;\n'
  );
  assert.equal(status, 0, stdout);
  assert.match(stdout, /^OK\s+src\/config\/variables\.local\.ts routes this build/m);
});

test('fails when a block-commented false sits above a live true', () => {
  const { status, stdout } = runProductionApiGate(
    '/* const USE_DEV_API = false; */\nconst USE_DEV_API = true;\n'
  );
  assert.equal(status, 1);
  assert.match(stdout, /WRONG\s+USE_DEV_API is true/);
});

// Two live declarations cannot both be the one the build reads, so the gate
// must not pick a winner.
test('fails when USE_DEV_API is declared twice', () => {
  const { status, stdout } = runProductionApiGate(
    'const USE_DEV_API = false;\nconst USE_DEV_API = true;\n'
  );
  assert.equal(status, 1);
  assert.match(stdout, /WRONG\s+USE_DEV_API declared 2 times/);
});
