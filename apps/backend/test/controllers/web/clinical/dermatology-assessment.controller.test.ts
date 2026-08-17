import { jest } from "@jest/globals";
import { DermatologyAssessmentController } from "src/controllers/web/dermatology-assessment.controller";
import {
  DermatologyAssessmentService,
  DermatologyAssessmentError,
} from "src/services/dermatology-assessment.service";
import {
  ENCOUNTER_ID,
  ORG_ID,
  PATIENT_ID,
  RECORD_ID,
  USER_ID,
  runClinicalControllerSuite,
} from "./clinical-suite";

jest.mock("src/services/dermatology-assessment.service", () => {
  const actual = jest.requireActual(
    "src/services/dermatology-assessment.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    DermatologyAssessmentService: {
      list: jest.fn(),
      create: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
});

const lesionMap = [
  {
    region: "Ventral abdomen",
    lesions: ["erythema"],
    severity: "MODERATE" as const,
  },
];

runClinicalControllerSuite({
  name: "DermatologyAssessmentController",
  controller: DermatologyAssessmentController,
  service: DermatologyAssessmentService as unknown as Record<string, unknown>,
  errorClass: DermatologyAssessmentError,
  cases: [
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      query: { patientId: PATIENT_ID, encounterId: ENCOUNTER_ID },
      serviceMethod: "list",
      expectArgs: [
        {
          organisationId: ORG_ID,
          patientId: PATIENT_ID,
          encounterId: ENCOUNTER_ID,
        },
      ],
      fallback: "Failed to list dermatology assessments",
      invalidPayload: { encounterId: "not-a-uuid" },
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      body: {
        patientId: PATIENT_ID,
        assessedAt: "2026-02-08T15:30:00.000Z",
        pruritusScore: 7,
        affectedRegions: ["Ventral abdomen"],
        coatQuality: "POOR",
        lesionMap,
        foodTrialStatus: "IN_PROGRESS",
        cades04Score: 32,
      },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          assessedBy: USER_ID,
          patientId: PATIENT_ID,
          pruritusScore: 7,
          affectedRegions: ["Ventral abdomen"],
          coatQuality: "POOR",
          lesionMap,
          foodTrialStatus: "IN_PROGRESS",
          cades04Score: 32,
          assessedAt: new Date("2026-02-08T15:30:00.000Z"),
        },
      ],
      status: 201,
      fallback: "Failed to create dermatology assessment",
      // pruritusScore is a 0-10 scale.
      invalidPayload: {
        patientId: PATIENT_ID,
        assessedAt: "2026-02-08T15:30:00.000Z",
        pruritusScore: 11,
      },
    },
    {
      handler: "get",
      params: { organisationId: ORG_ID, assessmentId: RECORD_ID },
      serviceMethod: "get",
      expectArgs: [RECORD_ID, ORG_ID],
      fallback: "Failed to get dermatology assessment",
    },
    {
      handler: "update",
      params: { organisationId: ORG_ID, assessmentId: RECORD_ID },
      body: { foodTrialStatus: "COMPLETED", pruritusScore: 3 },
      serviceMethod: "update",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        { foodTrialStatus: "COMPLETED", pruritusScore: 3 },
      ],
      fallback: "Failed to update dermatology assessment",
      invalidPayload: { foodTrialStatus: "PAUSED" },
    },
    {
      handler: "delete",
      params: { organisationId: ORG_ID, assessmentId: RECORD_ID },
      serviceMethod: "delete",
      expectArgs: [RECORD_ID, ORG_ID],
      status: 204,
      fallback: "Failed to delete dermatology assessment",
    },
  ],
});
