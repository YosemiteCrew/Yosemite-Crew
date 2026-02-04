---
id: backend-app
title: Backend App README
slug: /apps/backend
---

(Source: apps/backend/README.md)

# YosemiteCrew Server

## Prerequisites

## Database

## Dev server

## Running tests

## Production build

## Docker

## Animal Health Custom FHIR

We model animal health workflows using FHIR resources plus custom code systems and extensions. The canonical TypeScript types and mapping logic live in `packages/types/src`, and the API-facing DTOs live in `packages/types/src/dto`. The backend should rely on these types and helpers rather than duplicating FHIR shapes.

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
