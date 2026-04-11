# Engineering Standards

This document defines repository-wide quality standards for Yosemite Crew.

## Toolchain Baseline

- Node.js `20.x` (see `.nvmrc`)
- `pnpm` workspace package manager
- Turborepo task orchestration

## Pull Request Standard

- Small, focused PRs with clear user impact.
- Conventional commit format is mandatory.
- PR title must follow `<type>(<scope>): <subject>`.
- Every PR should include:
  - Summary of changes
  - Validation steps performed
  - Screenshots/video for UI changes (if applicable)

## Definition Of Done

Before merging, changes should satisfy:

- `pnpm run lint`
- `pnpm run type-check`
- `pnpm run test`
- `pnpm run build`
- Updated docs for any changed behavior, setup, or workflows.

## Testing Expectations

- Add or update tests for all behavioral changes.
- Prefer fast, deterministic tests.
- Do not merge known flaky tests without a tracking issue.
- Keep coverage reports available for Sonar analysis.

## Security Expectations

- Never commit secrets or production credentials.
- Use `.env.example` and template files for configuration docs.
- If a secret leak is suspected:
  - Rotate immediately
  - Follow `SECURITY.md` reporting process

## Documentation Quality

- Keep root `README.md` and workspace READMEs accurate.
- Avoid stale command names and outdated paths.
- Keep docs opinionated and executable.

## AI/Agent Contributions

- Follow repository `AGENTS.md`.
- State assumptions and unresolved risks.
- Do not claim checks were run unless they were run.
