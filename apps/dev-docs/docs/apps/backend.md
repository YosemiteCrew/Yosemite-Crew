---
id: backend-app
title: Backend App README
slug: /apps/backend
---

(Source: apps/backend/README.md)

# YosemiteCrew Server

## Prerequisites

Build and run the backend from the repo root:

```bash
pnpm run build --filter backend
pnpm run dev --filter backend
```

## Database

### MongoDB

The backend uses MongoDB via Mongoose. Connection setup lives in `apps/backend/src/config/db.ts` and is initialized in `apps/backend/src/main.ts` via `connectDB()`. Behavior is environment-driven:

- `USE_INMEMORY_DB=true` starts an in-memory MongoDB instance (useful for tests/dev).
- `LOCAL_DEVELOPMENT=true` connects to `mongodb://localhost:27017/yosemitecrew`.
- Otherwise it uses `MONGODB_URI`.

### Redis + BullMQ Workers

Background jobs run on BullMQ and use Redis for queue storage. Redis connection is configured in `apps/backend/src/queues/bull.config.ts` and queues/workers are initialized in `apps/backend/src/main.ts` via `initQueues()`.

Redis connection settings:

- `REDIS_HOST` (default `127.0.0.1`)
- `REDIS_PORT` (default `6379`)
- `REDIS_PASSWORD` (optional)

Queues:

- `appointments` (`apps/backend/src/queues/appointment.queue.ts`)
- `task-recurrence` (`apps/backend/src/queues/task.queues.ts`)
- `task-reminder` (`apps/backend/src/queues/task.queues.ts`)

Workers:

- `apps/backend/src/workers/appointment.worker.ts`
- `apps/backend/src/workers/taskRecurrence.worker.ts`
- `apps/backend/src/workers/taskReminder.worker.ts`

## Running tests

- Run tests

```bash
pnpm run test --filter backend
```

- Run tests with coverage report

```bash
pnpm run test --filter backend --coverage
```

## Production build

Build backend from the repo root:

```bash
pnpm run build --filter backend
```

## Animal Health Custom FHIR

We model animal health workflows using FHIR resources plus custom code systems and extensions. The canonical TypeScript types and mapping logic live in `packages/types/src`, and the API-facing DTOs live in `packages/types/src/dto`. The backend should rely on these types and helpers rather than duplicating FHIR shapes.

### Why Custom FHIR For Animal Health

FHIR is built primarily for human healthcare, and several animal health concepts don’t map cleanly to the base spec. We created a custom FHIR layer to:

- Represent companion specific data such as species, breed, neuter status, microchip/passport IDs, and breeding info.
- Capture clinic specific workflows (appointments, room assignments, forms, invoices) with consistent extensions.
- Maintain interoperability by staying close to standard FHIR resources (`Patient`, `Appointment`, `Organization`, etc.) while extending where needed.
- Keep the API contract stable across web, mobile, and integrations by centralizing all mappings in the types package.

### How It Is Built

1. Define domain models and helpers in `packages/types/src`.
1. Map domain models to FHIR resources with `toFHIR*` helpers.
1. Map FHIR resources back into domain models with `fromFHIR*` helpers where supported.
1. Wrap FHIR resources in DTO helpers in `packages/types/src/dto` for request/response validation and conversion.

### Core Mappings (Domain → FHIR)

- Users and profiles map to `Practitioner` in `packages/types/src/user.ts`.
- Organisations map to `Organization` in `packages/types/src/organization.ts`.
- Organisation rooms map to `Location` in `packages/types/src/organisationRoom.ts`.
- Specialities map to `Organization` in `packages/types/src/speciality.ts`.
- Services map to `HealthcareService` in `packages/types/src/service.ts`.
- User-organisation roles map to `PractitionerRole` in `packages/types/src/userOrganization.ts`.
- Pet companions map to `Patient` in `packages/types/src/companion.ts`.
- Pet owners map to `RelatedPerson` in `packages/types/src/parent.ts`.
- Appointments map to `Appointment` in `packages/types/src/appointment.ts`.
- Invoices map to `Invoice` in `packages/types/src/invoice.ts`.
- Forms map to `Questionnaire` in `packages/types/src/form.ts`.
- Form submissions map to `QuestionnaireResponse` in `packages/types/src/form.ts`.
- Addresses map to `Address` in `packages/types/src/address.model.ts`.

### Custom Extensions and Code Systems

We extend standard FHIR resources with animal-health specific fields using extensions and naming systems, for example:

- Companion details like species, neuter status, blood group, and breeding info are stored on `Patient` via extensions in `packages/types/src/companion.ts`.
- Organisation certifications, verification flags, and IDs are stored as `Organization` extensions in `packages/types/src/organization.ts`.
- Appointment metadata like emergency flags, attachments, and form IDs are stored as `Appointment` extensions in `packages/types/src/appointment.ts`.
- Payment and Stripe metadata are stored as `Invoice` extensions in `packages/types/src/invoice.ts`.
- Form schema and submission metadata are stored as `Questionnaire` and `QuestionnaireResponse` extensions in `packages/types/src/form.ts`.

These extensions are defined with explicit URLs (under `https://yosemitecrew.com/fhir/...`) inside the mapping files so they remain centralized and consistent.

### DTO Layer (API Contracts)

Each DTO file in `packages/types/src/dto` provides:

- A request/response type alias that is the FHIR resource shape.
- A `from*RequestDTO` function that validates the FHIR `resourceType` and converts to the domain model.
- A `to*ResponseDTO` function that converts the domain model back to the FHIR resource.

Example DTOs include:

- `packages/types/src/dto/appointment.dto.ts` for `Appointment`.
- `packages/types/src/dto/companion.dto.ts` for `Patient`.
- `packages/types/src/dto/organization.dto.ts` for `Organization`.
- `packages/types/src/dto/form.dto.ts` for `Questionnaire` and `QuestionnaireResponse`.

### Adding Or Extending A Resource

1. Add or update the domain type in `packages/types/src`.
1. Implement `toFHIR*` and `fromFHIR*` in the same file, including any extension URLs.
1. Export the types and helpers from `packages/types/src/index.ts`.
1. Add a DTO wrapper in `packages/types/src/dto` to validate `resourceType` and expose request/response helpers.
1. Use the DTO helpers in backend controllers and services instead of hand-rolling FHIR shapes.

## API Docs

Backend API documentation is split by router under the dev docs.

- See `apps/dev-docs/docs/apps/backend/index.md` for the router index and links to each API section.
