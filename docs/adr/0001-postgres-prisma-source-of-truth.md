# 0001. Postgres + Prisma as the target source of truth

**Status:** Accepted (migration in progress)
**Date:** 2026-06-07

## Context

The backend originally persisted everything in MongoDB via Mongoose. As the product grew into multi-tenant clinic data with financial records (invoices, payments) and relational integrity requirements (org scoping, RBAC joins across appointments/invoices/inventory), document-model MongoDB became a poor fit: cross-entity consistency and tenant-scoped queries were increasingly enforced in application code instead of the database.

A full big-bang cutover from MongoDB to Postgres was rejected as too risky for a live product with ~50+ Mongoose models across the backend — a single migration window could not be safely validated end-to-end.

## Decision

Adopt PostgreSQL via Prisma Migrate (`packages/database/prisma/schema.prisma`) as the target single source of truth, migrated incrementally behind a runtime flag rather than a single cutover:

- `apps/backend/src/config/db.ts` only opens a MongoDB connection when `READ_FROM_POSTGRES` is **not** `"true"`.
- Individual services (e.g. `audit-trail.service.ts`, `inventory.service.ts`) check `READ_FROM_POSTGRES` to decide which store to read from, and a `shouldDualWrite` flag to optionally write to both stores during the transition window for a given entity.
- Each entity migrates independently: dual-write until confidence is established, then flip reads to Postgres, then remove the Mongo write path and the Mongoose model for that entity.

## Consequences

**Good:**
- Each entity can be migrated and rolled back independently — a bad migration for one model doesn't block or risk the others.
- Relational integrity (foreign keys, joins) for tenant-scoped and financial data moves into the database instead of application-level enforcement.
- Zero-downtime migration path; no maintenance window required.

**Bad / accepted trade-offs:**
- Two datastores are live simultaneously for an extended period. Until every entity's Mongo write path is removed, the codebase carries the cognitive and operational cost of both.
- Dual-write is not transactional across the two stores — a partial failure (write succeeds in one store, fails in the other) is possible during the dual-write window for a given entity.
- `READ_FROM_POSTGRES` is a single global flag today, not per-entity; per-entity migration state currently lives in each service's own conditional logic rather than one central registry.

## Definition of done

MongoDB decommissioned: `READ_FROM_POSTGRES` flag removed (Postgres is unconditional), all Mongoose models and the Mongo connection code deleted from `apps/backend`, and `mongoose` removed from `apps/backend/package.json`.

## Alternatives considered

- **Big-bang cutover**: rejected — too risky to validate ~50 models' worth of read/write paths in one release.
- **Keep MongoDB, add Postgres only for new financial entities**: rejected — would permanently split the data model along an arbitrary line instead of converging on one store, and cross-store joins (e.g. invoice ↔ legacy appointment data) would become a long-term tax rather than a migration cost paid once.
