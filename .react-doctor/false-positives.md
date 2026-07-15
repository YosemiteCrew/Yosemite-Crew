# React Doctor — known false positives

Patterns react-doctor flags that are intentional in this codebase, with the reason. Each entry is verified against the rule's own "false positive" definition before being added.

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
