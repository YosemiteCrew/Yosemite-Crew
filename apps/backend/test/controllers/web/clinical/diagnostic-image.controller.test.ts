import { jest } from "@jest/globals";
import { DiagnosticImageController } from "src/controllers/web/diagnostic-image.controller";
import {
  DiagnosticImageService,
  DiagnosticImageError,
} from "src/services/diagnostic-image.service";
import {
  ENCOUNTER_ID,
  ORG_ID,
  PATIENT_ID,
  RECORD_ID,
  SECOND_ID,
  USER_ID,
  runClinicalControllerSuite,
} from "./clinical-suite";

jest.mock("src/services/diagnostic-image.service", () => {
  const actual = jest.requireActual(
    "src/services/diagnostic-image.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    DiagnosticImageService: {
      list: jest.fn(),
      record: jest.fn(),
      get: jest.fn(),
      review: jest.fn(),
      update: jest.fn(),
    },
  };
});

runClinicalControllerSuite({
  name: "DiagnosticImageController",
  controller: DiagnosticImageController,
  service: DiagnosticImageService as unknown as Record<string, unknown>,
  errorClass: DiagnosticImageError,
  cases: [
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      query: {
        patientId: PATIENT_ID,
        imagingType: "RADIOGRAPH",
        status: "PENDING_REVIEW",
      },
      serviceMethod: "list",
      expectArgs: [
        {
          organisationId: ORG_ID,
          patientId: PATIENT_ID,
          imagingType: "RADIOGRAPH",
          status: "PENDING_REVIEW",
        },
      ],
      fallback: "Failed to list diagnostic images",
      invalidPayload: { imagingType: "XRAY" },
    },
    {
      handler: "record",
      params: { organisationId: ORG_ID },
      body: {
        patientId: PATIENT_ID,
        encounterId: ENCOUNTER_ID,
        imagingType: "ULTRASOUND",
        bodyRegion: "Abdomen",
        takenAt: "2026-02-18T11:00:00.000Z",
        interpretedAt: "2026-02-18T13:00:00.000Z",
        interpretedBy: "Dr Silva",
        findings: "Mild splenomegaly",
        documentId: SECOND_ID,
      },
      serviceMethod: "record",
      // `takenBy` is stamped from the session, overriding whatever the body held.
      expectArgs: [
        {
          organisationId: ORG_ID,
          takenBy: USER_ID,
          patientId: PATIENT_ID,
          encounterId: ENCOUNTER_ID,
          imagingType: "ULTRASOUND",
          bodyRegion: "Abdomen",
          interpretedBy: "Dr Silva",
          findings: "Mild splenomegaly",
          documentId: SECOND_ID,
          takenAt: new Date("2026-02-18T11:00:00.000Z"),
          interpretedAt: new Date("2026-02-18T13:00:00.000Z"),
        },
      ],
      status: 201,
      fallback: "Failed to record diagnostic image",
      invalidPayload: {
        patientId: PATIENT_ID,
        imagingType: "ULTRASOUND",
        takenAt: "sometime",
      },
    },
    {
      handler: "record",
      params: { organisationId: ORG_ID },
      // Not yet interpreted: the key must be omitted rather than set to
      // an Invalid Date.
      body: {
        patientId: PATIENT_ID,
        imagingType: "CT_SCAN",
        takenAt: "2026-02-19T11:00:00.000Z",
      },
      serviceMethod: "record",
      expectArgs: [
        {
          organisationId: ORG_ID,
          takenBy: USER_ID,
          patientId: PATIENT_ID,
          imagingType: "CT_SCAN",
          takenAt: new Date("2026-02-19T11:00:00.000Z"),
        },
      ],
      status: 201,
      fallback: "Failed to record diagnostic image",
    },
    {
      handler: "get",
      params: { organisationId: ORG_ID, imageId: RECORD_ID },
      serviceMethod: "get",
      expectArgs: [RECORD_ID, ORG_ID],
      fallback: "Failed to get diagnostic image",
    },
    {
      handler: "review",
      params: { organisationId: ORG_ID, imageId: RECORD_ID },
      body: {
        interpretedBy: "Dr Silva",
        findings: "No abnormality detected",
        status: "REVIEWED",
        followUpRequired: false,
      },
      serviceMethod: "review",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        {
          interpretedBy: "Dr Silva",
          findings: "No abnormality detected",
          status: "REVIEWED",
          followUpRequired: false,
        },
        USER_ID,
      ],
      fallback: "Failed to review diagnostic image",
      // A review must carry both the interpreter and the findings.
      invalidPayload: { interpretedBy: "Dr Silva" },
    },
    {
      handler: "update",
      params: { organisationId: ORG_ID, imageId: RECORD_ID },
      body: {
        status: "REQUIRES_SPECIALIST",
        impression: "Refer to cardiology",
      },
      serviceMethod: "update",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        { status: "REQUIRES_SPECIALIST", impression: "Refer to cardiology" },
      ],
      fallback: "Failed to update diagnostic image",
      invalidPayload: { documentId: "not-a-uuid" },
    },
  ],
});
