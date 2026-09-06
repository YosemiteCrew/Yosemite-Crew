/**
 * No custom property may be declared twice inside one rule in `globals.css`.
 *
 * The defect this pins is not a wrong colour - it is an edit that does nothing.
 * At equal specificity the later declaration wins, so when a token appears
 * twice in the same rule the first copy is dead text. It still reads like the
 * declaration, it is still what a search for the token name lands on first, and
 * changing it leaves the page exactly as it was.
 *
 * `html[data-theme='dark']` carried 80 such pairs (#2822). Every pair held the
 * same value, so nothing rendered wrong and nothing could - which is why this
 * survived: the only symptom was a developer's edit going missing.
 *
 * Duplication ACROSS rules is a different thing and is not flagged here. A
 * token declared in `:root` and again under `html[data-theme='dark']` is how
 * theming works, and again under a scoped block is how scoping works.
 */
import { RULES, duplicatesWithin, parseRules } from '@/app/__tests__/support/globalsTokens';

describe('the duplicate detector itself', () => {
  /* A zero from this scan is only worth reading if the scan can return
     something else. Both halves are planted, because a parser that finds
     nothing and a file that contains nothing produce the same clean pass. */
  it('reports a property declared twice in the same rule', () => {
    const found = parseRules(':root {\n  --a: 1px;\n  --b: 2px;\n  --a: 3px;\n}\n').flatMap(
      duplicatesWithin
    );
    expect(found).toHaveLength(1);
    expect(found[0].prop).toBe('--a');
    expect(found[0].declarations.map((d) => d.line)).toEqual([2, 4]);
  });

  it('does not report the same property in two different rules', () => {
    const css = ":root {\n  --a: 1px;\n}\nhtml[data-theme='dark'] {\n  --a: 2px;\n}\n";
    expect(parseRules(css).flatMap(duplicatesWithin)).toEqual([]);
  });

  it('does not read a token named inside a comment as a declaration', () => {
    const css = ':root {\n  /* --a: 1px; is what this used to be */\n  --a: 2px;\n}\n';
    expect(parseRules(css).flatMap(duplicatesWithin)).toEqual([]);
  });

  it('has actually read globals.css', () => {
    /* Without this, an empty parse of the real file passes the assertion
       below by describing nothing at all. */
    expect(RULES.length).toBeGreaterThan(5);
    expect(RULES.reduce((n, r) => n + r.declarations.length, 0)).toBeGreaterThan(300);
  });
});

describe('globals.css', () => {
  it('declares every custom property at most once per rule', () => {
    const offenders = RULES.flatMap((rule) =>
      duplicatesWithin(rule).map(
        ({ prop, declarations }) =>
          `${rule.selector} [${rule.open}-${rule.close}]: ${prop} at ${declarations
            .map((d) => `${d.line}=${d.value}`)
            .join(' | ')} - all but the last are inert`
      )
    );
    expect(offenders).toEqual([]);
  });
});
