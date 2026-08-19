import { jest } from "@jest/globals";
import { PainAssessmentController } from "src/controllers/web/pain-assessment.controller";
import {
  PainAssessmentService,
  PainAssessmentError,
} from "src/services/pain-assessment.service";
import {
  ENCOUNTER_ID,
  ORG_ID,
  PATIENT_ID,
  RECORD_ID,
  USER_ID,
  runClinicalControllerSuite,
} from "./clinical-suite";

jest.mock("src/services/pain-assessment.service", () => {
  const actual = jest.requireActual(
    "src/services/pain-assessment.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    PainAssessmentService: {
      list: jest.fn(),
      record: jest.fn(),
      get: jest.fn(),
      delete: jest.fn(),
    },
  };
});

runClinicalControllerSuite({
  name: "PainAssessmentController",
  controller: PainAssessmentController,
  service: PainAssessmentService as unknown as Record<string, unknown>,
  errorClass: PainAssessmentError,
  cases: [
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      query: {
        patientId: PATIENT_ID,
        from: "2026-03-01T00:00:00.000Z",
        to: "2026-03-03T00:00:00.000Z",
      },
      serviceMethod: "list",
      expectArgs: [
        {
          organisationId: ORG_ID,
          patientId: PATIENT_ID,
          from: new Date("2026-03-01T00:00:00.000Z"),
          to: new Date("2026-03-03T00:00:00.000Z"),
        },
      ],
      fallback: "Failed to list pain assessments",
      invalidPayload: { from: "march" },
    },
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      query: { encounterId: ENCOUNTER_ID },
      serviceMethod: "list",
      expectArgs: [{ organisationId: ORG_ID, encounterId: ENCOUNTER_ID }],
      fallback: "Failed to list pain assessments",
    },
    {
      handler: "record",
      params: { organisationId: ORG_ID },
      body: {
        patientId: PATIENT_ID,
        encounterId: ENCOUNTER_ID,
        painScale: "GLASGOW_COMPOSITE_PAIN_SCALE",
        painScore: 6,
        rawScore: "14/24",
        vocalisation: true,
        assessedAt: "2026-03-02T04:00:00.000Z",
        interventionType: "ANALGESIC_GIVEN",
        reassessAt: "2026-03-02T08:00:00.000Z",
      },
      serviceMethod: "record",
      expectArgs: [
        {
          organisationId: ORG_ID,
          assessedBy: USER_ID,
          patientId: PATIENT_ID,
          encounterId: ENCOUNTER_ID,
          painScale: "GLASGOW_COMPOSITE_PAIN_SCALE",
          painScore: 6,
          rawScore: "14/24",
          vocalisation: true,
          interventionType: "ANALGESIC_GIVEN",
          assessedAt: new Date("2026-03-02T04:00:00.000Z"),
          reassessAt: new Date("2026-03-02T08:00:00.000Z"),
        },
      ],
      status: 201,
      fallback: "Failed to record pain assessment",
      // The pain score runs 0-10.
      invalidPayload: {
        patientId: PATIENT_ID,
        painScale: "NUMERIC_0_10",
        painScore: 11,
        assessedAt: "2026-03-02T04:00:00.000Z",
      },
    },
    {
      handler: "record",
      params: { organisationId: ORG_ID },
      // No reassessment booked: the key must stay off the payload.
      body: {
        patientId: PATIENT_ID,
        painScale: "FELINE_GRIMACE_SCALE",
        painScore: 1,
        assessedAt: "2026-03-02T12:00:00.000Z",
      },
      serviceMethod: "record",
      expectArgs: [
        {
          organisationId: ORG_ID,
          assessedBy: USER_ID,
          patientId: PATIENT_ID,
          painScale: "FELINE_GRIMACE_SCALE",
          painScore: 1,
          assessedAt: new Date("2026-03-02T12:00:00.000Z"),
        },
      ],
      status: 201,
      fallback: "Failed to record pain assessment",
    },
    {
      handler: "get",
      params: { organisationId: ORG_ID, assessmentId: RECORD_ID },
      serviceMethod: "get",
      expectArgs: [RECORD_ID, ORG_ID],
      fallback: "Failed to get pain assessment",
    },
    {
      handler: "delete",
      params: { organisationId: ORG_ID, assessmentId: RECORD_ID },
      serviceMethod: "delete",
      expectArgs: [RECORD_ID, ORG_ID],
      status: 204,
      fallback: "Failed to delete pain assessment",
    },
  ],
});
