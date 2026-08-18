import { jest } from "@jest/globals";
import { PatientAllergyController } from "src/controllers/web/patient-allergy.controller";
import {
  PatientAllergyService,
  PatientAllergyError,
} from "src/services/patient-allergy.service";
import {
  ORG_ID,
  PATIENT_ID,
  RECORD_ID,
  USER_ID,
  runClinicalControllerSuite,
} from "./clinical-suite";

jest.mock("src/services/patient-allergy.service", () => {
  const actual = jest.requireActual(
    "src/services/patient-allergy.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    PatientAllergyService: {
      list: jest.fn(),
      create: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      resolve: jest.fn(),
    },
  };
});

runClinicalControllerSuite({
  name: "PatientAllergyController",
  controller: PatientAllergyController,
  service: PatientAllergyService as unknown as Record<string, unknown>,
  errorClass: PatientAllergyError,
  cases: [
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      query: { patientId: PATIENT_ID, status: "ACTIVE", allergyType: "DRUG" },
      serviceMethod: "list",
      expectArgs: [
        {
          organisationId: ORG_ID,
          patientId: PATIENT_ID,
          status: "ACTIVE",
          allergyType: "DRUG",
        },
      ],
      fallback: "Failed to list allergies",
      invalidPayload: { allergyType: "POLLEN" },
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      body: {
        patientId: PATIENT_ID,
        allergen: "Penicillin",
        allergyType: "DRUG",
        severity: "LIFE_THREATENING",
        reaction: "Facial swelling and collapse",
        onsetDate: "2025-11-02T00:00:00.000Z",
      },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          recordedBy: USER_ID,
          patientId: PATIENT_ID,
          allergen: "Penicillin",
          allergyType: "DRUG",
          severity: "LIFE_THREATENING",
          reaction: "Facial swelling and collapse",
          onsetDate: new Date("2025-11-02T00:00:00.000Z"),
        },
      ],
      status: 201,
      fallback: "Failed to create allergy record",
      // The severity is mandatory.
      invalidPayload: {
        patientId: PATIENT_ID,
        allergen: "Penicillin",
        allergyType: "DRUG",
      },
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      body: {
        patientId: PATIENT_ID,
        allergen: "Chicken",
        allergyType: "FOOD",
        severity: "MILD",
      },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          recordedBy: USER_ID,
          patientId: PATIENT_ID,
          allergen: "Chicken",
          allergyType: "FOOD",
          severity: "MILD",
        },
      ],
      status: 201,
      fallback: "Failed to create allergy record",
    },
    {
      handler: "get",
      params: { organisationId: ORG_ID, allergyId: RECORD_ID },
      serviceMethod: "get",
      expectArgs: [RECORD_ID, ORG_ID],
      fallback: "Failed to get allergy record",
    },
    {
      handler: "update",
      params: { organisationId: ORG_ID, allergyId: RECORD_ID },
      body: {
        severity: "MODERATE",
        onsetDate: "2025-10-01T00:00:00.000Z",
        resolvedDate: "2026-01-05T00:00:00.000Z",
      },
      serviceMethod: "update",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        {
          severity: "MODERATE",
          onsetDate: new Date("2025-10-01T00:00:00.000Z"),
          resolvedDate: new Date("2026-01-05T00:00:00.000Z"),
        },
        USER_ID,
      ],
      fallback: "Failed to update allergy record",
      invalidPayload: { severity: "CATASTROPHIC" },
    },
    {
      handler: "update",
      params: { organisationId: ORG_ID, allergyId: RECORD_ID },
      body: { notes: "Owner reports no further episodes" },
      serviceMethod: "update",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        { notes: "Owner reports no further episodes" },
        USER_ID,
      ],
      fallback: "Failed to update allergy record",
    },
    {
      handler: "resolve",
      params: { organisationId: ORG_ID, allergyId: RECORD_ID },
      body: { resolvedDate: "2026-02-01T00:00:00.000Z" },
      serviceMethod: "resolve",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        USER_ID,
        new Date("2026-02-01T00:00:00.000Z"),
      ],
      fallback: "Failed to resolve allergy record",
      invalidPayload: { resolvedDate: "today" },
    },
    {
      handler: "resolve",
      params: { organisationId: ORG_ID, allergyId: RECORD_ID },
      // Resolving without a date leaves the service to stamp "now".
      body: {},
      serviceMethod: "resolve",
      expectArgs: [RECORD_ID, ORG_ID, USER_ID, undefined],
      fallback: "Failed to resolve allergy record",
    },
  ],
});
