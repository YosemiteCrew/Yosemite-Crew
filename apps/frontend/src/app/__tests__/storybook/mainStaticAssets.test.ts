/**
 * The static-asset half of `.storybook/main.ts` - see #2779.
 *
 * `staticDirs` used to duplicate what Vite's `publicDir` already copies, and
 * the two copiers race inside Storybook's `Promise.all`, producing an
 * intermittent `EEXIST: mkdir './storybook-static/static'` that flaked the
 * play-function shards. Emptying it fixes that, but on its own it also swaps
 * the manager favicon for Storybook's default, because the `favicon` preset
 * infers one by scanning `staticDirs` when it is not set explicitly.
 *
 * These assert the pair together: the duplicate copier stays gone AND the
 * favicon stays stated. Deleting either line reintroduces a defect that no
 * other test in this repo can see - the race is timing-dependent and the
 * favicon only shows up in built `index.html`.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';

import config from '../../../../.storybook/main';

const publicDir = path.resolve(__dirname, '../../../../public');

describe('.storybook static asset ownership', () => {
  it('declares no staticDirs, so Vite publicDir is the only copier', () => {
    // Not `toHaveLength(0)` on a possibly-undefined value: an omitted key would
    // also read as "no duplicate copier" while letting the preset fall back to
    // its own default, which is a different configuration than the one meant.
    expect(config.staticDirs).toEqual([]);
  });

  it('sets the favicon explicitly rather than letting it be inferred', () => {
    expect(typeof config.favicon).toBe('string');
  });

  it('points the favicon at a file that exists in public/', () => {
    const { favicon } = config;

    expect(favicon).toBeDefined();

    expect(path.resolve(favicon as string)).toBe(path.join(publicDir, 'favicon.ico'));
    expect(existsSync(favicon as string)).toBe(true);
  });

  it('resolves the favicon absolutely, so it does not depend on cwd', () => {
    expect(path.isAbsolute(config.favicon as string)).toBe(true);
  });
});
