'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PRODUCT_NAME = 'Yosemite Crew PIMS';
const appRoot = path.resolve(__dirname, '..');
const distDir = path.join(appRoot, 'dist');

const findExecutable = () => {
  if (process.platform === 'darwin') {
    if (!fs.existsSync(distDir))
      throw new Error(`No dist directory found at ${distDir}. Run desktop:pack first.`);
    for (const entry of fs.readdirSync(distDir)) {
      const candidate = path.join(
        distDir,
        entry,
        `${PRODUCT_NAME}.app`,
        'Contents',
        'MacOS',
        PRODUCT_NAME
      );
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  if (process.platform === 'win32') {
    const candidate = path.join(distDir, 'win-unpacked', `${PRODUCT_NAME}.exe`);
    if (fs.existsSync(candidate)) return candidate;
  }

  if (process.platform === 'linux') {
    for (const entry of fs.readdirSync(distDir)) {
      const candidate = path.join(distDir, entry, PRODUCT_NAME);
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  throw new Error(`No packaged executable found under ${distDir}. Run desktop:pack first.`);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const rssForPid = (pid) => {
  if (process.platform === 'darwin' || process.platform === 'linux') {
    const output = childProcess
      .execFileSync('ps', ['-o', 'rss=', '-p', String(pid)], {
        encoding: 'utf8',
      })
      .trim();
    return output ? Number(output) * 1024 : 0;
  }
  if (process.platform === 'win32') {
    const output = childProcess
      .execFileSync(
        'powershell.exe',
        ['-NoProfile', '-Command', `(Get-Process -Id ${pid}).WorkingSet64`],
        { encoding: 'utf8' }
      )
      .trim();
    return output ? Number(output) : 0;
  }
  return 0;
};

const main = async () => {
  const executable = findExecutable();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yc-desktop-perf-'));
  const start = Date.now();
  const child = childProcess.spawn(executable, [], {
    env: {
      ...process.env,
      YC_DESKTOP_DISABLE_UPDATES: '1',
      YC_DESKTOP_USER_DATA_DIR: userDataDir,
    },
    stdio: 'ignore',
  });

  await sleep(5_000);
  const startupMs = Date.now() - start;
  const idleRssBytes = rssForPid(child.pid);

  child.kill();
  await sleep(1_000);
  fs.rmSync(userDataDir, {
    recursive: true,
    force: true,
    maxRetries: 3,
    retryDelay: 250,
  });

  console.log(
    JSON.stringify(
      {
        executable,
        startupMs,
        idleRssMb: Math.round((idleRssBytes / 1024 / 1024) * 10) / 10,
      },
      null,
      2
    )
  );
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
