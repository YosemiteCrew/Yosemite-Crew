'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const sourceDir = path.join(root, 'src');
const buildDir = path.join(root, 'build');

// Local HTML pages + shared design-system stylesheet → build/pages
const pagesDir = path.join(buildDir, 'pages');
fs.mkdirSync(pagesDir, { recursive: true });
const pageAssets = [
  'loading.html',
  'loading.css',
  'loading.js',
  'offline.html',
  'welcome.html',
  'settings.html',
  'command-palette.html',
  'vault.html',
  'vault.css',
  'vault.js',
  'whats-new.html',
  'whats-new.css',
  'whats-new.js',
  'command-palette.css',
  'command-palette.js',
  'offline.css',
  'offline.js',
  'settings.css',
  'settings.js',
  'welcome.css',
  'welcome.js',
  'tokens.css',
  'tabbar.html',
  'tabbar.css',
];
for (const filename of pageAssets) {
  const src = path.join(sourceDir, 'pages', filename);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(pagesDir, filename));
  }
}

// Bundle the Satoshi Variable font → build/fonts (referenced by local pages
// via file:// as ../fonts/Satoshi-Variable.woff2). build/ ships in the package.
const fontsSrc = path.join(root, 'resources', 'fonts');
const fontsDir = path.join(buildDir, 'fonts');
if (fs.existsSync(fontsSrc)) {
  fs.mkdirSync(fontsDir, { recursive: true });
  for (const file of fs.readdirSync(fontsSrc)) {
    fs.copyFileSync(path.join(fontsSrc, file), path.join(fontsDir, file));
  }
}
