---
sidebar_position: 4
title: Contribution Guide
description: Rules for adding, modifying, and reviewing UI components — for humans and AI agents.
---

# UI Contribution Guide

This guide applies to all UI work in `apps/frontend/src/app/ui/` and `packages/design-tokens/`.
It also serves as the canonical reference for AI agents extending the design system.

---

## Before you write any code

1. **Check INVENTORY.md** — Is there an Approved component that already does what you need?
   ```
   apps/frontend/src/app/ui/INVENTORY.md
   ```
2. **Check Storybook** — Browse `pnpm --filter frontend run storybook` for visual reference.
3. **Check `ui/` barrel exports** — Import from the barrel: `import { Button, Card } from '@/app/ui'`

If an Approved component exists: **use it, extend it, do not duplicate it.**

---

## Adding a new shared component

New shared components require all of the following in the **same PR**:

```
src/app/ui/<category>/<ComponentName>/
  <ComponentName>.tsx        ← Component implementation
  <ComponentName>.stories.tsx ← Storybook stories (required)
  index.ts                   ← Barrel export
```

Plus:

- Jest tests covering key states (in `__tests__/` or colocated)
- Status label added to `INVENTORY.md`
- Entry in the relevant `index.ts` barrel

Do NOT ship a new shared component without stories. A component without a story is not discoverable.

---

## Modifying an existing component

1. Read the component file before modifying it.
2. Check all callsites before changing prop names or signatures.
3. If you break a prop API, update every callsite in the same PR.
4. Update the matching `*.stories.tsx` to reflect changed API.
5. Run targeted tests: `pnpm --filter frontend run test -- --testPathPattern="<ComponentName>"`
6. Run type-check: `npx tsc --noemit`

---

## Writing a story

Stories live **beside the component** (colocated):

```
Button.tsx
Button.stories.tsx    ← same directory
```

Story structure:

```ts
import type { Meta, StoryObj } from '@storybook/react';

const meta = {
  title: '<Category>/<ComponentName>',
  component: MyComponent,
  tags: ['autodocs'],      // enables automatic docs page
  parameters: {
    docs: { description: { component: '...' } },
  },
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

// One story per distinct state / variant
export const Default: Story = { args: { ... } };
export const Disabled: Story = { args: { isDisabled: true, ... } };
```

Required stories for every component:

- Default state
- All variants (if applicable)
- Disabled / loading / error states (if applicable)
- Interactive story for components with state changes

---

## Accessibility requirements

Every shared component must meet these minimum bars:

| Requirement                | Check                                             |
| -------------------------- | ------------------------------------------------- |
| Semantic HTML elements     | No `<div role="button">` — use `<button>`         |
| Keyboard navigation        | All interactive elements reachable via Tab        |
| Focus visible              | `:focus-visible` ring on all interactive elements |
| ARIA labels                | All icon-only buttons have `aria-label`           |
| Form labels                | All inputs associated with a `<label>`            |
| `aria-expanded`            | Accordions and dropdowns declare their state      |
| `role="dialog" aria-modal` | Modals declare themselves as dialogs              |
| `aria-hidden="true"`       | Decorative icons and SVGs carry this              |
| Color alone                | Never convey information with color alone         |

Run the Storybook accessibility addon checks:

```bash
pnpm --filter frontend run storybook
# Select a story → A11y tab in the addons panel
```

---

## Typography rules

- Use `--font-satoshi` (via `font-satoshi` Tailwind class or `var(--font-satoshi)` in CSS).
- **Never use `--font-grotesk` or `--grotesk-font`** — these aliases are removed.
- Use the `<Text>` component or `.text-*` Tailwind classes for all type variants.
- Never hardcode `font-family` in component files. Use CSS variables or Tailwind classes.

---

## Token rules

- Never hardcode hex colors in component files. Use `--color-*` CSS vars or Tailwind token classes.
- Never hardcode pixel values for spacing. Use Tailwind spacing utilities (`p-4`, `gap-6`) or `--spacing-*` vars.
- Never hardcode border-radius values. Use `rounded-2xl` (the default `radius.xl`) or the appropriate Tailwind class.
- New tokens go in `packages/design-tokens/src/` with semantic naming. See [Design Tokens](./design-tokens.md).

---

## Commit format

```
feat(frontend): add <ComponentName> component with stories and tests
fix(frontend): fix keyboard accessibility in <ComponentName>
refactor(frontend): migrate <ComponentName> off react-bootstrap
chore(frontend): add story coverage for <ComponentName>
```

Scope is always `frontend` for web UI work, `mobile` for mobile theme work, `repo` for token package changes.

---

## For AI agents

When asked to add or modify UI in `apps/frontend`:

1. Read `src/app/ui/INVENTORY.md` to check component status.
2. Use only **Approved** components for new UI.
3. Do not use `react-bootstrap` classes or imports.
4. Do not use `--font-grotesk` or `--grotesk-font`.
5. Do not hardcode hex values. Use CSS token variables.
6. Colocate stories beside the component.
7. Run `npx tsc --noemit` and `pnpm --filter frontend run lint` before finishing.
8. Follow CLAUDE.md commit discipline: do not commit — report a COMMIT CHECKPOINT to the user.
