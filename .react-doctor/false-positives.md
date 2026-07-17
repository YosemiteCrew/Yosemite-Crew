# React Doctor — known false positives

Patterns react-doctor flags that are intentional in this codebase, with the reason. Each entry is verified against the rule's own "false positive" definition before being added.

## The score is capped at 84, and clearing warnings does not raise it

**Read this before trying to "improve the score". It is measured, not argued.**

**The score is PRIORITY-WEIGHTED and dominated by the worst rule present — it is not a count.**
The CLI POSTs the diagnostics to `https://www.react.doctor/api/score`, which returns a priority per
rule. Measured against this app:

| Rule                                                | Priority    | Score alone | Fixable?                                                                          |
| --------------------------------------------------- | ----------- | ----------- | --------------------------------------------------------------------------------- |
| `iframe-missing-sandbox` ×2                         | **60 (P2)** | **84**      | No — see below. **This is the ceiling.**                                          |
| `nextjs-no-client-side-redirect` (PostAuthRedirect) | 56 (P2)     | 93          | No — matches the rule's own FP definition, and `features/auth/**` is out of scope |
| `prefer-dynamic-import` (ChartCanvas)               | 56 (P2)     | 93          | **No — its fix blanks every dashboard chart** (see the entry below)               |
| `no-derived-state` (ChatContainer)                  | 50          | 92          | No — false positive, fixed upstream in 0.7.8                                      |
| `no-initialize-state` (Github)                      | 42          | 98          | No — FP; the "fix" reintroduces a hydration mismatch                              |
| `no-giant-component`                                | **30 (P3)** | —           | Yes, and it bought **+1**                                                         |

`min(84, 92, 93, 93, 98) = 84`, exactly the reported score. **Reaching 95 requires every remaining
rule to score >= 95**, i.e. clearing four of the five — including the two that break the product. It
is not reachable by fixing.

**Proof the count is irrelevant:** clearing 5 warnings (4 `no-giant-component` splits + the unused
`aos` dependency) took the count 11 -> 6 and the score 84 -> **84**. Zero movement. Do not spend
effort on non-worst rules expecting a score change.

**The CI gate is not actually enforcing 95.** `.github/workflows/react-doctor.yml` sets
`REACT_DOCTOR_MIN_SCORE: '95'` but exits 0 whenever `error-count == 0`, which is our case. The real
gate is `blocking: error` in the scan step. Flipping that escape hatch off would red every open PR
in the repo at once.

**Do not "just upgrade the CLI".** 0.7.4 is pinned because the pinned Action rejects report
schemaVersion 3. Beyond that, **0.7.8 scores 64 with 106 ERRORS and 155 warnings** on this app
(new rules: `no-ref-current-in-render`, `effect-needs-cleanup`, `no-chain-state-updates`, …). Most
look real, but it would fail `blocking: error` immediately. Upgrading is a genuine workstream, not
a score fix.

**Measurement gotchas — all four cost real time:**

1. **The score comes from a REMOTE API and is flaky.** It returned `null` for ~20 consecutive runs,
   then recovered on its own. `ok: true` and `errorCount: 0` still come back, so **a null score looks
   exactly like a clean scan**. Always assert the score is non-null before believing a result.
2. **Re-running returns a cached `score: null`** unless `REACT_DOCTOR_NO_CACHE=1` is set.
3. **Do not hand-roll the score API call.** The CLI sends project metadata that lifts the score: an
   identical hand-built payload scored 72 where the CLI reported 84. Hand-rolling is only valid for
   like-for-like deltas, never for an absolute number.
4. **Run it the way CI does** — from the repo root with `apps/frontend` as the argument. Running from
   inside `apps/frontend` makes the repo-root `react-doctor.config.json` ignore globs (which are
   repo-root-relative) silently miss, and the counts disagree (11 vs 6).

## Accepted, not a false positive — iframe-missing-sandbox in DocSigningPortal.tsx / SigningOverlay.tsx

**A previous note in this repo claimed these were false positives because "react-doctor can't parse
multi-line JSX attrs". That reasoning was WRONG.** The parser is fine. **Read the rule's `message`,
not its `title`.** The title says "iframe missing sandbox attribute"; the message says:

> Combining `allow-scripts` & `allow-same-origin` lets the iframe remove its own sandbox, defeating
> the protection.

It objects to the **value**, not the absence. Both iframes DO carry `sandbox=` and both DO combine
`allow-scripts allow-same-origin`, so the rule is firing correctly on what it describes.

It is **accepted** because the premise does not hold here and the fix breaks the product:

- The self-removal attack needs the framed page to be same-origin **with the parent**. The `src` is a
  cross-origin Documenso URL, so the framed page cannot reach the parent's DOM to strip the attribute.
- Documenso needs `allow-same-origin` to be itself (cookies/storage on its own origin) and
  `allow-scripts` to run. Dropping either breaks signing.

If the signing iframe ever becomes same-origin with the app, this stops being acceptable and becomes
a real vulnerability — re-check then, and re-check by reading the `src`, not by re-reading this note.

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
