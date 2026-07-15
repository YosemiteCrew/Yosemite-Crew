# React Doctor — known false positives

Patterns react-doctor flags that are intentional in this codebase, with the reason. Each entry is verified against the rule's own "false positive" definition before being added.

## no-cascading-set-state — modal reset-on-open (disparate slices)

- **File:** `apps/frontend/src/app/features/forms/pages/Forms/Sections/AddForm/index.tsx`
- **Shape:** the `useLayoutEffect` that runs once when the AddForm modal opens and resets three **independent** state slices — `setView('build')` (builder view mode), `setShowDetails(false)` (details-panel toggle), `setFormData(next)` (the form data).
- **Why it's a false positive:** the rule's own doc lists "genuinely independent updates that touch disparate state slices" as a false positive. These three slices are unrelated (UI mode vs panel visibility vs form payload), and under React 18 the updates auto-batch into a single commit — there is no per-`setState` redraw to avoid. Collapsing them into one `useReducer` would couple unrelated concerns without any render benefit.

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
