import { jest } from "@jest/globals";
import { PathologySubmissionController } from "src/controllers/web/pathology-submission.controller";
import {
  PathologySubmissionService,
  PathologySubmissionError,
} from "src/services/pathology-submission.service";
import {
  ENCOUNTER_ID,
  ORG_ID,
  PATIENT_ID,
  RECORD_ID,
  USER_ID,
  runClinicalControllerSuite,
} from "./clinical-suite";

jest.mock("src/services/pathology-submission.service", () => {
  const actual = jest.requireActual(
    "src/services/pathology-submission.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    PathologySubmissionService: {
      list: jest.fn(),
      create: jest.fn(),
      get: jest.fn(),
      recordResults: jest.fn(),
      review: jest.fn(),
      update: jest.fn(),
    },
  };
});

runClinicalControllerSuite({
  name: "PathologySubmissionController",
  controller: PathologySubmissionController,
  service: PathologySubmissionService as unknown as Record<string, unknown>,
  errorClass: PathologySubmissionError,
  cases: [
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      query: {
        patientId: PATIENT_ID,
        status: "PROCESSING",
        pathologyType: "HISTOPATHOLOGY",
      },
      serviceMethod: "list",
      expectArgs: [
        {
          organisationId: ORG_ID,
          patientId: PATIENT_ID,
          status: "PROCESSING",
          pathologyType: "HISTOPATHOLOGY",
        },
      ],
      fallback: "Failed to list pathology submissions",
      invalidPayload: { status: "LOST_IN_POST" },
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      body: {
        patientId: PATIENT_ID,
        encounterId: ENCOUNTER_ID,
        pathologyType: "HISTOPATHOLOGY",
        sampleType: "Excisional biopsy",
        anatomicSite: "Left flank",
        collectedAt: "2026-03-07T10:00:00.000Z",
        submittedAt: "2026-03-07T14:00:00.000Z",
        labName: "Nationwide Labs",
        labRefNumber: "NW-2211",
      },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          collectedBy: USER_ID,
          patientId: PATIENT_ID,
          encounterId: ENCOUNTER_ID,
          pathologyType: "HISTOPATHOLOGY",
          sampleType: "Excisional biopsy",
          anatomicSite: "Left flank",
          labName: "Nationwide Labs",
          labRefNumber: "NW-2211",
          collectedAt: new Date("2026-03-07T10:00:00.000Z"),
          submittedAt: new Date("2026-03-07T14:00:00.000Z"),
        },
      ],
      status: 201,
      fallback: "Failed to create pathology submission",
      // The anatomic site is mandatory.
      invalidPayload: {
        patientId: PATIENT_ID,
        pathologyType: "CYTOLOGY",
        sampleType: "Fine needle aspirate",
        anatomicSite: "",
        collectedAt: "2026-03-07T10:00:00.000Z",
      },
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      // Collected but not yet posted to the lab.
      body: {
        patientId: PATIENT_ID,
        pathologyType: "CULTURE_SENSITIVITY",
        sampleType: "Swab",
        anatomicSite: "Right ear canal",
        collectedAt: "2026-03-08T10:00:00.000Z",
      },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          collectedBy: USER_ID,
          patientId: PATIENT_ID,
          pathologyType: "CULTURE_SENSITIVITY",
          sampleType: "Swab",
          anatomicSite: "Right ear canal",
          collectedAt: new Date("2026-03-08T10:00:00.000Z"),
        },
      ],
      status: 201,
      fallback: "Failed to create pathology submission",
    },
    {
      handler: "get",
      params: { organisationId: ORG_ID, submissionId: RECORD_ID },
      serviceMethod: "get",
      expectArgs: [RECORD_ID, ORG_ID],
      fallback: "Failed to get pathology submission",
    },
    {
      handler: "recordResults",
      params: { organisationId: ORG_ID, submissionId: RECORD_ID },
      body: {
        results: "Grade II mast cell tumour, margins incomplete",
        diagnosis: "Mast cell tumour",
        status: "RESULTS_AVAILABLE",
      },
      serviceMethod: "recordResults",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        {
          results: "Grade II mast cell tumour, margins incomplete",
          diagnosis: "Mast cell tumour",
          status: "RESULTS_AVAILABLE",
        },
        USER_ID,
      ],
      fallback: "Failed to record pathology results",
      // Results text is mandatory.
      invalidPayload: { results: "" },
    },
    {
      handler: "review",
      params: { organisationId: ORG_ID, submissionId: RECORD_ID },
      body: { reviewNotes: "Discussed with owner", diagnosis: "MCT grade II" },
      serviceMethod: "review",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        { reviewNotes: "Discussed with owner", diagnosis: "MCT grade II" },
        USER_ID,
      ],
      fallback: "Failed to review pathology submission",
      invalidPayload: { reviewNotes: 1 },
    },
    {
      handler: "review",
      params: { organisationId: ORG_ID, submissionId: RECORD_ID },
      // Falls back to the "unknown" reviewer when no user is resolved.
      body: {},
      withoutUser: true,
      serviceMethod: "review",
      expectArgs: [RECORD_ID, ORG_ID, {}, "unknown"],
      fallback: "Failed to review pathology submission",
    },
    {
      handler: "update",
      params: { organisationId: ORG_ID, submissionId: RECORD_ID },
      body: {
        status: "RECEIVED_BY_LAB",
        submittedAt: "2026-03-09T08:00:00.000Z",
      },
      serviceMethod: "update",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        {
          status: "RECEIVED_BY_LAB",
          submittedAt: new Date("2026-03-09T08:00:00.000Z"),
        },
      ],
      fallback: "Failed to update pathology submission",
      invalidPayload: { submittedAt: "yesterday" },
    },
    {
      handler: "update",
      params: { organisationId: ORG_ID, submissionId: RECORD_ID },
      body: { labRefNumber: "NW-2212" },
      serviceMethod: "update",
      expectArgs: [RECORD_ID, ORG_ID, { labRefNumber: "NW-2212" }],
      fallback: "Failed to update pathology submission",
    },
  ],
});
