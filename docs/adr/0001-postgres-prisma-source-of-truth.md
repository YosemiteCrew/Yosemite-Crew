# 0001. Postgres + Prisma as the target source of truth

**Status:** Accepted (migration complete - exit criteria met by #1819, 2026-07-18)
**Date:** 2026-06-07

## Context

The backend originally persisted everything in MongoDB via Mongoose. As the product grew into multi-tenant clinic data with financial records (invoices, payments) and relational integrity requirements (org scoping, RBAC joins across appointments/invoices/inventory), document-model MongoDB became a poor fit: cross-entity consistency and tenant-scoped queries were increasingly enforced in application code instead of the database.

A full big-bang cutover from MongoDB to Postgres was rejected as too risky for a live product with ~50+ Mongoose models across the backend — a single migration window could not be safely validated end-to-end.

## Decision

Adopt PostgreSQL via Prisma Migrate (`packages/database/prisma/schema.prisma`) as the target single source of truth, migrated incrementally behind a runtime flag rather than a single cutover:

- During the transition, `apps/backend/src/config/db.ts` only opened a MongoDB connection when `READ_FROM_POSTGRES` was **not** `"true"`. The file (and the Mongo connection) was deleted in #1819 once Postgres became unconditional.
- Individual services (e.g. `audit-trail.service.ts`, `inventory.service.ts`) checked `READ_FROM_POSTGRES` to decide which store to read from, and a `shouldDualWrite` flag to optionally write to both stores during the transition window for a given entity.
- Each entity migrated independently: dual-write until confidence was established, then reads flipped to Postgres, then the Mongo write path and the Mongoose model for that entity were removed.

## Consequences

**Good:**

- Each entity can be migrated and rolled back independently — a bad migration for one model doesn't block or risk the others.
- Relational integrity (foreign keys, joins) for tenant-scoped and financial data moves into the database instead of application-level enforcement.
- Zero-downtime migration path; no maintenance window required.

**Bad / accepted trade-offs:**

- Two datastores were live simultaneously for an extended period. Until every entity's Mongo write path was removed (completed in #1819), the codebase carried the cognitive and operational cost of both.
- Dual-write was not transactional across the two stores — a partial failure (write succeeds in one store, fails in the other) was possible during the dual-write window for a given entity.
- `READ_FROM_POSTGRES` was a single global flag, not per-entity; per-entity migration state lived in each service's own conditional logic rather than one central registry.

## Definition of done

MongoDB decommissioned: `READ_FROM_POSTGRES` flag removed (Postgres is unconditional), all Mongoose models and the Mongo connection code deleted from `apps/backend`, and `mongoose` removed from `apps/backend/package.json`. All criteria were met by PR #1819 (merged 2026-07-18).

## Alternatives considered

- **Big-bang cutover**: rejected — too risky to validate ~50 models' worth of read/write paths in one release.
- **Keep MongoDB, add Postgres only for new financial entities**: rejected — would permanently split the data model along an arbitrary line instead of converging on one store, and cross-store joins (e.g. invoice ↔ legacy appointment data) would become a long-term tax rather than a migration cost paid once.
