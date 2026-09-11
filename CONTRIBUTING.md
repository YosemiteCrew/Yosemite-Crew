# Contributing to Yosemite Crew

Thanks for contributing to Yosemite Crew. This repository is a pnpm + Turborepo monorepo with multiple apps and shared packages.

## Code of Conduct

Read and follow [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

## Engineering Standards

- Repository standards: [docs/engineering-standards.md](./docs/engineering-standards.md)
- AI/automation contribution policy: [AGENTS.md](./AGENTS.md)
- Architecture decisions (ADRs): [docs/adr/](./docs/adr/README.md) - Architecture Decision Records capture why a significant choice was made; read this before proposing a change to a datastore, payment flow, auth model, or any other decision that would be expensive to reverse.

## Found a Bug?

If you find a bug, please open an issue with clear reproduction steps, expected behavior, and actual behavior.
If you already have a fix, you can open a PR and link the issue.

## Missing a Feature?

If you want to propose a feature, open an issue first so maintainers and contributors can align on scope before implementation.
Small improvements can go directly as PRs, but major feature work should start with discussion.

## Repository Structure

- `apps/backend` - API/backend
- `apps/frontend` - web app
- `apps/desktop` - Electron PIMS desktop shell
- `apps/mobileAppYC` - React Native mobile app
- `packages/auth`, `packages/database`, `packages/fhir`, `packages/fhirtypes`, `packages/lib`, `packages/mcp-server`, `packages/types` - shared packages

## Development Setup

1. Fork and clone the repository.
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Create a feature branch from `dev`:
   ```bash
   git checkout -b feat/your-change
   ```

`pnpm install` automatically runs `prepare`, which installs Husky hooks.

## Local Quality Gates

Before opening a PR, run:

```bash
pnpm run lint
pnpm run type-check
pnpm run test
pnpm run build
```

You can run commands for a single workspace with `--filter`, for example:

```bash
pnpm run lint --filter frontend
pnpm run test --filter backend
```

### Every new frontend component needs a Storybook story

A pull request that adds a new component under `apps/frontend/src/app` and no
sibling `*.stories.tsx` fails CI (`scripts/ci/story-coverage.mjs`, run as the
`Story coverage` check) - a required, blocking gate, the same tier as the
Sonar quality gate. It only judges files the PR *adds*, not the pre-existing
backlog, so it can't block an unrelated change.

If a file genuinely doesn't need a story (a thin wrapper, something only ever
exercised inside a parent's story), mark it explicitly rather than working
around the gate:

```tsx
// no-story: thin route wrapper, real content is <FooPage>, already storied
```

## Commit Message Convention

Commit messages are validated by `commitlint` (locally via Husky and in CI).

Format:

```text
<type>(<scope>): <subject>
```

Allowed `type` values:

- `feat`
- `fix`
- `docs`
- `style`
- `refactor`
- `perf`
- `test`
- `build`
- `ci`
- `chore`
- `revert`

Allowed `scope` values:

- `backend`
- `frontend`
- `mobile`
- `desktop`
- `dev-docs`
- `types`
- `fhir`
- `repo`
- `ci`
- `docs`
- `lib`
- `auth`
- `database`

Rules:

- Subject must be imperative and concise.
- Max header length is 100 characters.

Examples:

- `feat(frontend): add appointment calendar filters`
- `fix(backend): prevent duplicate invoice generation`
- `docs(repo): clarify local setup for contributors`

## Pull Request Standards

PR titles must follow the same conventional format as commits:

```text
<type>(<scope>): <subject>
```

A scope is required — a scopeless title passes local commitlint but fails the "Validate PR title" CI check.

PR checklist:

- Link the related issue (or explain why none exists).
- Keep PRs focused and reasonably small.
- Ensure local hooks pass (`pre-commit`, `commit-msg`, `pre-push`).
- Ensure CI checks pass.
- If behavior or setup changed, update docs in the same PR.

Open PRs against the `dev` branch unless maintainers request otherwise.

## After Your PR Is Merged

You can safely clean up your branch and sync with upstream:

```bash
git push origin --delete your-branch-name
git checkout dev
git pull --ff upstream dev
git branch -D your-branch-name
```

## Security and Secret Hygiene

- Never commit `.env` files or credentials.
- Staged changes are scanned locally in `pre-commit` with Secretlint and the repo staged-secret scanner. If `gitleaks` is installed locally, the hook also runs `gitleaks protect --staged --redact`.
- GitHub Actions also scans for secrets using Gitleaks.
- If you accidentally commit a secret, rotate it immediately and open a security report per [SECURITY.md](./SECURITY.md).
- Keep test and example fixtures low-entropy and obviously fake (`abcdef1234567890`, `not-a-real-key`, `Bearer YOUR_JWT_TOKEN`). A fixture written to look like a live credential is indistinguishable from one to a scanner, and this repo is public: readers and their tooling see the value, not the comment next to it. Assemble the value from parts if a realistic shape is genuinely needed.

## Need Help

- Open a GitHub issue for bugs/features.
- Join community channels linked in [README.md](./README.md).
