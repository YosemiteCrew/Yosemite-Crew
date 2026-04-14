# Frontend SonarQube Rules — Yosemite Crew

## Description

Use this skill when fixing SonarQube issues in apps/frontend, or when writing new code that must pass Sonar checks. Contains the complete rule set enforced in this repo with examples and quick fixes.

TRIGGER: any mention of "sonar", "code quality", "lint issues", or when writing new frontend code.

---

## Mandatory Checks — Run After Every Frontend Change

Run all three in order before declaring any task done. Never skip.

```bash
# 1. Type check — from apps/frontend/
npx tsc --noemit

# 2. Lint — from repo root
pnpm --filter frontend run lint

# 3. Targeted test — only files you modified, NEVER the full suite
pnpm --filter frontend run test -- --testPathPattern="<ModifiedComponentName>"
```

**Full suite (`pnpm run test` with no filter) is forbidden — it hangs the machine.**

---

## Issue Tracker

Resolved/open issues log: `docs/guide/sonar-tracker.md`
Raw Sonar dump: `docs/guide/sonar.md`

Update `sonar-tracker.md` after every fix.

---

## Rules by Category

### Imports

- Never import the same module twice — merge into one statement.
- Prefer named imports.

### TypeScript

- Never `as SomeType | string` when `SomeType` already covers all values.
- Never `void somePromise()` — either `await` it or `.then()` it.
- Remove unnecessary `as X` type assertions where TypeScript can infer.
- Use `.closest<HTMLElement>(selector)` generic overload instead of `as HTMLElement | null`.
- Replace inline union literals repeated across files with a named type alias.
- Use `RefObject<T>` not `MutableRefObject<T>` unless you need to mutate `.current` externally.

### React — useState

- Always destructure: `const [value, setValue] = useState(...)`.
- Never `const state = useState(...)`.
- Never `const [, setter] = useState(...)` — use `useRef` instead when value is never read:

```ts
// Bad
const [, setBlurred] = useState(false);

// Good
const blurredRef = useRef(false);
const setBlurred = (v: boolean) => {
  blurredRef.current = v;
};
```

- Setter naming: `set` + PascalCase(valueName). E.g. `[items, setItems]`.

### React — General

- Never define props not used by the component. When you remove an unused prop from a type, also remove it from every call site and from test `defaultProps` / mock objects — otherwise TypeScript will error on excess properties.
- Never mock react-icons as `<button>` in tests — use `<span>`.
- Never nest `<button>` inside `<button>`.
- No `onClick`/`onKeyDown` on `<dialog>` — move to inner `<div>`.
- Remove unnecessary ARIA role wrappers like `role="group"` when native structure is already semantic.

### JSX — Ambiguous Text/Element Spacing

Sonar flags a raw text node immediately followed by a sibling element inside the same parent as "ambiguous spacing before next element". Fix by wrapping the text node in a JSX expression:

```tsx
// Bad — raw text node adjacent to <span>
<span>
  Finance
  <span className="text-text-tertiary">{` (${count})`}</span>
</span>

// Good — text wrapped in expression, no ambiguity
<span>
  {"Finance"}
  <span className="text-text-tertiary">{` (${count})`}</span>
</span>
```

This applies anywhere a bare string literal sits next to a JSX child element inside the same container.

### Accessibility / Semantic HTML

Prefer native elements over ARIA roles:

| Instead of                                    | Use                          |
| --------------------------------------------- | ---------------------------- |
| `<div role="article">`                        | `<article>`                  |
| `<div role="region" aria-label="...">`        | `<section aria-label="...">` |
| `<div role="list">` / `<div role="listitem">` | `<ul>` / `<li>`              |
| `<div role="dialog">`                         | `<dialog open>`              |
| `<div role="button">`                         | `<button>`                   |

- When container changes to `<ul>`, children must become `<li>` (including empty-state placeholders).
- When card changes to `<article>`, drag handler type → `React.DragEvent<HTMLElement>`.
- Non-interactive `<div>`/`<span>` with `onClick` must also have `role`, `tabIndex={0}`, `onKeyDown`.

### Complexity

- Cognitive complexity limit: **15**.
- Extract sub-sections as named components (not inline anonymous) when limit is exceeded.
- Nesting limit: **4 levels deep** — extract inner callbacks.
- Nested ternaries in JSX: extract to a named `const` before `return`.
- Nested ternaries in prop values (e.g. `value={a ? b ? 'X' : 'Y' : b ? 'Z' : 'W'}`): extract to a **named module-level helper function** placed before the component, not an inline `const`. This keeps the component body clean and the logic reusable.
- If Sonar flags excessive callback nesting (more than 4 levels), extract inner blocks into named helper functions outside the callback.

```ts
// Bad — nested ternary inline in prop
value={gender === 'female' ? isNeutered ? 'Spayed' : 'Not spayed' : isNeutered ? 'Neutered' : 'Not neutered'}

// Good — module-level helper
const getNeuteredStatusLabel = (gender: string | undefined, isNeutered: boolean | undefined): string => {
  if (gender === 'female') return isNeutered ? 'Spayed' : 'Not spayed';
  return isNeutered ? 'Neutered' : 'Not neutered';
};
// then in JSX:
value={getNeuteredStatusLabel(companion.gender, companion.isneutered)}
```

### Constants

```ts
// If array is only used for .includes() → convert to Set
const OPTIONS = new Set<Foo>(['A', 'B', 'C']);
if (OPTIONS.has(value)) { ... }
```

### Modern JS/TS Syntax

| Old                                    | New                          |
| -------------------------------------- | ---------------------------- |
| `window`                               | `globalThis.window`          |
| `typeof x === 'undefined'`             | `x === undefined`            |
| `str.replace(/foo/g, ...)`             | `str.replaceAll('foo', ...)` |
| `/^foo/.test(str)`                     | `str.startsWith('foo')`      |
| `arr[arr.length - 1]`                  | `arr.at(-1)`                 |
| `.filter(...).pop()`                   | `.findLast(...)`             |
| `str.match(regex)`                     | `RegExp.exec(str)`           |
| `arr.findIndex(x => x === val) >= 0`   | `arr.includes(val)`          |
| `.sort()` when original mustn't change | `.toSorted()`                |
| `{ ...{} }`                            | remove empty spread          |
| `arr.length > 0 && arr.every(...)`     | `arr.every(...)`             |

Additional constraints:

- If using `replaceAll` with a RegExp, the regex **must be global** (`/g`) or runtime errors occur.
- Replace single-character regex classes with the character itself when possible (e.g. `/[,]/g` -> `','`).
- For regex-heavy template strings, prefer `String.raw` to reduce escaping bugs.
- Prefer `else if` instead of `else { if (...) { ... } }` to satisfy Sonar readability rules.

### Drag & Drop Typing

All drag handlers shared across element types: use `React.DragEvent<HTMLElement>` not `HTMLDivElement`.

---

## Gotchas

- Running `eslint --fix` will auto-fix some of these but NOT semantic HTML, complexity, or accessibility issues — fix those manually.
- Sonar and ESLint sometimes disagree — Sonar wins.
- After any fix, run: `npx tsc --noemit` + `pnpm --filter frontend run lint` before marking resolved.
