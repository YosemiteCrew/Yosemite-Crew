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

  it('documents the real faint values in tokens.md', () => {
    // The table in tokens.md is what the next person reads before choosing an
    // ink, and it was wrong on its first outing: it listed the root light value
    // as the dark one and claimed both themes matched. A doc that states four
    // specific hexes can be checked, so it is.
    const doc = fs.readFileSync(path.join(process.cwd(), 'src/app/ui/tokens.md'), 'utf8');

    const chunkFor = (scope: 'root' | 'scoped', theme: 'light' | 'dark') => {
      if (scope === 'scoped') return CSS.match(theme === 'light' ? APP_SCOPE : APP_SCOPE_DARK)![1];
      const before = CSS.slice(0, CSS.indexOf('body:has([data-yc-app])'));
      const cut = before.indexOf("html[data-theme='dark']");
      return theme === 'light' ? before.slice(0, cut) : before.slice(cut);
    };
    const declared = (chunk: string, token: string) =>
      [...chunk.matchAll(new RegExp(`^\\s*${token}:\\s*([^;]+);`, 'gm'))].at(-1)?.[1].trim();

    // | scope | --token | light | dark |
    const rows = [
      ...doc.matchAll(
        // The scope cell carries a prose tail after the selector, e.g.
        // "`:root` (public marketing pages)", so allow anything up to the pipe.
        /^\|\s*`([^`]+)`[^|]*\|\s*`(--ink-faint2?)`\s*\|\s*`(#[0-9a-f]{6})`\s*\|\s*`(#[0-9a-f]{6})`\s*\|/gim
      ),
    ];
    expect(rows.length).toBe(4);

    const mismatches: string[] = [];
    for (const [, scopeLabel, token, light, dark] of rows) {
      const scope = scopeLabel.startsWith(':root') ? 'root' : 'scoped';
      for (const [theme, documented] of [
        ['light', light],
        ['dark', dark],
      ] as const) {
        const actual = declared(chunkFor(scope, theme), token);
        if (actual !== documented) {
          mismatches.push(`${scopeLabel} ${token} ${theme}: doc ${documented}, css ${actual}`);
        }
      }
    }

    expect(mismatches).toEqual([]);
  });

  it('has nothing painting text with a raw neutral ramp step', () => {
    // `text-neutral-500` in the chat panes is what exposed the whole bug, and
    // the first version of this guard only looked for that one shape - Tailwind
    // classes, in .tsx. That missed stylesheets (`color: var(--color-neutral-600)`)
    // and inline styles, which is most of them. All three forms are checked now.
    //
    // Only TEXT positions count. The same tokens are legitimate as backgrounds,
    // borders, dividers and scrollbar thumbs, and are deliberately left light
    // there, so `background:`/`border:`/`scrollbar-color:` are not matched.
    // Only the FAINT band. The ramp runs dark-to-light, and 700-900 (and
    // neutral-0 on dark surfaces) are legitimate text colours - it is 300-600
    // that lands in the unreadable range on bone and is not scoped.
    const FAINT = '(?:300|400|500|600)';
    const TEXT_USES = [
      new RegExp(`(?:^|[^-\\w])color:\\s*var\\(--color-neutral-${FAINT}\\)`), // CSS + inline styles
      new RegExp(`color=["']var\\(--color-neutral-${FAINT}\\)["']`), // react-icons style prop
      new RegExp(`\\btext-neutral-${FAINT}\\b`), // Tailwind utility
    ];

    /** Text on a DARK surface wants the light end of the ramp; that is correct. */
    const ON_DARK_SURFACE = new Set([
      'features/appointments/pages/AppointmentWorkspace/components/PackageBreakdownTooltip.tsx',
    ]);

    const root = path.join(process.cwd(), 'src/app');
    const files = fs
      .readdirSync(root, { recursive: true, encoding: 'utf8' })
      .filter((f) => /\.(tsx|css)$/.test(f))
      .filter((f) => !f.includes('__tests__') && !f.includes('.stories.'))
      .filter((f) => !ON_DARK_SURFACE.has(f))
      // globals.css is where the ramp is DEFINED; its own declarations are not uses.
      .filter((f) => f !== 'globals.css');

    const offenders: string[] = [];
    for (const file of files) {
      const lines = fs.readFileSync(path.join(root, file), 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (line.trimStart().startsWith('*') || line.trimStart().startsWith('//')) return;
        if (TEXT_USES.some((re) => re.test(line))) offenders.push(`${file}:${i + 1}`);
      });
    }

    expect(offenders).toEqual([]);
  });
});
