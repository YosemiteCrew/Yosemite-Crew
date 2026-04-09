# Frontend Design System — Yosemite Crew

## Description

Use this skill when working on UI in apps/frontend. It teaches you how to use our custom design system, component library, and style conventions so you produce consistent, on-brand UI without reinventing the wheel.

TRIGGER: any task involving JSX, styling, layout, new components, or visual changes in apps/frontend.

---

## Core Rule: Reuse Before Creating

**Before writing any new UI element, search the existing component library.**

```
src/app/ui/                 ← start here
  Button.tsx                ← variants: primary | secondary | danger
  Card.tsx                  ← variants: default | bordered | subtle
  Badge.tsx                 ← status chips / labels
  Input.tsx                 ← base input with token borders
  Stack.tsx                 ← flex layout helper
  Text.tsx                  ← typography variants
  inputs/                   ← Datepicker, Dropdowns, Search, FileInput
  cards/                    ← Appointment, Inventory, Forms, etc.
  tables/                   ← DataTable variants
  overlays/                 ← Modal, Toast, Loader
  layout/                   ← Header, Sidebar, guards
  primitives/Buttons/       ← Primary, Secondary, Delete (low-level)
  filters/                  ← Forms, Inventory, general filters
  widgets/                  ← domain widgets
```

**Import from the barrel:** `import { Button, Card, Badge } from '@/app/ui'`

---

## Design Tokens

The design-token source of truth is `apps/frontend/src/app/globals.css` under `@theme`. Never hardcode hex values or px sizes — always use tokens.

```css
/* Colors */
--color-*          (e.g. --color-neutral-200, --color-primary-500)

/* Typography */
--font-satoshi     (primary — all weights 300–900)
--font-grotesk     (secondary)
```

Reference documentation: `src/app/ui/tokens.md` (derived guide, not source of truth)

---

## Styling Rules

- **Tailwind CSS 4** is the styling system. Use utility classes.
- Use `clsx` for conditional class composition — it's already in the project.
- Never write inline `style={{}}` unless a value cannot be expressed as a token.
- Never add raw Bootstrap classes to new code — Bootstrap is legacy, do not spread it.
- Never use arbitrary Tailwind values (e.g. `w-[347px]`) unless strictly required for pixel-perfect alignment from design specs.

### Class ordering (Tailwind)

Layout → Spacing → Sizing → Typography → Colors → Borders → Effects → Responsive

---

## Typography

Use the `<Text>` component for all copy, not bare `<p>` / `<span>` tags.

Font: **Satoshi** (300 Light → 900 Black). Never default to Inter, Roboto, or system fonts for new UI.

## UI Text Normalization

- Never show raw backend enums, acronyms, or short forms in user-visible copy (for example `PAYMENT_AT_CLINIC`, `VET`, `PMS`).
- Always map domain values to plain-language labels before rendering.
- Do not use `Actor` as a user-facing label. Use contextual labels such as `Lead`/`Support`, or neutral `Updated by` when role context is unknown.

---

## Component Patterns

### Creating a new component

1. Search `src/app/ui/` — if something similar exists, extend it.
2. If a new primitive is needed, place it in `src/app/ui/` alongside its peers.
3. Domain-specific components go in the relevant `features/` subdirectory.
4. Use TypeScript props with named types (no inline `{ prop: type }` in function signatures).

### Button usage

```tsx
// Always use the wrapper, not primitives directly
<Button variant="primary" text="Save" href="#" onClick={handleSave} />
<Button variant="secondary" text="Cancel" href="#" onClick={handleCancel} />
<Button variant="danger" text="Delete" href="#" onClick={handleDelete} />
```

### State management

Use Zustand stores in `src/app/stores/`. Each domain has its own store. Do not introduce new state management libraries.

Available stores: appointment, auth, availability, companion, document, forms, integration, inventory, invoice, org, parent, profile, room, search, service, subscription, task, team, universalSearch.

---

## Gotchas

- **Do not nest `<button>` inside `<button>`** — invalid HTML, breaks tests.
- **Do not put icons in `<button>` mocks in tests** — use `<span>` not `<button>` for react-icons mocks.
- **Bootstrap classes** are legacy; do not add new ones — Tailwind only for new code.
- **Never use `--font-*` values that don't exist in globals.css** — check before using.
- **Never duplicate a store** — check `src/app/stores/` before creating new state.
- `clsx` not `cn`, `classnames`, or template literals for conditional classes.
- The design system does NOT use shadcn, Radix, or Material-UI — do not import them.

---

## References

- Token source of truth: [apps/frontend/src/app/globals.css](../../../../../apps/frontend/src/app/globals.css)
- Token map (reference): [src/app/ui/tokens.md](../../../../../apps/frontend/src/app/ui/tokens.md)
- Component map: [src/app/ui/README.md](../../../../../apps/frontend/src/app/ui/README.md)
- Detailed API signatures: `references/components-api.md`
