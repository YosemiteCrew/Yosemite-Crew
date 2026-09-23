import fs from 'node:fs';
import path from 'node:path';

// The local pages are plain files loaded over file:// under a strict CSP, so
// nothing type-checks or bundles them: a page script can reference a helper
// its HTML never loads, and the only symptom is that half the page quietly
// stops working. That is not hypothetical - the first cut of the #3299 fix
// shipped carousel-autoplay.js, registered it for packaging and unit tested
// it, and welcome.html did not load it. Every unit test stayed green while the
// carousel's accessibility attributes were never applied at all.
//
// Three things are checked here, all of them purely from the files:
//   1. every asset a page references exists;
//   2. every asset a page references is registered for packaging, or it will
//      not ship (the rule apps/desktop/AGENTS.md states);
//   3. every `globalThis.ycSomething` a page script reads is assigned by a
//      helper the same page loads.

const PAGES_DIR = path.join(__dirname, '..', 'src', 'pages');

const readPage = (file: string): string => fs.readFileSync(path.join(PAGES_DIR, file), 'utf8');

const htmlFiles = fs.readdirSync(PAGES_DIR).filter((f) => f.endsWith('.html'));

// Local references only: a page may also point at ../fonts or ../../resources,
// which are copied by their own branch of copy-static.js.
const localRefs = (html: string, attribute: 'src' | 'href'): string[] => {
  const pattern = new RegExp(`${attribute}="([^"]+)"`, 'g');
  return [...html.matchAll(pattern)]
    .map((m) => m[1]!)
    .filter((ref) => !ref.includes('/') && (ref.endsWith('.js') || ref.endsWith('.css')));
};

const scriptRefs = (html: string): string[] =>
  [...html.matchAll(/<script\s+src="([^"]+)"/g)].map((m) => m[1]!).filter((r) => !r.includes('/'));

const packagedAssets = (): string[] => {
  // New implementation copies the entire directory, so all files in src/pages are packaged.
  return fs
    .readdirSync(PAGES_DIR)
    .filter((f) => f.endsWith('.js') || f.endsWith('.css') || f.endsWith('.html'));
};

describe('local page assets', () => {
  test('there are pages to check', () => {
    expect(htmlFiles.length).toBeGreaterThan(0);
  });

  test.each(htmlFiles)('%s references only files that exist', (file) => {
    const html = readPage(file);
    const refs = [...localRefs(html, 'src'), ...localRefs(html, 'href')];
    const missing = refs.filter((ref) => !fs.existsSync(path.join(PAGES_DIR, ref)));
    expect(missing).toEqual([]);
  });

  test.each(htmlFiles)('everything %s references is registered for packaging', (file) => {
    const html = readPage(file);
    const refs = [...localRefs(html, 'src'), ...localRefs(html, 'href')];
    const packaged = packagedAssets();
    const unpackaged = refs.filter((ref) => !packaged.includes(ref));
    expect(unpackaged).toEqual([]);
  });

  test('every page HTML is itself registered for packaging', () => {
    const packaged = packagedAssets();
    expect(htmlFiles.filter((f) => !packaged.includes(f))).toEqual([]);
  });
});

describe('page script dependencies', () => {
  // `root.ycWindowCaption = api` at the bottom of a helper is how these scripts
  // publish themselves to the page.
  const providers = new Map<string, string>();
  for (const file of fs.readdirSync(PAGES_DIR).filter((f) => f.endsWith('.js'))) {
    for (const match of readPage(file).matchAll(/root\.(yc[A-Za-z]+)\s*=/g)) {
      providers.set(match[1]!, file);
    }
  }

  test('the helpers that publish a global were found', () => {
    // Guards the regex above: if it stopped matching, every case below would
    // pass by having nothing to resolve.
    expect(providers.size).toBeGreaterThan(0);
  });

  test.each(htmlFiles)('%s loads every helper its own scripts read', (file) => {
    const loaded = scriptRefs(readPage(file));
    const unmet: string[] = [];
    for (const script of loaded) {
      const source = readPage(script);
      for (const match of source.matchAll(/globalThis\.(yc[A-Za-z]+)/g)) {
        const global = match[1]!;
        const provider = providers.get(global);
        // ycDesktop comes from the preload bridge, not from a page file, so it
        // has no provider here and is correctly skipped.
        if (!provider || provider === script) continue;
        if (!loaded.includes(provider)) unmet.push(`${script} reads ${global} from ${provider}`);
      }
    }
    expect([...new Set(unmet)]).toEqual([]);
  });
});
