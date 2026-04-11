# Backend Skills

This file documents the backend-specific working patterns for agents and contributors operating in `apps/backend`.

## Use This Workspace For

- Express API route, controller, service, and model changes
- Prisma schema and migration-related backend work
- BullMQ queues and worker updates
- Integrations under `src/integrations/`, especially IDEXX and Merck
- Auth, validation, and logging changes in the backend app

## Core Stack

- Express 4 with TypeScript
- MongoDB/Mongoose for application models
- Prisma for schema and migration work
- Zod for request validation
- BullMQ for background jobs
- Winston for logging
- AWS Cognito, `jsonwebtoken`, and `jwks-rsa` for auth

## Required Architecture

Follow this flow:

`Router -> Controller -> Service -> Model`

- Routers register endpoints only.
- Controllers validate input and shape responses.
- Services contain business logic.
- Models define persistence concerns.

Do not move business logic into routers or controllers.

## Backend Rules

- Validate `req.body` with Zod before using it.
- Use Winston, not `console.log`.
- Queue async/background work with BullMQ instead of processing it inline in request handlers.
- Keep workers idempotent because retries can happen.
- Use FHIR types from `@yosemite-crew/fhirtypes` for healthcare data.
- Extend external vendor behavior inside `src/integrations/`.
- Treat Firebase Admin as a singleton.
- Verify Stripe webhook signatures before processing them.

## Key Directories

- `src/routers` for route registration
- `src/controllers` for HTTP handling
- `src/services` for business logic
- `src/models` for Mongoose models
- `src/integrations` for third-party integrations
- `src/queues` and `src/workers` for background processing
- `src/scripts` for backend maintenance and migration utilities
- `prisma/schema.prisma` for Prisma schema changes

## Safe Change Workflow

1. Read `AGENTS.md` at the repo root and `apps/backend/AGENTS.md` before making changes.
2. Find the existing router, controller, service, or model that already owns the behavior.
3. Make the smallest change in the correct layer.
4. Update targeted tests when behavior changes.
5. Run backend validation before handoff.

## Validation Commands

Run these from the repo root unless a task requires otherwise:

```bash
pnpm --filter backend run lint
pnpm --filter backend run type-check
pnpm --filter backend run test -- --runInBand <targeted-test>
```

Never run broad refactors or full-repo test sweeps unless explicitly requested.
