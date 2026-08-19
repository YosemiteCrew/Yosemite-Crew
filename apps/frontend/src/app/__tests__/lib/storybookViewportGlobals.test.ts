import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Storybook 10 removed `parameters.viewport.defaultViewport` and
 * `parameters.viewport.viewports`. Both still type-check and still render, so the
 * failure is completely silent: the story runs its play function, passes, and draws
 * the full-width desktop markup under a name that promises a phone.
 *
 * That is exactly what happened here. Every "Phone" story in this Storybook except
 * four measured 1200px wide - the same width as a story with no viewport at all -
 * because the project presets were registered under the dead `viewports` key and the
 * stories selected with the dead `defaultViewport` one. Fourteen more selected a
 * preset named `phone`, which has never existed in `preview.ts`.
 *
 * None of that is reachable by type-checking, linting, or running the stories, which
 * is why it is asserted here instead.
 */
const APP_DIR = join(__dirname, '..', '..');
const PREVIEW = join(__dirname, '..', '..', '..', '..', '.storybook', 'preview.ts');

const storyFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return storyFiles(full);
    return entry.name.endsWith('.stories.tsx') ? [full] : [];
  });

/** The preset keys `preview.ts` declares, read from the file rather than imported. */
const declaredPresets = (): string[] => {
  const src = readFileSync(PREVIEW, 'utf8');
  const block = /const viewports = \{([\s\S]*?)\n\};/.exec(src);
  if (!block) throw new Error('preview.ts no longer declares a `viewports` map');
  return [...block[1].matchAll(/^ {2}(\w+): \{$/gm)].map((m) => m[1]);
};

/**
 * The preset keys reachable from a story that registers its own `options`, whether
 * it inlines the map or names a `const` declared in the same file.
 */
const localKeys = (src: string, firstKeyOrConst: string): string[] => {
  const decl = new RegExp(`const ${firstKeyOrConst} = \\{([\\s\\S]*?)\\n\\};`).exec(src);
  const body = decl ? decl[1] : src;
  return decl ? [...body.matchAll(/^ {2}(\w+): \{$/gm)].map((m) => m[1]) : [firstKeyOrConst];
};

describe('Storybook viewport wiring', () => {
  it('registers the project presets under the key Storybook 10 reads', () => {
    const src = readFileSync(PREVIEW, 'utf8');
    expect(src).toMatch(/viewport: \{\s*options: viewports,/);
    // The pre-10 spellings, which are inert.
    expect(src).not.toMatch(/viewport: \{\s*viewports,/);
    expect(src.includes('defaultViewport:')).toBe(false);
  });

  it('sets the project default through initialGlobals, not a parameter', () => {
    const src = readFileSync(PREVIEW, 'utf8');
    expect(src).toMatch(/initialGlobals: \{\s*viewport: \{ value: '(\w+)', isRotated: false \},/);
  });

  it('has no story pinning a viewport with the removed `defaultViewport` parameter', () => {
    const offenders = storyFiles(APP_DIR).filter((file) =>
      /viewport: \{[^}]*defaultViewport/.test(readFileSync(file, 'utf8'))
    );
    expect(offenders).toEqual([]);
  });

  it('has every story select a preset that actually exists', () => {
    const presets = declaredPresets();
    expect(presets).toContain('mobile');

    const unknown: string[] = [];
    for (const file of storyFiles(APP_DIR)) {
      const src = readFileSync(file, 'utf8');
      /* A story MAY register its own `options` map, which replaces the project one
         for that story - so the names it may select are those keys, not these. The
         earlier version of this test skipped such files instead, and that `continue`
         quietly excused thirteen of them: a deliberately broken preset name went
         undetected and the test still reported four passes. Resolve the local keys
         and check against them rather than looking away. */
      const local = /viewport: \{\s*options: \{?\s*(\w+)/.exec(src);
      const allowed = local ? localKeys(src, local[1]) : presets;
      for (const match of src.matchAll(/globals: \{ viewport: \{ value: '(\w+)'/g)) {
        if (!allowed.includes(match[1])) {
          unknown.push(`${file.replace(APP_DIR, 'src/app')}: '${match[1]}'`);
        }
      }
    }
    expect(unknown).toEqual([]);
  });
});
