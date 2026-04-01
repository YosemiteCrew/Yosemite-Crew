# Frontend — Agent Rules

Inherits all root `AGENTS.md` rules. This file adds frontend-specific rules.

**Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS 4, Zustand, Jest + RTL.

---

## Design System — Reuse First

Before writing any new UI, check `src/app/ui/` for existing components:

```
src/app/ui/
  Button.tsx          variants: primary | secondary | danger
  Card.tsx            variants: default | bordered | subtle
  Badge.tsx           status chips
  Input.tsx           base input
  Stack.tsx           flex layout helper
  Text.tsx            typography
  inputs/             Datepicker, Dropdowns, Search, FileInput
  cards/              Appointment, Inventory, Forms
  tables/             DataTable variants
  overlays/           Modal, Toast, Loader
  layout/             Header, Sidebar
  primitives/         low-level Buttons, Icons
  filters/            form/inventory filters
```

Import from barrel: `import { Button, Card } from '@/app/ui'`

Design-token source of truth: `src/app/globals.css` (`@theme`). `src/app/ui/tokens.md` is reference material only. Never hardcode colors — use `--color-*` CSS tokens.

---

## Styling Rules

- Tailwind CSS 4 only for new code. No new Bootstrap classes.
- Use `clsx` for conditional classes.
- Font: **Satoshi** (already loaded). Never default to Inter or system fonts for new UI.
- No arbitrary Tailwind values (e.g. `w-[347px]`) without a clear reason.

## UI Copy Rules

- Never render backend/raw enums or acronyms in UI copy (example: `PAYMENT_AT_CLINIC`, `VET`).
- Always transform technical values to user-friendly text before render.
- Never use `Actor` as a label in cards, tables, or details panes. Prefer contextual labels such as `Lead`, `Support`, or neutral `Updated by`.

---

## State Management

Zustand stores in `src/app/stores/`. One store per domain. Do not introduce new state libraries.

Available stores: appointment, auth, availability, companion, document, forms, integration, inventory, invoice, org, parent, profile, room, search, service, subscription, task, team, universalSearch.

---

## SonarQube — Non-Negotiable Rules

Full rule set in `.claude/skills/frontend-sonar/SKILL.md`. Summary of the most commonly violated:

- `useState` must be destructured: `const [value, setValue] = useState(...)`.
- No `const [, setter]` — use `useRef` when the value is never read.
- No `<div role="...">` where a native HTML element exists.
- Non-interactive elements with `onClick` need `role`, `tabIndex={0}`, `onKeyDown`.
- Cognitive complexity ≤ 15. Nesting ≤ 4 levels. No nested ternaries in JSX.
- Nested ternaries inside prop values → extract to a **named module-level helper function**, not an inline const.
- Raw text node adjacent to a sibling JSX element → wrap the text in a JSX expression: `{"Label"}` not bare `Label` (fixes "ambiguous spacing before next element span").
- Arrays only used for `.includes()` → convert to `Set` and use `.has()`.
- Use `globalThis.window` not bare `window`.

After any change: `npx tsc --noemit` + `pnpm --filter frontend run lint`.

---

## Testing

```bash
# Targeted only — never the full suite
pnpm --filter frontend run test -- --testPathPattern="ComponentName"
```

### New code = new tests (mandatory)

Every new file you add must ship tests in the same commit batch. No exceptions.

| New code                                    | Required test                                              |
| ------------------------------------------- | ---------------------------------------------------------- |
| Service function                            | Jest unit: success + all error branches (axios, non-axios) |
| Zustand store                               | Jest: every action, selector, guard, and edge case         |
| Custom hook                                 | `renderHook` covering all return values and state branches |
| Utility / lib function                      | Jest unit with full branch coverage                        |
| UI component                                | RTL render + at least one user interaction test            |
| E2E-critical flow (auth, booking, checkout) | Playwright test in `playwright/`                           |

**Coverage bar for new files: Statements ≥ 90%, Branches ≥ 90%, Functions ≥ 90%.**
Never leave an existing file in a worse coverage state than you found it.

### Mandatory pre-commit checks (run in order, never skip)

```bash
npx tsc --noemit                                    # from apps/frontend/
pnpm --filter frontend run lint
pnpm --filter frontend run test -- --testPathPattern="<YourFile>"
```

- Mock react-icons as `<span>`, not `<button>`.
- `await act(async () => { ... })` for async state updates.
- Reset Zustand stores in `beforeEach`.
- DOM nesting warnings are test failures in this repo.
- When a hook calls `useXxxStore.getState()` directly, the store mock must expose `getState` too. Use `Object.assign(jest.fn(), { getState: jest.fn() })` in factory mocks, or attach `(useXxxStore as any).getState = mockGetState` in `beforeEach` for auto-mocks. See `frontend-testing` skill for full patterns.

### Test TypeScript rules

- **No `require()` in test bodies** — ESLint rule `@typescript-eslint/no-require-imports` blocks it. Always use top-level ES imports and cast: `(fromFormRequestDTO as jest.Mock).mockImplementationOnce(...)`.
- **`jest.resetAllMocks()` wipes factory mock defaults** — re-initialize all `.mockReturnValue()` calls in `beforeEach` after `resetAllMocks()`.
- **`axios.isAxiosError` mock** — use `jest.mock("axios", () => ({ isAxiosError: jest.fn() }))`, not `jest.spyOn`. Cast as `(axios.isAxiosError as unknown as jest.Mock)`.
- **Read-only DOM properties** — use `Object.defineProperty(el, 'scrollTop', { value: 0, writable: true, configurable: true })`, not `Object.assign`.
- **Type casts that don't overlap** — add `unknown` as intermediary: `as unknown as TargetType` instead of direct `as TargetType`.
- **`Task` type uses `_id`, not `id`** — always use `_id` when constructing partial task fixtures.
- **`RoleCode`** only includes `'OWNER'` and `'ADMIN'` — use `'MEMBER' as any` for other role strings in tests.

## What NOT to Do

- Do not nest `<button>` inside `<button>`.
- Do not add new `eslint-disable` comments.
- Do not import the same module twice in one file.
- Do not add new shadcn, Radix, or Material-UI imports — not in this stack.
- Do not use the `void` operator on promises.
