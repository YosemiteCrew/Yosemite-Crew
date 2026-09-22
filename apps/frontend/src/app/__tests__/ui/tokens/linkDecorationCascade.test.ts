import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import postcss, { type Declaration, type Rule } from 'postcss';

/**
 * The cascade fight that `a { text-decoration: none !important }` started.
 *
 * That one rule sat unlayered in `globals.css`, and an unlayered `!important`
 * declaration beats a layered non-important one whatever its specificity. So no
 * surface could give a link an underline the ordinary way: `.DocsBody a`,
 * `.yc-doc a` and the legal policy links each answered with an `!important` of
 * their own, and the booking footer answered with Tailwind's `underline!`. Any
 * prose surface added after them started life failing `link-in-text-block`
 * (WCAG 2.1 AA, serious) and had to rediscover the trick - which is what #3471
 * and #3475 were filed for.
 *
 * Both halves matter, so both are asserted:
 *   - no element-level `text-decoration` rule on `a` in `globals.css`, which is
 *     what made the reset blanket;
 *   - no `!important` text-decoration anywhere in the app's stylesheets, which
 *     is the tax the blanket reset collected.
 *
 * Read with postcss rather than a regex: a regex over the file text cannot tell
 * a declaration from the comment above it explaining why the declaration is not
 * there, and this file ships with exactly such a comment.
 */
const APP = join(__dirname, '..', '..', '..');

const stylesheets = (): string[] => {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.css')) found.push(full);
    }
  };
  walk(APP);
  return found;
};

/** Every `text-decoration*` declaration in a sheet, with the selector it sits under. */
const decorations = (css: string): { selector: string; declaration: Declaration }[] => {
  const rows: { selector: string; declaration: Declaration }[] = [];
  postcss.parse(css).walkDecls((declaration) => {
    if (!declaration.prop.startsWith('text-decoration')) return;
    const parent = declaration.parent as Rule | undefined;
    rows.push({ selector: parent?.selector?.replace(/\s+/g, ' ').trim() ?? '', declaration });
  });
  return rows;
};

describe('link text-decoration cascade', () => {
  it('leaves no blanket element-level link reset in globals.css', () => {
    const offenders = decorations(readFileSync(join(APP, 'globals.css'), 'utf8'))
      .filter(({ selector }) =>
        selector.split(',').some((part) => /^a(:\w[\w-]*(\([^)]*\))?)*$/.test(part.trim()))
      )
      .map(({ selector, declaration }) => `${selector} { ${declaration.toString()} }`);

    expect(offenders).toEqual([]);
  });

  it('needs no !important anywhere to decorate a link', () => {
    const offenders = stylesheets().flatMap((file) =>
      decorations(readFileSync(file, 'utf8'))
        .filter(({ declaration }) => declaration.important)
        .map(
          ({ selector, declaration }) =>
            `${file.slice(APP.length + 1)}: ${selector} { ${declaration.toString()} }`
        )
    );

    expect(offenders).toEqual([]);
  });
});
