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
`packages/auth` (#1672). Product code uses `requireWebAuth`/`requireMobileAuth`
from `src/middlewares/auth.ts` and never imports a provider SDK
(eslint-enforced).

Two auth stacks coexist:

- **Web/PIMS session auth: SuperTokens** via `@yosemite-crew/auth` -
  `requireAuth()` middleware + `getSessionUserId()`, initialized with
  `initSuperTokens` in `app.ts`. Use this for all new web endpoints.
- **Legacy mobile/FHIR JWT** (`authorizeCognito` / `authorizeCognitoMobile`
  in `src/middlewares/auth.ts`) remains on existing mobile/FHIR routes only -
  do not use it for new web endpoints. It accepts **both** AWS Cognito tokens
  (verified with `jsonwebtoken` + `jwks-rsa`) and Firebase tokens (issuer
  `securetoken.google.com`, social login, verified via Firebase Admin). Never
  remove the Firebase path - it would reject existing social-login users.

Never roll custom auth.

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
