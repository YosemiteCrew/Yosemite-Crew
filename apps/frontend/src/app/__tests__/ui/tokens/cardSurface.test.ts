/**
 * The card surface is declared once, and the migration onto it was a no-op.
 *
 * The warm-bone frame - `--screen` ground, hairline border, the two-stop depth
 * shadow - existed as exactly one CSS class (`.TableShell`) and as a hand-typed
 * Tailwind string in 39 more files and a hand-typed CSS block in 12. Nothing
 * could enforce it, because a four-utility string spread across a `className`
 * is not greppable and a reviewer cannot see that two cards agree.
 *
 * Two claims are worth a test rather than a sentence:
 *
 *   1. Replacing `bg-neutral-0` / `border-card-border` with a class that writes
 *      `var(--screen)` / `var(--hairline)` changed no colour. That is only true
 *      because those utilities alias those tokens, in BOTH themes - a fact
 *      about globals.css that a future retint can break silently.
 *   2. No copy came back. The gate is the point of the whole exercise; without
 *      it the 39 files return over a month and we do this again.
 *
 * The CSS-literal check collapses whitespace before matching. Prettier
 * hard-wraps a `box-shadow` past the print width, and 9 of the 12 CSS
 * occurrences are wrapped - a line-oriented scan finds 3 of 12 and reports a
 * confident near-zero.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import postcss from 'postcss';

import { GLOBALS_CSS, resolveColour } from '@/app/__tests__/support/globalsTokens';

const SRC = join(process.cwd(), 'src');

const declarationsOf = (selector: string, css: string): Map<string, string> => {
  const found = new Map<string, string>();
  postcss.parse(css).walkRules((rule) => {
    if (rule.selector !== selector) return;
    rule.walkDecls((decl) => {
      found.set(decl.prop, decl.value.replace(/\s+/g, ' ').trim());
    });
  });
  return found;
};

/** Source with comments and whitespace runs flattened, so a hard-wrapped
    declaration and a single-line one are the same string to a scan. */
const flatten = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ');

const TAILWIND_RECIPE = 'shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)]';
const CSS_RECIPE = '0 1px 2px var(--sh03), 0 8px 22px var(--sh05)';

/**
 * The CSS spelling still lives in these files and only these.
 *
 * They are NOT the same edit as the Tailwind ones: three of them
 * (`.invite-picker-card`, `.org-picker-card`, `.videos-card-tile`) carry the
 * shadow over a transparent ground with no background of their own, and two
 * have `:hover` / `--current` rules that override the frame. Applying an
 * unlayered class there is a visible change and a cascade question, not a
 * rename, so they are a separate change with its own screenshots. Listing them
 * by name means a NEW css copy fails this test rather than hiding among them.
 */
const CSS_COPIES_REMAINING = [
  'app/features/appointments/components/Calendar/AppointmentCalendar.tsx',
  'app/features/appointments/components/Calendar/TaskCalendar.tsx',
  'app/features/appointments/components/Calendar/responsive/PhoneDayRail.css',
  'app/features/developers/pages/DeveloperApiKeys/DeveloperApiKeys.css',
  'app/features/developers/pages/DeveloperBilling/DeveloperBilling.css',
  'app/features/developers/pages/DeveloperPlugins/DeveloperPlugins.css',
  'app/features/developers/pages/DeveloperWebsiteBuilder/DeveloperWebsiteBuilder.css',
  'app/features/integrations/pages/IdexxWorkspace/index.tsx',
  'app/ui/cards/InviteCard/InviteCard.css',
  'app/ui/cards/OrgCard/OrgCard.css',
  'app/ui/cards/VideosCard/VideosCard.css',
];

describe('.yc-card-surface is the only declaration of the card frame', () => {
  it('declares the four surface properties and nothing else', () => {
    const decls = declarationsOf('.yc-card-surface', GLOBALS_CSS);
    expect(Object.fromEntries(decls)).toEqual({
      background: 'var(--screen)',
      border: '1px solid var(--hairline)',
      'border-radius': '18px',
      'box-shadow': CSS_RECIPE,
    });
  });

  it('leaves .TableShell holding behaviour only, so the frame is not declared twice', () => {
    const sheet = readFileSync(join(SRC, 'app/ui/tables/GenericTable/Generictable.css'), 'utf8');
    const decls = declarationsOf('.TableShell', sheet);
    expect([...decls.keys()].sort()).toEqual(['isolation', 'min-height', 'overflow']);
  });

  it('keeps the three radius tiers the app already ships, each declared once', () => {
    expect(Object.fromEntries(declarationsOf('.yc-card-surface--tile', GLOBALS_CSS))).toEqual({
      'border-radius': '16px',
    });
    expect(Object.fromEntries(declarationsOf('.yc-card-surface--inset', GLOBALS_CSS))).toEqual({
      'border-radius': '14px',
    });
    expect(Object.fromEntries(declarationsOf('.yc-card-surface--flat', GLOBALS_CSS))).toEqual({
      'box-shadow': '0 1px 2px var(--sh03)',
    });
  });
});

describe('the migration changed no colour, because the spellings alias', () => {
  /* Every background spelling the 39 files used, and every border spelling. If
     any of these stops aliasing, cards that read identical today diverge and
     this test names which spelling moved. */
  it.each([false, true])('background spellings agree (dark=%s)', (dark) => {
    const screen = resolveColour('var(--screen)', dark);
    expect(resolveColour('var(--color-neutral-0)', dark)).toBe(screen);
    expect(resolveColour('var(--color-surface-card)', dark)).toBe(screen);
    expect(resolveColour('var(--color-screen)', dark)).toBe(screen);
  });

  it.each([false, true])('border spellings agree (dark=%s)', (dark) => {
    const hairline = resolveColour('var(--hairline)', dark);
    expect(resolveColour('var(--color-card-border)', dark)).toBe(hairline);
    expect(resolveColour('var(--color-neutral-200)', dark)).toBe(hairline);
    expect(resolveColour('var(--color-hairline)', dark)).toBe(hairline);
  });

  /* The comparator above is only worth its passes if it can fail. --band is the
     neighbouring bone surface, one step darker; if this reads equal, the
     resolver is returning a constant and the four assertions above mean
     nothing. */
  it('the spelling comparator can say two tokens differ', () => {
    expect(resolveColour('var(--band)', false)).not.toBe(resolveColour('var(--screen)', false));
  });
});

describe('no copy of the recipe survives outside globals.css', () => {
  const files = readdirSync(join(SRC, 'app'), { recursive: true, encoding: 'utf8' })
    .map((f) => join('app', f))
    .filter((f) => /\.(ts|tsx|css)$/.test(f) && !/\.test\.tsx?$/.test(f))
    .sort();
  const sources = new Map(files.map((f) => [f, readFileSync(join(SRC, f), 'utf8')]));

  it('reads a corpus that could contain the recipe', () => {
    expect(files.length).toBeGreaterThan(500);
    expect(flatten(GLOBALS_CSS)).toContain(CSS_RECIPE);
  });

  /**
   * The one Tailwind call site that is not a rename.
   *
   * ExploreCard's stat tile steps its radius at the xl breakpoint
   * (`rounded-[14px] xl:rounded-2xl`). `.yc-card-surface` is unlayered so that
   * it beats Tailwind's layered bg/border/shadow utilities - which also means a
   * layered `xl:rounded-2xl` can no longer override its radius, and the tile
   * would silently freeze at 14px on desktop. The radius-ladder change (the
   * design system's `--radius-card` is 20px, and the repo defines no radius
   * tokens at all) removes the step, so this resolves there rather than by
   * inventing a breakpoint variant for a hand-written class.
   */
  const TAILWIND_COPIES_REMAINING = ['app/ui/cards/ExploreCard/ExploreCard.tsx'];

  it('has no hand-typed Tailwind copies beyond the one responsive tile', () => {
    const offenders = [...sources]
      .filter(([, text]) => text.includes(TAILWIND_RECIPE))
      .map(([f]) => f)
      .sort();
    expect(offenders).toEqual(TAILWIND_COPIES_REMAINING);
  });

  it('confines the CSS-declared copies to the files still awaiting their own change', () => {
    const offenders = [...sources]
      .filter(([f, text]) => f !== 'app/globals.css' && flatten(text).includes(CSS_RECIPE))
      .map(([f]) => f)
      .sort();
    expect(offenders).toEqual(CSS_COPIES_REMAINING);
  });

  /* Both scans above are negatives, and a negative is only as wide as the
     matcher. A wrapped `box-shadow` is the exact shape that made a first pass
     at this report 3 of 12: prove the flattened matcher sees one. */
  it('the CSS matcher sees a hard-wrapped declaration', () => {
    const wrapped =
      '.x {\n  box-shadow:\n    0 1px 2px var(--sh03),\n    0 8px 22px var(--sh05);\n}';
    expect(wrapped.includes(CSS_RECIPE)).toBe(false);
    expect(flatten(wrapped)).toContain(CSS_RECIPE);
  });

  it('the Tailwind matcher fires on a planted copy', () => {
    const planted = '<div className="rounded-2xl border bg-neutral-0 ' + TAILWIND_RECIPE + '" />';
    expect(planted.includes(TAILWIND_RECIPE)).toBe(true);
  });
});
