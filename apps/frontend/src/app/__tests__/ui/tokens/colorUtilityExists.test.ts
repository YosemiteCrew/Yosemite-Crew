import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * A Tailwind colour utility naming a token that does not exist emits NO CSS at all.
 * The element simply inherits, so the text renders in the surrounding ink and looks
 * deliberate. Nothing catches it: it type-checks, it lints, the component's own tests
 * pass, and a screenshot shows readable text.
 *
 * `text-error-main` once shipped exactly that way, and is FIXED - this note is history,
 * not a live defect. There was no `--color-error-main` in `globals.css` and no
 * `.text-error-main` rule in the built stylesheet, so five error messages across PIMS
 * (the appointment submit error, the prescription signature error, the
 * companion-history load failure and the document-signing portal error) rendered in
 * ordinary body ink with no colour signal that anything had gone wrong. All five now
 * use `text-text-error`. Found by a story that asserted the error colour differed from
 * the normal one and measured both as rgb(48, 47, 46).
 *
 * Eight more dead utilities came out of the same audit: `border-error-border`,
 * `bg-danger-50`, `bg-blue-soft` (x4), `border-input-border`, `bg-surface-1`,
 * `bg-card-subtle` and `text-capton-1`. This test is what keeps them from returning.
 *
 * Tailwind v4 generates `text-x`, `bg-x` and `border-x` from a `--color-x` token, so
 * that is what this checks. Arbitrary values (`text-[var(--ink)]`) are generated from
 * the value itself and need no token.
 */
const APP = join(__dirname, '..', '..', '..');
const GLOBALS = join(APP, 'globals.css');

/** Class selectors written by hand in any project stylesheet. */
const handWrittenClasses = (): Set<string> => {
  const names = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.css')) {
        for (const m of readFileSync(full, 'utf8').matchAll(/\.([a-z][a-z0-9-]*)\s*[,{:]/g)) {
          names.add(m[1]);
        }
      }
    }
  };
  walk(APP);
  return names;
};

/** `--color-<name>` declarations, which are what Tailwind turns into utilities. */
const declaredColorTokens = (): Set<string> => {
  const css = readFileSync(GLOBALS, 'utf8');
  return new Set([...css.matchAll(/^\s*--color-([a-z0-9-]+):/gm)].map((m) => m[1]));
};

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full);
    return /\.tsx$/.test(entry.name) && !entry.name.includes('.stories.') ? [full] : [];
  });

/**
 * Utility prefixes whose suffix is a colour token. `text-` also spells typography
 * (`text-body-3`, `text-center`, `text-[13px]`), and `border-` also spells width and
 * style, so those are filtered by shape below rather than by prefix.
 */
/* `(?<![-\w])` anchors the prefix to the START of a class. Without it, `\b` happily
   matches the `text-` inside `border-input-text-placeholder-active` and reports a real,
   working utility as missing - which it did, on the first run of this test. */
const CANDIDATE =
  /(?<![-\w])(?:text|bg|border|ring|fill|stroke|divide|outline|shadow)-([a-z][a-z0-9]*(?:-[a-z0-9]+)+)\b/g;

/**
 * Suffixes Tailwind itself owns: sides and widths (`border-b-2`), keyword values
 * (`bg-no-repeat`), and ring geometry (`ring-offset-2`). These generate real CSS
 * without any project token, so they are not candidates for this check.
 */
const TAILWIND_OWN =
  /^(?:[trblxyse]-\d+|no-repeat|offset-\d+|clip-\w+|origin-\w+|gradient-to-\w+|\d+)$/;

/** Names that are Tailwind's own or are not colours at all. */
const NOT_A_COLOR_TOKEN =
  /^(?:body|caption|heading|display|title|label|sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl|left|right|center|justify|start|end|top|bottom|solid|dashed|dotted|double|none|hidden|clip|ellipsis|wrap|nowrap|balance|pretty|auto|inherit|current|transparent|black|white|opacity|separate|collapse|spacing|inner|xs)\b/;

describe('colour utilities resolve to a declared token', () => {
  const tokens = declaredColorTokens();
  const handWritten = handWrittenClasses();

  it('reads the token table it checks against', () => {
    expect(tokens.size).toBeGreaterThan(50);
    // The pair the miss was found through.
    expect(tokens.has('text-error')).toBe(true);
    expect(tokens.has('error-main')).toBe(false);
    // The hand-written side of the lookup, so a miss there cannot pass silently.
    expect(handWritten.has('text-page-title')).toBe(true);
  });

  it('has no component naming a colour token that does not exist', () => {
    const offenders: string[] = [];

    for (const file of sourceFiles(APP)) {
      const src = readFileSync(file, 'utf8');
      for (const match of src.matchAll(CANDIDATE)) {
        const name = match[1];
        if (NOT_A_COLOR_TOKEN.test(name)) continue;
        if (TAILWIND_OWN.test(name)) continue;
        if (tokens.has(name)) continue;
        // `border-t-card-border` is a side plus a colour: strip the side and retry.
        if (/^border-/.test(match[0]) && tokens.has(name.replace(/^[trblxyse]-/, ''))) continue;
        // Hand-written classes are real CSS even though no token generates them.
        if (handWritten.has(match[0])) continue;
        // Tailwind's built-in ramps (`slate-500`) and numeric steps of declared
        // families (`primary-600` where `--color-primary-600` exists) are covered
        // by the token check above; anything left is a name nothing defines.
        if (/^[a-z]+-\d{2,3}$/.test(name) && tokens.has(name.replace(/-\d+$/, ''))) continue;
        offenders.push(`${file.replace(APP, 'src/app')}: ${match[0]}`);
      }
    }

    expect([...new Set(offenders)]).toEqual([]);
  });
});
