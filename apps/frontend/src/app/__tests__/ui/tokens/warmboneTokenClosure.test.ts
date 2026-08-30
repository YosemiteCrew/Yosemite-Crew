/**
 * The warm-bone overrides must cover exactly what the passport reads, and must
 * agree with the global system.
 *
 * `.yc-warmbone` is the one place in this stylesheet that re-states tokens the
 * global system already owns. It exists because the public passport has its own
 * light/dark control, so it needs a theme that can differ from the root - and
 * since #2578 it applies ONLY in that disagreeing case.
 *
 * That narrowing removed the two failure modes the copy had already shipped,
 * but it also made drift quieter: a wrong value is now only wrong in a state
 * nobody routinely looks at. This test is the trade. It re-derives what the
 * components read from the source on every run, rather than hard-coding a list
 * that would rot the same way the copy did.
 *
 * The two defects it is written against, both real and both shipped:
 *
 *   1. The block declared `--danger-text` while PublicPassportView reads
 *      `--status-danger-text`. One prefix apart. The expired-vaccination badge
 *      kept the light ink on the espresso card - 1.89:1, on a page its own
 *      source calls "read as proof of cover by travel and boarding staff" -
 *      while the valid badge rendered correctly, so the section looked fine.
 *      Caught here by MISSING_FROM.
 *
 *   2. `--blue-text` was a private literal in one half and an alias to a
 *      theme-flipping token in the other, so a fixed surface got the wrong
 *      blue. Caught here by THEME_INVARIANT_ALIASES.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const CSS = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8');

const SHARE = 'src/app/(routes)/(share)/passport/[id]';
const COMPONENTS = [
  fs.readFileSync(path.join(root, SHARE, 'PublicPassportView.tsx'), 'utf8'),
  fs.readFileSync(path.join(root, SHARE, 'PassportClient.tsx'), 'utf8'),
].join('\n');

/**
 * Every custom property the passport actually reads, derived from source.
 *
 * Two consumers, not one: the components, and the `.yc-warmbone` base rule
 * itself, which paints `background: var(--page)` and `color: var(--ink-body)`.
 * Reading only the TSX misses those and reports them as dead.
 */
const tokensRead = (): string[] => {
  const base = CSS.slice(CSS.indexOf('.yc-warmbone {'));
  const baseRule = base.slice(0, base.indexOf('}'));
  return [
    ...new Set(
      [
        ...COMPONENTS.matchAll(/var\((--[a-z0-9-]+)\)/g),
        ...baseRule.matchAll(/var\((--[a-z0-9-]+)\)/g),
      ].map((m) => m[1])
    ),
  ];
};

/** The declarations inside one CSS rule, by selector prefix. */
const declarationsIn = (selectorStart: string): Record<string, string> => {
  const at = CSS.indexOf(selectorStart);
  if (at === -1) throw new Error(`selector not found: ${selectorStart}`);
  const body = CSS.slice(CSS.indexOf('{', at) + 1, CSS.indexOf('}', at));
  const out: Record<string, string> = {};
  for (const [, name, value] of body.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) {
    out[name] = value.trim();
  }
  return out;
};

const LIGHT_OVERRIDE = "html[data-theme='dark'] .yc-warmbone[data-wb-theme='light']";
const DARK_OVERRIDE = "html:not([data-theme='dark']) .yc-warmbone[data-wb-theme='dark']";

/**
 * Read by the components but deliberately NOT overridden, because the global
 * value is already correct in the disagreeing state. Every entry needs a reason.
 */
const NOT_OVERRIDDEN: Record<string, string> = {
  '--font-newsreader': 'font family, not a colour - identical in both themes',
};

describe('warm-bone overrides cover what the passport reads', () => {
  it.each([
    ['light override', LIGHT_OVERRIDE],
    ['dark override', DARK_OVERRIDE],
  ])('%s declares every token the components read', (_label, selector) => {
    const declared = declarationsIn(selector);
    const missing = tokensRead().filter((t) => !(t in declared) && !(t in NOT_OVERRIDDEN));

    // This is the assertion that would have caught the 1.89:1 expired badge:
    // --status-danger-text was read and never declared here.
    expect(missing).toEqual([]);
  });

  it('declares nothing the components do not read', () => {
    // The other direction. The block carried 14 dead token names for months,
    // which is what made the one genuinely missing name hard to notice.
    const read = new Set(tokensRead());
    for (const selector of [LIGHT_OVERRIDE, DARK_OVERRIDE]) {
      const dead = Object.keys(declarationsIn(selector)).filter((t) => !read.has(t));
      expect(dead).toEqual([]);
    }
  });

  it('applies only when the page and the root disagree', () => {
    // The base class must declare NO tokens. If it ever does again, it starts
    // shadowing body:has([data-yc-app]) on every load - defect 2's mechanism.
    const base = declarationsIn('.yc-warmbone {');
    expect(Object.keys(base)).toEqual([]);
  });

  it('aliases only to tokens that do not themselves flip', () => {
    // An override may alias a global token ONLY if that token resolves the same
    // under either root - otherwise the alias re-imports the very theme the
    // override exists to escape. --color-accent-deep/-dark qualify: each is
    // declared exactly once, in @theme, and never redeclared.
    const THEME_INVARIANT_ALIASES = ['--color-accent-deep', '--color-accent-dark'];

    for (const alias of THEME_INVARIANT_ALIASES) {
      const declarations = [...CSS.matchAll(new RegExp(`${alias}:\\s*[^;]+;`, 'g'))];
      expect(declarations).toHaveLength(1);
    }

    for (const selector of [LIGHT_OVERRIDE, DARK_OVERRIDE]) {
      for (const [token, value] of Object.entries(declarationsIn(selector))) {
        const aliased = value.match(/var\((--[a-z0-9-]+)\)/)?.[1];
        if (!aliased) continue;
        expect({ token, aliased }).toEqual({
          token,
          aliased: expect.stringMatching(new RegExp(`^(${THEME_INVARIANT_ALIASES.join('|')})$`)),
        });
      }
    }
  });

  it('keeps the danger trio spelled the way the component reads it', () => {
    // The original defect, pinned directly. --danger-* and --status-danger-* are
    // one prefix apart, and the component reads the longer name.
    for (const selector of [LIGHT_OVERRIDE, DARK_OVERRIDE]) {
      const declared = Object.keys(declarationsIn(selector));
      expect(declared).toEqual(expect.arrayContaining(['--status-danger-text']));
      expect(declared).not.toEqual(expect.arrayContaining(['--danger-text']));
    }
  });
});
