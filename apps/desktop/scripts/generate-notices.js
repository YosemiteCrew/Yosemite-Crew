'use strict';

const fs = require('node:fs');
const path = require('node:path');

const appRoot = path.resolve(__dirname, '..');
const nodeModulesRoot = path.join(appRoot, 'node_modules');
const outputPath = path.join(appRoot, 'THIRD-PARTY-NOTICES.md');

const licenseFileNames = [
  'LICENSE',
  'LICENSE.md',
  'LICENSE.txt',
  'LICENCE',
  'LICENCE.md',
  'NOTICE',
  'NOTICE.md',
];

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const packageDirs = () => {
  if (!fs.existsSync(nodeModulesRoot)) {
    throw new Error(`No node_modules found at ${nodeModulesRoot}. Run pnpm install first.`);
  }

  const dirs = [];
  for (const entry of fs.readdirSync(nodeModulesRoot, {
    withFileTypes: true,
  })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(nodeModulesRoot, entry.name);
    if ((entry.isDirectory() || entry.isSymbolicLink()) && entry.name.startsWith('@')) {
      for (const scoped of fs.readdirSync(full, { withFileTypes: true })) {
        if (scoped.isDirectory() || scoped.isSymbolicLink())
          dirs.push(path.join(full, scoped.name));
      }
      continue;
    }
    if (entry.isDirectory() || entry.isSymbolicLink()) dirs.push(full);
  }
  return dirs;
};

const licenseTextFor = (dir) => {
  for (const name of licenseFileNames) {
    const candidate = path.join(dir, name);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return fs.readFileSync(candidate, 'utf8').trim();
    }
  }
  return '';
};

const collectPackages = () =>
  packageDirs()
    .map((dir) => {
      const manifestPath = path.join(dir, 'package.json');
      if (!fs.existsSync(manifestPath)) return null;
      const manifest = readJson(manifestPath);
      if (!manifest.name || manifest.private) return null;
      return {
        name: manifest.name,
        version: manifest.version || 'unknown',
        license: manifest.license || 'SEE PACKAGE',
        homepage: manifest.homepage || (manifest.repository && manifest.repository.url) || '',
        text: licenseTextFor(dir),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));

const render = (packages) => {
  const lines = [
    '# Third-Party Notices',
    '',
    'Generated from installed desktop dependencies. Re-run `pnpm --filter @yosemite-crew/desktop run desktop:notices` after dependency changes.',
    '',
  ];

  for (const pkg of packages) {
    lines.push(`## ${pkg.name}@${pkg.version}`, '');
    lines.push(`- License: ${pkg.license}`);
    if (pkg.homepage) lines.push(`- Source: ${pkg.homepage}`);
    lines.push('');
    if (pkg.text) {
      lines.push('```text', pkg.text, '```', '');
    } else {
      lines.push('_No license file was found in the installed package._', '');
    }
  }

  return `${lines.join('\n')}\n`;
};

const packages = collectPackages();
fs.writeFileSync(outputPath, render(packages), 'utf8');
console.log(`Wrote ${outputPath} with ${packages.length} packages.`);
