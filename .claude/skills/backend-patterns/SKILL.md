---
name: backend-patterns
description: Use when working in apps/backend — new endpoints, controllers, services, models, queues/workers, or integrations. Covers the Router to Controller to Service to Model architecture, Zod validation, Prisma/PostgreSQL data access, Winston logging, BullMQ jobs, and FHIR/IDEXX/Merck integrations.
---

# Backend Patterns — Yosemite Crew

## Description

Use this skill when working on apps/backend. Covers Express.js architecture, service/controller patterns, validation, error handling, and healthcare-specific integrations.

TRIGGER: any task in apps/backend — new endpoints, services, models, or integrations.

---

## Architecture

```
apps/backend/src/
  routers/        ← Express route definitions (thin — just register handlers)
  controllers/    ← Request/response handling, input validation
  services/       ← Business logic (no req/res objects here)
  models/         ← legacy data models; no new files here (use Prisma via packages/database)
  queues/         ← BullMQ job definitions
  workers/        ← BullMQ worker processors
  integrations/   ← External services (IDEXX, Merck, Stripe, Firebase, AWS)
```

**Pattern: Router → Controller → Service → Model**

Controllers call services. Services call models. Never put business logic in controllers or routers.

---

## Validation

Use **Zod** for request validation. Never trust raw `req.body`.

```ts
import { z } from 'zod';

const CreateAppointmentSchema = z.object({
  patientId: z.string().uuid(),
  date: z.string().datetime(),
});

// In controller:
const data = CreateAppointmentSchema.parse(req.body);
```

---

## Database

- **PostgreSQL via Prisma** is the database for all new code; Prisma owns schema + migrations (see `@yosemite-crew/database`).
- **Prisma only for new persistence.** All new models and queries go through Prisma (`packages/database`); do not add new files under `src/models/` — this matches `apps/backend/AGENTS.md`.
- Never access data directly from controllers — always go through services/models.

---

## Authentication

SuperTokens is the auth provider behind the provider-neutral boundary in
`packages/auth` (#1672), initialized by `initSuperTokens` in `app.ts`. Product
code uses the session guards in `src/middlewares/auth.ts` and never imports a
provider SDK (eslint-enforced). Pick the guard by product surface:

- `requireWebAuth` - staff / PIMS web routes.
- `requireMobileAuth` - pet-parent mobile routes.
- `requireAnyAuth` - routes genuinely shared by both.

Never roll custom auth.

### Authorization: derive the tenant from the resource

Authentication only proves who is calling. `withOrgPermissions()` then proves
the caller belongs to the organisation **named by the request** (route param,
`x-org-id`, query, or body). On a route addressed by a resource id that is not
enough on its own - a caller can name an organisation they legitimately belong
to while addressing another tenant's record.

- On an id-addressed route, use the resource-derived middleware so the
  organisation comes from the record: `withAppointmentOrgPermissions`,
  `withInvoiceOrgPermissions`, `withPaymentOrgPermissions`,
  `withPaymentIntentOrgPermissions`, `withTaskOrgPermissions`,
  `withInventoryItemOrgPermissions`, `withEncounterOrgPermissions`,
  `withCaseOrgPermissions`, `withRenderedDocumentOrgPermissions`,
  `withRoomUnitOrgPermissions`, `withRoomUnitGroupOrgPermissions`. Add a new
  one via `withResourceOrgPermissions` rather than hand-rolling a lookup.
- In a controller, scope on `(req as OrgRequest).organisationId` - the value
  the middleware authorized. If the request also carries an organisation, it
  must **agree** with that value; reject a mismatch rather than preferring it.
- Take the organisation as a **required** service argument, never
  `organisationId?`. Prisma drops `undefined` where-fields, so an optional
  scope silently becomes an unfiltered, cross-tenant query. Required turns
  that into a build error.
- `Document` has no organisation column - scope document queries through
  `documentWhereForOrg()` (`src/services/document-scope.ts`), which expresses
  the `patientOrganisation` join and the PMS visibility flag once.
- `requirePermission([a, b])` is **any-of**. That is the intended idiom for an
  `:any`/`:own` pair of the _same_ resource. An array naming two _different_
  resources grants each to holders of the other - require both instead.
- Read the acting user from the verified session (`req.userId`). Do **not** use
  `resolveUserIdFromRequest` for an authorization decision: it falls back to a
  client-supplied `x-user-id` header. It is fine for attribution only.

---

## Background Jobs

BullMQ is the queue system. Jobs go in `queues/`, processors in `workers/`.

```ts
// Never process jobs inline in a request handler
// Always enqueue and let a worker handle async operations
await emailQueue.add('send-reminder', { appointmentId });
```

---

## Healthcare Integrations

- FHIR types from `@yosemite-crew/fhir` — use these, never invent custom health data shapes.
- IDEXX and Merck integrations live in `src/integrations/` — extend there, never inline.

---

## Logging

Use **Winston** for all logging. Never use `console.log` in production code.

```ts
import logger from 'src/utils/logger';
logger.info('Appointment created', { appointmentId });
logger.error('Payment failed', { error, userId });
```

---

## Gotchas

- Do not refactor backend architecture unless explicitly asked — the user's CLAUDE.md is explicit about this.
- Zod `.parse()` throws on invalid input — use `.safeParse()` when you want to handle errors gracefully.
- BullMQ jobs are persisted in Redis — make job processors idempotent.
- All Stripe webhook handlers must verify the signature before processing.
- Firebase Admin SDK is initialized once — never re-initialize it in a handler.
