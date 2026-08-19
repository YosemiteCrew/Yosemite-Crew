import { jest } from "@jest/globals";
import { GeneticHealthScreenController } from "src/controllers/web/genetic-health-screen.controller";
import {
  GeneticHealthScreenService,
  GeneticHealthScreenError,
} from "src/services/genetic-health-screen.service";
import {
  ENCOUNTER_ID,
  ORG_ID,
  PATIENT_ID,
  RECORD_ID,
  USER_ID,
  runClinicalControllerSuite,
} from "./clinical-suite";

jest.mock("src/services/genetic-health-screen.service", () => {
  const actual = jest.requireActual(
    "src/services/genetic-health-screen.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    GeneticHealthScreenService: {
      list: jest.fn(),
      create: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
});

const dnaTests = [
  {
    disease: "Degenerative myelopathy",
    gene: "SOD1",
    result: "CARRIER" as const,
    laboratoryId: "LAB-12",
  },
];

runClinicalControllerSuite({
  name: "GeneticHealthScreenController",
  controller: GeneticHealthScreenController,
  service: GeneticHealthScreenService as unknown as Record<string, unknown>,
  errorClass: GeneticHealthScreenError,
  cases: [
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      query: { patientId: PATIENT_ID, encounterId: ENCOUNTER_ID },
      serviceMethod: "list",
      expectArgs: [
        {
          organisationId: ORG_ID,
          patientId: PATIENT_ID,
          encounterId: ENCOUNTER_ID,
        },
      ],
      fallback: "Failed to list genetic health screens",
      invalidPayload: { patientId: "x".repeat(65) },
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      body: {
        patientId: PATIENT_ID,
        screenedAt: "2026-01-15T10:00:00.000Z",
        laboratoryName: "Embark",
        dnaTests,
        ofa_hips: "GOOD",
        certificateNumber: "OFA-9912",
        certificationExpiry: "2027-01-15T10:00:00.000Z",
      },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          screenedBy: USER_ID,
          patientId: PATIENT_ID,
          laboratoryName: "Embark",
          dnaTests,
          ofa_hips: "GOOD",
          certificateNumber: "OFA-9912",
          screenedAt: new Date("2026-01-15T10:00:00.000Z"),
          certificationExpiry: new Date("2027-01-15T10:00:00.000Z"),
        },
      ],
      status: 201,
      fallback: "Failed to create genetic health screen",
      // A DNA test row must name the disease and carry a known result.
      invalidPayload: {
        patientId: PATIENT_ID,
        screenedAt: "2026-01-15T10:00:00.000Z",
        dnaTests: [{ disease: "", result: "CLEAR" }],
      },
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      body: { patientId: PATIENT_ID, screenedAt: "2026-01-16T10:00:00.000Z" },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          screenedBy: USER_ID,
          patientId: PATIENT_ID,
          screenedAt: new Date("2026-01-16T10:00:00.000Z"),
          certificationExpiry: undefined,
        },
      ],
      status: 201,
      fallback: "Failed to create genetic health screen",
    },
    {
      handler: "get",
      params: { organisationId: ORG_ID, screenId: RECORD_ID },
      serviceMethod: "get",
      expectArgs: [RECORD_ID, ORG_ID],
      fallback: "Failed to get genetic health screen",
    },
    {
      handler: "update",
      params: { organisationId: ORG_ID, screenId: RECORD_ID },
      body: {
        ofa_elbows: "FAIR",
        certificationExpiry: "2028-01-15T10:00:00.000Z",
      },
      serviceMethod: "update",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        {
          ofa_elbows: "FAIR",
          certificationExpiry: new Date("2028-01-15T10:00:00.000Z"),
        },
      ],
      fallback: "Failed to update genetic health screen",
      invalidPayload: { ofa_hips: "PERFECT" },
    },
    {
      handler: "update",
      params: { organisationId: ORG_ID, screenId: RECORD_ID },
      body: { notes: "Recheck at two years" },
      serviceMethod: "update",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        { notes: "Recheck at two years", certificationExpiry: undefined },
      ],
      fallback: "Failed to update genetic health screen",
    },
    {
      handler: "delete",
      params: { organisationId: ORG_ID, screenId: RECORD_ID },
      serviceMethod: "delete",
      expectArgs: [RECORD_ID, ORG_ID],
      status: 204,
      fallback: "Failed to delete genetic health screen",
    },
  ],
});
