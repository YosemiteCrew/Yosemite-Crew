# Yosemite Crew - Veterinary PIMS: Complete Architecture & Implementation Guide

> **Status:** Living document - source of truth for all new module design  
> **Last Updated:** 2026-05-18  
> **Team:** 1 frontend engineer · 1 backend engineer · 1 designer  
> **Stack:** Next.js · React Native · Node.js · PostgreSQL (Prisma) · pnpm workspaces · Turbo

PIMS stands for Practice Information Management System: the software a veterinary clinic runs its day on (appointments, clinical records, billing, inventory). This document is the design blueprint for building out that system module by module; it describes the target design, so parts of it are forward-looking rather than a description of code that exists today. It is written for engineers picking up a module for the first time. For the real-time sync and notification pieces referenced throughout, see the related documents linked at the end. SOAP, used in Section 8 and after, is the standard clinical note format (Subjective, Objective, Assessment, Plan).

---

## Table of Contents

1. [Vision & Core Principles](#1-vision--core-principles)
2. [Database - PostgreSQL + Prisma](#2-database--postgresql--prisma)
3. [SuperTokens Auth Migration](#3-supertokens-auth-migration)
4. [Quality Standards - SonarQube, CI, Accessibility](#4-quality-standards--sonarqube-ci-accessibility)
5. [Species Model](#5-species-model)
6. [Organization Model Redesign](#6-organization-model-redesign)
7. [Appointment Module - Complete Redesign](#7-appointment-module--complete-redesign)
8. [SOAP Module - New](#8-soap-module--new)
9. [Vitals Module - New](#9-vitals-module--new)
10. [Prescription & Drug Management - New](#10-prescription--drug-management--new)
11. [Treatment Plan Module - New](#11-treatment-plan-module--new)
12. [Services & Packages - Redesign](#12-services--packages--redesign)
13. [Inventory Module - Deep Redesign](#13-inventory-module--deep-redesign)
14. [Templates Module - New](#14-templates-module--new)
15. [Finance / Billing - Agnostic Redesign](#15-finance--billing--agnostic-redesign)
16. [Tasks Module - Improvements](#16-tasks-module--improvements)
17. [In-Patient Module - New](#17-in-patient-module--new)
18. [Discharge Module - New](#18-discharge-module--new)
19. [Dental & Bone Charts - New](#19-dental--bone-charts--new)
20. [Lab Integration - Agnostic Layer](#20-lab-integration--agnostic-layer)
21. [Notification & Sync Bus - New](#21-notification--sync-bus--new)
22. [Documents Module Enhancement](#22-documents-module-enhancement)
23. [Companion Profile Enhancement](#23-companion-profile-enhancement)
24. [Triage System - New](#24-triage-system--new)
25. [Refer Appointments - New](#25-refer-appointments--new)
26. [Universal Search - New](#26-universal-search--new)
27. [Audit Trail & Country Compliance](#27-audit-trail--country-compliance)
28. [Reports & Data Export](#28-reports--data-export)
29. [Developer Portal & Integration Marketplace](#29-developer-portal--integration-marketplace)
30. [Payment Gateway Abstraction](#30-payment-gateway-abstraction)
31. [AI Integration Framework](#31-ai-integration-framework)
32. [Mobile App - New Screens & Offline-First](#32-mobile-app--new-screens--offline-first)
33. [Frontend - New Screens & Components](#33-frontend--new-screens--components)
34. [Database Indexing Strategy (PostgreSQL)](#34-database-indexing-strategy-postgresql)
35. [API Design Standards](#35-api-design-standards)
36. [Security Checklist](#36-security-checklist)
37. [Phased Implementation Roadmap](#37-phased-implementation-roadmap)

---

## 1. Vision & Core Principles

### What We Are Building

Yosemite Crew is the **world's first fully open-source, AI-native, multi-species veterinary PIMS** built as an infrastructure company. The developer portal is a first-class product - other companies build on our APIs.

- **Open marketplace:** Developers plug in labs, payments, AI, telehealth via a standard interface. All integrations free - orgs supply their own API keys.
- **AI-native, not AI-bolted-on:** Ambient SOAP, decision support, and drug interaction checking wired into appointment flow from day one.
- **Agnostic-everything:** Auth (SuperTokens), payments (IPaymentGateway), labs (ILabProvider), AI (IAIProvider), email (IMailer). No vendor lock-in.
- **FHIR R4 + HL7 v2.5 compliant:** Every core entity maps to a FHIR resource. HL7 ADT/ORU/ORM messages exportable.
- **Multi-country:** Currency immutable after org creation. Tax, controlled substance logs, government audit exports configurable per country.
- **Accessibility-first:** WCAG 2.1 AA, ARIA patterns enforced in CI.
- **Highest code quality:** SonarQube gate enforced on every PR across all three apps.

### Core Principles Table

| Principle         | Implementation                                                       |
| ----------------- | -------------------------------------------------------------------- |
| Agnostic auth     | SuperTokens (replaces Cognito + Firebase)                            |
| Agnostic payments | `IPaymentGateway` interface - Stripe is one implementation           |
| Agnostic labs     | `ILabProvider` interface - IDEXX, Antech, Zoetis are implementations |
| Agnostic AI       | `IAIProvider` interface - Anthropic, OpenAI are implementations      |
| Agnostic email    | `IMailer` interface - Plunk + nodemailer (replaces AWS SES)          |
| FHIR-first        | All entities have FHIR converters in `/packages/fhir`                |
| Data portability  | One-click full DB export, no fee, no notice period                   |
| Open integrations | All integrations free - orgs supply their own API keys               |
| Accessibility     | WCAG 2.1 AA, jest-axe in CI, full ARIA patterns                      |
| Code quality      | SonarQube highest gate on every PR, all three apps                   |

---

## 2. Database - PostgreSQL + Prisma

### Current Reality

- **Primary database:** PostgreSQL via Prisma ORM (`@prisma/client@^5.22.0`)
- **Schema file:** `apps/backend/prisma/schema.prisma` - 72 models, 50+ enums
- **MongoDB:** Still present in codebase but bypassed with `READ_FROM_POSTGRES=true`. **Target: remove entirely after migration.**
- **No Supabase:** PostgreSQL accessed directly. If hosting on Supabase, use the Supabase connection string in `DATABASE_URL`. No Supabase-specific SDK needed.
- **BullMQ:** `bullmq@^5.65.1` - job queue for async processing (lab syncs, reminders, notifications)

### Migration Plan (MongoDB → PostgreSQL)

```
1. Set READ_FROM_POSTGRES=true in all environments
2. Remove mongoose dependency after all services ported
3. Remove apps/backend/src/models/ Mongoose files
4. Remove mongodb-memory-server from test dependencies
5. Replace apps/backend/src/config/db.ts with Prisma client singleton
```

### Prisma Client Singleton Pattern

```typescript
// apps/backend/src/config/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

### Existing Prisma Enums to Keep / Extend

```prisma
// Species - KEEP as-is (matches companion.type in Mongoose)
enum CompanionType {
  dog
  cat
  horse
  other   // covers ALL exotic/other - see Section 5
}

// Appointment status - REPLACE with expanded set (Section 7)
enum AppointmentStatus {
  REQUESTED
  UPCOMING        // → rename to CONFIRMED
  CHECKED_IN
  IN_PROGRESS
  COMPLETED
  CANCELLED
  NO_SHOW
  // ADD: TRIAGE_PENDING, ADMITTED, AWAITING_DISCHARGE, DISCHARGED, REFERRED
}

// Task kind - KEEP existing, ADD new
enum TaskKind {
  MEDICATION
  OBSERVATION_TOOL
  HYGIENE
  DIET
  CUSTOM
  // ADD: PROCEDURE, FOLLOW_UP, CONSENT, LAB_ORDER, VACCINATION, EXERCISE
}

// Task library species - KEEP
enum TaskLibrarySpecies {
  dog
  cat
  horse
}

// Inventory business type - KEEP
enum InventoryBusinessType {
  HOSPITAL
  GROOMING
  BREEDING
  BOARDING
  GENERAL
}
```

---

## 3. SuperTokens Auth Migration

### Why

AWS Cognito (web) and Firebase (mobile) are vendor lock-in. SuperTokens is open-source, self-hostable, and supports all flows needed: email/password, social, MFA, passkeys, RBAC.

### Current State

- Web: `@aws-sdk/client-cognito-identity-provider@3.772.0` + JWT + JWKS
- Mobile: `firebase-admin@^13.6.0` + custom mobile auth (`AuthUserMobile` model)
- Permissions: `RolePermission` model with 7 roles (OWNER, ADMIN, SUPERVISOR, VETERINARIAN, TECHNICIAN, ASSISTANT, RECEPTIONIST) - **keep this structure**

### Migration Steps

**Step 1 - Parallel run middleware**

```typescript
// apps/backend/src/middleware/authorize.ts
export function authorize() {
  if (process.env.AUTH_PROVIDER === 'supertokens') {
    return authorizeSuperTokens();
  }
  return authorizeCognito(); // existing
}
```

**Step 2 - User schema addition (Prisma migration)**

```prisma
model User {
  // existing fields...
  supertokensUserId  String?   // SuperTokens userId
  cognitoSub         String?   // keep for migration lookup
  authMigrated       Boolean   @default(false)
}
```

**Step 3 - Session Claim: OrgContext**

```typescript
interface OrgSessionClaim {
  orgId: string;
  role:
    | 'OWNER'
    | 'ADMIN'
    | 'SUPERVISOR'
    | 'VETERINARIAN'
    | 'TECHNICIAN'
    | 'ASSISTANT'
    | 'RECEPTIONIST';
  permissions: string[]; // e.g. ['appointments:view:any', 'prescription:write']
}
```

### RBAC - Existing 7 Roles (Keep, Map to SuperTokens)

```typescript
// Existing permissions from role-permission.ts (sample - keep all)
export const ROLE_PERMISSIONS = {
  VETERINARIAN: [
    'appointments:view:any',
    'appointments:edit:any',
    'soap:view',
    'soap:edit',
    'prescription:view:any',
    'prescription:edit:any',
    'prescription:write',
    'controlled-substances:log',
    'controlled-substances:view',
    'billing:view:any',
    'vitals:record',
    'vitals:view',
    'dental-chart:edit',
    'bone-chart:edit',
    'discharge:create',
    'discharge:edit',
  ],
  RECEPTIONIST: [
    'appointments:view:any',
    'appointments:create',
    'appointments:cancel',
    'billing:view:any',
    'billing:create',
    'invoices:create',
    'invoices:view',
    'triage:view',
  ],
  TECHNICIAN: [
    'appointments:view:any',
    'vitals:record',
    'vitals:view',
    'soap:view',
    'tasks:view',
    'tasks:complete',
    'lab-orders:create',
    'lab-orders:view',
  ],
  // ... OWNER, ADMIN, SUPERVISOR, ASSISTANT
};
```

---

## 4. Quality Standards - SonarQube, CI, Accessibility

### SonarQube (Already Configured - Maintain & Enforce)

Three projects configured:

- `yosemitecrew_Yosemite-Crew_Backend` - `apps/backend/sonar-project.properties`
- Frontend - `apps/frontend/sonar-project.properties`
- Mobile - `apps/mobileAppYC/sonar-project.properties`

**Rules for all new code:**

| Rule                 | Requirement       |
| -------------------- | ----------------- |
| Cognitive complexity | ≤ 15 per function |
| Duplicated lines     | ≤ 3%              |
| Coverage             | ≥ 80% new code    |
| Code smells          | Zero new          |
| Bugs                 | Zero new          |
| Security hotspots    | All reviewed      |
| Reliability rating   | A                 |
| Security rating      | A                 |

**Key patterns to follow (from existing `frontend-sonar` skill):**

- No nested ternaries - use early returns or named variables
- No unused variables or imports
- No `any` type in TypeScript
- No `console.log` in production code - use logger
- Extract magic numbers into named constants

### CI/CD (13 Workflows - All Must Stay Green)

| Workflow                   | Purpose                           | Must pass on              |
| -------------------------- | --------------------------------- | ------------------------- |
| `ci-affected.yaml`         | Test affected workspaces          | All PRs                   |
| `sonar-cloud-analysis.yml` | SonarQube gate                    | All PRs                   |
| `frontend-a11y.yml`        | jest-axe WCAG 2.1 AA              | All PRs touching frontend |
| `frontend-quality.yml`     | Build, bundle budgets, Lighthouse | All PRs                   |
| `frontend-e2e.yml`         | Playwright E2E                    | PRs to main/dev           |
| `chromatic.yml`            | Visual regression (Storybook)     | Component changes         |
| `codeql.yml`               | CodeQL security analysis          | Weekly + PRs              |
| `dependency-review.yml`    | Vulnerability scanning            | All PRs                   |
| `secret-scan.yml`          | Secret detection                  | All PRs                   |
| `pr-governance.yml`        | PR rules                          | All PRs                   |

### Accessibility Standards (WCAG 2.1 AA - Non-Negotiable)

Every new component and page **must**:

```typescript
// Pattern: all interactive elements
<button
  aria-label="Record vitals for Buddy"
  aria-pressed={isRecording}
  onClick={handleRecord}
>
  Record Vitals
</button>

// Pattern: status updates
<div aria-live="polite" aria-atomic="true">
  {appointmentStatus}
</div>

// Pattern: form errors
<input
  id="weight"
  aria-describedby="weight-error"
  aria-invalid={!!errors.weight}
/>
<span id="weight-error" role="alert">{errors.weight}</span>

// Pattern: loading states
<div aria-busy={isLoading} aria-label="Loading appointment board">
  {isLoading ? <Skeleton /> : <AppointmentBoard />}
</div>

// Pattern: tabs
<div role="tablist" aria-label="Appointment details">
  <button role="tab" aria-selected={activeTab === 'soap'} aria-controls="soap-panel">SOAP</button>
</div>
<div id="soap-panel" role="tabpanel" tabIndex={0}>...</div>

// Pattern: modals / dialogs
<dialog aria-labelledby="modal-title" aria-describedby="modal-desc">
  <h2 id="modal-title">Dental Chart</h2>
  <p id="modal-desc">...</p>
</dialog>

// Pattern: data tables
<table>
  <caption>Appointment Queue - 18 May 2026</caption>
  <thead>
    <tr><th scope="col">Patient</th><th scope="col">Status</th></tr>
  </thead>
  <tbody>
    <tr><td>Buddy</td><td>In Progress</td></tr>
  </tbody>
</table>

// Pattern: color - never use color alone to convey meaning
// Always pair color with text/icon
<span className="text-red-600" aria-label="Emergency - P1">
  <AlertIcon aria-hidden="true" /> P1 Emergency
</span>
```

**jest-axe test pattern (required for every new component):**

```typescript
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);

it('has no accessibility violations', async () => {
  const { container } = render(<MyComponent />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

---

## 5. Species Model

### Decision: Four Types, No Over-Specialisation

Based on the existing Prisma enum and companion model:

```prisma
enum CompanionType {
  dog     // Canine - all breeds
  cat     // Feline - all breeds
  horse   // Equine - horses, ponies, donkeys
  other   // Everything else: rabbit, bird, reptile, small mammals, etc.
}
```

### Species-Specific vs Generic

| Feature        | dog                      | cat                      | horse                    | other                    |
| -------------- | ------------------------ | ------------------------ | ------------------------ | ------------------------ |
| Vital ranges   | ✓ Specific               | ✓ Specific               | ✓ Specific               | Generic defaults         |
| Dental formula | ✓ (42 teeth)             | ✓ (30 teeth)             | ✓ (40-44 teeth)          | Free-text notes field    |
| BCS scale      | 1-9 (WSAVA)              | 1-9 (WSAVA)              | 1-9 (Henneke)            | 1-9 generic              |
| Drug dosing    | Weight-based per species | Weight-based per species | Weight-based per species | Weight-based generic     |
| Task library   | ✓ Species-filtered       | ✓ Species-filtered       | ✓ Species-filtered       | Generic tasks            |
| Code reference | IDEXX/SNOMED codes       | IDEXX/SNOMED codes       | IDEXX/SNOMED codes       | Free-text or custom code |

### `other` Species: Free Input Pattern

```prisma
model Companion {
  type    CompanionType    // always set: dog | cat | horse | other
  breed   String           // for 'other': free text e.g. "Holland Lop Rabbit"
  // New field to add:
  speciesLabel  String?    // for 'other': free text species name e.g. "Rabbit", "Iguana", "Goldfish"
}
```

**UI rule:** When `type = 'other'`, show a free-text `speciesLabel` input alongside `breed`. This appears in all clinical records, vitals forms, and SOAP notes.

### Vital Range Defaults

```typescript
// packages/types/src/vital-ranges.ts
export const VITAL_RANGES = {
  dog: {
    temperatureCelsius: { min: 38.3, max: 39.2 },
    heartRateBpm: { min: 60, max: 140 },
    respRatePerMin: { min: 10, max: 30 },
    bcsScale: { min: 1, max: 9, ideal: [4, 5] },
    spo2Percent: { min: 95, max: 100 },
  },
  cat: {
    temperatureCelsius: { min: 38.1, max: 39.2 },
    heartRateBpm: { min: 160, max: 220 },
    respRatePerMin: { min: 15, max: 40 },
    bcsScale: { min: 1, max: 9, ideal: [4, 5] },
  },
  horse: {
    temperatureCelsius: { min: 37.5, max: 38.5 },
    heartRateBpm: { min: 28, max: 44 },
    respRatePerMin: { min: 8, max: 16 },
    bcsScale: { min: 1, max: 9, ideal: [5, 6] },
    gutSounds: { required: true }, // horses only
  },
  other: {
    // Generic - show ranges as guidance only, vet must assess
    temperatureCelsius: { min: 37.0, max: 41.0 },
    heartRateBpm: { min: 40, max: 300 },
    respRatePerMin: { min: 5, max: 60 },
  },
} as const;
```

---

## 6. Organization Model Redesign

### Current Issues

- `stripeAccountId` embedded directly - breaks payment agnosticism
- No currency lock enforcement (currency must be immutable after onboarding)
- No country/regulatory configuration
- `documensoApiKey` stored on org - should be in `IntegrationAccount` model
- No subscription tier, feature flags, or appointment config

### New Prisma Schema Addition

```prisma
// ADD to schema.prisma - extends existing Organization model

model Organization {
  // KEEP existing fields
  id                          String           @id @default(uuid())
  fhirId                      String?
  name                        String
  taxId                       String
  DUNSNumber                  String?
  imageURL                    String?
  type                        OrganizationType
  petNamePreference           PetNamePreference @default(COMPANION)
  phoneNo                     String
  website                     String?
  isVerified                  Boolean          @default(false)
  isActive                    Boolean          @default(true)
  healthAndSafetyCertNo       String?
  animalWelfareComplianceCertNo String?
  fireAndEmergencyCertNo      String?
  typeCoding                  Json?
  googlePlacesId              String?
  averageRating               Float            @default(0)
  ratingCount                 Int              @default(0)
  appointmentCheckInBufferMinutes Int          @default(5)
  appointmentCheckInRadiusMeters  Int          @default(200)

  // REMOVE: stripeAccountId (move to IntegrationAccount)
  // REMOVE: documensoTeamId, documensoApiKey (move to IntegrationAccount)

  // ADD: Locale & currency (IMMUTABLE after onboarding)
  currency          String?          // ISO 4217 e.g. 'EUR', 'USD', 'INR'
  timezone          String?          // IANA e.g. 'Europe/Madrid'
  language          String?          // BCP 47 e.g. 'es-ES'
  measurementSystem MeasurementSystem @default(METRIC)
  taxLabel          String?          // 'VAT', 'GST', 'Sales Tax'
  defaultTaxPercent Float            @default(0)
  taxInclusive      Boolean          @default(false)
  localeFinalized   Boolean          @default(false)  // once true, currency cannot change

  // ADD: Country compliance
  countryCode       String?          // ISO 3166-1 alpha-2
  auditExportEnabled         Boolean @default(false)
  auditExportFrequencyDays   Int?    // e.g. 14 for Spain
  auditExportFormat          String? // 'AEMPS' | 'RCVS' | 'DEA' | 'CUSTOM'
  lastAuditExportAt          DateTime?
  nextAuditExportDue         DateTime?
  deaRegistrationNumber      String?  // USA
  vetLicenseNumber           String?
  regulatoryBodyId           String?  // ref to RegulatoryAuthority

  // ADD: Appointment config
  inPatientEnabled                   Boolean @default(false)
  lockInPeriodHoursInPatient         Int     @default(24)
  lockInPeriodHoursOutPatient        Int     @default(2)
  triageEnabled                      Boolean @default(false)
  referralsEnabled                   Boolean @default(false)
  securityDepositEnabled             Boolean @default(false)
  securityDepositDefaultCents        Int     @default(0)

  // ADD: Feature flags
  featureDentalCharts   Boolean @default(false)
  featureBoneCharts     Boolean @default(false)
  featureLabOrders      Boolean @default(true)
  featureESignatures    Boolean @default(true)
  featureAiScribe       Boolean @default(false)
  featureOnlinePayments Boolean @default(true)

  // ADD: Payment gateway reference (agnostic)
  activePaymentGateway  String? // 'STRIPE' | 'RAZORPAY' etc.
  // gateway credentials stored in IntegrationAccount table

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime? // soft delete

  @@index([googlePlacesId, name])
}

enum MeasurementSystem {
  METRIC
  IMPERIAL
}
```

---

## 7. Appointment Module - Complete Redesign

### Current Status

Existing `Appointment` model (Prisma + Mongoose) has:

- 7 statuses: `REQUESTED | UPCOMING | CHECKED_IN | IN_PROGRESS | COMPLETED | CANCELLED | NO_SHOW`
- Denormalized companion/lead/room as JSON objects
- `concern` text field only
- No SOAP, vitals, prescription, treatment plan linkage
- No triage, no in-patient, no clinical flags

### New Status Machine

```
DRAFT ──────────────────────────────────────────► CANCELLED
  │
  ▼
REQUESTED ──────────────────────────────────────► CANCELLED
  │ (confirmed by receptionist)
  ▼
CONFIRMED ──────────────────────────────────────► CANCELLED
  │ (client arrives + geo check-in)
  ▼
CHECKED_IN ────────────────────────────────────► NO_SHOW
  │ (triage if enabled)
  ▼
TRIAGE_PENDING (optional)
  │ (clinical work begins)
  ▼
IN_PROGRESS ───────────────────────────────────► REFERRED
  │
  ▼
AWAITING_DISCHARGE (billing ready)
  │
  ▼
COMPLETED (outpatient end state)

CHECKED_IN → ADMITTED (in-patient path)
  │
ADMITTED → AWAITING_DISCHARGE → DISCHARGED
```

### Clinical Flags (Internal State on Top of Status)

These allow the receptionist board to show what the vet has done:

```prisma
// Embed as Json in Appointment, or as a separate AppointmentClinicalFlags table
model AppointmentClinicalFlags {
  id                    String   @id @default(uuid())
  appointmentId         String   @unique
  isVitalsRecorded      Boolean  @default(false)
  isSOAPSaved           Boolean  @default(false)
  isPrescriptionSaved   Boolean  @default(false)
  isTreatmentPlanCreated Boolean @default(false)
  isMarkedForBilling    Boolean  @default(false)
  isConsentFormSigned   Boolean  @default(false)
  isLabOrderPlaced      Boolean  @default(false)
  isDischargeComplete   Boolean  @default(false)
  sentToBillingAt       DateTime?
  sentToBillingBy       String?  // userId
}
```

### New Prisma Appointment Model

```prisma
// New enums to add
enum AppointmentStatus {
  DRAFT
  REQUESTED
  CONFIRMED
  CHECKED_IN
  TRIAGE_PENDING
  IN_PROGRESS
  ADMITTED
  AWAITING_DISCHARGE
  COMPLETED
  DISCHARGED
  CANCELLED
  NO_SHOW
  REFERRED
}

enum AppointmentKind {
  OUTPATIENT
  INPATIENT
}

enum TriageLevel {
  P1_EMERGENCY
  P2_URGENT
  P3_SEMI_URGENT
  P4_ROUTINE
  P5_NON_URGENT
}

model Appointment {
  id              String            @id @default(uuid())
  organisationId  String
  companionId     String
  parentId        String            // primary owner
  kind            AppointmentKind   @default(OUTPATIENT)
  status          AppointmentStatus @default(REQUESTED)

  // Denormalized snapshot (updated via triggers/events, not live joins)
  companionSnapshot Json             // { name, type, breed, speciesLabel, dob, weight, microchip, allergies }
  parentSnapshot    Json             // { firstName, lastName, email, phone }

  // Scheduling
  scheduledDate     DateTime
  startTime         String           // 'HH:MM' 24h
  endTime           String
  durationMinutes   Int
  timeZone          String           // IANA
  roomId            String?

  // Clinical team
  leadVetId         String?
  supportStaffIds   String[]         @default([])

  // Reason & triage
  chiefComplaint    String
  isEmergency       Boolean          @default(false)
  triageLevel       TriageLevel?
  triageNotes       String?
  triageAssignedBy  String?
  triageAssessedAt  DateTime?

  // Clinical linkage (IDs pointing to other tables)
  soapId            String?
  treatmentPlanId   String?
  dischargeId       String?
  invoiceIds        String[]         @default([])
  labOrderIds       String[]         @default([])
  prescriptionIds   String[]         @default([])
  vitalIds          String[]         @default([])
  formSubmissionIds String[]         @default([])
  dentalChartId     String?
  boneChartId       String?

  // Linkage to history
  previousAppointmentId String?
  referralId            String?
  referredFromOrgId     String?

  // In-patient data (populated when admitted)
  inPatientData     Json?           // ward, bed, admittedAt, estimatedDischarge, dailyRounds[]

  // Source
  source            String          @default("WEB") // WEB | MOBILE | API | WALK_IN

  // Notes & attachments
  internalNotes     String?
  attachments       Json?           // [{ s3Key, filename, mimeType, uploadedAt }]

  // Cancellation
  cancellationReason String?
  cancelledBy       String?
  cancelledAt       DateTime?
  refundInitiated   Boolean?

  // Speciality
  specialityId      String?
  serviceIds        String[]        @default([])

  // Status history (append-only)
  statusHistory     Json?           // [{ status, changedAt, changedBy, reason }]

  createdBy         String
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
  deletedAt         DateTime?

  @@index([organisationId, status, scheduledDate])
  @@index([organisationId, leadVetId, scheduledDate])
  @@index([companionId, scheduledDate])
  @@index([parentId])
  @@index([organisationId, triageLevel, status])
  @@index([organisationId, kind, status])
}
```

### Appointment API Endpoints

| Method | Path                                         | Description                            | Min Role        |
| ------ | -------------------------------------------- | -------------------------------------- | --------------- |
| POST   | `/fhir/v1/appointments`                      | Create                                 | RECEPTIONIST    |
| GET    | `/fhir/v1/appointments`                      | List (filter: date, status, vet, kind) | VIEWER          |
| GET    | `/fhir/v1/appointments/:id`                  | Get full detail                        | VIEWER          |
| PATCH  | `/fhir/v1/appointments/:id`                  | Update scheduling                      | RECEPTIONIST    |
| POST   | `/fhir/v1/appointments/:id/status`           | Transition status                      | varies          |
| POST   | `/fhir/v1/appointments/:id/check-in`         | Geo check-in                           | RECEPTIONIST    |
| POST   | `/fhir/v1/appointments/:id/triage`           | Assign triage                          | VET, TECHNICIAN |
| POST   | `/fhir/v1/appointments/:id/admit`            | Mark admitted                          | VET, ADMIN      |
| POST   | `/fhir/v1/appointments/:id/mark-for-billing` | Send to billing                        | VET             |
| POST   | `/fhir/v1/appointments/:id/refer`            | Refer to another org                   | VET, ADMIN      |
| GET    | `/fhir/v1/appointments/board`                | Kanban board (grouped by status)       | VIEWER          |
| GET    | `/fhir/v1/appointments/inpatient`            | Admitted patients                      | VIEWER          |
| GET    | `/fhir/v1/appointments/triage-queue`         | Sorted triage list                     | VIEWER          |
| POST   | `/fhir/v1/appointments/:id/daily-round`      | Daily round (in-patient)               | VET, TECHNICIAN |
| PATCH  | `/fhir/v1/appointments/bulk-status`          | Bulk status change                     | ADMIN           |

---

## 8. SOAP Module - New

SOAP lives in its own table linked to the appointment. **Structured by body system** (not free text) to enable AI pre-filling, inter-appointment comparison, and audit.

### Prisma Schema

```prisma
model AppointmentSOAP {
  id            String   @id @default(uuid())
  appointmentId String   @unique
  organisationId String
  companionId   String
  version       Int      @default(1)
  isDraft       Boolean  @default(true)
  locked        Boolean  @default(false)  // true = signed/finalized, no more edits

  // SUBJECTIVE
  subjective    Json
  // {
  //   chiefComplaint: string,
  //   historyOfPresentIllness: string,
  //   durationOfIllness?: string,
  //   previousTreatments?: string,
  //   diet?: string,
  //   environment?: string,
  //   vaccinationStatus?: string,
  //   dewormingStatus?: string,
  //   ownerObservations?: string,
  //   aiGenerated?: boolean,
  //   aiConfidence?: number
  // }

  // OBJECTIVE - structured by body system
  objective     Json
  // {
  //   vitalsId?: string,  // ref to AppointmentVitals
  //   generalAppearance: string,
  //   bodyConditionScore?: number,  // 1-9
  //   mentalStatus?: 'ALERT'|'DEPRESSED'|'OBTUNDED'|'STUPOROUS'|'COMATOSE',
  //   painScore?: number,  // 0-10
  //   // Per system (each: { findings: string, abnormal: boolean })
  //   integumentary?, musculoskeletal?, neurological?, ophthalmic?,
  //   otic?, oral?, respiratory?, cardiovascular?, gastrointestinal?,
  //   urogenital?, lymphNodes?, endocrine?, mammary?,
  //   // Horse only:
  //   gutSounds?: 'NORMAL'|'HYPERMOTILE'|'HYPOMOTILE'|'ABSENT',
  //   labFindings?: string,
  //   imagingFindings?: string
  // }

  // ASSESSMENT
  assessment    Json
  // {
  //   differentialDiagnoses: [{
  //     diagnosis: string,
  //     icdCode?: string,     // ICD-11
  //     snomedCode?: string,
  //     probability?: 'HIGH'|'MEDIUM'|'LOW',
  //     notes?: string
  //   }],
  //   primaryDiagnosis?: string,
  //   prognosisNotes?: string,
  //   clinicalReasoning?: string
  // }

  // PLAN
  plan          Json
  // {
  //   treatments: [{ description, serviceId?, performed: boolean }],
  //   medications: [{ drugName, dosage, frequency, route, duration, prescriptionId? }],
  //   diagnostics: [{ description, labOrderId? }],
  //   followUp?: { recommendedInDays?, notes? },
  //   clientInstructions?: string,
  //   internalNotes?: string
  // }

  // AI scribe metadata
  aiScribeSessionId  String?
  aiTranscriptS3Key  String?
  aiGeneratedAt      DateTime?
  aiModel            String?
  aiAcceptedByVet    Boolean?
  aiModifications    Json?     // [{ field, original, edited }]

  createdBy     String
  lastEditedBy  String
  signedBy      String?
  signedAt      DateTime?

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([appointmentId])
  @@index([companionId, createdAt])
}
```

### SOAP API Endpoints

| Method | Path                                      | Description                |
| ------ | ----------------------------------------- | -------------------------- |
| POST   | `/fhir/v1/appointments/:id/soap`          | Create/initialize SOAP     |
| GET    | `/fhir/v1/appointments/:id/soap`          | Get current SOAP           |
| PATCH  | `/fhir/v1/appointments/:id/soap`          | Auto-save draft            |
| POST   | `/fhir/v1/appointments/:id/soap/sign`     | Lock and sign (VET only)   |
| GET    | `/fhir/v1/appointments/:id/soap/history`  | All versions               |
| POST   | `/fhir/v1/appointments/:id/soap/ai-draft` | Trigger AI SOAP generation |

---

## 9. Vitals Module - New

### Prisma Schema

```prisma
model AppointmentVitals {
  id             String   @id @default(uuid())
  appointmentId  String
  organisationId String
  companionId    String
  species        String   // 'dog' | 'cat' | 'horse' | 'other'
  recordedBy     String
  recordedAt     DateTime @default(now())

  // Core vitals
  weightKg            Float?
  temperatureCelsius  Float?
  heartRateBpm        Int?
  respRatePerMin      Int?
  systolicBp          Int?
  diastolicBp         Int?
  spo2Percent         Float?

  // Clinical assessment
  painScore           Int?    // 0-10
  painScaleUsed       String? // 'NRS'|'VAS'|'CMPS-SF'|'FLACC'|'UNESP-II'|'CGS'|'FGS'|'EGS'
  bodyConditionScore  Float?  // 1-9 (species-specific scale)
  muscleConditionScore Int?   // 1-4 (WSAVA)

  // Species-specific grimace / pain scales
  // Canine Grimace Scale (CGS) - dog only: 0-2 per action unit, total 0-10
  cgsOrbitalTightening  Int?   // 0=absent 1=moderate 2=obvious
  cgsCheekTightening    Int?
  cgsEarPosition        Int?   // 0=relaxed 1=partially 2=fully back/rotated
  cgsMuzzleContraction  Int?
  cgsHeadPosition       Int?   // 0=above withers 1=level 2=below withers
  cgsTotal              Int?   // computed: sum of 5 AUs (0-10)

  // Feline Grimace Scale (FGS) - cat only: 0-2 per action unit, total 0-10
  fgsOrbitalTightening  Int?
  fgsMuzzleContraction  Int?
  fgsWhiskerChange      Int?   // 0=relaxed/forward 1=slightly back 2=fully back/straightened
  fgsEarPosition        Int?
  fgsHeadPosition       Int?   // 0=above shoulders 1=level 2=below shoulders or tilted
  fgsTotal              Int?   // computed: sum of 5 AUs (0-10)

  // Equine Grimace Scale (EGS) - horse only: 0-2 per action unit, total 0-10
  egsOrbitalTightening  Int?
  egsLoweredHeadPos     Int?
  egsEarPosition        Int?   // 0=forward/neutral 1=unilateral back 2=bilateral back/pinned
  egsAnkleMuscle        Int?   // 0=relaxed 1=mild tension 2=pronounced/lips pulled back
  egsNostrilMouth       Int?
  egsTotal              Int?   // computed: sum of 5 AUs (0-10)

  // Physical observation
  mucousMembraneColor   String?  // 'PINK'|'PALE'|'WHITE'|'BLUE'|'YELLOW'|'BRICK_RED'
  capillaryRefillTimeSec Float?
  hydrationStatus       String?  // 'NORMAL'|'MILD_5%'|'MODERATE_7%'|'SEVERE_10%'|'CRITICAL_12%'
  mentalStatus          String?  // 'ALERT'|'QUIET'|'DEPRESSED'|'OBTUNDED'|'STUPOROUS'|'COMATOSE'
  posture               String?  // 'NORMAL'|'GUARDED'|'HUNCHED'|'RECUMBENT'

  // Horse-specific
  gutSounds             String?  // 'NORMAL'|'HYPERMOTILE'|'HYPOMOTILE'|'ABSENT'

  // Dental (quick score)
  dentalScore           Int?    // AVDC 0-4

  // Auto-computed
  hasAbnormals          Boolean @default(false)
  abnormalFields        String[] @default([])

  // Additional notes / custom fields
  conditionNotes        String?
  additionalNotes       String?
  customVitals          Json?   // org-defined custom vital fields

  createdAt DateTime @default(now())

  @@index([appointmentId])
  @@index([companionId, recordedAt])
}
```

### Grimace Scale - UI Behaviour

The `painScaleUsed` field drives which input widget renders in the vitals form:

| Value      | Species          | Widget                                                                                                               |
| ---------- | ---------------- | -------------------------------------------------------------------------------------------------------------------- |
| `NRS`      | all              | Numeric slider 0-10 (general numeric rating scale)                                                                   |
| `VAS`      | all              | Visual analogue scale bar                                                                                            |
| `CMPS-SF`  | dog, cat         | Colorado/Glasgow Composite Pain Scale - Short Form; `painScore` stores the composite total                           |
| `FLACC`    | all (non-verbal) | Face/Legs/Activity/Cry/Consolability; `painScore` stores total 0-10                                                  |
| `UNESP-II` | cat              | UNESP-Botucatu Multidimensional Composite Pain Scale                                                                 |
| `CGS`      | dog              | Canine Grimace Scale - renders 5 AU sliders (0/1/2); stores per-AU scores in `cgs*` fields; `cgsTotal` auto-computed |
| `FGS`      | cat              | Feline Grimace Scale - renders 5 AU sliders; stores per-AU scores in `fgs*` fields; `fgsTotal` auto-computed         |
| `EGS`      | horse            | Equine Grimace Scale - renders 5 AU sliders; stores per-AU scores in `egs*` fields; `egsTotal` auto-computed         |

**Frontend rule:** show only the grimace scale appropriate for the appointment companion's species. The per-AU fields for the other two scales are left null. `painScore` (0-10 normalised) is always populated regardless of scale used - it is the canonical field used for alerts, trends, and AI flags.

**Reference photo sets:** YC ships a static asset pack of CGS/FGS/EGS reference photos (Creative Commons licensed from published studies) shown alongside each AU slider so staff can calibrate scores without leaving the form.

### Vitals as a Service (Vital Recording Service)

Vital recording during in-patient care is a billable nursing service in many practices. The `OBSERVATION_TOOL` service type covers this:

```prisma
// Example service record for vital monitoring
// type = INPATIENT_SERVICE, linked to OBSERVATION_TOOL task kind
{
  name: "Vital Signs Monitoring - per shift",
  type: INPATIENT_SERVICE,
  aahaCode: "3200",          // AAHA: Nursing Care
  basePriceCents: 1500,      // practice-configurable
  appointmentKinds: ["INPATIENT"],

  // When this service item is completed, it auto-triggers a vitals recording task
  // body linkage: observationToolId links to the vitals OT config
}
```

**Flow:**

1. Vet adds "Vital Signs Monitoring" service to treatment plan
2. Backend creates a `Task` (kind=`VITALS_RECORDING`, isInPatientSchedule=true) for each shift
3. When staff completes the task → vitals form opens inline, `AppointmentVitals` is saved
4. Completing the task marks the associated service line item as delivered → billed on invoice
5. `DailyRound.vitalsId` is updated to point to the latest recorded entry for that day

### Vitals API

| Method | Path                                        | Description                                                     |
| ------ | ------------------------------------------- | --------------------------------------------------------------- |
| POST   | `/fhir/v1/appointments/:id/vitals`          | Record vitals entry (species-aware, includes grimace scale AUs) |
| GET    | `/fhir/v1/appointments/:id/vitals`          | All vitals entries for appointment                              |
| GET    | `/fhir/v1/appointments/:id/vitals/latest`   | Most recent entry                                               |
| GET    | `/fhir/v1/companions/:id/vitals-history`    | Trend across all appointments                                   |
| GET    | `/fhir/v1/vitals/reference-ranges/:species` | Species-specific normal ranges for UI validation                |

---

## 10. Prescription & Drug Management - New

### Inventory vs Prescription Relationship

```
Drug item in Inventory  ──── dispensed via ──── Prescription
(physical stock)                                (clinical document)
     │                                               │
  InventoryBatch                            links to InventoryItem
  (lot/expiry tracking)                     + deducts stock on dispense
```

### Drug in Inventory (Category = `Medicine`)

See Section 13 for the full Inventory redesign including the `Medicine` category schema.

### Prescription Prisma Schema

```prisma
enum PrescriptionStatus {
  DRAFT
  ACTIVE
  DISPENSED
  COMPLETED
  CANCELLED
  VOIDED
}

model Prescription {
  id             String             @id @default(uuid())
  appointmentId  String
  organisationId String
  companionId    String
  parentId       String
  prescribedBy   String             // userId (must be VET role)
  prescribedAt   DateTime           @default(now())
  status         PrescriptionStatus @default(DRAFT)

  drugs          Json
  // Array of:
  // {
  //   // Drug identification
  //   inventoryItemId?: string,   // links to InventoryItem if dispensed from stock
  //   genericName: string,        // mandatory - e.g. "Amoxicillin"
  //   brandName?: string,         // e.g. "Clavamox"
  //   manufacturer?: string,
  //   formulation: string,        // "Tablet" | "Capsule" | "Liquid" | "Injectable" | "Topical" | "Ear Drops" | "Eye Drops"
  //   strength: string,           // e.g. "250mg", "50mg/ml"
  //   rxNormCode?: string,
  //   ndcCode?: string,
  //   atcCode?: string,
  //
  //   // Dosing
  //   dose: string,               // e.g. "5mg" or "0.1 ml/kg"
  //   doseUnit: string,           // "mg" | "ml" | "mcg" | "IU"
  //   dosePerKg?: number,         // auto-calc: dose × weight
  //   calculatedDose?: number,
  //   frequency: string,          // "SID" | "BID" | "TID" | "QID" | "PRN" | "q8h" | "EOD"
  //   route: string,              // "PO" | "SC" | "IM" | "IV" | "TOP" | "OTIC" | "OPHTHALMIC" | "RECTAL" | "INHALED"
  //   durationDays: number,
  //   totalQuantity: string,      // e.g. "30 tablets", "100ml"
  //   refills: number,            // 0 = no refills
  //
  //   // Flags
  //   isControlledSubstance: boolean,
  //   controlledSubstanceSchedule?: "CI"|"CII"|"CIII"|"CIV"|"CV",  // USA DEA
  //   requiresRefrigeration: boolean,
  //   isCompounded: boolean,
  //   withdrawalPeriodDays?: number,  // food animal withdrawal period
  //
  //   // Instructions
  //   patientInstructions: string,    // "Give with food"
  //   pharmacistNotes?: string,
  //
  //   // Interaction check
  //   interactionCheckAt?: string,
  //   interactions?: [{ drugName, severity: "CONTRAINDICATED"|"MAJOR"|"MODERATE"|"MINOR", description }],
  //
  //   // Dispensing
  //   dispensedQuantity?: string,
  //   dispensedAt?: string,
  //   dispensedBy?: string
  // }

  // Label data for PDF printing
  labelData      Json
  // {
  //   clinicName, clinicAddress, clinicPhone, clinicLicense,
  //   vetName, vetLicense,
  //   patientName, species, ownerName,
  //   date, expiryDate,
  //   legalDisclaimer?: string,
  //   isControlledSubstance: boolean
  // }

  pdfS3Key       String?
  dispensedAt    DateTime?
  dispensedBy    String?

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([appointmentId])
  @@index([organisationId, dispensedAt])
  @@index([companionId])
}
```

### Controlled Substance Log (DEA-compliant)

```prisma
enum ControlledSubstanceTransactionType {
  RECEIVED
  DISPENSED
  WASTED
  RETURNED
  ADJUSTMENT
}

model ControlledSubstanceLog {
  id              String                             @id @default(uuid())
  organisationId  String
  drugName        String
  genericName     String
  schedule        String                             // "CI"|"CII"|"CIII"|"CIV"|"CV"
  ndcCode         String?
  lotNumber       String?
  expiryDate      DateTime?
  formulation     String?

  transactionType ControlledSubstanceTransactionType
  quantityIn      Float?
  quantityOut     Float?
  unit            String
  runningBalance  Float

  prescriptionId  String?
  appointmentId   String?
  companionId     String?
  parentId        String?

  performedBy     String
  witnessedBy     String?   // required for WASTED
  performedAt     DateTime

  notes           String?
  exportedAt      DateTime? // null = not yet exported in audit

  createdAt       DateTime @default(now())

  @@index([organisationId, performedAt])
  @@index([organisationId, exportedAt])
}
```

### Drug Interaction Service (Open-Source, No Vendor Lock-In)

```typescript
// apps/backend/src/services/drug-interaction.service.ts
// openFDA API + RxNorm API - both free, no API key needed

interface IDrugInteractionProvider {
  checkInteractions(genericNames: string[]): Promise<{
    interactions: {
      drugs: string[];
      severity: 'CONTRAINDICATED' | 'MAJOR' | 'MODERATE' | 'MINOR';
      description: string;
    }[];
  }>;
  searchDrug(query: string): Promise<
    {
      genericName: string;
      brandNames: string[];
      rxNormCode: string;
      formulations: string[];
    }[]
  >;
}
```

### Prescription API

| Method | Path                                            | Description                      |
| ------ | ----------------------------------------------- | -------------------------------- |
| POST   | `/fhir/v1/appointments/:id/prescriptions`       | Create prescription (VET only)   |
| GET    | `/fhir/v1/appointments/:id/prescriptions`       | List for appointment             |
| GET    | `/fhir/v1/prescriptions/:id`                    | Get one                          |
| PATCH  | `/fhir/v1/prescriptions/:id`                    | Update (DRAFT only)              |
| POST   | `/fhir/v1/prescriptions/:id/dispense`           | Mark dispensed, deduct inventory |
| POST   | `/fhir/v1/prescriptions/:id/print-label`        | Generate PDF label               |
| POST   | `/fhir/v1/prescriptions/:id/void`               | Void with reason                 |
| POST   | `/fhir/v1/prescriptions/check-interactions`     | Drug interaction check           |
| GET    | `/fhir/v1/controlled-substances/log`            | Log with date filter             |
| POST   | `/fhir/v1/controlled-substances/log`            | Manual log entry                 |
| GET    | `/fhir/v1/controlled-substances/reconciliation` | Balance reconciliation           |
| POST   | `/fhir/v1/controlled-substances/export`         | Regulatory export                |

---

## 11. Treatment Plan Module - New

### Schema

```prisma
enum TreatmentPlanStatus {
  DRAFT
  SENT_FOR_APPROVAL
  APPROVED
  IN_PROGRESS
  COMPLETED
  DECLINED
}

model TreatmentPlan {
  id             String              @id @default(uuid())
  appointmentId  String              @unique
  organisationId String
  companionId    String
  createdBy      String
  status         TreatmentPlanStatus @default(DRAFT)
  templateId     String?

  // Services to perform
  services       Json
  // [{ serviceId, name, quantity, unitCostCents, discountPercent?,
  //    performedAt?, performedBy?, status: 'PLANNED'|'IN_PROGRESS'|'COMPLETED'|'SKIPPED', notes? }]

  // Medications administered in clinic (different from take-home prescription)
  inClinicMedications Json
  // [{ drugName, inventoryItemId?, dose, route,
  //    administeredAt?, administeredBy?,
  //    quantityUsed?, status: 'PLANNED'|'ADMINISTERED'|'SKIPPED' }]

  // Procedures
  procedures     Json
  // [{ name, serviceId?, notes?, status: 'PLANNED'|'COMPLETED'|'SKIPPED' }]

  // Billing
  estimatedTotalCents  Int      @default(0)
  markedForBilling     Boolean  @default(false)
  markedAt             DateTime?
  markedBy             String?   // vet userId who sent to receptionist

  // Client estimate
  depositRequired      Boolean  @default(false)
  depositAmountCents   Int      @default(0)
  estimatePdfS3Key     String?
  estimateSentAt       DateTime?
  clientApprovalStatus String?   // 'PENDING'|'APPROVED'|'DECLINED'
  clientApprovedAt     DateTime?
  clientApprovedVia    String?   // 'IN_PERSON'|'EMAIL'|'APP'

  notes          String?

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([appointmentId])
  @@index([organisationId])
}
```

### Treatment Plan API

| Method | Path                                                        | Description                   |
| ------ | ----------------------------------------------------------- | ----------------------------- |
| POST   | `/fhir/v1/appointments/:id/treatment-plan`                  | Create                        |
| GET    | `/fhir/v1/appointments/:id/treatment-plan`                  | Get                           |
| PATCH  | `/fhir/v1/appointments/:id/treatment-plan`                  | Update                        |
| POST   | `/fhir/v1/appointments/:id/treatment-plan/send-estimate`    | Email estimate to owner       |
| POST   | `/fhir/v1/appointments/:id/treatment-plan/mark-for-billing` | Send to receptionist          |
| POST   | `/fhir/v1/appointments/:id/treatment-plan/generate-pdf`     | Generate PDF                  |
| PATCH  | `/fhir/v1/treatment-plans/:id/items/:type/:index`           | Update individual item status |

---

## 12. Services & Packages - Redesign

### Current Model Problems

- Only two types: `CONSULTATION | OBSERVATION_TOOL`
- No packages, no consumables linkage, no medication linkage
- No AAHA codes, no in/out patient distinction

### New Service Types (extend existing enum)

```prisma
enum ServiceType {
  CONSULTATION      // existing
  OBSERVATION_TOOL  // existing
  PACKAGE           // bundle of services
  PROCEDURE         // surgical / diagnostic
  VACCINATION       // vaccine-specific
  LAB_SERVICE       // triggers lab order
  INPATIENT_SERVICE // daily rate, ward charge
  CONSUMABLE_SERVICE // inventory item sold as service (bandage, catheter)
}
```

### New Prisma Service Model

```prisma
model Service {
  id             String      @id @default(uuid())
  organisationId String?     // null = YC global/default service
  name           String
  description    String?
  code           String?     // internal billing code
  aahaCode       String?     // AAHA Chart of Accounts code

  type           ServiceType @default(CONSULTATION)
  isActive       Boolean     @default(true)
  isYCDefault    Boolean     @default(false)
  requiresVetApproval Boolean @default(false)

  // Pricing
  basePriceCents     Int
  currency           String?
  maxDiscountPercent Float    @default(0)
  defaultDiscountPercent Float @default(0)
  taxable            Boolean @default(true)
  taxOverridePercent Float?

  // Quantity pricing tiers
  quantityPricing Json?
  // [{ minQty: number, priceCents: number }]

  // Duration
  durationMinutes Int?

  // Package: nested services
  isPackage    Boolean @default(false)
  packageItems Json?
  // [{ serviceId: string, quantity: number, overridePriceCents?: number }]

  // Speciality
  specialityId String?

  // Species filter (null = all)
  applicableSpecies String[] @default([])

  // Appointment type filter
  appointmentKinds  String[] @default(["OUTPATIENT", "INPATIENT"])

  // Auto-linkages on service selection
  linkedSOAPTemplateId      String?
  linkedDischargeTemplateId String?
  linkedConsentFormId       String?

  // Consumables auto-deducted from inventory on completion
  consumables Json?
  // [{ inventoryItemId: string, quantityPerService: number }]

  // Medications auto-suggested to prescription
  linkedMedications Json?
  // [{ genericName, brandName?, defaultDose?, defaultFrequency?, defaultRoute? }]

  // Lab service config
  labProviderSlug  String?  // 'idexx' | 'antech' | 'in-house'
  labTestCode      String?
  labTurnaroundHours Int?

  // Vaccination config
  vaccineType       String?
  vaccineManufacturer String?
  boosterIntervalDays Int?

  // OT linkage (existing)
  observationToolId String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?

  @@index([organisationId, specialityId])
  @@index([organisationId, type, isActive])
  @@index([aahaCode])
}
```

---

## 13. Inventory Module - Deep Redesign

### Current Model Assessment

The existing `InventoryItem` model is too generic. The `attributes` JSON field stores type-specific data dynamically. This works but lacks type safety and makes querying hard.

### Proposed Category-Based Separation

The `category` field on `InventoryItem` drives the form and schema shown to users. Categories:

| Category      | Sub-categories                                                                                               | Special fields needed                                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Medicine`    | Antibiotic, Antiparasitic, Vaccine, Analgesic, Anaesthetic, Supplement, Hormone, Controlled Substance, Other | Generic name, brand name, manufacturer, formulation, strength, controlled substance schedule, withdrawal period, storage temp, species restrictions |
| `Consumable`  | Surgical Supplies, Bandages, IV Lines, Syringes, Gloves, Sutures, Catheters, Other                           | Unit type, single-use flag                                                                                                                          |
| `Equipment`   | Diagnostic, Surgical, Monitoring, Dental, Other                                                              | Serial number, service date, warranty expiry                                                                                                        |
| `Bedding`     | Towels, Blankets, Kennel Pads, Other                                                                         | Material, washing instructions                                                                                                                      |
| `Food / Diet` | Prescription Diet, Regular, Supplement                                                                       | Species, life stage                                                                                                                                 |
| `Retail`      | Flea/Tick Prevention, Shampoo, Toys, Collars, Other                                                          | Barcode, supplier product code                                                                                                                      |

### Medicine Category - Deep Schema

This is the most important for a PIMS. The `attributes` JSON for `category = 'Medicine'`:

```typescript
interface MedicineAttributes {
  // Drug identity
  genericName: string; // MANDATORY - e.g. "Amoxicillin Trihydrate"
  brandName?: string; // e.g. "Clavamox", "Synulox"
  manufacturer?: string; // e.g. "Zoetis", "Elanco"
  distributor?: string;

  // Formulation
  formulation:
    | 'Tablet'
    | 'Capsule'
    | 'Liquid/Oral'
    | 'Injectable/IM'
    | 'Injectable/IV'
    | 'Injectable/SC'
    | 'Topical'
    | 'Ear Drops'
    | 'Eye Drops'
    | 'Paste'
    | 'Powder'
    | 'Spray'
    | 'Implant'
    | 'Other';
  strength: string; // e.g. "250mg", "50mg/ml", "250mg/5ml"
  strengthUnit: string; // "mg" | "mg/ml" | "IU" | "mcg"
  packSize: string; // e.g. "100 tablets", "250ml"
  packUnit: string; // unit for 1 pack

  // Classification
  drugClass?: string; // e.g. "Beta-lactam antibiotic"
  atcCode?: string; // Anatomical Therapeutic Chemical code (international)
  rxNormCode?: string; // RxNorm (US)
  ndcCode?: string; // NDC (US)
  vmDNumber?: string; // UK Veterinary Medicines Directorate number
  eudraVigilanceCode?: string; // EU pharmacovigilance

  // Controlled substance
  isControlledSubstance: boolean;
  controlledSubstanceSchedule?: 'CI' | 'CII' | 'CIII' | 'CIV' | 'CV'; // USA DEA
  controlledSubstanceClass?: string; // country-specific equivalent

  // Safety & storage
  requiresRefrigeration: boolean;
  storageTemperatureMin?: number; // celsius
  storageTemperatureMax?: number;
  lightSensitive?: boolean;
  requiresPrescription: boolean;
  isVaccine: boolean;

  // Food animal
  withdrawalPeriodMeat?: number; // days
  withdrawalPeriodMilk?: number; // days
  withdrawalPeriodEggs?: number; // days

  // Species restrictions
  speciesContraindicated?: ('dog' | 'cat' | 'horse' | 'other')[];
  speciesNotes?: string; // e.g. "Do not use in cats - hepatotoxic"

  // Standard dosing guidance (not a prescription - just reference)
  dosageGuidance?: string; // e.g. "5-20 mg/kg BID PO"

  // Dispensing unit
  dispensingUnit: string; // e.g. "tablet", "ml", "vial"
  minDispenseQty: number; // minimum quantity per dispense (e.g. 1 tablet)
}
```

### Updated Prisma InventoryItem (with category-driven attributes)

The existing Prisma model is correct - `attributes Json @default("{}")` stores the above. What changes:

1. **Add `category` as an enum** (not free text) for type safety
2. **Add medicine-specific indexed fields** for querying controlled substances

```prisma
// New enum to add
enum InventoryCategory {
  MEDICINE
  CONSUMABLE
  EQUIPMENT
  BEDDING
  FOOD_DIET
  RETAIL
  OTHER
}

// Add to InventoryItem:
model InventoryItem {
  // existing fields...
  category      InventoryCategory  // CHANGE: from String to enum
  isControlledSubstance Boolean   @default(false)  // ADD: for controlled substance queries
  requiresPrescription  Boolean   @default(false)  // ADD: for dispensing validation
  genericName           String?                    // ADD: denormalized from attributes for search
  formulation           String?                    // ADD: denormalized for filtering
}
```

### Stock Movement - Enhanced Reasons

```prisma
enum StockMovementReason {
  PURCHASE_RECEIVED
  DISPENSED_PRESCRIPTION
  DISPENSED_IN_CLINIC        // used during appointment (treatment plan)
  RETURNED_TO_SUPPLIER
  EXPIRED_DISPOSAL
  WASTED_CONTROLLED          // controlled substance waste (requires witness)
  STOCK_ADJUSTMENT_INCREASE
  STOCK_ADJUSTMENT_DECREASE
  TRANSFER_IN
  TRANSFER_OUT
  THEFT_LOSS
  INITIAL_COUNT
}

// Update InventoryStockMovement:
model InventoryStockMovement {
  id             String               @id @default(uuid())
  itemId         String
  batchId        String?
  change         Int                  // positive = in, negative = out
  reason         StockMovementReason
  referenceId    String?              // prescriptionId | appointmentId | purchaseOrderId
  referenceType  String?              // 'PRESCRIPTION' | 'APPOINTMENT' | 'PURCHASE_ORDER'
  userId         String?
  notes          String?
  witnessedBy    String?              // for WASTED_CONTROLLED
  createdAt      DateTime @default(now())

  @@index([itemId])
  @@index([batchId])
  @@index([reason, createdAt])
}
```

### Inventory API - Separation

| Method | Path                                  | Description                                        |
| ------ | ------------------------------------- | -------------------------------------------------- |
| GET    | `/fhir/v1/inventory/items`            | List (filter: category, controlled, species)       |
| POST   | `/fhir/v1/inventory/items`            | Create item                                        |
| GET    | `/fhir/v1/inventory/items/:id`        | Get item with batches                              |
| PATCH  | `/fhir/v1/inventory/items/:id`        | Update                                             |
| GET    | `/fhir/v1/inventory/items/medicines`  | Medicine-only list with drug details               |
| GET    | `/fhir/v1/inventory/items/controlled` | Controlled substances only                         |
| POST   | `/fhir/v1/inventory/batches`          | Add batch (purchase received)                      |
| GET    | `/fhir/v1/inventory/batches`          | List batches (filter: expiring-soon)               |
| POST   | `/fhir/v1/inventory/stock-movements`  | Record manual adjustment                           |
| GET    | `/fhir/v1/inventory/stock-movements`  | Movement log                                       |
| GET    | `/fhir/v1/inventory/vendors`          | List vendors                                       |
| POST   | `/fhir/v1/inventory/vendors`          | Create vendor                                      |
| GET    | `/fhir/v1/inventory/alerts`           | Low stock + expiry alerts                          |
| GET    | `/fhir/v1/inventory/search-drug`      | Search drug by generic/brand name (for Rx builder) |

---

## 14. Templates Module - New

### Template Types

```prisma
enum TemplateType {
  SOAP
  PHYSICAL_EXAM
  DISCHARGE_INSTRUCTIONS
  PRESCRIPTION_DEFAULTS  // default dosing for common cases
  CONSENT_FORM
  TASK
  TREATMENT_PLAN
  OBSERVATION
  DAILY_ROUNDS
}

enum TemplateScope {
  YC_GLOBAL    // YC super-admin, read-only for orgs
  ORG_CUSTOM   // org-created or forked from YC_GLOBAL
}

enum TemplateStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

model Template {
  id             String         @id @default(uuid())
  organisationId String?        // null = YC_GLOBAL
  scope          TemplateScope
  type           TemplateType
  name           String
  description    String?
  version        Int            @default(1)
  status         TemplateStatus @default(DRAFT)

  // Species filter (null = all)
  applicableSpecies   String[] @default([])
  // Appointment kind filter
  applicableKinds     String[] @default(["OUTPATIENT", "INPATIENT"])

  // Template body (type-specific JSON)
  body           Json
  // For SOAP: { subjectivePrompts, objectiveSystems, assessmentTemplate, planTemplate }
  // For DISCHARGE: { sections: [{ title, content, required }] }
  // For TASK: { taskKind, defaultTitle, defaultInstructions, defaultPriority, recurrenceConfig }
  // For CONSENT: { title, body (markdown), requiredSigners }
  // For PRESCRIPTION_DEFAULTS: { drugs: [{genericName, defaultDose, frequency, route, duration}] }

  // Variables for UI hint
  variables      String[]       @default([])  // ['{{patientName}}', '{{vetName}}']

  // Usage tracking
  usageCount     Int            @default(0)
  lastUsedAt     DateTime?

  // Parent (for forked org copies)
  parentTemplateId String?

  createdBy      String?
  publishedBy    String?
  publishedAt    DateTime?

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  deletedAt      DateTime?

  @@index([organisationId, type, status])
  @@index([scope, type])
}
```

---

## 15. Finance / Billing - Agnostic Redesign

### Core Changes from Current Implementation

1. Remove all `stripe*` fields from Invoice - move to `payments[]` array
2. Combined invoice: one invoice per appointment (not multiple)
3. Partial payments, cash, offline supported
4. Security deposit as first-class workflow
5. Insurance fields (schema-ready, no third-party integration)
6. Every payment action tracked with userId

### Payment Gateway Interface

```typescript
// packages/types/src/payment-gateway.ts
export interface IPaymentGateway {
  readonly provider: string; // 'STRIPE' | 'RAZORPAY' | 'ADYEN'

  createCheckoutSession(params: {
    lineItems: { name: string; amountCents: number; quantity: number }[];
    currency: string;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
    idempotencyKey: string;
  }): Promise<{ gatewaySessionId: string; checkoutUrl: string }>;

  refundPayment(params: {
    gatewayPaymentId: string;
    amountCents?: number;
    reason?: string;
    idempotencyKey: string;
  }): Promise<{ refundId: string; status: string }>;

  getPaymentStatus(gatewayPaymentId: string): Promise<{
    status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';
    amountCents: number;
    receiptUrl?: string;
  }>;

  handleWebhook(payload: Buffer, signature: string): Promise<WebhookEvent>;
}

// Stripe implementation: apps/backend/src/payment-gateways/stripe.gateway.ts
// Future: RazorpayGateway, AdyenGateway, SquareGateway
```

### New Invoice Prisma Schema

```prisma
enum InvoiceStatus {
  DRAFT
  ISSUED
  PARTIALLY_PAID
  PAID
  OVERDUE
  VOID
  REFUNDED
}

model Invoice {
  id              String        @id @default(uuid())
  organisationId  String
  appointmentId   String?
  companionId     String
  parentId        String
  invoiceNumber   String        @unique  // ORG-YEAR-SEQ e.g. 'YC-2026-00143'
  status          InvoiceStatus @default(DRAFT)

  // Line items (from treatment plan + labs + services)
  lineItems       Json
  // [{
  //   description: string, type: 'SERVICE'|'MEDICATION'|'LAB'|'PROCEDURE'|'CONSUMABLE'|'DEPOSIT'|'DISCOUNT'|'TAX',
  //   serviceId?: string, quantity: number, unitPriceCents: number,
  //   discountPercent?: number, discountCents?: number,
  //   taxPercent?: number, taxCents?: number, totalCents: number,
  //   aahaCode?: string
  // }]

  // Totals (all in smallest currency unit, e.g. cents)
  subtotalCents       Int    @default(0)
  discountTotalCents  Int    @default(0)
  taxTotalCents       Int    @default(0)
  totalAmountCents    Int    @default(0)
  paidAmountCents     Int    @default(0)
  balanceCents        Int    @default(0)

  currency            String  // ISO 4217

  // Discount config
  maxDiscountPercent        Float @default(0)
  defaultDiscountPercent    Float @default(0)
  customDiscountPercent     Float?
  customDiscountAppliedBy   String?
  customDiscountReason      String?
  overallNetDiscountPercent Float?

  // Payments made (supports multiple partial payments)
  payments        Json    @default("[]")
  // [{
  //   paymentId: string (our uuid), gateway: string,
  //   gatewayPaymentId?: string, gatewaySessionId?: string,
  //   method: 'ONLINE'|'CASH'|'CARD_PRESENT'|'BANK_TRANSFER'|'INSURANCE'|'DEPOSIT_WITHDRAWAL',
  //   amountCents: number, currency: string,
  //   status: 'PENDING'|'SUCCEEDED'|'FAILED'|'REFUNDED',
  //   paidAt?: string, receiptUrl?: string, checkoutUrl?: string,
  //   recordedBy: string (userId), notes?: string
  // }]

  // Refunds
  refunds         Json    @default("[]")
  // [{ refundId, gatewayRefundId?, amountCents, reason, refundedAt, refundedBy }]

  // Security deposit
  depositCollected       Boolean @default(false)
  depositAmountCents     Int     @default(0)
  depositCollectedAt     DateTime?
  depositCollectedBy     String?
  depositWithdrawn       Boolean @default(false)
  depositWithdrawnAt     DateTime?
  depositWithdrawnBy     String?
  depositWithdrawnReason String?

  // Insurance (schema-ready, no third-party integration)
  insuranceProvider    String?
  insurancePolicyNumber String?
  insuranceClaimRef    String?
  insuranceCoverageAmountCents Int?
  insuranceClaimStatus String?  // 'PENDING'|'APPROVED'|'REJECTED'|'PARTIAL'
  insuranceSubmittedAt DateTime?

  issuedAt        DateTime?
  dueAt           DateTime?
  pdfS3Key        String?

  // Audit log (every financial action)
  auditLog        Json    @default("[]")
  // [{ action, performedBy, performedAt, details? }]

  notes           String?
  internalNotes   String?
  createdBy       String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime?

  @@index([organisationId, status, createdAt])
  @@index([parentId, status])
  @@index([appointmentId])
  @@index([invoiceNumber])
}
```

### Finance API

| Method | Path                                      | Description                            |
| ------ | ----------------------------------------- | -------------------------------------- |
| POST   | `/fhir/v1/invoices`                       | Create invoice (from treatment plan)   |
| GET    | `/fhir/v1/invoices`                       | List (filter: status, date, companion) |
| GET    | `/fhir/v1/invoices/:id`                   | Get with full payment history          |
| PATCH  | `/fhir/v1/invoices/:id`                   | Update line items (DRAFT only)         |
| POST   | `/fhir/v1/invoices/:id/issue`             | Finalize and issue                     |
| POST   | `/fhir/v1/invoices/:id/payments`          | Record payment (cash/online)           |
| POST   | `/fhir/v1/invoices/:id/payments/checkout` | Create online checkout session         |
| POST   | `/fhir/v1/invoices/:id/refund`            | Refund (full or partial)               |
| POST   | `/fhir/v1/invoices/:id/void`              | Void invoice                           |
| POST   | `/fhir/v1/invoices/:id/generate-pdf`      | Generate PDF                           |
| POST   | `/fhir/v1/invoices/:id/send-email`        | Email to parent                        |
| POST   | `/fhir/v1/invoices/:id/deposit/collect`   | Collect security deposit               |
| POST   | `/fhir/v1/invoices/:id/deposit/withdraw`  | Withdraw deposit                       |
| GET    | `/fhir/v1/finance/reports`                | Revenue reports                        |
| GET    | `/fhir/v1/finance/export`                 | QuickBooks-compatible CSV export       |

### QuickBooks-Compatible Export (AAHA COA Codes)

```typescript
export const AAHA_COA = {
  CONSULTATION: '4000',
  LABORATORY: '4100',
  PHARMACY: '4200',
  RADIOLOGY_IMAGING: '4300',
  SURGERY: '4400',
  HOSPITALIZATION: '4500',
  PREVENTIVE_CARE: '4600',
  DENTAL: '4650',
  GROOMING: '4700',
  BOARDING: '4800',
  RETAIL_PRODUCTS: '4900',
  OTHER_REVENUE: '4950',
  DEPOSIT_LIABILITY: '2100',
};
```

---

## 16. Tasks Module - Improvements

### Current State

Existing `Task` model is good. The `TaskKind` enum has: `MEDICATION | OBSERVATION_TOOL | HYGIENE | DIET | CUSTOM`.

### What to Add

```prisma
// Extend TaskKind enum
enum TaskKind {
  // - existing -
  MEDICATION        // administer a drug (links to Prescription or TreatmentPlanItem)
  OBSERVATION_TOOL  // use a clinical OT: grimace scale (CGS/FGS/EGS), dental index, BCS wheel
  HYGIENE           // wound care, ear clean, anal gland expression, bandage change
  DIET              // feeding instruction (type, amount, frequency)
  CUSTOM            // free-text task, no structured linkage

  // - ADD -
  VITALS_RECORDING  // opens AppointmentVitals form on completion; links to vital recording service
  PROCEDURE         // surgical or diagnostic procedure (links to TreatmentPlanItem.serviceId)
  FOLLOW_UP         // re-evaluation by vet; can auto-create a child appointment
  CONSENT           // obtain signature on a consent form (links to Template.type=CONSENT_FORM)
  LAB_ORDER         // submit a lab panel; completing the task creates a LabOrder record
  VACCINATION       // administer and record a vaccine (links to VaccinationRecord)
  EXERCISE          // physiotherapy / controlled exercise (duration, type, supervision level)
}
```

### Task Kind Behaviour Matrix

| Kind               | Completes When     | Auto-Side Effects                                                                             |
| ------------------ | ------------------ | --------------------------------------------------------------------------------------------- |
| `MEDICATION`       | Staff marks given  | Deducts stock from inventory (if linked to prescription/batch)                                |
| `OBSERVATION_TOOL` | OT result recorded | Score stored in `Task.result`; alerts if threshold breached                                   |
| `VITALS_RECORDING` | Vitals form saved  | Creates `AppointmentVitals`; updates `DailyRound.vitalsId`; marks service line item delivered |
| `HYGIENE`          | Staff marks done   | No auto side-effects; notes stored in `Task.notes`                                            |
| `DIET`             | Staff confirms fed | No auto side-effects                                                                          |
| `PROCEDURE`        | Vet marks complete | Marks `TreatmentPlanItem` as done; triggers invoice line item                                 |
| `FOLLOW_UP`        | Vet closes re-eval | Optionally creates a new outpatient appointment                                               |
| `CONSENT`          | Signature captured | Updates `AppointmentClinicalFlags.isConsentSigned`                                            |
| `LAB_ORDER`        | Order submitted    | Creates `LabOrder` record; BullMQ polls for results                                           |
| `VACCINATION`      | Vaccine given      | Creates `VaccinationRecord`; schedules booster reminder task                                  |
| `EXERCISE`         | Session complete   | Duration + type logged                                                                        |
| `CUSTOM`           | Staff marks done   | No auto side-effects                                                                          |

### Observation Tool (OT) - Grimace Scale Detail

OTs of `OBSERVATION_TOOL` kind are pre-configured tools that map to structured assessment widgets. The three grimace scales are first-class OTs:

| OT Slug  | Species | Scale                              | Fields Populated                                                                                                      |
| -------- | ------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `ot-cgs` | dog     | Canine Grimace Scale (5 AUs × 0-2) | `cgsOrbitalTightening`, `cgsCheekTightening`, `cgsEarPosition`, `cgsMuzzleContraction`, `cgsHeadPosition`, `cgsTotal` |
| `ot-fgs` | cat     | Feline Grimace Scale (5 AUs × 0-2) | `fgsOrbitalTightening`, `fgsMuzzleContraction`, `fgsWhiskerChange`, `fgsEarPosition`, `fgsHeadPosition`, `fgsTotal`   |
| `ot-egs` | horse   | Equine Grimace Scale (5 AUs × 0-2) | `egsOrbitalTightening`, `egsLoweredHeadPos`, `egsEarPosition`, `egsAnkleMuscle`, `egsNostrilMouth`, `egsTotal`        |

When a task with `kind=OBSERVATION_TOOL` is linked to one of these OT slugs, completing the task:

1. Opens the species-matched grimace scale widget (renders reference photos alongside each AU slider)
2. On submit, writes AU scores to the corresponding `cgs*`/`fgs*`/`egs*` fields on `AppointmentVitals`
3. Sets `painScaleUsed = 'CGS'|'FGS'|'EGS'` and computes the normalised `painScore`
4. Triggers alert if total ≥ 6/10 (threshold configurable per org in `Organisation.complianceConfig`)

**Add to Task model:**

```prisma
model Task {
  // existing fields - keep all
  // ADD:
  priority      TaskPriority  @default(MEDIUM)
  dueAt         DateTime      // already exists, confirm
  // ADD: appointment in-patient schedule
  isInPatientSchedule Boolean @default(false)
  scheduledForDate    DateTime?  // for recurring in-patient daily tasks
}

enum TaskPriority {
  HIGH
  MEDIUM
  LOW
}
```

**Board/calendar views:**

- Task list: filterable by priority, assignee, status, date, kind
- In-patient schedule: daily task list per admitted companion
- Recurring task master → child relationship already exists via `recurrence.isMaster` + `recurrence.masterTaskId`

---

## 17. In-Patient Module - New

### Ward Management

```prisma
model Ward {
  id             String   @id @default(uuid())
  organisationId String
  name           String   // 'ICU', 'General', 'Isolation', 'Recovery', 'Post-Op'
  capacity       Int
  isActive       Boolean  @default(true)

  beds           Json     @default("[]")
  // [{ bedNumber: string, isOccupied: boolean, currentAppointmentId?: string }]

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([organisationId])
  @@unique([organisationId, name])
}
```

### In-Patient Daily Rounds

```prisma
model DailyRound {
  id             String   @id @default(uuid())
  appointmentId  String
  organisationId String
  companionId    String
  recordedBy     String
  roundDate      DateTime
  vitalsId       String?  // ref to AppointmentVitals
  notes          String
  clinicalStatus String?  // 'IMPROVING'|'STABLE'|'DECLINING'|'CRITICAL'
  medicationsGiven Json?
  proceduresDone   Json?
  nextRoundNotes   String?

  createdAt      DateTime @default(now())

  @@index([appointmentId, roundDate])
}
```

### In-Patient API

| Method | Path                                     | Description                           |
| ------ | ---------------------------------------- | ------------------------------------- |
| GET    | `/fhir/v1/appointments/inpatient`        | All admitted patients (calendar data) |
| POST   | `/fhir/v1/appointments/:id/admit`        | Admit patient to ward/bed             |
| POST   | `/fhir/v1/appointments/:id/daily-round`  | Record daily round                    |
| GET    | `/fhir/v1/appointments/:id/daily-rounds` | All rounds history                    |
| GET    | `/fhir/v1/wards`                         | List wards with occupancy             |
| POST   | `/fhir/v1/wards`                         | Create ward                           |
| PATCH  | `/fhir/v1/wards/:id`                     | Update ward                           |
| PATCH  | `/fhir/v1/wards/:wardId/beds/:bedNumber` | Assign/release bed                    |

---

## 18. Discharge Module - New

```prisma
enum DischargeStatus {
  DRAFT
  READY
  SENT
  COMPLETED
}

model Discharge {
  id             String        @id @default(uuid())
  appointmentId  String        @unique
  organisationId String
  companionId    String
  parentId       String
  createdBy      String
  status         DischargeStatus @default(DRAFT)
  templateId     String?

  // Summary
  finalDiagnosis        String?
  proceduresPerformed   String[] @default([])
  clinicalNotes         String?

  // Instructions (structured)
  activityRestrictions  String?
  dietInstructions      String?
  woundCare             String?
  bathingRestrictions   String?
  followUpDate          DateTime?
  followUpNotes         String?
  warningSignsToWatch   String[] @default([])
  emergencyInstructions String?
  customSections        Json?    // [{ title, content }]

  // Medications sent home
  medicationsSentHome   Json     @default("[]")
  // [{ prescriptionId, drugName, dose, frequency, duration, instructions }]

  // Auto-generated tasks on discharge
  generatedTaskIds      String[] @default([])

  // PDF + delivery
  pdfS3Key        String?
  pdfGeneratedAt  DateTime?
  emailSentAt     DateTime?
  emailSentTo     String?
  parentAcknowledgedAt DateTime?

  // Legal
  legalDisclaimer       String?
  signatureRequired     Boolean  @default(false)
  signatureFormSubmissionId String?

  dischargedAt    DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([appointmentId])
  @@index([organisationId])
}
```

---

## 19. Dental & Bone Charts - New

### Species → Dental Formula

| Species | Formula                   | Total Teeth |
| ------- | ------------------------- | ----------- |
| dog     | 2×(I3/3 C1/1 P4/4 M2/3)   | 42          |
| cat     | 2×(I3/3 C1/1 P3/2 M1/1)   | 30          |
| horse   | 2×(I3/3 C1/1 P3-4/3 M3/3) | 40-44       |
| other   | Free-text notes           | N/A         |

### Triadan Notation (Animals)

```
Quadrant 1 = Upper Right (101-111)
Quadrant 2 = Upper Left  (201-211)
Quadrant 3 = Lower Left  (301-311)
Quadrant 4 = Lower Right (401-411)
```

### Prisma Schema

```prisma
model DentalChart {
  id             String   @id @default(uuid())
  appointmentId  String
  organisationId String
  companionId    String
  species        String   // 'dog'|'cat'|'horse'|'other'
  recordedBy     String
  recordedAt     DateTime @default(now())

  overallDentalScore Int?  // AVDC 0-4

  teeth          Json     @default("[]")
  // [{
  //   triadan: string,      // e.g. '101'
  //   quadrant: 1|2|3|4,
  //   position: number,
  //   toothType: 'INCISOR'|'CANINE'|'PREMOLAR'|'MOLAR',
  //   conditions: string[], // 'NORMAL'|'MISSING'|'FRACTURED'|'CARIES'|'RESORPTION'|
  //                         // 'FURCATION'|'PERIODONTAL'|'EXTRACTION_RECOMMENDED'|'EXTRACTED'|
  //                         // 'CROWN'|'ROOT_REMNANT'
  //   probingDepthMm?: number,
  //   mobilityGrade?: 0|1|2|3,
  //   furcationGrade?: 0|1|2|3,
  //   recessionMm?: number,
  //   notes?: string
  // }]

  periodontitisStage Int?  // AVDC 0-4
  overallNotes       String?
  recommendedTreatments String[] @default([])
  pdfS3Key          String?
  soapId            String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([appointmentId])
  @@index([companionId, createdAt])
}

model BoneChart {
  id             String   @id @default(uuid())
  appointmentId  String
  organisationId String
  companionId    String
  species        String
  recordedBy     String
  recordedAt     DateTime @default(now())

  findings       Json     @default("[]")
  // [{
  //   region: string,   // 'FEMUR_LEFT'|'LUMBAR_L4'|'TIBIA_RIGHT' etc.
  //   condition: 'NORMAL'|'FRACTURE'|'LUXATION'|'ARTHRITIS'|'OSTEOLYSIS'|'OSTEOPROLIFERATION'|'ABNORMAL',
  //   severity?: 'MILD'|'MODERATE'|'SEVERE',
  //   notes?: string,
  //   imagingReference?: string
  // }]

  overallNotes   String?
  soapId         String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([appointmentId])
}
```

### Side Modal Access Rules

```
Dental Chart : status IN [IN_PROGRESS, AWAITING_DISCHARGE] AND species IN [dog, cat, horse]
Bone Chart   : status IN [IN_PROGRESS, AWAITING_DISCHARGE]
Vitals       : status IN [CHECKED_IN, TRIAGE_PENDING, IN_PROGRESS, ADMITTED]
Chat         : always
Activity     : always
MSD (Medical Side Drawer) : always - shows: latest vitals, allergies, active meds, diagnoses
```

---

## 20. Lab Integration - Agnostic Layer

### ILabProvider Interface

```typescript
// packages/types/src/lab-provider.ts
export interface ILabProvider {
  readonly providerSlug: string; // 'idexx' | 'antech' | 'zoetis' | 'in-house'
  readonly supportsOrders: boolean;
  readonly supportsResultPolling: boolean;

  getAvailableTests(species?: string): Promise<LabTest[]>;
  submitOrder(params: LabOrderSubmitParams): Promise<{ providerOrderId: string }>;
  getOrderStatus(providerOrderId: string): Promise<LabOrderStatus>;
  getResults(providerOrderId: string): Promise<LabResult[]>;
  syncPendingResults(since: Date): Promise<LabResultBatch[]>;
}

// IDEXX existing implementation → refactor to implement this interface
// class IDEXXProvider implements ILabProvider { ... }
// class InHouseProvider implements ILabProvider { ... }
// Future: AnchProvider, ZoetisProvider
```

### Lab → Invoice Integration Rule

**Every lab test ordered = one line item on the appointment invoice.**
No separate invoice for labs. The lab service has a `serviceId` on the `LabOrder` which the invoice service uses to add the line item.

### Updated LabOrder (add to Prisma schema)

```prisma
// Add to existing LabOrder model:
  tests            Json?     // [{ testCode, testName, category, serviceId?, invoiceLineRef? }]
  specimenType     String?   // 'BLOOD'|'URINE'|'FECES'|'BIOPSY'|'SWAB'
  specimenCollectedBy String?
  // structured results (replace rawPayload where possible)
  structuredResults Json?
  // [{ testCode, testName, value, numericValue?, unit?, referenceRange?,
  //    abnormalFlag?: 'HIGH'|'LOW'|'CRITICAL_HIGH'|'CRITICAL_LOW'|'ABNORMAL',
  //    status: 'FINAL'|'PRELIMINARY'|'CORRECTED', resultedAt? }]
  dicomStudyUid    String?   // for imaging results
  imagingReportS3Key String?
  notifiedVetAt    DateTime?
```

---

## 21. Notification & Sync Bus - New

### Architecture

```
Event Bus (BullMQ - already installed)
    ↓
NotificationRouter
    ├── In-app WebSocket (Socket.IO)
    ├── Push (FCM - existing)
    ├── Email (Plunk / SMTP via IMailer)
    └── SMS (future)
```

### System Events

```typescript
export type SystemEvent =
  | 'appointment.status_changed'
  | 'appointment.triage_assigned'
  | 'appointment.marked_for_billing'
  | 'payment.received'
  | 'payment.failed'
  | 'invoice.issued'
  | 'form.signed'
  | 'lab_result.ready'
  | 'lab_result.critical'
  | 'task.due_soon'
  | 'task.overdue'
  | 'chat.new_message'
  | 'prescription.dispensed'
  | 'discharge.ready'
  | 'referral.received'
  | 'companion.vitals_alert';
```

### Mailing Service Migration (AWS SES → Plunk + Nodemailer)

```typescript
// packages/mailer/src/index.ts
export interface IMailer {
  sendTransactional(params: {
    to: string; subject: string;
    template: string; variables: Record<string, string | number>;
    attachments?: { filename: string; s3Key: string }[];
  }): Promise<{ messageId: string }>;
}

class PlunkMailer implements IMailer { ... }    // primary
class SmtpMailer implements IMailer { ... }    // self-hosted SMTP fallback
```

---

## 22. Documents Module Enhancement

### New Subcategories (replace existing ambiguous ones)

```typescript
export type DocumentSubcategory =
  | 'SOAP_NOTE'
  | 'PRESCRIPTION'
  | 'CONSENT_FORM'
  | 'DISCHARGE_SUMMARY'
  | 'VACCINATION_RECORD'
  | 'LAB_RESULT'
  | 'IMAGING_REPORT'
  | 'DENTAL_CHART'
  | 'INVOICE'
  | 'INSURANCE_DOCUMENT'
  | 'REFERRAL_LETTER'
  | 'MEDICAL_HISTORY'
  | 'PHOTO_CLINICAL'
  | 'PHOTO_ID'
  | 'HEALTH_CERTIFICATE'
  | 'BREEDING_RECORD'
  | 'MICROCHIP_RECORD'
  | 'LEGAL_DOCUMENT'
  | 'OTHER';
```

### S3 Key Structure

```
org/{orgId}/appointments/{appointmentId}/{subcategory}/{filename}
org/{orgId}/companions/{companionId}/{subcategory}/{filename}
org/{orgId}/general/{subcategory}/{filename}
```

---

## 23. Companion Profile Enhancement

### New Prisma Fields to Add

```prisma
model Companion {
  // existing fields - keep all
  // ADD:
  speciesLabel      String?    // free text for type='other' e.g. "Holland Lop Rabbit"
  insuranceProvider String?    // denormalized from insurance JSON for quick display
  emergencyContact  String?    // owner's emergency contact (or vet on call)
  bloodGroup        String?    // already exists in Mongoose - add to Prisma

  // QR / ID card
  qrCodeUrl         String?    // generated QR code image URL
  idCardPdfS3Key    String?    // generated ID card PDF S3 key
  idCardGeneratedAt DateTime?
}
```

### QR Code Payload

```typescript
interface CompanionQRPayload {
  companionId: string;
  name: string;
  species: string;
  microchip?: string;
  emergencyContact: string;
  emergencyPhone: string;
  profileUrl: string; // deep link: https://app.yosemitecrew.com/c/{companionId}
}
```

### Companion ID Card PDF Spec

```
Front:
  [ CLINIC LOGO ]  [ YC LOGO ]
  Photo (if available)
  Name: Buddy
  Species: Dog (Labrador Retriever)
  DOB: 14 Mar 2020 | Sex: Male
  Microchip: 981000012345678
  Vaccinations:
    Rabies - due Jan 2027
    DA2PP - due Mar 2027
  Blood Group: DEA 1.1+
  Allergies: Penicillin

Back:
  Owner: John Smith
  Phone: +44 7700 900123
  Clinic: Yosemite Veterinary Centre
  Clinic Phone: +44 20 1234 5678
  Current Medications: Apoquel 16mg SID
  Emergency: If found, call owner or clinic
  [ QR CODE ]
```

---

## 24. Triage System - New

### Levels (Manchester Triage adapted for Veterinary)

| Level | Name        | Color  | Max Wait  | Examples                                                                  |
| ----- | ----------- | ------ | --------- | ------------------------------------------------------------------------- |
| P1    | EMERGENCY   | Red    | Immediate | Cardiac arrest, severe trauma, respiratory failure, uncontrolled bleeding |
| P2    | URGENT      | Orange | 10 min    | Suspected fracture, severe pain, laboured breathing, urinary obstruction  |
| P3    | SEMI_URGENT | Yellow | 30 min    | Vomiting + lethargy, skin wound, mild respiratory signs                   |
| P4    | ROUTINE     | Green  | 60 min    | Annual wellness, mild dermatitis, weight recheck                          |
| P5    | NON_URGENT  | Grey   | 2 hours   | Paperwork, product collection, routine follow-up                          |

### Triage Queue Response

```typescript
GET /fhir/v1/appointments/triage-queue

// Response:
{
  queue: [{
    appointmentId: string;
    companionName: string;
    species: string;
    chiefComplaint: string;
    triageLevel: 'P1_EMERGENCY' | 'P2_URGENT' | 'P3_SEMI_URGENT' | 'P4_ROUTINE' | 'P5_NON_URGENT';
    triageNotes?: string;
    checkedInAt: Date;
    waitMinutes: number;           // computed from checkedInAt
    estimatedWaitMinutes?: number; // manually set by staff
    leadVetName?: string;
    clinicalFlags: { isVitalsRecorded: boolean; isSOAPSaved: boolean; };
  }],
  summary: { P1: 0, P2: 1, P3: 2, P4: 8, P5: 3 }
}
```

---

## 25. Refer Appointments - New

```prisma
enum ReferralStatus {
  PENDING
  ACCEPTED
  DECLINED
  COMPLETED
  EXPIRED
}

enum ReferralUrgency {
  EMERGENCY
  URGENT
  ROUTINE
}

model Referral {
  id                  String         @id @default(uuid())
  fromOrgId           String
  toOrgId             String?        // null if external (non-YC) clinic
  toOrgEmail          String?
  companionId         String
  sourceAppointmentId String
  newAppointmentId    String?        // created on acceptance

  urgency             ReferralUrgency
  reason              String
  specialityId        String?
  clinicalSummary     String?

  sharedDocumentIds   String[]       @default([])
  shareSOAP           Boolean        @default(false)
  shareLabResults     Boolean        @default(false)
  sharePrescriptions  Boolean        @default(false)

  status              ReferralStatus @default(PENDING)
  acceptedAt          DateTime?
  acceptedBy          String?
  declineReason       String?

  expiresAt           DateTime
  emailSentAt         DateTime?
  emailToken          String?        // for accept/decline via email link (no login)

  referredBy          String
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@index([fromOrgId])
  @@index([toOrgId, status])
  @@index([companionId])
}
```

---

## 26. Universal Search - New

```typescript
// PostgreSQL full-text search via Prisma raw queries + tsvector
// OR: pg_search extension

// Search entities: companions, parents, appointments, invoices, medications, services

GET /fhir/v1/search?q={query}&types=companion,parent&limit=20

// Response:
{
  results: [{
    type: 'companion';
    id: string;
    title: string;          // "Buddy"
    subtitle: string;       // "Labrador Retriever · Owner: John Smith"
    meta: { species: string; ... };
    score: number;          // relevance
    href: string;           // '/companions/...'
  }],
  total: 15, timingMs: 43
}
```

### PostgreSQL Full-Text Index

```sql
-- Add to Prisma migration
ALTER TABLE "Companion" ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(breed, '') || ' ' || coalesce("microchipNumber", ''))
  ) STORED;
CREATE INDEX companion_search_idx ON "Companion" USING GIN(search_vector);

ALTER TABLE "Parent" ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce("firstName", '') || ' ' || coalesce("lastName", '') || ' ' || coalesce(email, ''))
  ) STORED;
CREATE INDEX parent_search_idx ON "Parent" USING GIN(search_vector);
```

---

## 27. Audit Trail & Country Compliance

### Enhanced AuditTrail (existing model - extend)

```prisma
// Existing model - add fields:
model AuditTrail {
  // existing fields - keep
  // ADD:
  ipAddress      String?
  userAgent      String?
  before         Json?   // state before change
  after          Json?   // state after change
  severity       String? // 'LOW'|'MEDIUM'|'HIGH'|'CRITICAL'
  exportedAt     DateTime? // null = not yet in compliance export
  exportRef      String?
}
```

### Country Compliance: Spain (AEMPS 14-day Controlled Substance Export)

```typescript
// apps/backend/src/compliance/spain-aemps.exporter.ts
interface AEMPSAuditRow {
  fecha: string; // DD/MM/YYYY
  veterinario: string; // COLVEMA vet license
  clinica: string; // clinic registration number
  paciente: string; // animal name
  especie: string;
  propietario: string;
  medicamento: string; // brand name
  principioActivo: string; // generic/active substance
  cantidad: number;
  unidad: string;
  nLote?: string;
  indicacion: string;
  tipoPrescripcion: 'USO_VETERINARIO' | 'RECETA';
}
// Export every 14 days as CSV/XML, stored with nextAuditExportDue tracking on Organization
```

### Country Compliance: UK (RCVS Controlled Drug Register)

```typescript
interface RCVSControlledDrugEntry {
  date: string;
  drug: string;
  schedule: string;
  supplierOrRecipient: string;
  qtyReceived?: number;
  qtySupplied?: number;
  balance: number;
  vetSignature: string;
}
```

### Generic Compliance Export API

```
POST /fhir/v1/compliance/export
Body: { type: 'CONTROLLED_SUBSTANCES' | 'FULL_AUDIT', from: Date, to: Date, format: 'CSV' | 'XML' }

GET /fhir/v1/compliance/exports         → list past exports
GET /fhir/v1/compliance/exports/:id/download
GET /fhir/v1/compliance/next-due        → { nextDue: Date, daysRemaining: number }
```

---

## 28. Reports & Data Export

### Standard Reports

| Report                         | Export formats            |
| ------------------------------ | ------------------------- |
| Daily appointment summary      | PDF, CSV                  |
| Revenue by period/service/vet  | PDF, CSV, QuickBooks IIF  |
| Controlled substance DEA log   | PDF, CSV, AEMPS XML       |
| Vaccination due list           | CSV, Email                |
| Outstanding lab orders         | CSV                       |
| Overdue invoices (aging)       | PDF, CSV                  |
| Companion full medical history | PDF, FHIR Bundle, HL7 CCD |
| Stock expiry report            | CSV                       |

### Data Portability

```
POST /fhir/v1/data-export          → triggers async job → { jobId, estimatedMinutes }
GET  /fhir/v1/data-export/:jobId   → { status: 'PENDING'|'READY'|'FAILED', downloadUrl?, expiresAt? }
```

Includes: all companions, parents, appointments, SOAP notes, prescriptions, invoices, lab results, documents, audit trail.
Formats: JSON + CSV (structured), FHIR Bundle (medical), HL7 v2.5 messages.

---

## 29. Developer Portal & Integration Marketplace

### API Key Model

```prisma
model ApiKey {
  id             String   @id @default(uuid())
  organisationId String
  name           String
  keyPrefix      String   // first 8 chars shown in UI
  keyHash        String   // bcrypt hash of full key
  scopes         String[] @default([])
  rateLimitRpm   Int      @default(60)
  rateLimitRpd   Int      @default(10000)
  allowedIps     String[] @default([])
  lastUsedAt     DateTime?
  expiresAt      DateTime?
  isActive       Boolean  @default(true)
  createdBy      String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([organisationId])
  @@index([keyPrefix])
}
```

### Integration Registry (new table)

```prisma
model IntegrationDefinition {
  id              String   @id @default(uuid())
  slug            String   @unique
  name            String
  category        String   // 'PAYMENT'|'LAB'|'EMAIL'|'AI'|'IMAGING'|'INSURANCE'|'ACCOUNTING'|'TELEHEALTH'
  description     String
  logoUrl         String?
  docsUrl         String?
  requiredCredentials Json  // [{ key, label, type: 'TEXT'|'SECRET'|'URL', helpText? }]
  isOfficial      Boolean  @default(false)
  isCommunity     Boolean  @default(false)
  isActive        Boolean  @default(true)
  implementationClass String  // e.g. 'StripeGateway'
  version         String

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### Webhook Subscription

```prisma
model WebhookSubscription {
  id             String   @id @default(uuid())
  organisationId String
  url            String
  events         String[] // SystemEvent values
  secret         String   // HMAC-SHA256 signing secret
  isActive       Boolean  @default(true)
  lastDeliveredAt DateTime?
  failureCount   Int      @default(0)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([organisationId])
}
// Delivery: exponential backoff 3 attempts
// Header: X-YC-Signature: sha256={hmac}
```

---

## 30. Payment Gateway Abstraction

Already defined in Section 15. Summary:

```typescript
// Stripe: apps/backend/src/payment-gateways/stripe.gateway.ts
class StripeGateway implements IPaymentGateway {
  // wraps existing stripe.service.ts - remove direct Stripe calls from invoice service
}

// Gateway selected via:
// org.activePaymentGateway → 'STRIPE'
// Credentials from: IntegrationAccount table (encrypted)
```

---

## 31. AI Integration Framework

### IAIProvider Interface

```typescript
// packages/types/src/ai-provider.ts
export interface IAIProvider {
  readonly providerName: string;

  generateSOAPDraft(params: {
    transcript?: string;
    chiefComplaint: string;
    species: string;
    vitals?: object;
    previousSOAP?: object;
    patientHistory?: string;
  }): Promise<{ soap: object; confidence: number; model: string }>;

  checkDrugInteractions(genericNames: string[]): Promise<{
    interactions: { drugs: string[]; severity: string; description: string }[];
  }>;

  summarizeDocument(
    text: string,
    type: 'SOAP' | 'DISCHARGE' | 'LAB'
  ): Promise<{
    summary: string;
    keyFindings: string[];
  }>;

  transcribeAudio(
    audioBuffer: Buffer,
    language?: string
  ): Promise<{
    transcript: string;
    confidence: number;
    durationSeconds: number;
  }>;
}

// Anthropic Claude implementation (primary):
// apps/backend/src/ai-providers/anthropic.provider.ts
// OpenAI implementation:
// apps/backend/src/ai-providers/openai.provider.ts
```

### AI Audit Log (Every AI Action Logged)

```prisma
model AIAuditLog {
  id             String   @id @default(uuid())
  organisationId String
  userId         String
  appointmentId  String?
  feature        String   // 'SOAP_DRAFT'|'DRUG_INTERACTION'|'TRANSCRIPTION'|'DOC_SUMMARY'
  provider       String
  model          String
  promptTokens   Int?
  completionTokens Int?
  latencyMs      Int
  confidence     Float?
  userAction     String   // 'ACCEPTED'|'PARTIALLY_ACCEPTED'|'REJECTED'|'NOT_REVIEWED'
  modifications  Json?    // [{ field, original, edited }]
  estimatedCostUsd Float?
  timestamp      DateTime @default(now())

  @@index([organisationId, timestamp])
  @@index([appointmentId])
}
```

---

## 32. Mobile App - New Screens & Offline-First

### Offline-First Architecture

```
App Layer (React Native)
  ↓
MMKV (fast key-value) + SQLite (structured local cache)
  ↓
SyncManager (queues writes when offline, resolves conflicts when online)
  ↓
Backend API
```

**Conflict resolution:** Server timestamp wins. SOAP edits show a merge UI for the vet.

### New Screens

| Screen                   | Purpose                             | Min Role  |
| ------------------------ | ----------------------------------- | --------- |
| Triage Queue             | Real-time triage list               | VET, TECH |
| In-Patient Board         | Admitted patients with daily rounds | VET, TECH |
| Vitals Entry             | Species-aware vitals form           | VET, TECH |
| SOAP Entry               | Structured SOAP with AI draft       | VET       |
| Dental Chart View        | Read-only dental chart              | VET, TECH |
| Prescription Detail      | Rx + instructions (parent view)     | ALL       |
| QR Companion Card        | QR code display for ID              | ALL       |
| Referral Accept/Reject   | Token-based from email link         | ALL       |
| Controlled Substance Log | Quick CS log entry                  | VET       |
| Discharge Summary View   | Parent view                         | PARENT    |

---

## 33. Frontend - New Screens & Components

### New Pages

| Route                              | Component                | Description                             |
| ---------------------------------- | ------------------------ | --------------------------------------- |
| `/appointments/board`              | `AppointmentBoard`       | Kanban - hide/show columns, bulk status |
| `/appointments/triage`             | `TriageQueue`            | Real-time triage queue, colour-coded    |
| `/appointments/inpatient`          | `InPatientCalendar`      | Separate calendar for admitted patients |
| `/appointments/:id/soap`           | `SOAPEntry`              | Structured SOAP form                    |
| `/appointments/:id/vitals`         | `VitalsEntry`            | Species-aware vitals                    |
| `/appointments/:id/prescription`   | `PrescriptionBuilder`    | Drug search + dosage calculator         |
| `/appointments/:id/treatment-plan` | `TreatmentPlan`          | Services/meds/procedures builder        |
| `/appointments/:id/discharge`      | `DischargeForm`          | Template-based discharge                |
| `/companions/:id/dental-chart`     | `DentalChart`            | Interactive SVG dental chart            |
| `/companions/:id/qr-card`          | `CompanionIDCard`        | QR + printable ID card                  |
| `/lab-orders`                      | `LabOrdersPage`          | All lab orders with status              |
| `/reports`                         | `ReportBuilder`          | Select, date range, export              |
| `/compliance`                      | `CompliancePage`         | Audit exports, next due dates           |
| `/developers`                      | `DeveloperPortal`        | API keys, webhooks                      |
| `/developers/marketplace`          | `IntegrationMarketplace` | Browse + activate integrations          |
| `/search`                          | `UniversalSearch`        | Global search results                   |
| `/audit`                           | `AuditTrailPage`         | Timeline with filters                   |

### Side Modal System (Appointment Detail)

```typescript
type SideModalTab =
  | 'VITALS' // AppointmentVitals form + history
  | 'CHAT' // Existing chat session
  | 'ACTIVITY' // Status history + audit events
  | 'MSD' // Medical Side Drawer: vitals summary, allergies, meds, diagnoses
  | 'DENTAL' // DentalChart (IN_PROGRESS+ only)
  | 'BONE' // BoneChart (IN_PROGRESS+ only)
  | 'LABS' // Lab orders + results
  | 'DOCUMENTS'; // Appointment documents
```

Each tab must:

- Have `role="tabpanel"`, `tabIndex={0}`, `aria-labelledby`
- Load lazily (only fetch data on tab activation)
- Show skeleton while loading, `aria-busy={true}`

---

## 34. Database Indexing Strategy (PostgreSQL)

```sql
-- Core indexes (add via Prisma migrations)

-- Appointments
CREATE INDEX idx_appt_org_status_date    ON "Appointment"("organisationId", status, "scheduledDate" DESC);
CREATE INDEX idx_appt_org_vet_date       ON "Appointment"("organisationId", "leadVetId", "scheduledDate");
CREATE INDEX idx_appt_companion          ON "Appointment"("companionId", "scheduledDate" DESC);
CREATE INDEX idx_appt_org_triage         ON "Appointment"("organisationId", "triageLevel", status);
CREATE INDEX idx_appt_org_kind_status    ON "Appointment"("organisationId", kind, status);

-- Invoices
CREATE UNIQUE INDEX idx_invoice_number ON "Invoice"("invoiceNumber");
CREATE INDEX idx_invoice_org_status    ON "Invoice"("organisationId", status, "createdAt" DESC);
CREATE INDEX idx_invoice_parent        ON "Invoice"("parentId", status);
CREATE INDEX idx_invoice_appointment   ON "Invoice"("appointmentId");

-- Tasks
CREATE INDEX idx_task_assignee_due     ON "Task"("assignedTo", "dueAt");
CREATE INDEX idx_task_companion_due    ON "Task"("companionId", "dueAt");
CREATE INDEX idx_task_org_due          ON "Task"("organisationId", "dueAt");

-- Prescriptions
CREATE INDEX idx_rx_appointment        ON "Prescription"("appointmentId");
CREATE INDEX idx_rx_org_dispensed      ON "Prescription"("organisationId", "dispensedAt");
CREATE INDEX idx_rx_companion          ON "Prescription"("companionId");

-- Controlled substances
CREATE INDEX idx_cs_org_date           ON "ControlledSubstanceLog"("organisationId", "performedAt" DESC);
CREATE INDEX idx_cs_org_exported       ON "ControlledSubstanceLog"("organisationId", "exportedAt");

-- SOAP
CREATE UNIQUE INDEX idx_soap_appointment ON "AppointmentSOAP"("appointmentId");
CREATE INDEX idx_soap_companion          ON "AppointmentSOAP"("companionId", "createdAt" DESC);

-- Inventory
CREATE INDEX idx_inv_org_category       ON "InventoryItem"("organisationId", category);
CREATE INDEX idx_inv_controlled         ON "InventoryItem"("organisationId", "isControlledSubstance");
CREATE INDEX idx_inv_batch_expiry       ON "InventoryBatch"("organisationId", "expiryDate");

-- Audit trail
CREATE INDEX idx_audit_org_time         ON "AuditTrail"("organisationId", timestamp DESC);
CREATE INDEX idx_audit_appointment      ON "AuditTrail"("appointmentId", timestamp DESC);
CREATE INDEX idx_audit_exported         ON "AuditTrail"("organisationId", "exportedAt");

-- Full-text search (see Section 26)
```

---

## 35. API Design Standards

### Cursor-Based Pagination

```typescript
// Request
GET /fhir/v1/appointments?cursor=eyJpZCI6Ii4uLiJ9&limit=25&sort=scheduledDate:desc

// Response
{
  data: [...],
  pagination: {
    cursor: string,       // base64(lastItem.id + sort field)
    nextCursor: string | null,
    hasMore: boolean,
    total: number         // only on first page (no cursor)
  }
}
```

### Error Response

```typescript
interface APIError {
  status: number; // HTTP status
  code: string; // 'APPOINTMENT_NOT_FOUND' | 'INVALID_TRIAGE_LEVEL' | ...
  message: string; // human-readable English
  field?: string; // for validation errors
  requestId: string; // UUID for support tracing
  timestamp: string; // ISO 8601
}
```

### Idempotency (Payments & Mutations)

```
POST /fhir/v1/invoices/:id/payments
Headers:
  Idempotency-Key: <uuid-v4>
// Server: store key for 24h, return same response if duplicate
```

### Response Envelope

```typescript
interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: APIError;
  meta?: { requestId: string; version: string; timingMs: number };
}
```

---

## 36. Security Checklist

| Category      | Requirement                                          | Status                               |
| ------------- | ---------------------------------------------------- | ------------------------------------ |
| Auth          | SuperTokens rotating refresh tokens                  | To implement                         |
| Auth          | MFA/TOTP on vet+admin accounts                       | To implement                         |
| Auth          | API key scoping (least privilege)                    | To implement                         |
| Auth          | Webhook HMAC-SHA256 signing                          | To implement                         |
| Input         | Zod validation on all request bodies                 | Partial (Zod present)                |
| Input         | NoSQL/SQL injection: Prisma parameterised queries    | ✓ Prisma handles this                |
| Input         | `express-mongo-sanitize`                             | Remove after full Postgres migration |
| Data          | Encrypt PII at rest: microchip, DEA log, insurance   | To implement                         |
| Data          | S3 SSE for file storage                              | To verify                            |
| CORS          | Strict allowlist, no wildcard in production          | To verify                            |
| Headers       | helmet.js: CSP, HSTS, X-Frame-Options                | Partial                              |
| Rate limiting | Per-route + per-API-key (express-rate-limit present) | Partial                              |
| Audit         | Log all access to clinical + financial records       | To implement                         |
| Payment       | PCI: no raw card data on our servers                 | Stripe/gateway handles               |
| GDPR          | Right-to-erasure: soft delete + export               | Partial                              |
| Secrets       | No secrets in code, env vars only                    | ✓                                    |
| WebSocket     | Auth token required on WS upgrade                    | To implement                         |
| File upload   | Server-side MIME type + size validation              | Partial                              |
| A11y          | WCAG 2.1 AA + jest-axe in CI                         | ✓ CI present                         |
| SonarQube     | Zero new bugs/smells gate                            | ✓ CI present                         |

---

## 37. Phased Implementation Roadmap

### Phase 1 - Core Clinical PIMS (Weeks 1-8)

| Week | Backend                                                                        | Frontend                                            | Mobile                  |
| ---- | ------------------------------------------------------------------------------ | --------------------------------------------------- | ----------------------- |
| 1-2  | SuperTokens migration + Org model redesign                                     | Auth migration UI                                   | Auth migration          |
| 3-4  | Appointment model rewrite + status machine                                     | Appointment board, status transitions, triage queue | Appointment status sync |
| 5-6  | SOAP + Vitals + AppointmentClinicalFlags Prisma migrations + APIs              | SOAP entry, Vitals form (species-aware)             | Vitals entry (vet)      |
| 7-8  | In-Patient (Ward, DailyRound), Discharge, DentalChart, BoneChart Prisma + APIs | In-patient calendar, discharge form, dental chart   | Triage queue view       |

### Phase 2 - Prescription, Finance & Templates (Weeks 9-14)

| Week  | Backend                                                                            | Frontend                                                   |
| ----- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 9-10  | Prescription + ControlledSubstanceLog Prisma + APIs; drug interaction service      | Prescription builder, controlled substance log             |
| 11-12 | IPaymentGateway layer, Invoice redesign (agnostic)                                 | Invoice builder, payment collection, deposit workflow      |
| 13-14 | Templates module (SOAP, Discharge, Task), Services package redesign, TreatmentPlan | Template library, treatment plan builder, service packages |

### Phase 3 - Inventory Deep, Labs & Notifications (Weeks 15-18)

| Week | Backend                                                                          | Frontend                                           |
| ---- | -------------------------------------------------------------------------------- | -------------------------------------------------- |
| 15   | Inventory redesign (Medicine category schema, StockMovement reasons), AAHA codes | Inventory forms (category-driven), medicine search |
| 16   | Country compliance (Spain AEMPS, UK RCVS, DEA), AuditTrail enhancement           | Compliance page, export triggers                   |
| 17   | Lab agnostic layer (ILabProvider refactor), DICOM stub                           | Lab orders page, results viewer                    |
| 18   | WebSocket sync bus (Socket.IO + BullMQ), Plunk email migration                   | Real-time status board, notification centre        |

### Phase 4 - Developer Portal & AI (Weeks 19-24)

| Week  | Backend                                                                                  | Frontend                                         |
| ----- | ---------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 19-20 | API key management, webhook subscriptions, rate limiting per key                         | Developer portal, API key management             |
| 21-22 | IntegrationDefinition registry, IntegrationAccount encrypted credentials                 | Marketplace UI, integration activation           |
| 23-24 | IAIProvider framework, Anthropic Claude integration, AIAuditLog, drug interaction widget | AI scribe button on SOAP, drug interaction panel |

### Phase 5 - Mobile Enhancement & QR/Wallet (Weeks 25-28)

- Offline-first sync manager (MMKV + SyncQueue)
- Dental chart view (read-only, mobile)
- QR companion card screen
- Google Wallet / Apple Wallet (companion ID card)
- Push notification deep links (appointment status, lab results, task due)
- Referral accept/reject via email token (mobile web view)

---

_This document is the single source of truth for all new module design. All Prisma schema additions must match Section 2 and the individual module schemas exactly before implementation begins._

_Related documents:_

- _[realtime-backend.md](realtime-backend.md) - WebSocket implementation detail_
- _[NOTIFICATION_SETUP_GUIDE.md](NOTIFICATION_SETUP_GUIDE.md) - Push notification setup_
- _[POSTHOG_ANALYTICS_MIGRATION.md](POSTHOG_ANALYTICS_MIGRATION.md) - Analytics migration_
