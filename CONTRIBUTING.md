# Contributing to Yosemite Crew

Thanks for contributing to Yosemite Crew. This repository is a pnpm + Turborepo monorepo with multiple apps and shared packages.

## Code of Conduct

Read and follow [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

## Engineering Standards

- Repository standards: [docs/engineering-standards.md](./docs/engineering-standards.md)
- AI/automation contribution policy: [AGENTS.md](./AGENTS.md)

## Found a Bug?

If you find a bug, please open an issue with clear reproduction steps, expected behavior, and actual behavior.
If you already have a fix, you can open a PR and link the issue.

## Missing a Feature?

If you want to propose a feature, open an issue first so maintainers and contributors can align on scope before implementation.
Small improvements can go directly as PRs, but major feature work should start with discussion.

## Repository Structure

- `apps/backend` - API/backend
- `apps/frontend` - web app
- `apps/mobileAppYC` - React Native mobile app
- `apps/dev-docs` - Docusaurus docs app
- `packages/types` and `packages/fhirtypes` - shared packages

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
- `dev-docs`
- `types`
- `fhirtypes`
- `repo`
- `ci`
- `docs`

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
- Staged changes are scanned locally with Secretlint in `pre-commit`.
- GitHub Actions also scans for secrets using Gitleaks.
- If you accidentally commit a secret, rotate it immediately and open a security report per [SECURITY.md](./SECURITY.md).

## Need Help

- Open a GitHub issue for bugs/features.
- Join community channels linked in [README.md](./README.md).
