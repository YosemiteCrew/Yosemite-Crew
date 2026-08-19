import { jest } from "@jest/globals";
import { NeurologyAssessmentController } from "src/controllers/web/neurology-assessment.controller";
import {
  NeurologyAssessmentService,
  NeurologyAssessmentError,
} from "src/services/neurology-assessment.service";
import {
  ENCOUNTER_ID,
  ORG_ID,
  PATIENT_ID,
  RECORD_ID,
  USER_ID,
  runClinicalControllerSuite,
} from "./clinical-suite";

jest.mock("src/services/neurology-assessment.service", () => {
  const actual = jest.requireActual(
    "src/services/neurology-assessment.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    NeurologyAssessmentService: {
      list: jest.fn(),
      create: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
});

runClinicalControllerSuite({
  name: "NeurologyAssessmentController",
  controller: NeurologyAssessmentController,
  service: NeurologyAssessmentService as unknown as Record<string, unknown>,
  errorClass: NeurologyAssessmentError,
  cases: [
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      query: { patientId: PATIENT_ID, gaitScore: "ATAXIC" },
      serviceMethod: "list",
      expectArgs: [
        { organisationId: ORG_ID, patientId: PATIENT_ID, gaitScore: "ATAXIC" },
      ],
      fallback: "Failed to list neurology assessments",
      invalidPayload: { gaitScore: "WOBBLY" },
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      body: {
        patientId: PATIENT_ID,
        encounterId: ENCOUNTER_ID,
        assessedAt: "2026-03-04T16:20:00.000Z",
        consciousnessLevel: "OBTUNDED",
        gaitScore: "NON_AMBULATORY_PARAPLEGIC",
        spinalReflexGrades: { patellar: "EXAGGERATED", withdrawal: "NORMAL" },
        deepPainPresent: true,
        mriRecommended: true,
        diagnoses: ["Suspected IVDD"],
      },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          assessedBy: USER_ID,
          patientId: PATIENT_ID,
          encounterId: ENCOUNTER_ID,
          consciousnessLevel: "OBTUNDED",
          gaitScore: "NON_AMBULATORY_PARAPLEGIC",
          spinalReflexGrades: { patellar: "EXAGGERATED", withdrawal: "NORMAL" },
          deepPainPresent: true,
          mriRecommended: true,
          diagnoses: ["Suspected IVDD"],
          assessedAt: new Date("2026-03-04T16:20:00.000Z"),
        },
      ],
      status: 201,
      fallback: "Failed to create neurology assessment",
      // Reflex grades are constrained to the documented vocabulary.
      invalidPayload: {
        patientId: PATIENT_ID,
        assessedAt: "2026-03-04T16:20:00.000Z",
        spinalReflexGrades: { patellar: "BRISK" },
      },
    },
    {
      handler: "get",
      params: { organisationId: ORG_ID, assessmentId: RECORD_ID },
      serviceMethod: "get",
      expectArgs: [RECORD_ID, ORG_ID],
      fallback: "Failed to get neurology assessment",
    },
    {
      handler: "update",
      params: { organisationId: ORG_ID, assessmentId: RECORD_ID },
      body: { consciousnessLevel: "ALERT", proprioceptionIntact: true },
      serviceMethod: "update",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        { consciousnessLevel: "ALERT", proprioceptionIntact: true },
      ],
      fallback: "Failed to update neurology assessment",
      invalidPayload: { consciousnessLevel: "SLEEPY" },
    },
    {
      handler: "delete",
      params: { organisationId: ORG_ID, assessmentId: RECORD_ID },
      serviceMethod: "delete",
      expectArgs: [RECORD_ID, ORG_ID],
      status: 204,
      fallback: "Failed to delete neurology assessment",
    },
  ],
});
