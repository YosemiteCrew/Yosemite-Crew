/**
 * The app scope must re-declare the whole ALIAS CLOSURE of the faint inks.
 *
 * `--ink-faint` is darkened for PIMS under `body:has([data-yc-app])`, but the
 * `@theme` layer aliases it (`--color-neutral-600: var(--ink-faint)`) and those
 * aliases are computed on `:root`. A custom property resolves where it is
 * DECLARED, so overriding the dependency further down the tree does not
 * recompute the ancestor's alias - `text-neutral-500` in the chat panes went on
 * resolving the old #a9a39e long after the short token had been fixed.
 *
 * Chasing that chain by hand is exactly how it broke, so this walks it from the
 * stylesheet instead: anything reachable from the faint inks must be re-stated
 * inside both scoped blocks, or be named in NON_TEXT below with a reason.
 */
import fs from 'node:fs';
import path from 'node:path';

const CSS = fs.readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8');

/**
 * Reachable from the faint inks but NOT text, so deliberately left on the
 * global value: darkening a border is a visible change with no contrast
 * argument behind it (borders owe 3:1 only as non-text UI, which these meet).
 */
const NON_TEXT = new Set(['--color-grey-border', '--greyborder']);

const ROOTS = ['--ink-faint', '--ink-faint2'];

const APP_SCOPE = /^body:has\(\[data-yc-app\]\)\s*\{([\s\S]*?)^\}/m;
const APP_SCOPE_DARK = /^html\[data-theme='dark'\] body:has\(\[data-yc-app\]\)\s*\{([\s\S]*?)^\}/m;

/** Declarations made at the root layers, which is where aliases get computed. */
const rootAliasGraph = () => {
  const beforeScopes = CSS.slice(0, CSS.search(APP_SCOPE));
  const graph = new Map<string, string[]>();
  for (const [, name, source] of beforeScopes.matchAll(
    /^\s+(--[a-z0-9-]+):\s*var\((--[a-z0-9-]+)\)\s*;/gim
  )) {
    graph.set(source, [...(graph.get(source) ?? []), name]);
  }
  return graph;
};

const closure = () => {
  const graph = rootAliasGraph();
  const seen = new Set<string>();
  const queue = [...ROOTS];
  while (queue.length) {
    for (const child of graph.get(queue.shift() as string) ?? []) {
      if (seen.has(child)) continue;
      seen.add(child);
      queue.push(child);
    }
  }
  return [...seen];
};

const declaredIn = (block: RegExp) => {
  const found = CSS.match(block);
  if (!found) throw new Error(`scope block not found in globals.css: ${block}`);
  return new Set([...found[1].matchAll(/^\s+(--[a-z0-9-]+):/gim)].map((m) => m[1]));
};

describe('faint-ink alias closure is mirrored into the app scope', () => {
  it('finds the chain at all (guards against the walker silently going blind)', () => {
    expect(closure()).toEqual(expect.arrayContaining(['--color-neutral-600', '--black-grey']));
  });

  it.each([
    ['light', APP_SCOPE],
    ['dark', APP_SCOPE_DARK],
  ])('re-declares every text alias in the %s scope', (_label, block) => {
    const declared = declaredIn(block);
    const missing = closure().filter((t) => !NON_TEXT.has(t) && !declared.has(t));

    expect(missing).toEqual([]);
  });

  it('leaves the non-text tokens on their global value', () => {
    const declared = declaredIn(APP_SCOPE);

    for (const token of NON_TEXT) expect(declared.has(token)).toBe(false);
  });

  it('keeps the two scopes in step, so dark mode cannot drift', () => {
    expect([...declaredIn(APP_SCOPE_DARK)].sort()).toEqual([...declaredIn(APP_SCOPE)].sort());
  });
});
