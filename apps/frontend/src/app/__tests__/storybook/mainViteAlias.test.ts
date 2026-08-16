/**
 * `viteFinal` must preserve whatever aliases the framework already set.
 *
 * Storybook hands the hook `resolve.alias` as an OBJECT holding styled-jsx's
 * preset aliases. An earlier version treated any non-array as empty, which
 * fixed the `@/` paths while silently dropping those - the kind of breakage
 * that shows up later as one story failing to render, far from its cause.
 */
import config from '../../../../.storybook/main';

type AliasEntry = { find: string | RegExp; replacement: string };

const run = (alias: unknown) => {
  // ViteFinal is (config, options); the hook ignores options, so the cast goes
  // through unknown rather than pretending the signature is narrower.
  const viteFinal = config.viteFinal as unknown as (c: { resolve?: { alias?: unknown } }) => {
    resolve: { alias: AliasEntry[] };
  };
  return viteFinal({ resolve: { alias } }).resolve.alias;
};

const finds = (out: AliasEntry[]) => out.map((a) => String(a.find));

describe('.storybook viteFinal alias handling', () => {
  it('keeps framework aliases supplied in object form', () => {
    const out = run({ 'styled-jsx/style': '/preset/styled-jsx-style.js' });

    expect(out.some((a) => a.find === 'styled-jsx/style')).toBe(true);
    expect(out.find((a) => a.find === 'styled-jsx/style')?.replacement).toBe(
      '/preset/styled-jsx-style.js'
    );
  });

  it('keeps framework aliases supplied in array form', () => {
    const out = run([{ find: /^preset$/, replacement: '/preset/entry.js' }]);

    expect(finds(out)).toContain('/^preset$/');
  });

  it('adds the tsconfig paths on top of whatever was inherited', () => {
    const out = finds(run({ 'styled-jsx/style': '/preset/styled-jsx-style.js' }));

    for (const p of ['@\\/features\\/', '@\\/ui\\/', '@\\/lib\\/', '@\\/constants\\/']) {
      expect(out.some((f) => f.includes(p))).toBe(true);
    }
  });

  it('orders the specific prefixes before the bare @/ so it cannot swallow them', () => {
    const out = finds(run(undefined));
    const bare = out.findIndex((f) => f === '/^@\\//');

    expect(bare).toBeGreaterThan(-1);
    for (const specific of ['features', 'ui', 'lib', 'constants']) {
      expect(out.findIndex((f) => f.includes(specific))).toBeLessThan(bare);
    }
  });

  it('copes with no inherited aliases at all', () => {
    expect(run(undefined).length).toBe(5);
  });
});
