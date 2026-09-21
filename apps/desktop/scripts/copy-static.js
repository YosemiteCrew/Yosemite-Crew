'use strict';

const fs = require('node:fs');
const path = require('node:path');

/*
 * The local pages are plain HTML, CSS and browser scripts: tsc does not see
 * them, so they are copied into build/ by hand.
 *
 * This used to be a hardcoded list of filenames guarded by `existsSync`, which
 * failed open in both directions - a page asset added to src/pages was silently
 * left out of the build, and a name deleted from src/pages was silently
 * skipped. Copying the directory removes the first case; `verifyPageReferences`
 * removes the second, by refusing to finish a build whose pages point at a file
 * that is not beside them.
 */
const copyPageAssets = (pagesSrcDir, pagesOutDir) => {
  const entries = fs.readdirSync(pagesSrcDir, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  if (files.length === 0) {
    throw new Error(`No page assets found in ${pagesSrcDir}`);
  }
  fs.mkdirSync(pagesOutDir, { recursive: true });
  for (const filename of files) {
    fs.copyFileSync(path.join(pagesSrcDir, filename), path.join(pagesOutDir, filename));
  }
  verifyPageReferences(pagesOutDir, files);
  return files;
};

// Anything with a scheme, a fragment or a protocol-relative host is not a file
// in this directory and is not this script's business.
const isLocalReference = (ref) =>
  ref !== '' && !/^[a-z][a-z0-9+.-]*:/i.test(ref) && !ref.startsWith('#') && !ref.startsWith('//');

const LOCAL_REFERENCE = /(?:src|href)="([^"]*)"/g;

/*
 * Every `src`/`href` a shipped page points at has to exist beside it. A missing
 * one is not a build error and not a runtime error either: the page loads, the
 * script 404s under file://, and the global it was going to define is simply
 * undefined - so the failure surfaces as a dead control somewhere in the UI.
 *
 * Stylesheet `url()` references are deliberately not covered: the only one is
 * the bundled font, which lands in build/fonts after this runs.
 */
const verifyPageReferences = (pagesOutDir, copied) => {
  const htmlFiles = copied.filter((filename) => filename.endsWith('.html'));
  if (htmlFiles.length === 0) {
    throw new Error(`No HTML pages found in ${pagesOutDir}; nothing could be verified`);
  }
  const missing = [];
  let checked = 0;
  for (const filename of htmlFiles) {
    const markup = fs.readFileSync(path.join(pagesOutDir, filename), 'utf8');
    for (const match of markup.matchAll(LOCAL_REFERENCE)) {
      const ref = match[1];
      if (!isLocalReference(ref)) continue;
      checked += 1;
      if (!fs.existsSync(path.resolve(pagesOutDir, ref))) missing.push(`${filename} -> ${ref}`);
    }
  }
  // Canary: a pattern that matched nothing would report every build as clean,
  // including the one this guard exists to stop.
  if (checked === 0) {
    throw new Error(`No local page references found in ${pagesOutDir}; the guard read nothing`);
  }
  if (missing.length > 0) {
    throw new Error(`Page assets referenced but not shipped:\n  ${missing.join('\n  ')}`);
  }
  return checked;
};

const copyFonts = (fontsSrcDir, fontsOutDir) => {
  if (!fs.existsSync(fontsSrcDir)) return [];
  fs.mkdirSync(fontsOutDir, { recursive: true });
  const files = fs.readdirSync(fontsSrcDir);
  for (const filename of files) {
    fs.copyFileSync(path.join(fontsSrcDir, filename), path.join(fontsOutDir, filename));
  }
  return files;
};

module.exports = { copyPageAssets, verifyPageReferences, copyFonts, isLocalReference };

if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  const buildDir = path.join(root, 'build');
  copyPageAssets(path.join(root, 'src', 'pages'), path.join(buildDir, 'pages'));
  // Bundled Satoshi Variable font → build/fonts, referenced by the local pages
  // via file:// as ../fonts/Satoshi-Variable.woff2. build/ ships in the package.
  copyFonts(path.join(root, 'resources', 'fonts'), path.join(buildDir, 'fonts'));
}
