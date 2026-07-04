# YosemiteCrew Server

This is the backend API server for Yosemite Crew (YC), the open-source veterinary practice management (PIMS) platform. It is an Express.js + TypeScript service that exposes the FHIR (Fast Healthcare Interoperability Resources) endpoints consumed by the web frontend and mobile app. For agent and contributor conventions (architecture layers, validation, logging, background jobs), see [`AGENTS.md`](./AGENTS.md) and [`SKILLS.md`](./SKILLS.md).

## Prerequisites

## Database

## Dev server

## Running tests

## Production build

## Docker

## Parent & Companion Linking

- The parent-facing APIs now require Cognito authentication. The `ParentController` and `CompanionController` expect a valid `Authorization` header and will derive the acting parent from the Cognito `sub`.
- Creating a companion automatically links the authenticated parent's profile as the primary parent via the new `ParentCompanion` join model. The linked record stores the role, status, and granular permissions (assign as primary, appointments, documents, etc.) for future co-parent management.
- Additional co-parent flows (invites, role changes) can build on the `ParentCompanionService` to ensure consistent permission handling and enforcement.
- New endpoints:
  - `GET /fhir/v1/parent/:id/companions` lists the authenticated parent's companions.
  - `DELETE /fhir/v1/companion/:id` removes a companion when requested by its primary parent.
  - `DELETE /fhir/v1/parent/:id` deletes a parent profile once all companion links are removed.
