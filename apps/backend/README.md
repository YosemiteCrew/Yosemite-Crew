# YosemiteCrew Server

This is the backend API server for Yosemite Crew (YC), the open-source veterinary practice management (PIMS) platform. It is an Express.js + TypeScript service that exposes the FHIR (Fast Healthcare Interoperability Resources) endpoints consumed by the web frontend and mobile app. For agent and contributor conventions (architecture layers, validation, logging, background jobs), see [`AGENTS.md`](./AGENTS.md) and [`SKILLS.md`](./SKILLS.md).

## Prerequisites

- Node.js 20+ and `pnpm@8.15.6` (install dependencies from the repo root with `pnpm install`)
- PostgreSQL (the schema lives in `packages/database/prisma/schema.prisma`)
- Redis (required by the BullMQ job queues)
- MongoDB, unless you set `READ_FROM_POSTGRES=true` — the server still connects to Mongo at startup (see Database below)

## Database

### PostgreSQL via Prisma (source of truth)

Prisma is the schema source of truth (`packages/database`). From the repo root:

```bash
pnpm --filter backend run prisma:generate   # generate the Prisma client
pnpm --filter backend run prisma:migrate    # apply migrations in development
```

### Legacy MongoDB (still required at startup)

`main.ts` calls `connectDB()` on boot (`src/config/db.ts`). It skips MongoDB only when `READ_FROM_POSTGRES=true`; otherwise it needs one of:

- `READ_FROM_POSTGRES=true` — skip MongoDB entirely (Postgres-only path)
- `USE_INMEMORY_DB=true` — start an in-memory MongoDB (no local install needed)
- `LOCAL_DEVELOPMENT=true` — connect to `mongodb://localhost:27017/yosemitecrew`
- otherwise — connect to `MONGODB_URI`

With none of these set, startup fails on an empty connection string. Mongo is legacy and being retired — do not add new MongoDB usage.

## Dev server

```bash
pnpm --filter backend run dev
```

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

`Dockerfile` builds the production API image; `Dockerfile.test` builds the image used for test runs. The repo-root `docker-compose.yml` wires supporting services for local development.

## Parent & Companion Linking

- The parent-facing APIs now require Cognito authentication. The `ParentController` and `CompanionController` expect a valid `Authorization` header and will derive the acting parent from the Cognito `sub`.
- Creating a companion automatically links the authenticated parent's profile as the primary parent via the new `ParentCompanion` join model. The linked record stores the role, status, and granular permissions (assign as primary, appointments, documents, etc.) for future co-parent management.
- Additional co-parent flows (invites, role changes) can build on the `ParentCompanionService` to ensure consistent permission handling and enforcement.
- New endpoints:
  - `GET /fhir/v1/parent/:id/companions` lists the authenticated parent's companions.
  - `DELETE /fhir/v1/companion/:id` removes a companion when requested by its primary parent.
  - `DELETE /fhir/v1/parent/:id` deletes a parent profile once all companion links are removed.
