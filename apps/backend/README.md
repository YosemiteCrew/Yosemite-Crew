# YosemiteCrew Server

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
