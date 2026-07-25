# YosemiteCrew Server

This is the backend API server for Yosemite Crew (YC), the open-source veterinary practice management (PIMS) platform. It is an Express.js + TypeScript service that exposes the FHIR (Fast Healthcare Interoperability Resources) endpoints consumed by the web frontend and mobile app. For agent and contributor conventions (architecture layers, validation, logging, background jobs), see [`AGENTS.md`](./AGENTS.md) and [`SKILLS.md`](./SKILLS.md).

## Prerequisites

- Node.js 20+ and `pnpm@8.15.6` (install dependencies from the repo root with `pnpm install`)
- PostgreSQL (the schema lives in `packages/database/prisma/schema.prisma`)
- Redis (required by the BullMQ job queues)

## Database

PostgreSQL via Prisma is the only datastore; Prisma is the schema source of truth (`packages/database`). From the repo root:

```bash
pnpm --filter backend run prisma:generate   # generate the Prisma client
pnpm --filter backend run prisma:migrate    # apply migrations in development
```

All persistence goes through Prisma.

## Dev server

```bash
pnpm --filter backend run dev
```

`LOCAL_DEVELOPMENT=true` switches on local-only behaviour: it opens CORS to `localhost:3000` (`src/app.ts`) and mounts the local-only MFA debug endpoint `POST /v1/auth/mfa/totp/debug/create-device`, which creates a TOTP device without the full enrolment flow. Both are keyed on this flag rather than on `NODE_ENV`, so a deployed tier running `NODE_ENV=development` never gets them. Set it only for a local run.

## Running tests

```bash
pnpm --filter backend run test -- --testPathPattern="<pattern>"   # targeted (preferred)
pnpm --filter backend run test:coverage                           # with coverage
```

## Production build

```bash
pnpm --filter backend run build
pnpm --filter backend run start
```

## Docker

`Dockerfile` builds the production API image; `Dockerfile.test` builds the image used for test runs.

The repo-root `docker-compose.yml` is stale — it builds only `website` and `api` from `apps/website/Dockerfile` and `apps/api/Dockerfile`, neither of which exists, and it provisions no database or Redis. Do not use it to bring up local dependencies; provision PostgreSQL and Redis yourself.

## Parent & Companion Linking

- The parent-facing APIs require the mobile SuperTokens session (`requireMobileAuth`). The `ParentController` and `CompanionController` expect a valid session and derive the acting parent from the verified session user id.
- Creating a companion automatically links the authenticated parent's profile as the primary parent via the new `ParentCompanion` join model. The linked record stores the role, status, and granular permissions (assign as primary, appointments, documents, etc.) for future co-parent management.
- Additional co-parent flows (invites, role changes) can build on the `ParentCompanionService` to ensure consistent permission handling and enforcement.
- New endpoints:
  - `GET /fhir/v1/parent/:id/companions` lists the authenticated parent's companions.
  - `DELETE /fhir/v1/companion/:id` removes a companion when requested by its primary parent.
  - `DELETE /fhir/v1/parent/:id` deletes a parent profile once all companion links are removed.
