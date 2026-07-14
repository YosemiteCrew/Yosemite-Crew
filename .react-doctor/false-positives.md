# React Doctor — known false positives

Patterns react-doctor flags that are intentional in this codebase, with the reason. Each entry is verified against the rule's own "false positive" definition before being added.

## no-cascading-set-state — modal reset-on-open (disparate slices)

- **File:** `apps/frontend/src/app/features/forms/pages/Forms/Sections/AddForm/index.tsx`
- **Shape:** the `useLayoutEffect` that runs once when the AddForm modal opens and resets three **independent** state slices — `setView('build')` (builder view mode), `setShowDetails(false)` (details-panel toggle), `setFormData(next)` (the form data).
- **Why it's a false positive:** the rule's own doc lists "genuinely independent updates that touch disparate state slices" as a false positive. These three slices are unrelated (UI mode vs panel visibility vs form payload), and under React 18 the updates auto-batch into a single commit — there is no per-`setState` redraw to avoid. Collapsing them into one `useReducer` would couple unrelated concerns without any render benefit.

## no-pass-data-to-parent — service-group checkbox seeding (accepted deferral)

- **File:** `apps/frontend/src/app/features/forms/pages/Forms/Sections/AddForm/Build.tsx`
- **Shape:** the `useEffect` that seeds the service-selection checkbox into service groups that predate it, once `serviceOptions` loads (`setFormData((prev) => …ensureServiceCheckbox…)`).
- **Why it's deferred (not a clean win):** the saved payload is already correct without this effect — `index.tsx` runs `normalizeServiceGroups(schema, serviceOptions)` on save/publish, and Build renders the checkbox via `ensureServiceCheckbox` at render time; the effect only pre-seeds the in-memory schema. The rule's suggested fix (lift into the parent that owns `formData`) merely relocates the identical effect to `index.tsx` without changing behavior, at the cost of rewriting the isolated `build.test.tsx` seeding tests and a concurrent task's still-uncommitted `index.test.tsx`. Warning-only (the React Doctor gate is `blocking: error`); deferred until that test file is released.
