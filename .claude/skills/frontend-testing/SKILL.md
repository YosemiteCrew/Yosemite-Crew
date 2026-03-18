# Frontend Testing — Yosemite Crew

## Description

Use this skill when writing or fixing tests in apps/frontend. Covers Jest + React Testing Library conventions, targeting rules, and common pitfalls in this codebase.

TRIGGER: any task involving test files in apps/frontend, or when asked to write/fix/run frontend tests.

---

## Mandatory Checks — Run in This Order After Every Change

Run all three every time you touch `apps/frontend`. Never skip any step.

```bash
# 1. Type check — run from apps/frontend/
npx tsc --noemit

# 2. Lint — run from repo root
pnpm --filter frontend run lint

# 3. Targeted test — only the files you modified, NEVER the full suite
pnpm --filter frontend run test -- --testPathPattern="<ModifiedComponentName>"

# Examples
pnpm --filter frontend run test -- --testPathPattern="CompanionCard"
pnpm --filter frontend run test -- --testPathPattern="Availability"
pnpm --filter frontend run test -- --testPathPattern="__tests__/features/billing"
```

**Full suite is forbidden.** It takes 100+ seconds and hangs the machine. Always derive the `--testPathPattern` from the filenames you actually changed.

---

## Stack

- **Jest 29** + **React Testing Library** (@testing-library/react, @testing-library/user-event)
- **Playwright** for E2E (separate from unit/integration tests)
- Test files: `src/app/__tests__/`
- Jest config: `apps/frontend/jest.config.ts`
- Mocks: `src/app/jest.mocks/`

---

## Rules

### DOM Nesting

`jest.spyOn(console, 'error')` checks are active — DOM nesting warnings are treated as test failures.

- Never render `<button>` inside `<button>`.
- Mock react-icons as `<span>` not `<button>`:

```tsx
// jest.mocks or inline
jest.mock('react-icons/fa', () => ({
  FaUser: () => <span data-testid="icon-user" />,
  FaPlus: () => <span data-testid="icon-plus" />,
}));
```

### Async State

```tsx
// Always wrap async state updates
await act(async () => {
  userEvent.click(button);
});
```

### Zustand Stores

Reset store state between tests to avoid leakage:

```ts
beforeEach(() => {
  useAuthStore.setState({ user: null, isAuthenticated: false });
});
```

**Mocking stores that use `.getState()` outside React**

When a hook calls `useXxxStore.getState()` directly (e.g. to read `status` without subscribing), `jest.mock` alone produces a plain function with no `getState` method and the test will throw `TypeError: useXxxStore.getState is not a function`.

Two patterns depending on how the store is mocked:

1. **`jest.mock('@/app/stores/xxxStore')` (auto-mock)** — attach `getState` in `beforeEach`:

```ts
const mockGetState = jest.fn();

beforeEach(() => {
  (useXxxStore as unknown as jest.Mock).mockImplementation((selector) => selector(mockState));
  mockGetState.mockReturnValue(mockState);
  (useXxxStore as unknown as jest.Mock & { getState: jest.Mock }).getState = mockGetState;
});
```

2. **`jest.mock('...', () => ({ useXxxStore: jest.fn() }))` (explicit factory)** — include `getState` in the factory and wire it in `beforeEach`:

```ts
jest.mock('@/app/stores/xxxStore', () => ({
  useXxxStore: Object.assign(jest.fn(), { getState: jest.fn() }),
}));

const mockGetState = jest.fn();

beforeEach(() => {
  (useXxxStore as unknown as jest.Mock).mockImplementation((selector) => selector(mockState));
  mockGetState.mockReturnValue(mockState);
  (useXxxStore as unknown as jest.Mock & { getState: jest.Mock }).getState = mockGetState;
});
```

Always update `mockGetState.mockReturnValue(mockState)` whenever `mockState` changes mid-test so that `getState()` stays in sync with the selector mock.

### API Mocking

Use `jest.spyOn` on axios or mock at the module level. Never make real HTTP calls in tests.

```ts
import axios from 'axios';
jest.spyOn(axios, 'get').mockResolvedValue({ data: mockData });
```

### Query Priority (Testing Library)

In order of preference:

1. `getByRole` — semantic, accessible
2. `getByLabelText` — forms
3. `getByText` — when role isn't meaningful
4. `getByTestId` — last resort, only when no other selector works

---

## File Structure

```
src/app/__tests__/
  features/           ← feature-level tests
  components/         ← component unit tests
  hooks/              ← custom hook tests
  utils/              ← utility function tests
```

Test file naming: `ComponentName.test.tsx` mirrors the source file name.

---

## Gotchas

- Never use `screen.getByDisplayValue` for controlled inputs — use `getByRole('textbox')` + check value.
- `userEvent` needs `await` in v14+ — always `await userEvent.click(el)`.
- If a test imports from `@/app/ui`, make sure the mock is at module level, not inside `describe`.
- Playwright tests live in `playwright/` and run separately — don't confuse them with Jest tests.
- If `--testPathPattern` matches multiple files unintentionally, be more specific with the path.
