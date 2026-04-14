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
- Prefer `.at(-1)` over `arr[arr.length - 1]`.
- Avoid `else { if (...) { ... } }` patterns; collapse to `else if`.
- If `replaceAll` uses a RegExp, it must be global (`/g`), and prefer direct characters over single-character classes (`/[,]/` -> `,`).
- Use `String.raw` for regex-heavy template literals to avoid excess escaping.
- Remove empty object spreads and other no-op spreads.
- Prefer native semantic elements over ARIA-role shims (`<dialog>` over `role="dialog"`, no `role="group"` wrappers when not needed).
- Keep callback/function nesting depth at 4 or less by extracting named helpers for inner logic.

After any change: `npx tsc --noemit` + `pnpm --filter frontend run lint`.

---

## Testing

```bash
# Targeted only — never the full suite
pnpm --filter frontend run test -- --testPathPattern="ComponentName"
```

### Coverage Mandate — Non-Negotiable

**Target: ≥ 95% Statements, Branches, Functions, Lines. Every change must move coverage upward, never downward.**

1. **Any file you touch** must finish with equal or higher coverage than you found it.
2. **Any file you create** must hit ≥ 90% on first commit — no new file ships without tests.
3. **When you delete code**, delete the matching test code too.
4. **When you modify behaviour**, update existing tests for the changed path AND add new cases for new branches.
5. **Snapshot tests do not substitute** for behavioural assertions — every logical branch needs at least one outcome assertion.

#### All four test layers must grow together

| Layer     | Tool                       | When required                                                     |
| --------- | -------------------------- | ----------------------------------------------------------------- |
| Unit      | Jest                       | Every service, store, hook, utility, helper                       |
| Component | RTL                        | Every UI component — render + interaction + conditional rendering |
| Snapshot  | Jest `toMatchSnapshot`     | Stable layouts — complement behavioural tests, never replace them |
| E2E       | Playwright (`playwright/`) | Auth, booking, checkout, payment, and any critical user journey   |

#### Coverage check workflow

```bash
# Verify coverage for the file(s) you changed:
pnpm --filter frontend run test -- --testPathPattern="<YourFile>" --coverage --collectCoverageFrom="src/app/path/to/YourFile.tsx"
# If Statements/Branches/Functions dropped, add tests before declaring done.
```

---

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
# 1. Type check — run with a 120s timeout; if it times out tell the user, never silently skip
npx tsc --noemit                                    # from apps/frontend/

# 2. Lint
pnpm --filter frontend run lint

# 3. Targeted tests — check src/app/__tests__/ for matching test file before running
pnpm --filter frontend run test -- --testPathPattern="<YourFile>"
```

When modifying an existing file, check whether a test file already exists for it in `src/app/__tests__/` (mirroring the source path). If it does, run it and **fix any failures your change introduced** before declaring the task done. A change is not complete if it breaks existing tests.

**Always report actual test output at each COMMIT CHECKPOINT.** Never fabricate or omit results. If tsc times out, say so. If no test file exists for a touched file, say so — do not silently skip.

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
