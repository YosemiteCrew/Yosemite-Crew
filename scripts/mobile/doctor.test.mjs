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
const runDoctor = ({ assetFonts, registered, plistBody }) => {
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
