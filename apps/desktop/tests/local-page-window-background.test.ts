import fs from 'node:fs';
import path from 'node:path';

/*
 * `LOCAL_PAGE_BACKGROUND` only does its job (issue #3298) on the windows that
 * actually use it. Two windows that display a local page were left on a colour
 * literal - the main window on `'#ffffff'` and the command palette on the LIGHT
 * `--screen` value hardcoded - so `tests/theming.test.ts`, which pins the
 * constant to the token, could not see them drift (issue #3425).
 *
 * This reads the shell sources and fails when a window that loads a local page
 * is constructed with anything but `localPageBackgroundColor(...)`. Windows
 * that host remote PIMS content are deliberately exempt: `childWindowOptions()`
 * paints white on purpose, because that is what the web app paints.
 */

const SRC_ROOT = path.join(__dirname, '..', 'src');

// The windows known to display a local page when this guard was written. They
// are asserted to be FOUND, not to be the whole set: a window added later is
// classified by the same rules and guarded without being listed here. The list
// exists so that a scanner which silently stops matching - a renamed helper, a
// reformatted constructor - fails instead of passing on an empty set.
const KNOWN_LOCAL_PAGE_WINDOWS = [
  'mainWindow',
  'settingsWindow',
  'vaultWindow',
  'commandPaletteWindow',
];

interface WindowSite {
  file: string;
  line: number;
  variable: string;
  /** Raw source of the `backgroundColor` value, or null when the option is absent. */
  backgroundColor: string | null;
  loadsLocalPage: boolean;
}

const tsFilesUnder = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return tsFilesUnder(full);
    return entry.isFile() && full.endsWith('.ts') ? [full] : [];
  });

/** End index (exclusive) of the object literal that starts at `open`. */
const matchingBrace = (source: string, open: number): number => {
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return source.length;
};

const CONSTRUCTION = /(?:(?:const|let|var)\s+)?([A-Za-z_$][\w$]*)\s*=\s*new BrowserWindow\(\s*\{/g;

export const scanWindowSites = (source: string, file = '<source>'): WindowSite[] => {
  const matches = [...source.matchAll(CONSTRUCTION)];
  return matches.map((match, index) => {
    const variable = match[1]!;
    const open = source.indexOf('{', match.index! + match[0].length - 1);
    const options = source.slice(open, matchingBrace(source, open));
    // Stop at `}` as well as `,`: a single-line constructor would otherwise
    // swallow the closing brace into the value and never match the helper.
    const background = /\bbackgroundColor\s*:\s*([^\n,}]+)/.exec(options);

    // Scoped to this construction's own region - up to the next one - because a
    // 2,400-line module reuses short window names across functions, and a
    // file-wide search for `win.loadFile(` picks up somebody else's `win`.
    // `void win\n  .loadFile(...)` is formatted across lines, so the receiver
    // and the call are matched with the whitespace between them.
    const region = source.slice(match.index!, matches[index + 1]?.index ?? source.length);
    const loads = new RegExp(String.raw`\b${variable}\b(?:\.webContents)?\s*\.loadFile\s*\(`);

    return {
      file,
      line: source.slice(0, match.index!).split('\n').length,
      variable,
      backgroundColor: background ? background[1]!.trim() : null,
      loadsLocalPage: loads.test(region),
    };
  });
};

const violations = (sites: WindowSite[]): WindowSite[] =>
  sites.filter(
    (site) => site.loadsLocalPage && !/^localPageBackgroundColor\(/.test(site.backgroundColor ?? '')
  );

const describeSite = (site: WindowSite): string =>
  `${site.file}:${site.line} ${site.variable} -> backgroundColor: ${site.backgroundColor ?? '(absent)'}`;

describe('scanWindowSites', () => {
  // The guard below passes by finding nothing, so it says nothing about the
  // scanner until the scanner is shown reporting a defect that is really there.
  const PLANTED = `
    const offender = new BrowserWindow({ title: 'x', backgroundColor: '#ffffff', show: false });
    void offender.loadFile(localPage('welcome'));

    const fixed = new BrowserWindow({
      title: 'y',
      backgroundColor: localPageBackgroundColor(nativeTheme.shouldUseDarkColors),
      show: false,
    });
    void fixed
      .loadFile(localPage('settings'));

    const remote = new BrowserWindow({ title: 'z', backgroundColor: '#ffffff' });
    void remote.loadURL(url);
  `;

  test('reports a local-page window that carries a colour literal', () => {
    expect(violations(scanWindowSites(PLANTED, 'planted.ts')).map((s) => s.variable)).toEqual([
      'offender',
    ]);
  });

  test('accepts the helper, including across a line break before .loadFile', () => {
    const fixed = scanWindowSites(PLANTED, 'planted.ts').find((s) => s.variable === 'fixed');
    expect(fixed?.loadsLocalPage).toBe(true);
    expect(fixed?.backgroundColor).toBe(
      'localPageBackgroundColor(nativeTheme.shouldUseDarkColors)'
    );
  });

  test('leaves a window that loads a remote URL alone', () => {
    const remote = scanWindowSites(PLANTED, 'planted.ts').find((s) => s.variable === 'remote');
    expect(remote?.loadsLocalPage).toBe(false);
    expect(remote?.backgroundColor).toBe(`'#ffffff'`);
  });

  test('a window with no backgroundColor that loads a local page is a violation', () => {
    const source = `
      const bare = new BrowserWindow({ title: 'x' });
      void bare.loadFile(localPage('vault'));
    `;
    expect(violations(scanWindowSites(source)).map((s) => s.variable)).toEqual(['bare']);
  });
});

describe('every window that displays a local page paints --screen', () => {
  const files = tsFilesUnder(SRC_ROOT);
  const sites = files.flatMap((file) =>
    scanWindowSites(fs.readFileSync(file, 'utf8'), path.relative(SRC_ROOT, file))
  );

  test('the scan reaches every BrowserWindow construction in src/', () => {
    // A construction the regex cannot attribute to a variable would be skipped
    // silently, and an unguarded window is exactly what this file is about.
    const constructions = files.reduce(
      (total, file) =>
        total + (fs.readFileSync(file, 'utf8').match(/new BrowserWindow\(/g)?.length ?? 0),
      0
    );
    expect(constructions).toBeGreaterThan(0);
    expect(sites).toHaveLength(constructions);
  });

  test('it finds the windows known to display a local page', () => {
    const local = sites.filter((s) => s.loadsLocalPage).map((s) => s.variable);
    expect(local).toEqual(expect.arrayContaining(KNOWN_LOCAL_PAGE_WINDOWS));
  });

  test('it also finds windows that do not, so the classification discriminates', () => {
    // Without this, a classifier that answered "local page" for everything
    // would satisfy the check above and quietly demand the helper on the
    // remote-content windows, where white is correct.
    expect(sites.filter((s) => !s.loadsLocalPage).length).toBeGreaterThan(0);
  });

  test('none of them carries a colour literal', () => {
    expect(violations(sites).map(describeSite)).toEqual([]);
  });
});
