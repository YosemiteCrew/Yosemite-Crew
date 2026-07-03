'use strict';

const childProcess = require('node:child_process');
const path = require('node:path');

const REQUIRED_AZURE_ENV = ['AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET'];
const DEFAULT_ENDPOINT = 'https://swn.codesigning.azure.net/';
const DEFAULT_ACCOUNT = 'yc-signing';
const DEFAULT_CERTIFICATE_PROFILE = 'yc-public-trust';
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_MODULE_TIMEOUT_MS = 5 * 60 * 1000;

let moduleReadyPromise = null;

const psQuote = (value) => `'${String(value).replace(/'/g, "''")}'`;

const timeoutFromEnv = (env, name, fallback) => {
  const raw = env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const getMissingAzureEnv = (env = process.env) =>
  REQUIRED_AZURE_ENV.filter((name) => !String(env[name] || '').trim());

const getTrustedSigningConfig = (env = process.env) => ({
  endpoint: env.AZURE_TRUSTED_SIGNING_ENDPOINT || DEFAULT_ENDPOINT,
  codeSigningAccountName: env.AZURE_TRUSTED_SIGNING_ACCOUNT || DEFAULT_ACCOUNT,
  certificateProfileName:
    env.AZURE_TRUSTED_SIGNING_CERTIFICATE_PROFILE || DEFAULT_CERTIFICATE_PROFILE,
  timestampRfc3161:
    env.AZURE_TRUSTED_SIGNING_TIMESTAMP_RFC3161 || 'http://timestamp.acs.microsoft.com',
  timestampDigest: env.AZURE_TRUSTED_SIGNING_TIMESTAMP_DIGEST || 'SHA256',
  fileDigest: env.AZURE_TRUSTED_SIGNING_FILE_DIGEST || 'SHA256',
});

const buildInstallModuleScript = () => `
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Install-PackageProvider -Name NuGet -MinimumVersion 2.8.5.201 -Force -Scope CurrentUser -ErrorAction SilentlyContinue | Out-Null
Install-Module -Name TrustedSigning -MinimumVersion 0.5.0 -Force -AllowClobber -Repository PSGallery -Scope CurrentUser -ErrorAction Stop
Import-Module TrustedSigning -MinimumVersion 0.5.0 -ErrorAction Stop
`;

const buildEndpointProbeScript = (config) => `
$ErrorActionPreference = 'Stop'
$uri = [Uri]${psQuote(config.endpoint)}
$client = [Net.Sockets.TcpClient]::new()
try {
  $connect = $client.BeginConnect($uri.Host, 443, $null, $null)
  if (-not $connect.AsyncWaitHandle.WaitOne(30000)) {
    throw "Timed out connecting to $($uri.Host):443"
  }
  $client.EndConnect($connect)
}
finally {
  $client.Close()
}
`;

const buildInvokeTrustedSigningScript = (filePath, config) => `
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Import-Module TrustedSigning -MinimumVersion 0.5.0 -ErrorAction Stop
$params = @{
  Endpoint = ${psQuote(config.endpoint)}
  CertificateProfileName = ${psQuote(config.certificateProfileName)}
  CodeSigningAccountName = ${psQuote(config.codeSigningAccountName)}
  TimestampRfc3161 = ${psQuote(config.timestampRfc3161)}
  TimestampDigest = ${psQuote(config.timestampDigest)}
  FileDigest = ${psQuote(config.fileDigest)}
  Files = ${psQuote(filePath)}
}
Invoke-TrustedSigning @params
`;

const runPowerShellScript = (script, label, timeoutMs, deps = {}) => {
  const env = deps.env || process.env;
  const spawn = deps.spawn || childProcess.spawn;
  const command = env.YC_DESKTOP_POWERSHELL || 'pwsh';
  const args = [
    '-NoLogo',
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    script,
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      stdio: deps.stdio || 'inherit',
      windowsHide: true,
    });

    let settled = false;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      if (!child.killed) child.kill();
    }, timeoutMs);

    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve();
    };

    child.on('error', (error) => finish(error));
    child.on('close', (code, signal) => {
      if (timedOut) {
        finish(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s`));
        return;
      }
      if (code === 0) {
        finish();
        return;
      }
      finish(new Error(`${label} failed with exit code ${code ?? signal ?? 'unknown'}`));
    });
  });
};

const assertSigningEnvironment = (env = process.env) => {
  const missing = getMissingAzureEnv(env);
  if (missing.length > 0) {
    throw new Error(`Missing Azure Trusted Signing environment variables: ${missing.join(', ')}`);
  }
};

const shouldRequireSigning = (env = process.env) =>
  env.YC_DESKTOP_REQUIRE_WINDOWS_SIGNING === '1' || env.CI === 'true';

const ensureTrustedSigningModule = (deps = {}) => {
  if (!moduleReadyPromise) {
    const env = deps.env || process.env;
    const timeoutMs = timeoutFromEnv(
      env,
      'YC_DESKTOP_WINDOWS_SIGN_MODULE_TIMEOUT_MS',
      DEFAULT_MODULE_TIMEOUT_MS
    );
    moduleReadyPromise = runPowerShellScript(
      buildInstallModuleScript(),
      'TrustedSigning module setup',
      timeoutMs,
      deps
    ).catch((error) => {
      moduleReadyPromise = null;
      throw error;
    });
  }
  return moduleReadyPromise;
};

const runPreflight = async (deps = {}) => {
  const env = deps.env || process.env;
  const platform = deps.platform || process.platform;
  assertSigningEnvironment(env);
  if (platform !== 'win32') {
    throw new Error('Windows Trusted Signing preflight must run on a Windows runner.');
  }
  const config = getTrustedSigningConfig(env);
  await runPowerShellScript(
    buildEndpointProbeScript(config),
    'Azure Trusted Signing endpoint probe',
    timeoutFromEnv(env, 'YC_DESKTOP_WINDOWS_SIGN_PREFLIGHT_TIMEOUT_MS', 60 * 1000),
    deps
  );
  await ensureTrustedSigningModule(deps);
};

const sign = async (configuration, _packager, deps = {}) => {
  const env = deps.env || process.env;
  const platform = deps.platform || process.platform;
  const filePath = configuration && configuration.path;

  if (!filePath) throw new Error('Windows signing hook received no file path.');

  const requireSigning = shouldRequireSigning(env);
  if (env.YC_DESKTOP_SKIP_WINDOWS_SIGNING === '1') {
    if (requireSigning) {
      throw new Error('Windows signing skip is not allowed when signing is required.');
    }
    console.warn(`[windows-sign] Skipping Windows signing for ${path.basename(filePath)}.`);
    return;
  }

  const missing = getMissingAzureEnv(env);
  if (missing.length > 0) {
    if (requireSigning) assertSigningEnvironment(env);
    console.warn(`[windows-sign] Skipping unsigned local build; missing ${missing.join(', ')}.`);
    return;
  }

  if (platform !== 'win32') {
    if (requireSigning) {
      throw new Error('Windows signing requires a Windows runner.');
    }
    console.warn(`[windows-sign] Skipping Windows signing on ${platform}.`);
    return;
  }

  const config = getTrustedSigningConfig(env);
  const timeoutMs = timeoutFromEnv(env, 'YC_DESKTOP_WINDOWS_SIGN_TIMEOUT_MS', DEFAULT_TIMEOUT_MS);

  await ensureTrustedSigningModule(deps);
  console.log(`[windows-sign] Signing ${path.basename(filePath)} with Azure Trusted Signing.`);
  await runPowerShellScript(
    buildInvokeTrustedSigningScript(filePath, config),
    `Azure Trusted Signing for ${path.basename(filePath)}`,
    timeoutMs,
    deps
  );
};

if (require.main === module) {
  runPreflight()
    .then(() => {
      console.log('[windows-sign] Azure Trusted Signing preflight passed.');
    })
    .catch((error) => {
      console.error(`[windows-sign] ${error.message || error}`);
      process.exitCode = 1;
    });
}

module.exports = sign;
module.exports.REQUIRED_AZURE_ENV = REQUIRED_AZURE_ENV;
module.exports.buildEndpointProbeScript = buildEndpointProbeScript;
module.exports.buildInvokeTrustedSigningScript = buildInvokeTrustedSigningScript;
module.exports.getMissingAzureEnv = getMissingAzureEnv;
module.exports.getTrustedSigningConfig = getTrustedSigningConfig;
module.exports.runPreflight = runPreflight;
