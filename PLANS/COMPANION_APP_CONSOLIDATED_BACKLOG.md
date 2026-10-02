---
title: 'Consolidated Backlog: Unimplemented Companion-App Health, Education, and AI-Testing Modules'
tags: [enhancement, app, companion-app]
status: active
created: 2026-10-01
---

# Consolidated Backlog: Unimplemented Companion-App Health, Education, and AI-Testing Modules

## Summary

Consolidates the remaining unimplemented scope from eight companion-app feature requests (#628, #633, #634, #636, #640, #738, #894, #1226) into a single tracking issue. Each of those issues was verified against `dev` and closed in favor of this one. Nothing in them shipped in full; three shipped in part, and the partial coverage is recorded below so the remaining work is not re-specified from scratch.

## Current State Analysis (as of 2026-10-01)

### Already Implemented (Reusable Infrastructure)

| Area                    | Exists Today                                                                                            | Location                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Tasks**               | Vaccination, exercise (`take-exercise`), chronic conditions (diabetes) task types with reminder options | `apps/mobileAppYC/src/features/tasks/`                                                 |
| **Documents**           | Categories with file counts, vaccination category, PDF preview                                          | `apps/mobileAppYC/src/features/documents/`                                             |
| **Observational Tools** | FGS (cats), CAPS (dogs), EGS (horses) with providers, vet selection, evaluation fees, send-to-vet flow  | `apps/mobileAppYC/src/features/observationalTools/`                                    |
| **Knowledge**           | Merck manual search for web and mobile (rate-limited, keyed on verified caller)                         | `apps/mobileAppYC/src/features/merck/`, `apps/backend/src/routers/knowledge.router.ts` |
| **Ratings**             | Organisation-level rating (post once, gated by `is-rated`), Practitioner feedback for appointments      | `apps/backend/src/routers/organisationRating.router.ts`                                |
| **Chat**                | Full chat feature                                                                                       | `apps/mobileAppYC/src/features/chat/`                                                  |

### Workstream Status Summary

| #   | Workstream                           | Status              | Notes                                                                                                         |
| --- | ------------------------------------ | ------------------- | ------------------------------------------------------------------------------------------------------------- |
| 1   | Wellness Summary Screen              | **Not Implemented** | No health-metrics module exists                                                                               |
| 2   | Exercise Plan Management             | **Not Implemented** | Only `take-exercise` hygiene task exists                                                                      |
| 3   | Knowledge Library                    | **Partial**         | Merck search exists; missing article pages, topic filtering, social engagement, content management            |
| 4   | Diabetes Management                  | **Not Implemented** | `diabetes` is only a `ChronicConditionType` string; OT only has pain scales                                   |
| 5   | Educational Blog ("Paws & Insights") | **Not Implemented** | No blog surface                                                                                               |
| 6   | Vaccination Management               | **Partial**         | Task type + document category exist; no record entity in Prisma                                               |
| 7.  | Medical Records Feed & Vet Feedback  | **Partial**         | Documents, star-plus-text review, chat exist; missing feed, vet profiles, vet-level feedback, edit capability |
| 8.  | AI Browsers Interaction Testing      | **Not Implemented** | No AI integration surface; MCP server tracked separately (#1588, PR #1788)                                    |

---

## Workstream Implementation Plans

### Workstream 1: Wellness Summary Screen

**Scope**: Pet profile header, metric tracking (weight, activity, food, water, urination), color-coded status indicators, "Add Metrics" entry, FHIR-compliant storage.

**Dependencies**: None (new module)

**Reusable Components**: None new - builds on existing pet profile infrastructure

**New Components Needed**:

- `apps/mobileAppYC/src/features/healthMetrics/` - new feature slice
  - Metric logging screens (weight, activity, food, water, urination)
  - Color-coded status indicators (green/orange/red)
  - FHIR-compliant observation storage
  - Pet profile header with circular avatar, multi-pet support

**Shared with Workstream 4**: Metric logging infrastructure (water intake, food intake, activity, urination)

**Backend Needs**: New FHIR Observation endpoints for metric storage

---

### Workstream 2: Exercise Plan Management

**Scope**: Vet-authored plans with condition-specific templates, customization by breed/age/weight/condition, plan cards with duration/frequency/categorization/review milestones, progress tracking (percent complete, exercise logging with sets/duration/intensity, "done for today" with streaks), reminders (30min to 3 days prior), "Know More" tutorials with video demos.

**Dependencies**: None (new module, but extends existing `take-exercise` hygiene task)

**Reusable Components**:

- Existing `take-exercise` hygiene task type in `tasks/types.ts`
- Task reminder infrastructure
- Observational tool provider/vet selection flow

**New Components Needed**:

- `apps/mobileAppYC/src/features/exercisePlans/` - new feature slice
  - Plan creation/editing screens (vet-facing)
  - Plan detail view with cards (duration, frequency, categorization, milestones)
  - Progress tracking screens (percent complete, exercise logging with sets/duration/intensity)
  - Streak tracking ("done for today")
  - Reminder scheduling (30min to 3 days prior)
  - "Know More" tutorial viewer with video support

**Backend Needs**:

- Exercise plan CRUD endpoints
- Plan template management (condition-specific)
- Progress tracking storage
- Video tutorial content management

---

### Workstream 3: Knowledge Library

**Scope**: Article detail pages rendering full medical content (not just search hits), topic-based filtering (Arthritis, Back Pain, NSAIDs, Joint Health, etc.), social engagement (helpful ratings, share), content management surface for veterinary professionals, FHIR-compliant content structuring.

**Current State**: Merck search exists (`/merck/manuals/search`); returns search hits with title/summary/URL.

**Dependencies**: Workstream 5 (Educational Blog) shares article rendering and topic filtering - **must share one content model**

**Reusable Components**:

- Existing Merck search API (`/merck/manuals/search`)
- Article entry structure (`MerckEntry` in `merck/types.ts`)

**New Components Needed**:

- Article detail page rendering full content (not just search hits)
- Topic-based filtering UI (Arthritis, Back Pain, NSAIDs, Joint Health, etc.)
- Social engagement: helpful ratings, share buttons
- Content management surface for veterinary professionals (CMS-like)
- FHIR-compliant content structuring (shared with Workstream 5)

**Backend Needs**:

- Article content retrieval endpoints (full content, not just search hits)
- Topic/category taxonomy management
- Rating/voting system for articles
- Content management API for veterinary professionals

**Shared with Workstream 5**: Single content model for articles (topic filtering, rendering, social engagement)

---

### Workstream 4: Diabetes Management

**Scope**: Blood glucose logging with High/Optimal/Low trend charts, timestamps, optional photo; empty state/onboarding/data export; multi-parameter tracking (water, food, activity, urination - shared with Workstream 1); optional medical entries (urine glucose, ketones, weight, body-condition photo); alerting on dangerous glucose levels; diabetes instrument in observational tool flow (vet selection, fee breakdown, payment, "send to vet").

**Dependencies**: Workstream 1 (shared metric logging), Workstream 3 (observational tool flow integration)

**Reusable Components**:

- Existing `diabetes` ChronicConditionType in `tasks/types.ts`
- Observational tool flow (`observationalTools/`) - vet selection, fee breakdown, payment, "send to vet"
- Task reminder infrastructure

**New Components Needed**:

- `apps/mobileAppYC/src/features/diabetes/` - new feature slice
  - Blood glucose logging screen with trend charts (High/Optimal/Low)
  - Multi-parameter tracking (water, food, activity, urination - **shared with Workstream 1**)
  - Optional medical entries (urine glucose, ketones, weight, body-condition photo)
  - Dangerous glucose level alerting
  - Data export for consultations
  - Diabetes-specific observational tool instrument (plugged into existing OT flow)
  - Empty state and onboarding

**Shared with Workstream 1**: Metric logging infrastructure (water intake, food intake, activity, urination)

**Backend Needs**:

- Blood glucose observation endpoints (FHIR-compliant)
- Glucose threshold alerting
- Diabetes OT instrument definition
- Data export endpoint

---

### Workstream 5: Educational Blog ("Paws & Insights")

**Scope**: Featured article showcase, topic filtering (13 categories), article cards/detail pages with author credentials/date/read time, social sharing, related-articles recommendations.

**Dependencies**: **Must share content model with Workstream 3** (Knowledge Library) - same article rendering, topic filtering, social engagement.

**Current State**: Not implemented

**Reusable Components**:

- Shared content model with Workstream 3
- Topic filtering infrastructure (from Workstream 3)

**New Components Needed**:

- `apps/mobileAppYC/src/features/blog/` - new feature slice (or extend Workstream 3)
  - Featured article showcase screen
  - Topic filtering across 13 categories
  - Article cards with author credentials, publication date, read time
  - Article detail pages
  - Social sharing
  - Related-articles recommendations

**Shared with Workstream 3**: Single content model for articles (topic filtering, rendering, social engagement, related articles)

---

### Workstream 6: Vaccination Management

**Scope**: Vaccination record with manufacturer, vaccine name, batch number, expiry date, vaccination date, clinic name, next due date; document upload for vaccine bottle/label (DOC, PDF, PNG, JPEG, max 20MB); status dashboard with color-coded indicators (up to date, upcoming, overdue, pending), recent-vaccinations timeline, history, empty states; edit with pre-populated data, delete with confirmation; vaccination scheduling from appointment booking, direct record sharing with clinic.

**Current State**:

- `VaccinationTaskDetails` exists with `vaccineName` only
- `Vaccination` document category exists with file counts
- No vaccination record entity in Prisma schema

**Dependencies**: **Depends on #1648 / PR #1675 (digital pet passport) landing first** - to avoid competing vaccination models

**Reusable Components**:

- Existing `VaccinationTaskDetails` in `tasks/types.ts`
- `Vaccination` document category in `documents/`
- Document upload infrastructure (DOC, PDF, PNG, JPEG, max 20MB)
- Appointment booking flow (for vaccination scheduling)

**New Components Needed**:

- Prisma model for vaccination records (after #1648 lands)
- `apps/mobileAppYC/src/features/vaccinationRecords/` - new feature slice
  - Vaccination record CRUD screens
  - Document upload for vaccine bottle/label
  - Status dashboard (color-coded: up to date, upcoming, overdue, pending)
  - Timeline/history view
  - Edit/delete with confirmation
  - Appointment booking integration for scheduling
  - Direct record sharing with clinic

**Backend Needs** (after #1648):

- Vaccination record Prisma model
- CRUD endpoints
- Document upload integration
- Appointment-vaccination linking
- Clinic sharing endpoints

**Sequencing**: Must wait for #1648 / PR #1675 to land first

---

### Workstream 7: Medical Records Feed & Veterinarian Feedback

**Scope**: Chronological medical-records feed with unread/all tabs (unread state exists for notifications only); veterinarian profile cards with practice info in feed; feedback at veterinarian level (not just organisation); feedback display and editing after submission (current API is post-once, gated by `is-rated`, no update path).

**Current State**:

- Document categorisation with file counts and PDF preview
- Star-plus-text review on `ReviewScreen`
- `POST /v1/organisation-rating/:organisationId` and `GET /:organisationId/is-rated`
- Chat feature for vet communication

**Dependencies**: None

**Reusable Components**:

- Document categorisation and PDF preview
- Star-plus-text review component
- Organisation rating API
- Chat feature
- Notification unread state (for unread tab concept)

**New Components Needed**:

- Chronological medical-records feed screen (unread/all tabs)
- Veterinarian profile cards with practice info in feed
- Veterinarian-level feedback (extends organisation rating to practitioner level)
- Feedback display and editing after submission (add UPDATE path to rating API)
- Unread state for records (extend notification unread logic)

**Backend Needs**:

- Chronological records feed endpoint
- Veterinarian profile data in feed
- Veterinarian-level rating API (POST, GET, PUT)
- Update path for feedback submission

---

### Workstream 8: AI Browsers Interaction Testing Module

**Scope**: Sandbox for running PMS-specific queries against Atlas (OpenAI) and Comet (Perplexity); controlled comparison of output accuracy and performance across assistants.

**Current State**: Not implemented. No AI integration surface on `dev`. MCP server work tracked separately (#1588, PR #1788).

**Dependencies**: MCP server work (#1588, PR #1788)

**Reusable Components**:

- MCP server infrastructure (when ready)

**New Components Needed**:

- `apps/mobileAppYC/src/features/aiTesting/` - new feature slice (or web-only)
  - Sandbox for running PMS-specific queries against Atlas (OpenAI) and Comet (Perplexity)
  - Controlled comparison UI for output accuracy and performance
  - Reference implementation per https://developers.openai.com/apps-sdk/

**Backend Needs**:

- MCP server completion
- Sandbox execution environment
- Query logging and comparison metrics

**Note**: Needs privacy and data-handling review before real data is used (sends PMS data to third-party AI assistants)

---

## Cross-Workstream Dependencies

```
Workstream 1 (Wellness) ──┐
                          ├──► Shared metric logging infrastructure
Workstream 4 (Diabetes) ──┘

Workstream 3 (Knowledge) ──┐
                           ├──► Shared article content model
Workstream 5 (Blog)    ────┘

Workstream 6 (Vaccination) ──► Depends on #1648 / PR #1675 (pet passport)

Workstream 4 (Diabetes) ──► Workstream 1 (shared metrics)
Workstream 4 (Diabetes) ──► Workstream 3 (OT flow integration)

Workstream 8 (AI Testing) ──► Depends on #1588 / PR #1788 (MCP server)
```

---

## Implementation Priority Order

Based on dependencies and user impact:

1. **Workstream 1** (Wellness) - No dependencies, foundational for Workstream 4
2. **Workstream 3** (Knowledge Library) - Foundational for Workstream 5
3. **Workstream 5** (Blog) - Depends on Workstream 3
4. **Workstream 4** (Diabetes) - Depends on Workstream 1, 3
5. **Workstream 2** (Exercise Plans) - Independent, high user value
6. **Workstream 7** (Medical Records Feed) - Independent, extends existing features
7. **Workstream 6** (Vaccination Records) - Wait for #1648 / PR #1675
8. **Workstream 8** (AI Testing) - Wait for #1588 / PR #1788

---

## Acceptance Criteria Checklist

- [ ] Each of the eight workstreams is either delivered, or explicitly deferred with a recorded reason
- [ ] Metric logging is implemented once and shared by the wellness summary and diabetes workstreams
- [ ] Article content is modelled once and shared by the knowledge library and blog workstreams
- [ ] Vaccination records do not introduce a model that conflicts with the pet passport work in #1648 / PR #1675
- [ ] Veterinarian-level feedback supports editing after submission

## Test Plan Requirements

- [ ] Unit tests for any new reducers, services, and validation
- [ ] Component tests for new screens including empty, loading, and error states
- [ ] Integration tests for new backend routes covering auth and permission negative cases
- [ ] Coverage on the touched files meets the Sonar new-code gate

---

## Next Steps

1. **Create sub-issues** for each workstream that can be independently picked up
2. **Prioritize Workstream 1** (Wellness) as it unblocks Workstream 4
3. **Prioritize Workstream 3** (Knowledge) as it unblocks Workstream 5
4. **Wait on Workstream 6** until #1648/PR #1675 lands
5. **Wait on Workstream 8** until #1588/PR #1788 lands

---

## Dependencies & Risks

| Workstream      | Dependency           | Risk                                                    |
| --------------- | -------------------- | ------------------------------------------------------- |
| 6 (Vaccination) | #1648 / PR #1675     | Competing vaccination models if not sequenced           |
| 1, 3, 4 (FHIR)  | FHIR modelling       | Requirements should be settled once, up front           |
| 8 (AI Testing)  | #1588 / PR #1788     | Sends PMS data to third-party AI - needs privacy review |
| 3 & 5 (Content) | Shared content model | Must be designed once, not twice                        |

---

## Sub-Issues to Create

When a workstream is ready to be picked up, create a focused implementation issue:

| Workstream | Sub-Issue Title                                                      | Dependencies     |
| ---------- | -------------------------------------------------------------------- | ---------------- |
| 1          | `feat(mobile): wellness summary screen with metric tracking`         | None             |
| 2          | `feat(mobile): exercise plan management with vet templates`          | None             |
| 3          | `feat(mobile): knowledge library article pages with topic filtering` | None             |
| 4          | `feat(mobile): diabetes management with glucose tracking`            | Workstream 1     |
| 5          | `feat(mobile): educational blog "Paws & Insights"`                   | Workstream 3     |
| 6          | `feat(mobile): vaccination record management`                        | #1648 / PR #1675 |
| 7          | `feat(mobile): medical records feed with vet-level feedback`         | None             |
| 8          | `feat(mobile): AI browser interaction testing sandbox`               | #1588 / PR #1788 |

---

## Notes

- This document consolidates the analysis from the original eight issues
- Partial implementations are noted to avoid re-specifying shipped work
- Cross-workstream sharing (metrics, content) is explicitly called out
- Dependencies are clearly mapped to enable parallel work where possible
- Each workstream should be split into a focused implementation issue only when actually picked up
- FHIR modelling requirements (Workstreams 1, 3, 4) should be settled once upfront
- Workstream 8 requires privacy/data-handling review before real data is used
