import { jest } from "@jest/globals";
import { PatientConsentController } from "src/controllers/web/patient-consent.controller";
import {
  PatientConsentService,
  PatientConsentError,
} from "src/services/patient-consent.service";
import {
  ORG_ID,
  PATIENT_ID,
  RECORD_ID,
  SECOND_ID,
  USER_ID,
  runClinicalControllerSuite,
} from "./clinical-suite";

/**
 * A 24-hex Mongo ObjectId, still live for patients migrated before the
 * Postgres UUID cutover. patientId must accept it the same way every sibling
 * clinical controller's patient/encounter filters do (see patient-allergy's
 * LEGACY_PATIENT_ID) - a strict z.uuid() here 400s the request before the
 * service lookup runs, which is exactly what shipped the "Could not load the
 * consent list" banner for these patients.
 */
const LEGACY_PATIENT_ID = "507f1f77bcf86cd799439011";

jest.mock("src/services/patient-consent.service", () => {
  const actual = jest.requireActual(
    "src/services/patient-consent.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    PatientConsentService: {
      list: jest.fn(),
      grant: jest.fn(),
      get: jest.fn(),
      revoke: jest.fn(),
    },
  };
});

runClinicalControllerSuite({
  name: "PatientConsentController",
  controller: PatientConsentController,
  service: PatientConsentService as unknown as Record<string, unknown>,
  errorClass: PatientConsentError,
  cases: [
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      query: {
        patientId: PATIENT_ID,
        status: "ACTIVE",
        consentType: "SURGICAL",
      },
      serviceMethod: "list",
      expectArgs: [
        {
          organisationId: ORG_ID,
          patientId: PATIENT_ID,
          status: "ACTIVE",
          consentType: "SURGICAL",
        },
      ],
      fallback: "Failed to list consents",
      invalidPayload: { consentType: "VERBAL" },
    },
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      query: { patientId: LEGACY_PATIENT_ID },
      serviceMethod: "list",
      expectArgs: [{ organisationId: ORG_ID, patientId: LEGACY_PATIENT_ID }],
      fallback: "Failed to list consents",
    },
    {
      handler: "grant",
      params: { organisationId: ORG_ID },
      // `consentedBy` is the CONSENT_GRANTED audit actor, so it may only come
      // from the session. A body-supplied value is dropped by the schema and
      // must never reach the service - otherwise any authorised staff member
      // could attribute a SURGICAL/DNR consent to a colleague.
      body: {
        patientId: PATIENT_ID,
        consentType: "ANESTHESIA",
        procedureDesc: "General anaesthesia for dental",
        consentedBy: "someone-else",
        consentedByName: "Alex Turner",
        consentedAt: "2026-03-14T08:00:00.000Z",
        expiresAt: "2026-03-21T08:00:00.000Z",
        documentId: SECOND_ID,
      },
      serviceMethod: "grant",
      expectArgs: [
        {
          organisationId: ORG_ID,
          patientId: PATIENT_ID,
          consentType: "ANESTHESIA",
          procedureDesc: "General anaesthesia for dental",
          consentedBy: "user_clinical_1",
          consentedByName: "Alex Turner",
          documentId: SECOND_ID,
          consentedAt: new Date("2026-03-14T08:00:00.000Z"),
          expiresAt: new Date("2026-03-21T08:00:00.000Z"),
        },
      ],
      status: 201,
      fallback: "Failed to grant consent",
      // documentId is validated with the same lenient bound as patientId (a
      // Documenso/legacy reference is not a UUID either), so what makes a
      // payload invalid now is exceeding the length bound, not the format.
      invalidPayload: {
        patientId: PATIENT_ID,
        consentType: "SURGICAL",
        documentId: "x".repeat(65),
      },
    },
    {
      handler: "grant",
      params: { organisationId: ORG_ID },
      // With nothing in the body, the session user is recorded as the grantor
      // and neither date key is added.
      body: { patientId: PATIENT_ID, consentType: "DNR" },
      serviceMethod: "grant",
      expectArgs: [
        {
          organisationId: ORG_ID,
          consentedBy: USER_ID,
          patientId: PATIENT_ID,
          consentType: "DNR",
        },
      ],
      status: 201,
      fallback: "Failed to grant consent",
    },
    {
      handler: "grant",
      params: { organisationId: ORG_ID },
      // No session user at all: the stamp is skipped entirely.
      body: { patientId: PATIENT_ID, consentType: "DATA_SHARING" },
      withoutUser: true,
      serviceMethod: "grant",
      expectArgs: [
        {
          organisationId: ORG_ID,
          patientId: PATIENT_ID,
          consentType: "DATA_SHARING",
        },
      ],
      status: 201,
      fallback: "Failed to grant consent",
    },
    {
      handler: "get",
      params: { organisationId: ORG_ID, consentId: RECORD_ID },
      serviceMethod: "get",
      expectArgs: [RECORD_ID, ORG_ID],
      fallback: "Failed to get consent",
    },
    {
      handler: "revoke",
      params: { organisationId: ORG_ID, consentId: RECORD_ID },
      body: { revokedReason: "Owner changed their mind" },
      serviceMethod: "revoke",
      expectArgs: [RECORD_ID, ORG_ID, "Owner changed their mind", USER_ID],
      fallback: "Failed to revoke consent",
      invalidPayload: { revokedReason: 5 },
    },
    {
      handler: "revoke",
      params: { organisationId: ORG_ID, consentId: RECORD_ID },
      body: {},
      serviceMethod: "revoke",
      expectArgs: [RECORD_ID, ORG_ID, undefined, USER_ID],
      fallback: "Failed to revoke consent",
    },
  ],
});
