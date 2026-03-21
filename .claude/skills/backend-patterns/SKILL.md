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
  models/         ← Mongoose schemas + Prisma models
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

- **Mongoose** for document operations (primary).
- **Prisma** for migrations and schema management.
- Never write raw MongoDB queries in controllers — always through models/services.

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

- FHIR types from `@yosemite-crew/fhirtypes` — use these, never invent custom health data shapes.
- IDEXX and Merck integrations live in `src/integrations/` — extend there, never inline.

---

## Logging

Use **Winston** for all logging. Never use `console.log` in production code.

```ts
import logger from '@/lib/logger';
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
