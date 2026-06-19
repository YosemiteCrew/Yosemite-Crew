'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses');

const getExecutablePath = (context) => {
  const productFilename = context.packager.appInfo.productFilename;
  if (context.electronPlatformName === 'darwin') {
    return path.join(context.appOutDir, `${productFilename}.app`);
  }
  if (context.electronPlatformName === 'win32') {
    return path.join(context.appOutDir, `${productFilename}.exe`);
  }
  return path.join(context.appOutDir, productFilename);
};

const patchMacInfoPlist = (context) => {
  if (context.electronPlatformName !== 'darwin') return;

  const productFilename = context.packager.appInfo.productFilename;
  const plistPath = path.join(
    context.appOutDir,
    `${productFilename}.app`,
    'Contents',
    'Info.plist'
  );
  const plistBuddy = '/usr/libexec/PlistBuddy';
  if (!fs.existsSync(plistPath) || !fs.existsSync(plistBuddy)) return;

  const setPlistValue = (keyPath, type, value) => {
    try {
      childProcess.execFileSync(plistBuddy, ['-c', `Set ${keyPath} ${value}`, plistPath], {
        stdio: 'ignore',
      });
    } catch {
      childProcess.execFileSync(plistBuddy, ['-c', `Add ${keyPath} ${type} ${value}`, plistPath], {
        stdio: 'ignore',
      });
    }
  };

  setPlistValue(':NSAppTransportSecurity:NSAllowsArbitraryLoads', 'bool', 'false');
  setPlistValue(':NSAppTransportSecurity:NSAllowsLocalNetworking', 'bool', 'true');
};

exports.default = async function applyElectronFuses(context) {
  await flipFuses(getExecutablePath(context), {
    version: FuseVersion.V1,
    strictlyRequireAllFuses: true,
    resetAdHocDarwinSignature: context.electronPlatformName === 'darwin',
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
    [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,
    // Local splash/welcome/offline pages load via file:// and need standard
    // file-protocol privileges to render in a packaged build.
    [FuseV1Options.GrantFileProtocolExtraPrivileges]: true,
  });
  patchMacInfoPlist(context);
};

exports.getExecutablePath = getExecutablePath;
