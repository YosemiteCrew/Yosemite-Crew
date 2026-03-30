# Frontend Testing — Yosemite Crew

## Description

Use this skill when writing or fixing tests in apps/frontend. Covers Jest + React Testing Library conventions, targeting rules, and common pitfalls in this codebase.

TRIGGER: any task involving test files in apps/frontend, or when asked to write/fix/run frontend tests.

---

## New Code = New Tests (Mandatory)

**Every new module, service, hook, store, utility, or component added to `apps/frontend` must ship with tests in the same batch. No exceptions.**

| What you add                                         | What you must also add                                      |
| ---------------------------------------------------- | ----------------------------------------------------------- |
| Service function / API call                          | Jest unit: success + all error branches (axios + non-axios) |
| Zustand store                                        | Jest: every action, selector, guard, and edge case          |
| Custom hook                                          | `renderHook` covering all return values and state branches  |
| Utility / lib function                               | Jest unit with full branch coverage                         |
| UI component                                         | RTL render + at least one user interaction test             |
| E2E-critical flow (auth, booking, checkout, payment) | Playwright test in `playwright/`                            |

**Coverage bar for any new file you author: Statements ≥ 90%, Branches ≥ 90%, Functions ≥ 90%.**

Do not leave an existing file in a worse coverage state than you found it. If you touch a file, hold or improve its coverage.

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

---

## Pitfalls Discovered During Coverage Work (2025–2026)

### `require()` is forbidden — use top-level imports instead

ESLint rule `@typescript-eslint/no-require-imports` blocks `require()` inside test bodies. Never do:

```ts
// ❌ forbidden
const { fromFormRequestDTO } = require('@yosemite-crew/types');
```

Instead, import at the top of the file and cast:

```ts
// ✅ correct
import { fromFormRequestDTO } from '@yosemite-crew/types';
// ...
(fromFormRequestDTO as jest.Mock).mockImplementationOnce(() => {
  throw new Error('invalid');
});
```

### `jest.resetAllMocks()` wipes factory mock return values

If you use `jest.resetAllMocks()` in `beforeEach`, any mock initialized with `.mockReturnValue()` in a `jest.mock()` factory is reset to `undefined`. Re-initialize all mock return values inside `beforeEach` after `resetAllMocks()`:

```ts
beforeEach(() => {
  jest.resetAllMocks();
  // Must re-set these — factory defaults are gone after resetAllMocks
  (canTransitionAppointmentStatus as jest.Mock).mockReturnValue(true);
  (useAuthStore.getState as jest.Mock).mockReturnValue({ user: mockUser, attributes: {} });
});
```

### `axios.isAxiosError` mock — use `jest.mock("axios", ...)` not `jest.spyOn`

`jest.spyOn` on `axios.isAxiosError` doesn't reliably work because the service imports axios at module load time. Use:

```ts
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  })),
  isAxiosError: jest.fn(),
}));
// Then per test:
(axios.isAxiosError as jest.Mock).mockReturnValue(true);
// After test:
(axios.isAxiosError as jest.Mock).mockReset();
```

### Read-only DOM properties require `Object.defineProperty`

`Object.assign(el, { scrollTop: 0 })` throws because `scrollTop` is a getter-only property on `HTMLElement`. Use:

```ts
Object.defineProperty(el, 'scrollTop', { value: 0, writable: true, configurable: true });
```

### Module-level singletons break cross-test isolation with `jest.resetModules()`

Services that maintain module-level singletons (e.g. `connectionPromise`, `chatClient`) can't easily test "connection in progress" state when `jest.resetModules()` resets the module between each test. Drop those test scenarios or use a single `beforeAll` import for that specific describe block.

### `performAppointmentAction` requires a valid `lead.id` for `accept` action

When testing `acceptAppointment` or `changeAppointmentStatus → UPCOMING`, the appointment must have a non-empty `lead.id` or the service throws "Cannot accept appointment without a valid lead." Always include `lead: { id: 'vet-1', name: 'Dr Vet' }` in those test fixtures.

### `canTransitionAppointmentStatus` from `@/app/lib/appointments`

This function is imported by `appointmentService.ts` from `@/app/lib/appointments` (not from a utils sub-path). Mock it as:

```ts
jest.mock('@/app/lib/appointments', () => ({
  canTransitionAppointmentStatus: jest.fn(),
  getInvalidAppointmentStatusTransitionMessage: jest.fn().mockReturnValue('Invalid transition'),
}));
```

And re-initialize in `beforeEach` after `resetAllMocks()`:

```ts
const { canTransitionAppointmentStatus } = jest.requireMock('@/app/lib/appointments');
(canTransitionAppointmentStatus as jest.Mock).mockReturnValue(true);
```

### Auth and team stores need re-initialization when using `resetAllMocks()`

`useAuthStore` and `useTeamStore` are imported by `appointmentService`. If your test file uses `jest.resetAllMocks()`, you must re-seed these in `beforeEach`:

```ts
const { useAuthStore } = jest.requireMock('@/app/stores/authStore');
(useAuthStore.getState as jest.Mock).mockReturnValue({
  user: { getUsername: jest.fn().mockReturnValue('user-1') },
  attributes: {},
});
```

### `getValidSession` branch logic in authStore

`isSessionFresh` checks `session.isValid()` first, then reads `payload.exp`. Testing branches:

- Pass a session with `isValid: () => true` and `exp` far in the future → returns cached session
- Pass `null` session → triggers refresh
- Pass session where `decodePayload` throws → falls back to `session.isValid()` return value
- `forceRefresh: true` + null refreshed session → returns `null` without calling `checkSession`
