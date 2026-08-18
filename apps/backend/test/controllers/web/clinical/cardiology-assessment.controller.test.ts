import { jest } from "@jest/globals";
import { CardiologyAssessmentController } from "src/controllers/web/cardiology-assessment.controller";
import {
  CardiologyAssessmentService,
  CardiologyAssessmentError,
} from "src/services/cardiology-assessment.service";
import {
  ENCOUNTER_ID,
  ORG_ID,
  PATIENT_ID,
  RECORD_ID,
  USER_ID,
  runClinicalControllerSuite,
} from "./clinical-suite";

jest.mock("src/services/cardiology-assessment.service", () => {
  const actual = jest.requireActual(
    "src/services/cardiology-assessment.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    CardiologyAssessmentService: {
      list: jest.fn(),
      create: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
});

runClinicalControllerSuite({
  name: "CardiologyAssessmentController",
  controller: CardiologyAssessmentController,
  service: CardiologyAssessmentService as unknown as Record<string, unknown>,
  errorClass: CardiologyAssessmentError,
  cases: [
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      query: { patientId: PATIENT_ID, acvimClass: "B2" },
      serviceMethod: "list",
      expectArgs: [
        { organisationId: ORG_ID, patientId: PATIENT_ID, acvimClass: "B2" },
      ],
      fallback: "Failed to list cardiology assessments",
      invalidPayload: { acvimClass: "E" },
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      body: {
        patientId: PATIENT_ID,
        encounterId: ENCOUNTER_ID,
        assessedAt: "2026-03-05T14:00:00.000Z",
        heartRate: 140,
        heartRhythm: "SINUS_ARRHYTHMIA",
        murmurGrade: "GRADE_3",
        acvimClass: "B2",
        laAoRatio: 1.8,
        diagnoses: ["Myxomatous mitral valve disease"],
      },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          assessedBy: USER_ID,
          patientId: PATIENT_ID,
          encounterId: ENCOUNTER_ID,
          assessedAt: new Date("2026-03-05T14:00:00.000Z"),
          heartRate: 140,
          heartRhythm: "SINUS_ARRHYTHMIA",
          murmurGrade: "GRADE_3",
          acvimClass: "B2",
          laAoRatio: 1.8,
          diagnoses: ["Myxomatous mitral valve disease"],
        },
      ],
      status: 201,
      fallback: "Failed to create cardiology assessment",
      // heartRate is capped at 500.
      invalidPayload: {
        patientId: PATIENT_ID,
        assessedAt: "2026-03-05T14:00:00.000Z",
        heartRate: 900,
      },
    },
    {
      handler: "get",
      params: { organisationId: ORG_ID, assessmentId: RECORD_ID },
      serviceMethod: "get",
      expectArgs: [RECORD_ID, ORG_ID],
      fallback: "Failed to get cardiology assessment",
    },
    {
      handler: "update",
      params: { organisationId: ORG_ID, assessmentId: RECORD_ID },
      body: { acvimClass: "C", ejectionFraction: 45 },
      serviceMethod: "update",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        { acvimClass: "C", ejectionFraction: 45 },
      ],
      fallback: "Failed to update cardiology assessment",
      invalidPayload: { ejectionFraction: 140 },
    },
    {
      handler: "delete",
      params: { organisationId: ORG_ID, assessmentId: RECORD_ID },
      serviceMethod: "delete",
      expectArgs: [RECORD_ID, ORG_ID],
      status: 204,
      fallback: "Failed to delete cardiology assessment",
    },
  ],
});
