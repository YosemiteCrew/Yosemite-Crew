'use strict';

const childProcess = require('node:child_process');
const path = require('node:path');

const adHocSignForLocalLaunch = (appPath) => {
  const entitlements = path.join(__dirname, '..', 'resources', 'entitlements.mac.plist');
  childProcess.execFileSync(
    'codesign',
    [
      // No `--deep` — it is deprecated and signs nested code with the same flags
      // incorrectly. electron-builder already signs nested binaries; this is only
      // an ad-hoc re-sign of the top-level bundle for local launch.
      '--force',
      '--sign',
      '-',
      '--options',
      'runtime',
      '--entitlements',
      entitlements,
      appPath,
    ],
    { stdio: 'inherit' }
  );
};

exports.default = async function notarizeMacBuild(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const { APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID } = process.env;
  const appName = context.packager.appInfo.productFilename;
  const appPath = `${context.appOutDir}/${appName}.app`;

  if (process.env.YC_DESKTOP_NOTARIZE_DRY_RUN === '1') {
    console.log(`Skipping macOS notarization dry run for ${appPath}.`);
    return;
  }

  if (!APPLE_ID || !APPLE_APP_SPECIFIC_PASSWORD || !APPLE_TEAM_ID) {
    console.log(
      'Skipping macOS notarization: APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, or APPLE_TEAM_ID is not set.'
    );
    console.log('Ad-hoc signing macOS app for local launch verification.');
    adHocSignForLocalLaunch(appPath);
    return;
  }

  const { notarize } = require('@electron/notarize');

  await notarize({
    appBundleId: context.packager.appInfo.id,
    appPath,
    appleId: APPLE_ID,
    appleIdPassword: APPLE_APP_SPECIFIC_PASSWORD,
    teamId: APPLE_TEAM_ID,
  });
};
