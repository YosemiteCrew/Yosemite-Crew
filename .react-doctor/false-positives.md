# React Doctor — known false positives

Patterns react-doctor flags that are intentional in this codebase, with the reason. Each entry is verified against the rule's own "false positive" definition before being added.

## Accepted, not suppressible — prefer-dynamic-import in DynamicChart/ChartCanvas.tsx

**Status: the warning still fires, by design. Do not "fix" it.** It cannot be suppressed:
`ignore.overrides` and even `ignore.files` were both tried against the CI-pinned CLI (0.7.4)
and neither drops this diagnostic, so no config change was kept — dead config that looks like
it works is worse than none. It stays advisory: the CI gate is `blocking: error` and this is a
warning.

The honest label matters: **this does not meet the rule's own false-positive definition**,
which is narrow — "type-only imports ... or critical above-the-fold UI that must SSR".
`ChartCanvas` is neither. The diagnostic fires on a real static value import of recharts, and
it fires _because of_ the fix in `dac87cac6` — before it, no file imported recharts statically.

It is accepted anyway because the rule's _premise_ is empirically false here, and its
prescribed fix is verified to break the product:

- **The premise ("ships extra code to your users up front") does not hold.** `ChartCanvas` is
  itself the lazy chunk: `DynamicChartCard` loads it via
  `dynamic(() => import('./ChartCanvas'), { ssr: false })`. Verified against a production
  build, not by argument — recharts compiles into exactly one chunk
  (`static/chunks/6220.*.js`, 380K) and `app-build-manifest.json` lists that chunk in **no
  route's initial bundle**. `/dashboard` First Load JS is 279 kB and excludes it. The code
  splitting the rule wants is already in place, one level up, where the rule cannot see it.
- **The prescribed fix reintroduces a shipped bug.** Wrapping the individual recharts
  elements in `next/dynamic` is what the codebase did before `dac87cac6`, and it is exactly
  why every dashboard chart rendered blank: recharts resolves its children by matching them
  against the real component types, sees anonymous loadable components, and silently drops
  all of them. Confirmed in the browser: 0 bars / 0 axis ticks before, 16/8/1 bars with 8
  x-ticks and 5 y-ticks after. The rule's other suggestion, `React.lazy(() => import('recharts'))`,
  is not even coherent for recharts — `React.lazy` needs a module whose default export is a
  component, and recharts has no default export. The recipe fits a single default-exported
  widget (Monaco, CodeMirror); it does not fit a composition of many components whose
  identity is load-bearing.

This entry exists because the bot's comment is a trap: taken at face value it instructs the
next agent to make the exact change that blanks every chart. If recharts ever stops being
lazy-loaded behind `ChartCanvas`, this stops being acceptable — re-check with a build
(`grep -rl recharts-surface .next/static/chunks` plus `app-build-manifest.json`), never by
reading the import line alone.

## Fixed, not a false positive — no-cascading-set-state in AddForm/index.tsx

Kept as a note because it was briefly (and wrongly) recorded here as a false positive.

The reset-on-open `useLayoutEffect` called `setView`, `setShowDetails` and `setFormData`
together. The claim was that these are "genuinely independent updates that touch disparate
state slices" (the rule's own FP wording). That was wrong: the slices are disparate, but the
updates are **not independent** — they always fire together, as one reset. A coherent
transition across three setters is exactly what the rule targets.

Fixed in `c08e69197`: `view` + `showDetails` are now one `builderUi` reducer with a single
`RESET` action, so the effect drops to one setState and the reset reads as the single
transition it always was. Behaviour unchanged (all 22 Forms suites pass untouched).

## Fixed, not a false positive — no-pass-data-to-parent in Build.tsx

Kept as a note because it was briefly (and wrongly) recorded here as a deferral.

`Build.tsx` had a `useEffect` seeding the service-selection checkbox back up through
`setFormData`. Checked against the rule's own FP definition, it did **not** qualify — that
definition is narrow ("the child genuinely owns an external subscription the parent cannot
subscribe to"), and this was a plain child-generates-then-ships-up effect. It was a real
diagnostic and is now **removed** (commit `795ff106c`).

The effect was outright redundant: Build ensures the checkbox at render time (both the group
renderer and `renderSelectedBuilder` call `ensureServiceCheckbox`), and the parent already runs
`normalizeServiceGroups` on save/publish, so the parent owns the persisted shape. Deleting it
needed no change to `index.tsx` at all — so the concurrent `index.test.tsx` that the earlier
deferral cited as the blocker was never actually in the way. The lesson: validate against the
rule's FP definition before recording a deferral.
