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

  it('does not composite the faint inks under opacity', () => {
    // Opacity applies to TEXT as well as decoration, and the faint end of the
    // ramp has no headroom: #66635f at 0.45 is 1.81:1 on --band, and no alpha
    // below 1.0 gets it back to 4.5. Two phone-calendar rules receded a whole
    // cell that way while its label used a faint ink - on a tappable control in
    // one case and an informational row in the other. A control should recede
    // through a lighter INK, not through alpha.
    //
    // Disabled controls are exempt (WCAG 1.4.3 excludes inactive components),
    // and so are keyframe steps, which are transient rather than a resting
    // state.
    const root = path.join(process.cwd(), 'src/app');
    const files = fs
      .readdirSync(root, { recursive: true, encoding: 'utf8' })
      .filter((f) => f.endsWith('.css') && !f.includes('/marketing/'));

    const offenders: string[] = [];

    // Tailwind can dim from the markup too, which a stylesheet-only scan cannot
    // see: `text-[var(--ink-faint)] ... opacity-70` on the calendar minute
    // labels composited to 2.94:1 across five calendar views while this test
    // passed. State-prefixed utilities are exempt - `hover:` raises contrast
    // back on release, and `disabled:` is an inactive control.
    const tsx = fs
      .readdirSync(root, { recursive: true, encoding: 'utf8' })
      .filter((f) => f.endsWith('.tsx') && !f.includes('__tests__') && !f.includes('.stories.'))
      .filter((f) => !f.includes('/marketing/'));

    // Narrowed to the actual defect: an opacity utility on the SAME element as a
    // faint text token. A dimmed icon or a dimmed container is a different
    // question; what breaks here is faint text dimmed further, which is what
    // the calendar minute labels were doing.
    const FAINT_TEXT =
      /--ink-faint2?\)|--color-text-tertiary\)|--color-text-extra\)|\btext-text-tertiary\b|--status-[a-z]+-text\)/;

    for (const file of tsx) {
      const lines = fs.readFileSync(path.join(root, file), 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (!FAINT_TEXT.test(line)) return;
        // `cursor-not-allowed` marks the disabled branch of a clsx ternary,
        // where the element also carries a real `disabled` attribute a few
        // lines up - an inactive control, exempt under WCAG 1.4.3.
        if (/cursor-not-allowed/.test(line)) return;
        for (const m of line.matchAll(/(^|[\s"'`:])opacity-(\d{1,3})\b/g)) {
          if (m[1].endsWith(':')) continue; // hover: / disabled: / group-hover:
          if (Number(m[2]) >= 100 || Number(m[2]) === 0) continue; // 0 = hidden
          offenders.push(`${file}:${i + 1}  faint text + opacity-${m[2]}`);
        }
      });
    }
    for (const file of files) {
      const lines = fs.readFileSync(path.join(root, file), 'utf8').split('\n');
      lines.forEach((line, i) => {
        // EVERY non-unit opacity, not a threshold. The first version of this
        // stopped at 0.7 and so walked past `.yc-pwo-row--done { opacity: 0.75 }`,
        // where --ink-faint labels still land at 3.23:1 on --screen. There is no
        // safe cutoff: the faint inks pass by so little that any compositing at
        // all can drop them under 4.5.
        const m = /^\s*opacity:\s*(0?\.\d+|0)\s*;/.exec(line);
        if (!m) return;

        // Walk back to the selector this declaration belongs to.
        let selector = '';
        // Wide enough to clear a multi-line value: the header's decorative
        // hairline sits 15 lines below its selector behind a linear-gradient().
        for (let j = i - 1; j >= 0 && j > i - 40; j--) {
          const t = lines[j].trim();
          if (t.endsWith('{')) {
            selector = t.slice(0, -1).trim();
            break;
          }
        }
        const exempt =
          m[1] === '0' ||
          m[1] === '0.0' || // fully hidden: nothing painted to read
          /disabled/i.test(selector) || // inactive component
          /^\d+%$|^from$|^to$/.test(selector) || // keyframe step
          // Decoration: rules, bars, skeleton placeholders, icons, pseudo-elements.
          /divider|-sk-|skeleton|bar\b|icon|indicator|::before|::after|scrollbar|shadow/i.test(
            selector
          );
        if (!exempt) offenders.push(`${file}:${i + 1}  ${selector}`);
      });
    }

    // Empty, and it should stay that way. Anything new either recedes through
    // ink instead, or names itself as decoration / a disabled control.
    expect(offenders).toEqual([]);
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
      // The quotes matter: a CSS file writes `color: var(--x)` but a style
      // OBJECT writes `color: 'var(--x)'`, and the first version of this
      // required var( immediately after the colon - so every inline style in
      // the app walked straight past it.
      new RegExp(`(?:^|[^-\\w])color:\\s*['"\`]?var\\(--color-neutral-${FAINT}\\)`), // CSS + inline styles
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
