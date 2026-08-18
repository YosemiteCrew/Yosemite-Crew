import { jest } from "@jest/globals";
import { AftercarePlanController } from "src/controllers/web/aftercare-plan.controller";
import {
  AftercarePlanService,
  AftercarePlanError,
} from "src/services/aftercare-plan.service";
import {
  ORG_ID,
  PATIENT_ID,
  RECORD_ID,
  USER_ID,
  runClinicalControllerSuite,
} from "./clinical-suite";

jest.mock("src/services/aftercare-plan.service", () => {
  const actual = jest.requireActual(
    "src/services/aftercare-plan.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    AftercarePlanService: {
      list: jest.fn(),
      create: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
});

runClinicalControllerSuite({
  name: "AftercarePlanController",
  controller: AftercarePlanController,
  service: AftercarePlanService as unknown as Record<string, unknown>,
  errorClass: AftercarePlanError,
  cases: [
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      // `completed` arrives as a query string and must be transformed to a boolean.
      query: { patientId: PATIENT_ID, type: "BURIAL", completed: "true" },
      serviceMethod: "list",
      expectArgs: [
        {
          organisationId: ORG_ID,
          patientId: PATIENT_ID,
          type: "BURIAL",
          completed: true,
        },
      ],
      fallback: "Failed to list aftercare plans",
      invalidPayload: { patientId: "not-a-uuid" },
    },
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      query: { completed: "false" },
      serviceMethod: "list",
      expectArgs: [
        {
          organisationId: ORG_ID,
          patientId: undefined,
          type: undefined,
          completed: false,
        },
      ],
      fallback: "Failed to list aftercare plans",
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      body: {
        patientId: PATIENT_ID,
        type: "CREMATION_PRIVATE",
        provider: "Forever Paws",
        estimatedCost: 350,
        pawPrintRequested: true,
        urnsRequested: 1,
        completedAt: "2026-03-01T10:00:00.000Z",
      },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          recordedBy: USER_ID,
          patientId: PATIENT_ID,
          type: "CREMATION_PRIVATE",
          provider: "Forever Paws",
          estimatedCost: 350,
          pawPrintRequested: true,
          urnsRequested: 1,
          completedAt: new Date("2026-03-01T10:00:00.000Z"),
        },
      ],
      status: 201,
      fallback: "Failed to create aftercare plan",
      invalidPayload: { patientId: PATIENT_ID, type: "SPACE_BURIAL" },
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      // Without `completedAt` the coercion must yield `undefined`, not an
      // Invalid Date built from the missing string.
      body: { patientId: PATIENT_ID, type: "BURIAL" },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          recordedBy: USER_ID,
          patientId: PATIENT_ID,
          type: "BURIAL",
          completedAt: undefined,
        },
      ],
      status: 201,
      fallback: "Failed to create aftercare plan",
    },
    {
      handler: "get",
      params: { organisationId: ORG_ID, planId: RECORD_ID },
      serviceMethod: "get",
      expectArgs: [RECORD_ID, ORG_ID],
      fallback: "Failed to get aftercare plan",
    },
    {
      handler: "update",
      params: { organisationId: ORG_ID, planId: RECORD_ID },
      body: {
        provider: "Rainbow Bridge",
        completedAt: "2026-04-02T08:30:00.000Z",
      },
      serviceMethod: "update",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        {
          provider: "Rainbow Bridge",
          completedAt: new Date("2026-04-02T08:30:00.000Z"),
        },
      ],
      fallback: "Failed to update aftercare plan",
      invalidPayload: { provider: 42 },
    },
    {
      handler: "update",
      params: { organisationId: ORG_ID, planId: RECORD_ID },
      body: { notes: "Owner collecting the urn" },
      serviceMethod: "update",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        { notes: "Owner collecting the urn", completedAt: undefined },
      ],
      fallback: "Failed to update aftercare plan",
    },
    {
      handler: "delete",
      params: { organisationId: ORG_ID, planId: RECORD_ID },
      serviceMethod: "delete",
      expectArgs: [RECORD_ID, ORG_ID],
      status: 204,
      fallback: "Failed to delete aftercare plan",
    },
  ],
});
