import { jest } from "@jest/globals";
import { BodyConditionController } from "src/controllers/web/body-condition.controller";
import {
  BodyConditionService,
  BodyConditionError,
} from "src/services/body-condition.service";
import {
  ENCOUNTER_ID,
  ORG_ID,
  PATIENT_ID,
  RECORD_ID,
  USER_ID,
  runClinicalControllerSuite,
} from "./clinical-suite";

jest.mock("src/services/body-condition.service", () => {
  const actual = jest.requireActual(
    "src/services/body-condition.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    BodyConditionService: {
      list: jest.fn(),
      record: jest.fn(),
      get: jest.fn(),
      trend: jest.fn(),
      delete: jest.fn(),
    },
  };
});

runClinicalControllerSuite({
  name: "BodyConditionController",
  controller: BodyConditionController,
  service: BodyConditionService as unknown as Record<string, unknown>,
  errorClass: BodyConditionError,
  cases: [
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      query: {
        patientId: PATIENT_ID,
        bcsScale: "BCS_9",
        from: "2026-01-01T00:00:00.000Z",
        to: "2026-02-01T00:00:00.000Z",
      },
      serviceMethod: "list",
      // `from`/`to` are replaced by the `dateRange` Date filters.
      expectArgs: [
        {
          organisationId: ORG_ID,
          patientId: PATIENT_ID,
          bcsScale: "BCS_9",
          from: new Date("2026-01-01T00:00:00.000Z"),
          to: new Date("2026-02-01T00:00:00.000Z"),
        },
      ],
      fallback: "Failed to list body condition records",
      invalidPayload: { from: "last week" },
    },
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      // With no bounds supplied `dateRange` must omit both keys entirely.
      query: { encounterId: ENCOUNTER_ID },
      serviceMethod: "list",
      expectArgs: [
        {
          organisationId: ORG_ID,
          encounterId: ENCOUNTER_ID,
        },
      ],
      fallback: "Failed to list body condition records",
    },
    {
      handler: "record",
      params: { organisationId: ORG_ID },
      body: {
        patientId: PATIENT_ID,
        bcsScale: "BCS_9",
        bcsScore: 6,
        weightKg: 12.4,
        recordedAt: "2026-02-20T11:00:00.000Z",
      },
      serviceMethod: "record",
      expectArgs: [
        {
          organisationId: ORG_ID,
          recordedBy: USER_ID,
          patientId: PATIENT_ID,
          bcsScale: "BCS_9",
          bcsScore: 6,
          weightKg: 12.4,
          recordedAt: new Date("2026-02-20T11:00:00.000Z"),
        },
      ],
      status: 201,
      fallback: "Failed to record body condition",
      // bcsScore is capped at 9.
      invalidPayload: {
        patientId: PATIENT_ID,
        bcsScale: "BCS_9",
        bcsScore: 12,
        recordedAt: "2026-02-20T11:00:00.000Z",
      },
    },
    {
      handler: "get",
      params: { organisationId: ORG_ID, recordId: RECORD_ID },
      serviceMethod: "get",
      expectArgs: [RECORD_ID, ORG_ID],
      fallback: "Failed to get body condition record",
    },
    {
      handler: "trend",
      params: { organisationId: ORG_ID },
      // `limit` arrives as a query string and must be parsed to a number.
      query: { patientId: PATIENT_ID, limit: "5" },
      serviceMethod: "trend",
      expectArgs: [PATIENT_ID, ORG_ID, 5],
      fallback: "Failed to get body condition trend",
      invalidPayload: {},
    },
    {
      handler: "delete",
      params: { organisationId: ORG_ID, recordId: RECORD_ID },
      serviceMethod: "delete",
      expectArgs: [RECORD_ID, ORG_ID],
      status: 204,
      fallback: "Failed to delete body condition record",
    },
  ],
});
