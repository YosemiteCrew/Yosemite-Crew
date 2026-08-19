import { jest } from "@jest/globals";
import { ReproductiveRecordController } from "src/controllers/web/reproductive-record.controller";
import {
  ReproductiveRecordService,
  ReproductiveRecordError,
} from "src/services/reproductive-record.service";
import {
  ORG_ID,
  PATIENT_ID,
  RECORD_ID,
  SECOND_ID,
  USER_ID,
  runClinicalControllerSuite,
} from "./clinical-suite";

jest.mock("src/services/reproductive-record.service", () => {
  const actual = jest.requireActual(
    "src/services/reproductive-record.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    ReproductiveRecordService: {
      list: jest.fn(),
      create: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
    },
  };
});

runClinicalControllerSuite({
  name: "ReproductiveRecordController",
  controller: ReproductiveRecordController,
  service: ReproductiveRecordService as unknown as Record<string, unknown>,
  errorClass: ReproductiveRecordError,
  cases: [
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      query: { patientId: PATIENT_ID, reproductiveStatus: "INTACT" },
      serviceMethod: "list",
      expectArgs: [
        {
          organisationId: ORG_ID,
          patientId: PATIENT_ID,
          reproductiveStatus: "INTACT",
        },
      ],
      fallback: "Failed to list reproductive records",
      invalidPayload: { reproductiveStatus: "FIXED" },
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      // Every one of the six optional dates must be coerced.
      body: {
        patientId: PATIENT_ID,
        reproductiveStatus: "INTACT",
        lastHeatDate: "2026-01-05T00:00:00.000Z",
        nextHeatExpected: "2026-07-05T00:00:00.000Z",
        matingDate: "2026-01-12T00:00:00.000Z",
        sireId: SECOND_ID,
        sireName: "Baxter",
        pregnancyStatus: "CONFIRMED",
        pregnancyConfirmedAt: "2026-02-02T00:00:00.000Z",
        expectedWhelp: "2026-03-16T00:00:00.000Z",
        actualWhelp: "2026-03-15T00:00:00.000Z",
        litterSizeUltrasound: 6,
        litterSizeBorn: 5,
        litterSizeAlive: 5,
      },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          recordedBy: USER_ID,
          patientId: PATIENT_ID,
          reproductiveStatus: "INTACT",
          sireId: SECOND_ID,
          sireName: "Baxter",
          pregnancyStatus: "CONFIRMED",
          litterSizeUltrasound: 6,
          litterSizeBorn: 5,
          litterSizeAlive: 5,
          lastHeatDate: new Date("2026-01-05T00:00:00.000Z"),
          nextHeatExpected: new Date("2026-07-05T00:00:00.000Z"),
          matingDate: new Date("2026-01-12T00:00:00.000Z"),
          pregnancyConfirmedAt: new Date("2026-02-02T00:00:00.000Z"),
          expectedWhelp: new Date("2026-03-16T00:00:00.000Z"),
          actualWhelp: new Date("2026-03-15T00:00:00.000Z"),
        },
      ],
      status: 201,
      fallback: "Failed to create reproductive record",
      // Litter sizes cannot be negative.
      invalidPayload: {
        patientId: PATIENT_ID,
        reproductiveStatus: "INTACT",
        litterSizeBorn: -1,
      },
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      // With no dates at all every coerced field must come through undefined.
      body: { patientId: PATIENT_ID, reproductiveStatus: "SPAYED" },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          recordedBy: USER_ID,
          patientId: PATIENT_ID,
          reproductiveStatus: "SPAYED",
          lastHeatDate: undefined,
          nextHeatExpected: undefined,
          matingDate: undefined,
          pregnancyConfirmedAt: undefined,
          expectedWhelp: undefined,
          actualWhelp: undefined,
        },
      ],
      status: 201,
      fallback: "Failed to create reproductive record",
    },
    {
      handler: "get",
      params: { organisationId: ORG_ID, recordId: RECORD_ID },
      serviceMethod: "get",
      expectArgs: [RECORD_ID, ORG_ID],
      fallback: "Failed to get reproductive record",
    },
    {
      handler: "update",
      params: { organisationId: ORG_ID, recordId: RECORD_ID },
      body: {
        pregnancyStatus: "WHELPED",
        actualWhelp: "2026-03-15T04:20:00.000Z",
        litterSizeAlive: 4,
      },
      serviceMethod: "update",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        {
          pregnancyStatus: "WHELPED",
          litterSizeAlive: 4,
          lastHeatDate: undefined,
          nextHeatExpected: undefined,
          matingDate: undefined,
          pregnancyConfirmedAt: undefined,
          expectedWhelp: undefined,
          actualWhelp: new Date("2026-03-15T04:20:00.000Z"),
        },
        USER_ID,
      ],
      fallback: "Failed to update reproductive record",
      invalidPayload: { pregnancyStatus: "MAYBE" },
    },
  ],
});
