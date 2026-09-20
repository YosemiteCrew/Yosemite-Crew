import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// The build step is a plain CommonJS script, run by `pnpm run build` rather
// than imported by the app, so it is required here and its surface restated for
// the type checker.
import untypedCopyStatic from '../scripts/copy-static.js';

const copyStatic: {
  copyPageAssets: (pagesSrcDir: string, pagesOutDir: string) => string[];
  verifyPageReferences: (pagesOutDir: string, copied: string[]) => number;
  copyFonts: (fontsSrcDir: string, fontsOutDir: string) => string[];
  isLocalReference: (ref: string) => boolean;
} = untypedCopyStatic;

let workDir: string;
let srcDir: string;
let outDir: string;

beforeEach(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yc-copy-static-'));
  srcDir = path.join(workDir, 'pages');
  outDir = path.join(workDir, 'build', 'pages');
  fs.mkdirSync(srcDir, { recursive: true });
});

afterEach(() => {
  fs.rmSync(workDir, { recursive: true, force: true });
});

const writePage = (name: string, contents: string): void =>
  fs.writeFileSync(path.join(srcDir, name), contents, 'utf8');

describe('copyPageAssets', () => {
  /*
   * The list of page assets used to be maintained by hand. A browser script
   * added to src/pages and wired into a page was simply not copied, and the
   * build said nothing: the page then 404s the script under file:// and the
   * global it defines is undefined, so the failure shows up as a dead control
   * in the UI rather than a broken build (found while shipping #3297/#3298).
   */
  test('ships every file in the source directory, not a list someone maintains', () => {
    writePage('page.html', '<script src="helper.js"></script>');
    writePage('helper.js', '// a script nobody remembered to list');
    writePage('page.css', 'body { color: red; }');

    const copied = copyStatic.copyPageAssets(srcDir, outDir);

    expect([...copied].sort()).toEqual(['helper.js', 'page.css', 'page.html']);
    for (const filename of copied) {
      expect(fs.existsSync(path.join(outDir, filename))).toBe(true);
    }
  });

  test('a subdirectory is not copied as if it were a file', () => {
    writePage('page.html', '<link rel="stylesheet" href="page.css" />');
    writePage('page.css', 'body { color: red; }');
    fs.mkdirSync(path.join(srcDir, 'nested'));

    expect([...copyStatic.copyPageAssets(srcDir, outDir)].sort()).toEqual([
      'page.css',
      'page.html',
    ]);
  });

  test('an empty source directory fails the build rather than shipping nothing', () => {
    expect(() => copyStatic.copyPageAssets(srcDir, outDir)).toThrow(/No page assets found/);
  });
});

describe('verifyPageReferences', () => {
  test('a page pointing at a file that was not shipped fails the build', () => {
    writePage('page.html', '<script src="present.js"></script><script src="absent.js"></script>');
    writePage('present.js', '// here');

    expect(() => copyStatic.copyPageAssets(srcDir, outDir)).toThrow(
      /Page assets referenced but not shipped:[\s\S]*page\.html -> absent\.js/
    );
  });

  test('names every missing reference, not just the first', () => {
    writePage('a.html', '<script src="gone-a.js"></script>');
    writePage('b.html', '<link rel="stylesheet" href="gone-b.css" />');

    expect(() => copyStatic.copyPageAssets(srcDir, outDir)).toThrow(/gone-a\.js[\s\S]*gone-b\.css/);
  });

  test('a page whose references all resolve passes, and reports how many it read', () => {
    writePage(
      'page.html',
      '<link rel="stylesheet" href="page.css" /><script src="page.js"></script>'
    );
    writePage('page.css', 'body { color: red; }');
    writePage('page.js', '// here');

    const copied = copyStatic.copyPageAssets(srcDir, outDir);
    expect(copyStatic.verifyPageReferences(outDir, copied)).toBe(2);
  });

  /*
   * The canary. A pattern that matched nothing - a rename, a change of quoting
   * style - would report every build as clean, including the one this guard
   * exists to stop.
   */
  test('an HTML page with no local references at all is an error, not a pass', () => {
    writePage('page.html', '<p>nothing to load here</p>');

    expect(() => copyStatic.copyPageAssets(srcDir, outDir)).toThrow(/the guard read nothing/);
  });

  test('a build with no HTML pages is an error, not a pass', () => {
    writePage('orphan.js', '// no page loads this');

    expect(() => copyStatic.copyPageAssets(srcDir, outDir)).toThrow(/No HTML pages found/);
  });
});

describe('isLocalReference', () => {
  test.each([['helper.js'], ['tokens.css'], ['../fonts/Satoshi-Variable.woff2']])(
    '%s is a file beside the page',
    (ref) => {
      expect(copyStatic.isLocalReference(ref)).toBe(true);
    }
  );

  test.each([
    ['https://example.test/x.js'],
    ['http://example.test/x.js'],
    ['file:///tmp/x.js'],
    ['data:image/png;base64,AAAA'],
    ['blob:abc'],
    ['#main'],
    ['//cdn.example.test/x.js'],
    [''],
  ])('%p is not this build step to resolve', (ref) => {
    expect(copyStatic.isLocalReference(ref)).toBe(false);
  });
});

describe('copyFonts', () => {
  test('copies the bundled font files', () => {
    const fontsSrc = path.join(workDir, 'fonts');
    fs.mkdirSync(fontsSrc);
    fs.writeFileSync(path.join(fontsSrc, 'Satoshi-Variable.woff2'), 'not-really-a-font');

    const fontsOut = path.join(workDir, 'build', 'fonts');
    expect(copyStatic.copyFonts(fontsSrc, fontsOut)).toEqual(['Satoshi-Variable.woff2']);
    expect(fs.existsSync(path.join(fontsOut, 'Satoshi-Variable.woff2'))).toBe(true);
  });

  test('a repository with no bundled fonts is not an error', () => {
    expect(copyStatic.copyFonts(path.join(workDir, 'absent'), path.join(workDir, 'out'))).toEqual(
      []
    );
  });
});
