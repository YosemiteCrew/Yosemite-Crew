import { jest } from "@jest/globals";
import { OncologyAssessmentController } from "src/controllers/web/oncology-assessment.controller";
import {
  OncologyAssessmentService,
  OncologyAssessmentError,
} from "src/services/oncology-assessment.service";
import {
  ENCOUNTER_ID,
  ORG_ID,
  PATIENT_ID,
  RECORD_ID,
  USER_ID,
  runClinicalControllerSuite,
} from "./clinical-suite";

jest.mock("src/services/oncology-assessment.service", () => {
  const actual = jest.requireActual(
    "src/services/oncology-assessment.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    OncologyAssessmentService: {
      list: jest.fn(),
      create: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
});

runClinicalControllerSuite({
  name: "OncologyAssessmentController",
  controller: OncologyAssessmentController,
  service: OncologyAssessmentService as unknown as Record<string, unknown>,
  errorClass: OncologyAssessmentError,
  cases: [
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      query: { patientId: PATIENT_ID, overallStage: "STAGE_IIIA" },
      serviceMethod: "list",
      expectArgs: [
        {
          organisationId: ORG_ID,
          patientId: PATIENT_ID,
          overallStage: "STAGE_IIIA",
        },
      ],
      fallback: "Failed to list oncology assessments",
      invalidPayload: { overallStage: "STAGE_V" },
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      body: {
        patientId: PATIENT_ID,
        encounterId: ENCOUNTER_ID,
        assessedAt: "2026-03-09T11:00:00.000Z",
        tumorType: "Mast cell tumour",
        overallStage: "STAGE_II",
        chemotherapyProtocol: "Vinblastine/prednisolone",
        chemotherapyStartDate: "2026-03-12T09:00:00.000Z",
        chemotherapyCycles: 4,
        qualityOfLifeScore: 8,
      },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          assessedBy: USER_ID,
          patientId: PATIENT_ID,
          encounterId: ENCOUNTER_ID,
          tumorType: "Mast cell tumour",
          overallStage: "STAGE_II",
          chemotherapyProtocol: "Vinblastine/prednisolone",
          chemotherapyCycles: 4,
          qualityOfLifeScore: 8,
          assessedAt: new Date("2026-03-09T11:00:00.000Z"),
          chemotherapyStartDate: new Date("2026-03-12T09:00:00.000Z"),
        },
      ],
      status: 201,
      fallback: "Failed to create oncology assessment",
      // The quality of life score runs 0-10.
      invalidPayload: {
        patientId: PATIENT_ID,
        assessedAt: "2026-03-09T11:00:00.000Z",
        qualityOfLifeScore: 12,
      },
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      // No chemotherapy planned yet.
      body: {
        patientId: PATIENT_ID,
        assessedAt: "2026-03-10T11:00:00.000Z",
        tumorType: "Lipoma",
      },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          assessedBy: USER_ID,
          patientId: PATIENT_ID,
          tumorType: "Lipoma",
          assessedAt: new Date("2026-03-10T11:00:00.000Z"),
          chemotherapyStartDate: undefined,
        },
      ],
      status: 201,
      fallback: "Failed to create oncology assessment",
    },
    {
      handler: "get",
      params: { organisationId: ORG_ID, assessmentId: RECORD_ID },
      serviceMethod: "get",
      expectArgs: [RECORD_ID, ORG_ID],
      fallback: "Failed to get oncology assessment",
    },
    {
      handler: "update",
      params: { organisationId: ORG_ID, assessmentId: RECORD_ID },
      body: {
        overallStage: "STAGE_IV",
        chemotherapyStartDate: "2026-04-01T09:00:00.000Z",
      },
      serviceMethod: "update",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        {
          overallStage: "STAGE_IV",
          chemotherapyStartDate: new Date("2026-04-01T09:00:00.000Z"),
        },
      ],
      fallback: "Failed to update oncology assessment",
      invalidPayload: { chemotherapyCycles: 0 },
    },
    {
      handler: "update",
      params: { organisationId: ORG_ID, assessmentId: RECORD_ID },
      body: { prognosis: "Guarded" },
      serviceMethod: "update",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        { prognosis: "Guarded", chemotherapyStartDate: undefined },
      ],
      fallback: "Failed to update oncology assessment",
    },
    {
      handler: "delete",
      params: { organisationId: ORG_ID, assessmentId: RECORD_ID },
      serviceMethod: "delete",
      expectArgs: [RECORD_ID, ORG_ID],
      status: 204,
      fallback: "Failed to delete oncology assessment",
    },
  ],
});
