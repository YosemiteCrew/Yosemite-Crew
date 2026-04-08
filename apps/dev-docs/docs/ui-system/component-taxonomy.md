---
sidebar_position: 3
title: Component Taxonomy
description: How components are classified, what categories exist, and how to decide where new UI belongs.
---

# Component Taxonomy

All frontend UI must belong to exactly one category. This prevents ambiguity about where code lives and whether it can be reused.

---

## Categories

### Tokens

Design variables — not components. CSS custom properties and Tailwind theme entries.

- Location: `packages/design-tokens/` and `apps/frontend/src/app/globals.css`
- Rule: No app-specific business logic here.

### Primitives

Lowest-level building blocks used everywhere.

- Location: `apps/frontend/src/app/ui/primitives/` and base files like `Button.tsx`, `Text.tsx`, `Card.tsx`
- Rule: Must have stable API, token alignment, tests, and story coverage to be **Approved**.

### Inputs

Form control components.

- Location: `apps/frontend/src/app/ui/inputs/`
- Examples: Datepicker, Dropdown, Search, FileInput, MultiSelectDropdown

### Overlays

Components that render above page content.

- Location: `apps/frontend/src/app/ui/overlays/`
- Examples: ModalBase, CenterModal, Toast, YosemiteLoader

### Layout / Navigation

Page structure, shells, headers, sidebars, routing guards.

- Location: `apps/frontend/src/app/ui/layout/`
- Examples: Header, PublicShell, ProtectedRoute, ToastProvider

### Cards

Card-shaped display units with varied content.

- Location: `apps/frontend/src/app/ui/cards/`
- Base: `Card.tsx` (3 variants: default / bordered / subtle)

### Tables

Data table components and cell primitives.

- Location: `apps/frontend/src/app/ui/tables/`
- Base: `GenericTable` — use this before building domain-specific tables.

### Widgets

Higher-level domain composites shared across multiple features.

- Location: `apps/frontend/src/app/ui/widgets/`
- Rule: Only promote to Widget if used in 2+ features AND it carries its own story.

### Feature-only composites

Components that are tightly coupled to one feature area and not meant for general reuse.

- Location: `apps/frontend/src/app/features/<feature>/`
- Rule: Do not move to `ui/` unless the component genuinely reappears in another feature.

### Legacy / Deprecated

Components that are pending replacement or removal.

- Still in `ui/` but labeled **Legacy** or **Deprecated** in `INVENTORY.md`.
- New code must not use Deprecated components.
- New code must not add new usages of Legacy components (existing usage is allowed).

---

## Status labels

| Label               | Meaning                               | Action required          |
| ------------------- | ------------------------------------- | ------------------------ |
| ✅ **Approved**     | Use freely for new work               | None                     |
| 🔄 **In migration** | Use with caution; cleanup in progress | Check notes before using |
| ⚠️ **Legacy**       | No new usage; existing usage allowed  | Don't spread it further  |
| ❌ **Deprecated**   | Must be replaced                      | Create a migration task  |

Full inventory: [`apps/frontend/src/app/ui/INVENTORY.md`](https://github.com/YosemiteCrew/Yosemite-Crew/blob/dev/apps/frontend/src/app/ui/INVENTORY.md)

---

## Approval criteria

A component is only **Approved** when **all** of the following are true:

- [ ] Uses design tokens (no hardcoded hex, px, or font values)
- [ ] Stable, documented props API (TypeScript types exported)
- [ ] Jest / RTL tests cover the main states
- [ ] Storybook story covers all visual states, variants, and sizes
- [ ] Accessibility review: semantic HTML, keyboard navigability, ARIA attributes where needed
- [ ] Usage documentation (inline JSDoc + story description)
- [ ] Clear category in INVENTORY.md

---

## Deciding where new UI belongs

```
Is it a one-off for this feature only?
  → Feature-only composite. Lives in features/<feature>/. Do not promote.

Is it used in 2+ features already?
  → Shared composite candidate. Promote to ui/ with stories + tests.

Does a similar Approved component already exist?
  → Extend it. Do not create a parallel component.

Is it a foundational building block (button, input, card)?
  → Primitive/Input/Card. High bar for approval. Must pass all criteria.
```

---

## Storybook navigation mirrors taxonomy

Storybook categories map directly to this taxonomy:

- `Primitives/` → Primitives
- `Inputs/` → Inputs
- `Overlays/` → Overlays
- `Layout/` → Layout / Navigation
- `Cards/` → Cards
- `Tables/` → Tables
- `Widgets/` → Widgets
- `Legacy/` → Legacy / Deprecated (visible but labeled)
