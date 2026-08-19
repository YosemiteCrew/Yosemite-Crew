import { jest } from "@jest/globals";
import { NutritionAssessmentController } from "src/controllers/web/nutrition-assessment.controller";
import {
  NutritionAssessmentService,
  NutritionAssessmentError,
} from "src/services/nutrition-assessment.service";
import {
  ENCOUNTER_ID,
  ORG_ID,
  PATIENT_ID,
  RECORD_ID,
  USER_ID,
  runClinicalControllerSuite,
} from "./clinical-suite";

jest.mock("src/services/nutrition-assessment.service", () => {
  const actual = jest.requireActual(
    "src/services/nutrition-assessment.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    NutritionAssessmentService: {
      list: jest.fn(),
      create: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
});

runClinicalControllerSuite({
  name: "NutritionAssessmentController",
  controller: NutritionAssessmentController,
  service: NutritionAssessmentService as unknown as Record<string, unknown>,
  errorClass: NutritionAssessmentError,
  cases: [
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      query: { patientId: PATIENT_ID, appetiteScore: "POOR" },
      serviceMethod: "list",
      expectArgs: [
        {
          organisationId: ORG_ID,
          patientId: PATIENT_ID,
          appetiteScore: "POOR",
        },
      ],
      fallback: "Failed to list nutrition assessments",
      invalidPayload: { appetiteScore: "RAVENOUS" },
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      body: {
        patientId: PATIENT_ID,
        encounterId: ENCOUNTER_ID,
        assessedAt: "2026-03-06T09:40:00.000Z",
        appetiteScore: "FAIR",
        bodyConditionScore: 4,
        muscleConditionScore: 2,
        currentWeightKg: 9.2,
        idealWeightKg: 11,
        restingEnergyRequirement: 420,
        feedingRoute: "ESOPHAGOSTOMY",
        hydrationStatus: "MILD_DEHYDRATION",
        supplementation: ["Omega-3"],
      },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          assessedBy: USER_ID,
          patientId: PATIENT_ID,
          encounterId: ENCOUNTER_ID,
          appetiteScore: "FAIR",
          bodyConditionScore: 4,
          muscleConditionScore: 2,
          currentWeightKg: 9.2,
          idealWeightKg: 11,
          restingEnergyRequirement: 420,
          feedingRoute: "ESOPHAGOSTOMY",
          hydrationStatus: "MILD_DEHYDRATION",
          supplementation: ["Omega-3"],
          assessedAt: new Date("2026-03-06T09:40:00.000Z"),
        },
      ],
      status: 201,
      fallback: "Failed to create nutrition assessment",
      // The muscle condition score runs 1-4.
      invalidPayload: {
        patientId: PATIENT_ID,
        assessedAt: "2026-03-06T09:40:00.000Z",
        muscleConditionScore: 7,
      },
    },
    {
      handler: "get",
      params: { organisationId: ORG_ID, assessmentId: RECORD_ID },
      serviceMethod: "get",
      expectArgs: [RECORD_ID, ORG_ID],
      fallback: "Failed to get nutrition assessment",
    },
    {
      handler: "update",
      params: { organisationId: ORG_ID, assessmentId: RECORD_ID },
      body: { appetiteScore: "GOOD", feedingPlan: "Return to oral feeding" },
      serviceMethod: "update",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        { appetiteScore: "GOOD", feedingPlan: "Return to oral feeding" },
      ],
      fallback: "Failed to update nutrition assessment",
      invalidPayload: { currentWeightKg: -2 },
    },
    {
      handler: "delete",
      params: { organisationId: ORG_ID, assessmentId: RECORD_ID },
      serviceMethod: "delete",
      expectArgs: [RECORD_ID, ORG_ID],
      status: 204,
      fallback: "Failed to delete nutrition assessment",
    },
  ],
});
