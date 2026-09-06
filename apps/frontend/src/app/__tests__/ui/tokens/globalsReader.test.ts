/**
 * `globals.css` as the reader sees it, checked against a parser with no stake
 * in the answer.
 *
 * Every guard built on `globalsTokens` is worth exactly its negative - "no
 * property is declared twice", "this token clears AA in both themes" - and a
 * negative is only as wide as what the reader can see. The reader is a hand
 * parser, so the question is not whether it works on a fixture; it is whether
 * it agrees with a real one about the file that actually ships.
 *
 * It shipped disagreeing. Prettier wraps a value past the print width onto its
 * own lines, which leaves the `;` three lines below the property name, and the
 * reader needed it on the naming line: `postcss` found 635 custom-property
 * declarations in `globals.css` and the reader found 633. A duplicate of either
 * wrapped declaration was invisible while the shadowing scan reported zero.
 * Sixteen selector lists are wrapped the same way and were read as their last
 * line alone - `):focus-visible` for one of them - which is one re-wrap away
 * from `html[data-theme='dark']` not being recognised as the dark rule at all.
 *
 * `postcss` is already a devDependency here; it is what Tailwind parses with.
 */
import postcss from 'postcss';

import {
  GLOBALS_CSS,
  RULES,
  parseRules,
  themeMaps,
  type Rule,
} from '@/app/__tests__/support/globalsTokens';

type Shape = { selector: string; open: number; close: number; declarations: string[] };

/** The same shape, read by postcss: top-level rules and the custom properties
    declared directly inside them, which is `parseRules`'s exact contract. */
const byPostcss = (css: string): Shape[] => {
  const shapes: Shape[] = [];
  postcss.parse(css).each((node) => {
    if (node.type !== 'rule' && node.type !== 'atrule') return;
    if (node.nodes === undefined) return; // `@import 'tailwindcss';` has no block
    const declarations: string[] = [];
    node.each((child) => {
      if (child.type === 'decl' && child.prop.startsWith('--'))
        declarations.push(`${child.prop}@${child.source?.start?.line}`);
    });
    shapes.push({
      selector: (node.type === 'rule' ? node.selector : `@${node.name} ${node.params}`)
        .replace(/\s+/g, ' ')
        .trim(),
      open: node.source?.start?.line ?? -1,
      close: node.source?.end?.line ?? -1,
      declarations,
    });
  });
  return shapes;
};

const byReader = (rules: Rule[]): Shape[] =>
  rules.map((rule) => ({
    selector: rule.selector,
    open: rule.open,
    close: rule.close,
    declarations: rule.declarations.map((d) => `${d.prop}@${d.line}`),
  }));

describe('the globals.css reader', () => {
  it('is comparing something', () => {
    /* Two empty arrays are equal, so the agreement below means nothing until
       the reference is shown to have read a real stylesheet. */
    const reference = byPostcss(GLOBALS_CSS);
    expect(reference.length).toBeGreaterThan(50);
    expect(reference.flatMap((r) => r.declarations).length).toBeGreaterThan(600);
  });

  it('agrees with postcss about every rule, selector and declaration', () => {
    expect(byReader(RULES)).toEqual(byPostcss(GLOBALS_CSS));
  });

  it('reads a declaration whose value the formatter wrapped', () => {
    const css =
      ':root {\n  --shadow:\n    0 2px 4px rgba(0, 0, 0, 0.28),\n    0 12px 28px rgba(0, 0, 0, 0.44);\n  --after: #ffffff;\n}\n';
    expect(byReader(parseRules(css))).toEqual(byPostcss(css));
    expect(parseRules(css)[0].declarations.map((d) => d.value)).toEqual([
      '0 2px 4px rgba(0, 0, 0, 0.28), 0 12px 28px rgba(0, 0, 0, 0.44)',
      '#ffffff',
    ]);
  });

  it('reads a selector list the formatter wrapped', () => {
    /* Read as its last line alone, this rule stops matching the dark selector
       and every token in it silently falls back to the light literal. */
    const css = "html[data-theme='dark'],\n.yc-scope-dark {\n  --a: #111111;\n}\n";
    expect(parseRules(css)[0].selector).toBe("html[data-theme='dark'], .yc-scope-dark");
    expect(themeMaps(parseRules(css)).dark.get('--a')).toBe('#111111');
  });

  it('does not read a token named inside a comment that spans lines', () => {
    const css =
      ':root {\n  /* this used to be\n     --a: 1px;\n     until it moved */\n  --a: 2px;\n}\n';
    expect(parseRules(css).flatMap((r) => r.declarations.map((d) => d.line))).toEqual([5]);
  });

  it("does not take a statement at-rule for the next rule's selector", () => {
    const css = "@import 'tailwindcss';\n\n:root {\n  --a: #111111;\n}\n";
    expect(parseRules(css)[0].selector).toBe(':root');
  });
});
