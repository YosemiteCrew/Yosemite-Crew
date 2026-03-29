# Monorepo Operations — Yosemite Crew

## Description

Use this skill for any task involving monorepo-level operations: running scripts, adding dependencies, managing shared packages, understanding workspace relationships, or cross-app work.

TRIGGER: tasks spanning multiple apps, dependency changes, turbo commands, pnpm workspace operations, or shared package changes.

---

## Workspace Layout

```
apps/
  frontend/       @yosemite-crew/frontend
  backend/        @yosemite-crew/backend
  mobileAppYC/    @yosemite-crew/mobile
  dev-docs/       @yosemite-crew/dev-docs
packages/
  types/          @yosemite-crew/types
  fhirtypes/      @yosemite-crew/fhirtypes
  fhir/           @yosemite-crew/fhir
```

Tooling: **pnpm workspaces** + **Turbo**. Package manager: `pnpm@8.15.6`.

---

## Running Commands

Always use `--filter` to scope to the relevant workspace. Never run commands at root without `--filter` unless intentionally affecting all packages.

```bash
# Dev
pnpm --filter frontend dev
pnpm --filter backend dev

# Build
pnpm --filter frontend build
pnpm turbo build --filter=frontend...   # build frontend + its deps

# Lint
pnpm --filter frontend run lint
pnpm --filter backend run lint

# Type check
pnpm --filter frontend run type-check
# or from within the app:
npx tsc --noemit

# Tests (targeted)
pnpm --filter frontend run test -- --testPathPattern="ComponentName"
pnpm --filter mobile run test -- --testPathPattern="ScreenName"
```

---

## Adding Dependencies

```bash
# Add to a specific app
pnpm --filter frontend add <package>
pnpm --filter backend add <package>
pnpm --filter mobile add <package>

# Add as devDependency
pnpm --filter frontend add -D <package>

# Add to a shared package
pnpm --filter @yosemite-crew/types add <package>

# Add root devDependency (tooling only)
pnpm add -D -w <package>
```

---

## Shared Packages

When changing `packages/types` or `packages/fhirtypes`:

1. Update the type definitions.
2. Run `pnpm --filter @yosemite-crew/types build` (if it has a build step).
3. All consumers (frontend, backend, mobile) pick up changes automatically via workspace links.
4. Run type-check in each affected app.

---

## Build Pipeline (Turbo)

`turbo.json` defines the task graph. Tasks run in dependency order automatically.

```bash
pnpm turbo build           # builds all apps in correct order
pnpm turbo build --filter=frontend...  # builds frontend + its dependencies
```

---

## Pre-commit Hooks

Husky + commitlint are configured. Pre-commit runs lint + type-check. Commit messages must follow conventional commits:

```
<type>(<scope>): <subject>
Types: feat | fix | chore | refactor | test | docs | style | perf | ci
```

Scope allowlist is defined centrally in root `AGENTS.md` and enforced by `commitlint.config.cjs`.

Never skip hooks with `--no-verify`.

---

## Secrets Check

`secretlint` runs on commit. Never commit `.env` files, API keys, tokens, or private keys.

```bash
pnpm run check:secrets   # manual check
```

---

## Gotchas

- `pnpm install` at the root installs all workspaces. Never run `npm install` or `yarn` — pnpm only.
- Hoisting: some packages are hoisted to root `node_modules`, others are not. If you see resolution errors, check `pnpm-workspace.yaml`.
- Lock file: always commit `pnpm-lock.yaml` changes. Never ignore it.
- If turbo cache causes stale output: `pnpm turbo build --force` to bypass cache.
