# UI

Reusable UI primitives and shared components live here.

Examples:

- Button, Input, Card, Badge
- Typography and layout helpers (Text, Stack)

Available now:

- Button (wrapper over Primary/Secondary/Delete)
- Text (typography variants via utility classes)
- Stack (flex layout helper)
- Card (surface wrapper)
- Badge (status/label chip)
- Input (base input with token-based borders)
- Inputs (Datepicker, Dropdowns, Search, FileInput, etc.)
- Filters (Forms, Inventory, general filters)
- Cards (Appointment, Inventory, Forms, etc.)
- Tables (DataTable variants)
- Overlays (Modal, Toast, Loader, etc.)
- Layout (Header, Sidebar, guards)
- Primitives (Buttons, Icons)

Prefer importing from `src/app/ui` for shared UI.

Token source of truth: `src/app/globals.css` (`@theme`). Token reference: [`tokens.md`](./tokens.md).
For the full component list with taxonomy, status labels, and remaining migration work, see [`INVENTORY.md`](./INVENTORY.md).

## Colours come from tokens, and CI holds the line

`scripts/ci/check-hardcoded-colours.mjs` fails when frontend source gains a hex,
`rgb()`, or `hsl()` literal. The literals already here are recorded per file in
`scripts/ci/hardcoded-colours-baseline.json`; the gate fails on any increase, and
fails just as loudly when a file improves and the baseline is not retightened:

```
node scripts/ci/check-hardcoded-colours.mjs           # what CI runs
node scripts/ci/check-hardcoded-colours.mjs --list    # every known literal
node scripts/ci/check-hardcoded-colours.mjs --update  # after removing some
```

Literals inside comments are not findings. The comments in this tree record why a
colour was rejected (`#8b8173 passed only on --spot`), and a gate that counted
them would be answered by deleting the reasoning.

A `var(--token, #literal)` fallback is a finding for a reason worth knowing: when
the token exists the fallback is unreachable and pins a value that no longer
moves with it, and when the token does NOT exist the fallback is what paints -
in both themes, silently. `--scrim`, `--on-cta` and `--color-surface-secondary`
are referenced today and declared nowhere.

### Some literals are correct, and they are recorded rather than tolerated

A few colours must not be tokens. Stripe Connect renders in its own iframe and
cannot read this document's custom properties; a `<style>` string injected into
a print popup has none of our CSS; the wallet-pass preview reproduces colours the
OS paints outside this app; the availability knob is fixed white on purpose,
because `--screen` flips and the off state measured 1.15:1 in espresso.

Those live in the baseline's `justified` map, each with a written `why`. The
list is not an exemption:

- an entry with no usable reason fails the gate with exit 2, not a pass
- a justified file is pinned in **both** directions, so a _new_ literal cannot
  hide behind a reason written for a different one
- `--update` never moves a file into `justified`; a reason is written by a person

### If the gate reports colours you did not write, read the last line first

The baseline is a per-file count of a specific commit, recorded as `generated_at`.
Run it on a branch cut before that commit and every literal the baseline's commit
_removed_ appears as a literal your branch _added_ — real file, real line, real
colour, wrong conclusion. On any failure the gate now says which case it is:

```
READ THIS BEFORE ACTING ON THE ABOVE. The baseline describes commit 1007378ea,
which is NOT in this tree's history.
```

Merge `origin/dev` and re-run before believing the findings. If git cannot answer,
it says that too rather than assuming the baseline is current.
