#!/usr/bin/env node
'use strict';

// CLI entry to export a diagnostics bundle without launching the full desktop
// app.  Usage:
//   node scripts/export-diagnostics.js [--out ./my-bundle.zip]

const path = require('node:path');
const os = require('node:os');
const {
  collectDiagnosticData,
  createDiagnosticBundle,
  readRecentLogEntries,
  writeDiagnosticZip,
} = require('../build/diagnostics');
const { getDesktopConfig } = require('../build/navigation-policy');

const OUT_DIR = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const outFlag = args.indexOf('--out');
const destPath =
  outFlag !== -1 && args[outFlag + 1]
    ? path.resolve(process.cwd(), args[outFlag + 1])
    : path.join(OUT_DIR, `yc-desktop-diagnostics-${new Date().toISOString().slice(0, 10)}.zip`);

const EXPORTED_FUSES = {
  RunAsNode: false,
  EnableCookieEncryption: true,
  EnableNodeOptionsEnvironmentVariable: false,
  EnableNodeCliInspectArguments: false,
  EnableEmbeddedAsarIntegrityValidation: true,
  OnlyLoadAppFromAsar: true,
  LoadBrowserProcessSpecificV8Snapshot: false,
  GrantFileProtocolExtraPrivileges: true,
};

async function main() {
  const data = collectDiagnosticData({
    appVersion: process.env.npm_package_version || '0.0.0',
    electronVersion: process.versions.electron || '',
    chromeVersion: process.versions.chrome || '',
    nodeVersion: process.versions.node || '',
    platform: process.platform,
    arch: process.arch,
    osRelease: os.release(),
    isPackaged: false,
    config: getDesktopConfig({}),
    fuses: EXPORTED_FUSES,
  });

  const logPath = path.join(os.tmpdir(), 'desktop.log');
  const logEntries = readRecentLogEntries(logPath);
  const bundle = createDiagnosticBundle(data, logEntries);

  await writeDiagnosticZip(destPath, bundle.diagnosticsJson, bundle.logContent);
  console.log(`Diagnostics bundle written to: ${destPath}`);
}

main().catch((error) => {
  console.error('Failed to export diagnostics:', error.message);
  process.exit(1);
});
