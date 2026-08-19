import { jest } from "@jest/globals";
import { WoundAssessmentController } from "src/controllers/web/wound-assessment.controller";
import {
  WoundAssessmentService,
  WoundAssessmentError,
} from "src/services/wound-assessment.service";
import {
  ENCOUNTER_ID,
  ORG_ID,
  PATIENT_ID,
  RECORD_ID,
  SECOND_ID,
  USER_ID,
  runClinicalControllerSuite,
} from "./clinical-suite";

jest.mock("src/services/wound-assessment.service", () => {
  const actual = jest.requireActual(
    "src/services/wound-assessment.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    WoundAssessmentService: {
      list: jest.fn(),
      record: jest.fn(),
      get: jest.fn(),
      delete: jest.fn(),
    },
  };
});

runClinicalControllerSuite({
  name: "WoundAssessmentController",
  controller: WoundAssessmentController,
  service: WoundAssessmentService as unknown as Record<string, unknown>,
  errorClass: WoundAssessmentError,
  cases: [
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      query: {
        patientId: PATIENT_ID,
        surgicalProcedureId: SECOND_ID,
        from: "2026-03-20T00:00:00.000Z",
        to: "2026-03-30T00:00:00.000Z",
      },
      serviceMethod: "list",
      expectArgs: [
        {
          organisationId: ORG_ID,
          patientId: PATIENT_ID,
          surgicalProcedureId: SECOND_ID,
          from: new Date("2026-03-20T00:00:00.000Z"),
          to: new Date("2026-03-30T00:00:00.000Z"),
        },
      ],
      fallback: "Failed to list wound assessments",
      invalidPayload: { surgicalProcedureId: "not-a-uuid" },
    },
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      query: { encounterId: ENCOUNTER_ID },
      serviceMethod: "list",
      expectArgs: [{ organisationId: ORG_ID, encounterId: ENCOUNTER_ID }],
      fallback: "Failed to list wound assessments",
    },
    {
      handler: "record",
      params: { organisationId: ORG_ID },
      body: {
        patientId: PATIENT_ID,
        encounterId: ENCOUNTER_ID,
        surgicalProcedureId: SECOND_ID,
        woundType: "SURGICAL_INCISION",
        location: "Ventral midline",
        lengthCm: 6.5,
        widthCm: 0.4,
        healingStage: "PROLIFERATION",
        healingStatus: "HEALING",
        dressing: "Non-adherent pad",
        assessedAt: "2026-03-23T09:00:00.000Z",
      },
      serviceMethod: "record",
      expectArgs: [
        {
          organisationId: ORG_ID,
          assessedBy: USER_ID,
          patientId: PATIENT_ID,
          encounterId: ENCOUNTER_ID,
          surgicalProcedureId: SECOND_ID,
          woundType: "SURGICAL_INCISION",
          location: "Ventral midline",
          lengthCm: 6.5,
          widthCm: 0.4,
          healingStage: "PROLIFERATION",
          healingStatus: "HEALING",
          dressing: "Non-adherent pad",
          assessedAt: new Date("2026-03-23T09:00:00.000Z"),
        },
      ],
      status: 201,
      fallback: "Failed to record wound assessment",
      // The wound location is mandatory.
      invalidPayload: {
        patientId: PATIENT_ID,
        woundType: "LACERATION",
        location: "",
        assessedAt: "2026-03-23T09:00:00.000Z",
      },
    },
    {
      handler: "get",
      params: { organisationId: ORG_ID, assessmentId: RECORD_ID },
      serviceMethod: "get",
      expectArgs: [RECORD_ID, ORG_ID],
      fallback: "Failed to get wound assessment",
    },
    {
      handler: "delete",
      params: { organisationId: ORG_ID, assessmentId: RECORD_ID },
      serviceMethod: "delete",
      expectArgs: [RECORD_ID, ORG_ID],
      status: 204,
      fallback: "Failed to delete wound assessment",
    },
  ],
});
