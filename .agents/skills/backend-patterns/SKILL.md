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
  models/         ← Prisma models (PostgreSQL); legacy Mongoose only, no new usage
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
- **No new Mongoose/MongoDB.** Legacy Mongoose models may still exist, but do not add new models or queries — this matches `apps/backend/AGENTS.md`.
- Never access data directly from controllers — always go through services/models.

---

## Authentication

AWS Cognito is the auth provider. Use `jsonwebtoken` + `jwks-rsa` for token verification. Never roll custom auth.

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

- Do not refactor backend architecture unless explicitly asked — the user's AGENTS.md is explicit about this.
- Zod `.parse()` throws on invalid input — use `.safeParse()` when you want to handle errors gracefully.
- BullMQ jobs are persisted in Redis — make job processors idempotent.
- All Stripe webhook handlers must verify the signature before processing.
- Firebase Admin SDK is initialized once — never re-initialize it in a handler.
