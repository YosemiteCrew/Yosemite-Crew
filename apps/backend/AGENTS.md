# Backend — Agent Rules

Inherits all root `AGENTS.md` rules. This file adds backend-specific rules.

**Stack:** Express.js 4, TypeScript, MongoDB/Mongoose, Prisma, BullMQ, Zod, Winston.

> **Important:** Do not refactor backend architecture unless explicitly asked.

---

## Architecture Pattern

```
Router → Controller → Service → Model
```

- Routers: only route registration.
- Controllers: input validation + response shaping. No business logic.
- Services: all business logic. Never import `req`/`res` here.
- Models: Mongoose schemas. Prisma for migrations.

---

## Validation

All `req.body` inputs must be validated with **Zod** before use:

```ts
const Schema = z.object({ id: z.string().uuid() });
const data = Schema.parse(req.body); // throws on invalid
// or:
const result = Schema.safeParse(req.body); // handle errors gracefully
```

---

## Logging

Use **Winston** only. No `console.log` in production code.

```ts
import logger from "@/lib/logger";
logger.info("message", { context });
logger.error("message", { error });
```

---

## Background Jobs

Use **BullMQ**. Never process async work inline in a request handler.

```ts
await emailQueue.add("send-reminder", { appointmentId });
// Worker in src/workers/ processes it asynchronously
```

Make workers idempotent — jobs may be retried.

---

## Healthcare Data

- Use FHIR types from `@yosemite-crew/fhirtypes` — never invent custom health data shapes.
- IDEXX and Merck integrations: extend `src/integrations/`, never inline in controllers.

---

## Auth

AWS Cognito + `jsonwebtoken` + `jwks-rsa`. Never roll custom auth flows.

---

## What NOT to Do

- No raw MongoDB queries outside the model/service layer.
- No business logic in controllers or routers.
- No `console.log` — use Winston.
- No synchronous processing of work that should be queued.
- Never re-initialize Firebase Admin SDK in a handler — it's a singleton.
- Always verify Stripe webhook signatures before processing.
