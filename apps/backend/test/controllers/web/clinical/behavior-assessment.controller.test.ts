import { jest } from "@jest/globals";
import { BehaviorAssessmentController } from "src/controllers/web/behavior-assessment.controller";
import {
  BehaviorAssessmentService,
  BehaviorAssessmentError,
} from "src/services/behavior-assessment.service";
import {
  ENCOUNTER_ID,
  ORG_ID,
  PATIENT_ID,
  RECORD_ID,
  USER_ID,
  runClinicalControllerSuite,
} from "./clinical-suite";

jest.mock("src/services/behavior-assessment.service", () => {
  const actual = jest.requireActual(
    "src/services/behavior-assessment.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    BehaviorAssessmentService: {
      list: jest.fn(),
      create: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
});

runClinicalControllerSuite({
  name: "BehaviorAssessmentController",
  controller: BehaviorAssessmentController,
  service: BehaviorAssessmentService as unknown as Record<string, unknown>,
  errorClass: BehaviorAssessmentError,
  cases: [
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      query: {
        patientId: PATIENT_ID,
        encounterId: ENCOUNTER_ID,
        fasScore: "FAS_3",
      },
      serviceMethod: "list",
      expectArgs: [
        {
          organisationId: ORG_ID,
          patientId: PATIENT_ID,
          encounterId: ENCOUNTER_ID,
          fasScore: "FAS_3",
        },
      ],
      fallback: "Failed to list behavior assessments",
      invalidPayload: { fasScore: "FAS_9" },
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      body: {
        patientId: PATIENT_ID,
        encounterId: ENCOUNTER_ID,
        assessedAt: "2026-02-11T09:15:00.000Z",
        fasScore: "FAS_2",
        handlingTolerance: "MODERATE",
        aggressionTriggers: ["nail trim"],
        referralRecommended: true,
      },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          assessedBy: USER_ID,
          patientId: PATIENT_ID,
          encounterId: ENCOUNTER_ID,
          assessedAt: new Date("2026-02-11T09:15:00.000Z"),
          fasScore: "FAS_2",
          handlingTolerance: "MODERATE",
          aggressionTriggers: ["nail trim"],
          referralRecommended: true,
        },
      ],
      status: 201,
      fallback: "Failed to create behavior assessment",
      invalidPayload: { patientId: PATIENT_ID, assessedAt: "yesterday" },
    },
    {
      handler: "get",
      params: { organisationId: ORG_ID, assessmentId: RECORD_ID },
      serviceMethod: "get",
      expectArgs: [RECORD_ID, ORG_ID],
      fallback: "Failed to get behavior assessment",
    },
    {
      handler: "update",
      params: { organisationId: ORG_ID, assessmentId: RECORD_ID },
      body: { fasScore: "FAS_1", fearFreeNotes: "Responded well to treats" },
      serviceMethod: "update",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        { fasScore: "FAS_1", fearFreeNotes: "Responded well to treats" },
      ],
      fallback: "Failed to update behavior assessment",
      invalidPayload: { referralRecommended: "yes" },
    },
    {
      handler: "delete",
      params: { organisationId: ORG_ID, assessmentId: RECORD_ID },
      serviceMethod: "delete",
      expectArgs: [RECORD_ID, ORG_ID],
      status: 204,
      fallback: "Failed to delete behavior assessment",
    },
  ],
});
