/**
 * The app scope must cover the whole ALIAS CLOSURE of the faint inks, and must
 * cover it by ALIASING rather than by copying the hex.
 *
 * `--ink-faint` is darkened for PIMS under `body:has([data-yc-app])`, but the
 * `@theme` layer aliases it (`--color-neutral-600: var(--ink-faint)`) and those
 * aliases are computed on `:root`. A custom property resolves where it is
 * DECLARED, so overriding the dependency further down the tree does not
 * recompute the ancestor's alias - `text-neutral-500` in the chat panes went on
 * resolving the old #a9a39e long after the short token had been fixed.
 *
 * Two ways that fix can rot, so both are checked here:
 *   1. a NEW alias is added to the chain and nobody re-declares it in the scope
 *   2. a scoped declaration holds its own hex literal, which then goes stale
 *      the next time either ink moves - the exact utility/runtime mismatch the
 *      change exists to prevent
 *
 * Chasing the chain by hand is how it broke in the first place, so the closure
 * is re-derived from the stylesheet on every run rather than hard-coded.
 */
import fs from 'node:fs';
import path from 'node:path';

const CSS = fs.readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8');

/**
 * Reachable from the faint inks but deliberately NOT re-declared in the scope.
 * Every entry needs a reason, because each one is a token that stays light
 * inside PIMS.
 */
const NOT_SCOPED: Record<string, string> = {
  // Borders, not text. Darkening them is a visible change with no contrast
  // argument behind it (they meet the 3:1 non-text bar already).
  '--color-grey-border': 'border token (OtpModal, UploadImage)',
  '--greyborder': 'border token (OtpModal, UploadImage)',
  // Raw ramp steps rather than text semantics. neutral-500 also backs
  // `border-neutral-500` in three components and the scrollbar thumb, so
  // bending it would darken outlines and scrollbars to fix text. Text callers
  // use the semantic --color-text-* tokens, which ARE scoped.
  '--color-neutral-500': 'ramp step - also borders and the scrollbar thumb',
  '--color-neutral-600': 'ramp step - text callers use --color-text-tertiary',
};

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

/** name -> declared value, for one scope block. */
const declarationsIn = (block: RegExp) => {
  const found = CSS.match(block);
  if (!found) throw new Error(`scope block not found in globals.css: ${block}`);
  return new Map(
    [...found[1].matchAll(/^\s+(--[a-z0-9-]+):\s*([^;]+);/gim)].map((m) => [m[1], m[2].trim()])
  );
};

const SCOPES: ReadonlyArray<readonly [string, RegExp]> = [
  ['light', APP_SCOPE],
  ['dark', APP_SCOPE_DARK],
];

describe('faint-ink alias closure is mirrored into the app scope', () => {
  it('finds the chain at all (guards against the walker silently going blind)', () => {
    expect(closure()).toEqual(expect.arrayContaining(['--color-text-tertiary', '--black-grey']));
  });

  it.each(SCOPES)('covers every reachable token in the %s scope', (_label, block) => {
    const declared = declarationsIn(block);
    const missing = closure().filter((t) => !(t in NOT_SCOPED) && !declared.has(t));

    expect(missing).toEqual([]);
  });

  it.each(SCOPES)('aliases rather than copying the hex in the %s scope', (_label, block) => {
    const literals = [...declarationsIn(block)]
      .filter(([name]) => !ROOTS.includes(name))
      .filter(([, value]) => !value.startsWith('var('))
      .map(([name, value]) => `${name}: ${value}`);

    expect(literals).toEqual([]);
  });

  it.each(SCOPES)('points every alias at one of the scoped inks in %s', (_label, block) => {
    const strays = [...declarationsIn(block)]
      .filter(([name]) => !ROOTS.includes(name))
      .filter(([, value]) => !ROOTS.some((ink) => value.includes(`var(${ink})`)))
      .map(([name, value]) => `${name}: ${value}`);

    expect(strays).toEqual([]);
  });

  it('leaves the excluded tokens out of the scope entirely', () => {
    const declared = declarationsIn(APP_SCOPE);

    for (const token of Object.keys(NOT_SCOPED)) expect(declared.has(token)).toBe(false);
  });

  it('keeps the two scopes in step, so dark mode cannot drift', () => {
    expect([...declarationsIn(APP_SCOPE_DARK).keys()].sort()).toEqual(
      [...declarationsIn(APP_SCOPE).keys()].sort()
    );
  });

  it('has no text component reaching for the raw ramp steps', () => {
    // `text-neutral-500` was the call site that exposed the whole bug. The ramp
    // steps are not scoped, so a text utility built on one silently opts out of
    // the readable ink.
    const files = fs
      .readdirSync(path.join(process.cwd(), 'src/app'), { recursive: true, encoding: 'utf8' })
      .filter((f) => f.endsWith('.tsx') && !f.includes('__tests__') && !f.includes('.stories.'));

    const offenders = files.filter((f) =>
      /\btext-neutral-(500|600)\b/.test(
        fs.readFileSync(path.join(process.cwd(), 'src/app', f), 'utf8')
      )
    );

    expect(offenders).toEqual([]);
  });
});
