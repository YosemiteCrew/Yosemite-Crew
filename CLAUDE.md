# Claude Code Agent Instructions — Yosemite Crew

This file is auto-loaded by Claude Code on every session. All rules here are **mandatory**.

## Skills Index

Modular skills in `.claude/skills/` provide deep, app-specific guidance. Load the relevant one before starting any task:

| Skill                             | When to use                                                  |
| --------------------------------- | ------------------------------------------------------------ |
| `.claude/skills/frontend-design`  | UI work, new components, styling in apps/frontend            |
| `.claude/skills/frontend-sonar`   | SonarQube fixes or writing Sonar-clean code in apps/frontend |
| `.claude/skills/frontend-testing` | Writing/fixing/running tests in apps/frontend                |
| `.claude/skills/backend-patterns` | Any work in apps/backend                                     |
| `.claude/skills/mobile-patterns`  | Any work in apps/mobileAppYC                                 |
| `.claude/skills/monorepo-ops`     | Cross-app work, dependency changes, turbo, pnpm              |
| `.claude/skills/code-review`      | Reviewing code or auditing a PR                              |

Per-app `AGENTS.md` files (for Codex compatibility): `apps/frontend/AGENTS.md`, `apps/backend/AGENTS.md`, `apps/mobileAppYC/AGENTS.md`.

---

## Monorepo Layout

```
apps/
  frontend/      — Next.js web app (primary)
  backend/       — API server (do not refactor unless explicitly asked)
  mobileAppYC/   — React Native mobile app
  dev-docs/      — Internal documentation site
packages/
  types/         — Shared TypeScript types
  fhirtypes/     — FHIR type definitions
```

Tooling: `pnpm` workspaces + `turbo`. Always use `--filter` to scope commands to the relevant workspace.

---

## Mandatory Checks Before Finishing A Frontend Task

Run these in order when your changes touch `apps/frontend`. **Never skip any of them for frontend work.**

```bash
# 1. Type check (run from apps/frontend/)
npx tsc --noemit

# 2. Lint
pnpm --filter frontend run lint

# 3. Tests — TARGETED ONLY, never the full suite
pnpm --filter frontend run test -- --testPathPattern="<relevant-file>"
# Example:
pnpm --filter frontend run test -- --testPathPattern="Availability"
```

**Full test suite runs are forbidden.** They take 100+ seconds. Always target the test file(s) related to what you changed.

For backend/mobile/shared-package only changes, run the workspace-appropriate checks instead of frontend checks.

## Commit Discipline — CRITICAL

Before making changes in a resumed or compacted session, run `git status --short` and preserve any existing uncommitted work unless the user explicitly asks you to discard it.

**NEVER run `git commit` yourself.** The agent must never commit. Instead:

- After every logical batch of changes (per file or feature), tell the user: "**COMMIT CHECKPOINT** — suggested message: `<conventional commit message>`"
- The user commits manually.
- This prevents context compaction from silently discarding uncommitted work.

Additional commit rules:

- Never add `Co-Authored-By` or any signature lines to commit messages.
- Never skip pre-commit hooks (`--no-verify` is forbidden).
- All pre-commit hooks must pass before the user commits — if lint/type/test checks fail, fix them first.

---

## Code Quality — SonarQube Rules (Enforce on Every Change)

These are the exact classes of issues that have been repeatedly introduced and fixed in this codebase. Do not introduce any of them.

### Imports

- Never import the same module twice in one file — merge into a single import statement.
- Prefer named imports; avoid barrel re-imports that cause duplicate resolution.

### TypeScript

- Never use `as SomeType | string` unions — if a type already covers all values, drop the `| string`.
- Never use the `void` operator (`void somePromise()`). Either `await` it or chain `.then()`.
- Remove unnecessary type assertions (`as X`) where TypeScript can infer the type.
- Use `.closest<HTMLElement>(selector)` with the generic overload instead of `.closest(selector) as HTMLElement | null` — the generic is cleaner and Sonar accepts it.
- Replace inline union types that repeat the same literal set with a named type alias.
- Use `RefObject<T>` instead of `MutableRefObject<T>` unless you explicitly need to mutate `.current` from outside React.

### React — useState

- Always destructure `useState` as `const [value, setValue] = useState(...)`.
- Never `const state = useState(...)` (not destructured).
- Never `const [, setter] = useState(...)` with an empty first slot — Sonar flags the omitted value. If the state value is never read, replace the entire `useState` with a `useRef` and a plain setter function:
  ```ts
  // Instead of: const [, setBlurred] = useState(false)
  const blurredRef = useRef(false);
  const setBlurred = (v: boolean) => {
    blurredRef.current = v;
  };
  ```
- The setter must follow the naming convention `set` + PascalCase of the value name. E.g. `[recentSearches, setRecentSearches]` — not `setRecentSearchesState`.

### React — General

- Never define props that are not actually used by the component. When removing an unused prop from a type, also remove it from every call site and from test `defaultProps` / mock objects.
- Icon components from `react-icons` render as `<svg>`. Never mock them as `<button>` in tests — use `<span>` to avoid DOM nesting violations.
- Never nest `<button>` inside `<button>` — invalid HTML and breaks tests.
- Never put `onClick`/`onKeyDown` on a `<dialog>` element — Sonar treats it as non-interactive. Move stop-propagation handlers to an inner wrapper `<div>` if needed.

### React — Accessibility & Semantic HTML

- Use native semantic elements instead of ARIA roles on divs:
  - `<article>` instead of `<div role="article">`
  - `<section aria-label="...">` instead of `<div role="region" aria-label="...">`
  - `<ul>` / `<li>` instead of `<div role="list">` / `<div role="listitem">`
  - `<dialog open>` instead of `<div role="dialog">`
  - `<button>` instead of `<div role="button">`
- When changing a container from `<div>` to `<ul>`, its children must become `<li>` elements (including empty-state placeholders).
- When changing a card from `<div>` to `<article>`, update drag handler types — `onDragStart` on `<article>` passes `DragEvent<HTMLElement>`, not `DragEvent<HTMLDivElement>`. Type the handler as `React.DragEvent<HTMLElement>` to stay compatible across element types.
- Non-interactive elements (`<div>`, `<span>`) that have `onClick` must also have `role`, `tabIndex={0}`, and an `onKeyDown` handler.
- Every interactive element must be reachable via keyboard (`tabIndex`).

### Complexity

- Cognitive complexity limit: **15**. If a component or function exceeds this, extract named helper components or module-level functions.
- When a React component's render function is too complex, extract sub-sections as standalone named components (not inline anonymous components) placed before the parent in the same file. Pass the needed state down as props.
- Nesting limit: **4 levels deep**. Extract inner callbacks, map bodies, or conditional branches into named module-level functions.
- Nested ternaries in JSX: extract to a named `const` before the `return`.
- Nested ternaries inside prop values (e.g. `value={a ? b ? 'X' : 'Y' : ...}`): extract to a **named module-level helper function** placed before the component — not an inline const inside render.

### Constants — Arrays vs Sets

- If a constant array is used only for `.includes()` membership checks, convert it to a `Set` and use `.has()`:

  ```ts
  // Before
  const OPTIONS: Foo[] = ['A', 'B', 'C'];
  if (OPTIONS.includes(value)) { ... }

  // After
  const OPTIONS = new Set<Foo>(['A', 'B', 'C']);
  if (OPTIONS.has(value)) { ... }
  ```

- When converting, find **all** usages — update `.includes()` → `.has()` and any spreading (`[...OPTIONS]`) accordingly.

### JavaScript / Modern Syntax

- Use `globalThis.window` instead of bare `window` for SSR-safe checks.
- Use `globalThis.window?.sessionStorage` (optional chaining) when accessing browser APIs.
- `typeof x === 'undefined'` → `x === undefined` (compare directly).
- `String#replaceAll()` over `String#replace()` with a `/g` regex.
- `String#startsWith()` / `String#endsWith()` over regex or index checks.
- `Array#at(-1)` over `arr[arr.length - 1]`.
- `Array#findLast()` over `.filter(...).pop()`.
- `RegExp.exec(str)` over `str.match(regex)` for single-match extraction.
- `Array#indexOf()` over `Array#findIndex(x => x === val)`.
- `Array#includes()` over `Array#indexOf(x) >= 0` for existence checks.
- `.toSorted()` over mutating in-place `.sort()` when the original array should not be modified.
- Remove empty object spreads (`{ ...{} }` is a no-op).
- Remove redundant `return`/`continue` at the natural end of a block.
- Remove assignments to variables that are immediately overwritten.
- Remove `arr.length > 0 &&` guards before `arr.every(...)` — `every` returns `true` for empty arrays by spec.
- Duplicate functions: if two functions have identical implementations, consolidate — one delegates to the other.

### Drag & Drop Typing

- Drag event handlers shared across `<div>`, `<ul>`, `<li>`, `<article>`, `<section>` must use `React.DragEvent<HTMLElement>` (not `HTMLDivElement`) so they remain assignable to any HTML element's drag props.

---

## Test Writing Rules

- Mock `react-icons` components as `<span>` (not `<button>`) — icons are rendered inside `<button>` elements in this app and button-inside-button is invalid HTML.
- Always use `--testPathPattern` or `--testNamePattern` to run targeted tests.
- Tests must pass `jest.spyOn(console, 'error')` checks — DOM nesting warnings are treated as errors in this repo's jest setup.
- Use `await act(async () => { ... })` when testing components with async state updates.
- When a hook calls `useXxxStore.getState()` directly (outside React), the jest mock must expose `getState` too — a plain `jest.fn()` will not have it. For auto-mocks assign it in `beforeEach`; for factory mocks use `Object.assign(jest.fn(), { getState: jest.fn() })`. See `frontend-testing` skill for full patterns.
- When a text node sits directly next to a sibling JSX element inside the same container, wrap the text in a JSX expression (`{"Label"}`) to avoid the Sonar "ambiguous spacing before next element" error.

---

## What NOT to Do

- Do not run `pnpm run test` without `--testPathPattern` — full suite is forbidden.
- Do not commit `.env` files, secrets, tokens, or private keys.
- Do not refactor backend code unless explicitly requested.
- Do not add `// eslint-disable` comments to suppress warnings — fix the root cause.
- Do not create new files when editing an existing one achieves the goal.
- Do not add docstrings, comments, or type annotations to code you didn't change.
- Do not add error handling for scenarios that cannot happen.
- Do not design for hypothetical future requirements.
- Do not fabricate command output, test results, or lint results.

---

## Commit & PR Format

Conventional commits are enforced by `commitlint`:

```
<type>(<scope>): <subject>

Types: feat | fix | chore | refactor | test | docs | style | perf | ci
Scope: frontend | backend | mobile | types | docs | repo

Examples:
  feat(frontend): add recurring appointment support
  fix(frontend): resolve button nesting in Availability component
  fix(frontend): use HTMLElement drag handler type across board cards
  test(frontend): fix Availability icon mock to use span not button
  chore(repo): update agent rules with sonar patterns
```

PR title must match the same pattern. PR body must include: what changed, why, impact area, validation performed.

---

## How to Give Me a Task Efficiently

Use this pattern when prompting:

```
[SCOPE: frontend | backend | mobile | types | all]
[FILES: optional list of files to focus on]

<your task description>
```

Example prompts that work well:

- `[SCOPE: frontend] Fix the nested ternary sonar issues in AppointmentCalendar.tsx`
- `[SCOPE: frontend] [FILES: TaskBoard.tsx] Add keyboard accessibility to the drag handles`
- `[SCOPE: frontend] Run targeted tests for the Availability component and fix any failures`
- `[SCOPE: frontend] Fix all issues in the latest sonar.md dump and update the tracker`

---

## Sonar Issue Tracker

The resolved/unresolved issue log lives at [`docs/guide/sonar-tracker.md`](docs/guide/sonar-tracker.md).
The raw sonar dump is at [`docs/guide/sonar.md`](docs/guide/sonar.md).
Update the tracker (`resolved` column) whenever you fix an issue from that list.
When a new sonar.md is provided, generate new tracker rows for all new issues and mark them as the fixes are applied.
