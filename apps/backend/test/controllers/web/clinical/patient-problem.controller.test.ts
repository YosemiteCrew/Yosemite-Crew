import { jest } from "@jest/globals";
import { PatientProblemController } from "src/controllers/web/patient-problem.controller";
import {
  PatientProblemService,
  PatientProblemError,
} from "src/services/patient-problem.service";
import {
  ORG_ID,
  PATIENT_ID,
  RECORD_ID,
  USER_ID,
  runClinicalControllerSuite,
} from "./clinical-suite";

jest.mock("src/services/patient-problem.service", () => {
  const actual = jest.requireActual(
    "src/services/patient-problem.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    PatientProblemService: {
      list: jest.fn(),
      create: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      resolve: jest.fn(),
    },
  };
});

runClinicalControllerSuite({
  name: "PatientProblemController",
  controller: PatientProblemController,
  service: PatientProblemService as unknown as Record<string, unknown>,
  errorClass: PatientProblemError,
  cases: [
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      query: { patientId: PATIENT_ID, status: "ACTIVE" },
      serviceMethod: "list",
      expectArgs: [
        { organisationId: ORG_ID, patientId: PATIENT_ID, status: "ACTIVE" },
      ],
      fallback: "Failed to list problems",
      invalidPayload: { status: "CHRONIC" },
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      body: {
        patientId: PATIENT_ID,
        name: "Chronic kidney disease",
        codeSystem: "SNOMED",
        code: "709044004",
        severity: "MODERATE",
        onsetDate: "2025-08-01T00:00:00.000Z",
      },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          recordedBy: USER_ID,
          patientId: PATIENT_ID,
          name: "Chronic kidney disease",
          codeSystem: "SNOMED",
          code: "709044004",
          severity: "MODERATE",
          onsetDate: new Date("2025-08-01T00:00:00.000Z"),
        },
      ],
      status: 201,
      fallback: "Failed to create problem",
      // The problem name may not be blank.
      invalidPayload: { patientId: PATIENT_ID, name: "" },
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      body: { patientId: PATIENT_ID, name: "Otitis externa" },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          recordedBy: USER_ID,
          patientId: PATIENT_ID,
          name: "Otitis externa",
        },
      ],
      status: 201,
      fallback: "Failed to create problem",
    },
    {
      handler: "get",
      params: { organisationId: ORG_ID, problemId: RECORD_ID },
      serviceMethod: "get",
      expectArgs: [RECORD_ID, ORG_ID],
      fallback: "Failed to get problem",
    },
    {
      handler: "update",
      params: { organisationId: ORG_ID, problemId: RECORD_ID },
      body: {
        status: "RESOLVED",
        onsetDate: "2025-07-01T00:00:00.000Z",
        resolvedDate: "2026-01-20T00:00:00.000Z",
      },
      serviceMethod: "update",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        {
          status: "RESOLVED",
          onsetDate: new Date("2025-07-01T00:00:00.000Z"),
          resolvedDate: new Date("2026-01-20T00:00:00.000Z"),
        },
        USER_ID,
      ],
      fallback: "Failed to update problem",
      invalidPayload: { severity: "EXTREME" },
    },
    {
      handler: "update",
      params: { organisationId: ORG_ID, problemId: RECORD_ID },
      body: { notes: "Managed with diet" },
      serviceMethod: "update",
      expectArgs: [RECORD_ID, ORG_ID, { notes: "Managed with diet" }, USER_ID],
      fallback: "Failed to update problem",
    },
    {
      handler: "resolve",
      params: { organisationId: ORG_ID, problemId: RECORD_ID },
      body: { resolvedDate: "2026-02-14T00:00:00.000Z" },
      serviceMethod: "resolve",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        USER_ID,
        new Date("2026-02-14T00:00:00.000Z"),
      ],
      fallback: "Failed to resolve problem",
      invalidPayload: { resolvedDate: "valentines" },
    },
    {
      handler: "resolve",
      params: { organisationId: ORG_ID, problemId: RECORD_ID },
      body: {},
      serviceMethod: "resolve",
      expectArgs: [RECORD_ID, ORG_ID, USER_ID, undefined],
      fallback: "Failed to resolve problem",
    },
  ],
});
