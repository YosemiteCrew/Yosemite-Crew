# Yosemite Crew — Project Architecture Baseline (March 31, 2026)

Use this when drafting architecture decisions, technical narratives, or product-engineering updates.

## Monorepo Shape and Scale

- Workspace model: `pnpm` + `turbo`.
- Core apps: `apps/frontend` (staff-facing web PIMS), `apps/backend` (Express API), `apps/mobileAppYC` (pet-parent React Native app), `apps/dev-docs`.
- Shared packages: `@yosemite-crew/types`, `@yosemite-crew/fhirtypes`, `@yosemite-crew/fhir`, `@yosemite-crew/design-tokens`.
- Approx source files: frontend ~1132 TS/JS, mobile ~501, backend ~254, packages ~115.
- Test footprint: frontend ~482 test files, mobile ~371 test files (targeted tests required).

## Product Architecture

- Dual-surface platform: Web PIMS (clinic ops) + Mobile app (pet parents/co-parents).
- Backend routes: `/fhir/v1/*` (FHIR-oriented) and `/v1/*` (app/mobile workflows).
- Shared domain contracts in `@yosemite-crew/types` consumed across all apps.

## Domain Model

- FHIR as boundary language — internal TS domain objects mapped to/from FHIR DTOs at edges.
- Appointment flow modeled in shared types, converted to FHIR at boundaries.

## Permissions & Access Model

- Web: granular RBAC strings (`appointments:*`, `billing:*`, `forms:*`, `integrations:*`).
- Mobile: companion-scoped co-parent permissions with primary-parent override behavior.
- Backend enforces authorization; clients derive deterministic UI affordances from permission payloads.

## Workflow Chains

- Scheduling/clinical: appointment services + availability + form attachments + check-in/status progression.
- Financial: invoice + Stripe services tied to appointments and payment state.
- Follow-through: tasks, reminders/recurrence, notifications, documents, audit trail.
- Integrations: labs (IDEXX), Merck, communication/chat, device token + notification infra.

## Platform Directions

**Frontend:** Moving toward stronger design system contract (`src/app/ui`) with Storybook. The shared semantic token package (`packages/design-tokens`) is dead - never built, zero runtime consumers, stale palette; the live tokens are `apps/frontend/src/app/globals.css`.

**Mobile:** Feature-first module layout with Redux Toolkit + Redux Persist. Its `semanticTokens.ts` is a hand-maintained approximation of the web vocabulary, unused by application code and drifting - do not treat the two as aligned.

**Backend:** Express app with rate limiting, CORS, upload handling, sanitization, centralized route registration. Service layer domain-partitioned. Persistence is consolidated onto Prisma/Postgres as the single source of truth (the MongoDB migration is complete and the old cluster is gone).

## Engineering Narrative Themes

1. Operational truth over UI illusion (state machines, permission-derived UX, deterministic flows).
2. Boundary-first interoperability (FHIR at edges, typed domain core).
3. Multi-actor authorization as product architecture (staff RBAC + companion-scoped co-parent controls).
4. Cross-surface consistency through shared contracts/tokens, not brittle code sharing.
5. End-to-end workflow ownership (schedule → care execution → billing → history/audit).
