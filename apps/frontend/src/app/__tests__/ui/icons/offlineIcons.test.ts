import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { OFFLINE_ICONS } from '@/app/ui/icons/offlineIcons';

const SRC_DIR = path.resolve(__dirname, '../../../../');

/**
 * Every icon name reachable from source, in both forms the codebase uses:
 * a literal `icon="prefix:name"` prop, and a bare `'prefix:name'` string held in
 * a data array and passed through as a variable. The second form is why this
 * test exists - it is invisible to a search for `icon=` alone.
 *
 * `icon="` has to be anchored to a preceding space. Unanchored it also matches
 * the tail of `data-icon="..."`, which is a test hook carrying a component's own
 * value and not an Iconify name at all - that reported `warn`, `check`, `clock`,
 * `spinner` and even a raw `${name}` from inside a template literal as missing
 * icons. Every real prop is JSX, so it is always preceded by whitespace; the
 * only other `data-icon` uses live under `__tests__`, which is excluded below.
 */
const collectUsedIconNames = (): string[] => {
  const out = execFileSync(
    'grep',
    [
      '-rhoE',
      `([[:space:]]icon="[^"]+"|'(ion|mdi|solar):[a-z0-9-]+')`,
      SRC_DIR,
      '--include=*.tsx',
      '--include=*.ts',
      // The bundle itself lists every name, and this file quotes the pattern in
      // its own source - both would match themselves.
      '--exclude-dir=__tests__',
      '--exclude=offlineIcons.ts',
    ],
    { encoding: 'utf8' }
  );

  const names = new Set<string>();
  for (const match of out.matchAll(/\sicon="([^"]+)"/g)) names.add(match[1]);
  for (const match of out.matchAll(/'((?:ion|mdi|solar):[a-z0-9-]+)'/g)) names.add(match[1]);
  return [...names].sort();
};

describe('offline icon bundle', () => {
  it('bundles every icon name used anywhere in the app', () => {
    // A name that is not bundled falls through to Iconify's remote lookup, which
    // the CSP blocks since the icon API hosts were removed - so the icon simply
    // does not render. That failure is invisible in review, hence this check.
    const missing = collectUsedIconNames().filter((name) => !(name in OFFLINE_ICONS));

    expect(missing).toEqual([]);
  });

  it('gives every bundled icon renderable data', () => {
    for (const [name, icon] of Object.entries(OFFLINE_ICONS)) {
      expect(typeof icon.body).toBe('string');
      expect(icon.body.length).toBeGreaterThan(0);
      expect(icon.width).toBeGreaterThan(0);
      expect(icon.height).toBeGreaterThan(0);
      expect(name).toMatch(/^[a-z-]+:[a-z0-9-]+$/);
    }
  });
});
