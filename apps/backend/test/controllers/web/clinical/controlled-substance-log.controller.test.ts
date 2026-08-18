import { jest } from "@jest/globals";
import { ControlledSubstanceLogController } from "src/controllers/web/controlled-substance-log.controller";
import {
  ControlledSubstanceLogService,
  ControlledSubstanceLogError,
} from "src/services/controlled-substance-log.service";
import {
  ENCOUNTER_ID,
  ORG_ID,
  PATIENT_ID,
  RECORD_ID,
  USER_ID,
  runClinicalControllerSuite,
} from "./clinical-suite";

jest.mock("src/services/controlled-substance-log.service", () => {
  const actual = jest.requireActual(
    "src/services/controlled-substance-log.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    ControlledSubstanceLogService: {
      list: jest.fn(),
      create: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
});

runClinicalControllerSuite({
  name: "ControlledSubstanceLogController",
  controller: ControlledSubstanceLogController,
  service: ControlledSubstanceLogService as unknown as Record<string, unknown>,
  errorClass: ControlledSubstanceLogError,
  cases: [
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      query: {
        patientId: PATIENT_ID,
        drug: "Methadone",
        deaSchedule: "II",
        fromDate: "2026-01-01T00:00:00.000Z",
        toDate: "2026-02-01T00:00:00.000Z",
      },
      serviceMethod: "list",
      expectArgs: [
        {
          organisationId: ORG_ID,
          patientId: PATIENT_ID,
          drug: "Methadone",
          deaSchedule: "II",
          fromDate: new Date("2026-01-01T00:00:00.000Z"),
          toDate: new Date("2026-02-01T00:00:00.000Z"),
        },
      ],
      fallback: "Failed to list controlled substance log entries",
      invalidPayload: { deaSchedule: "I" },
    },
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      query: {},
      serviceMethod: "list",
      expectArgs: [
        {
          organisationId: ORG_ID,
          patientId: undefined,
          drug: undefined,
          deaSchedule: undefined,
          fromDate: undefined,
          toDate: undefined,
        },
      ],
      fallback: "Failed to list controlled substance log entries",
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      body: {
        patientId: PATIENT_ID,
        encounterId: ENCOUNTER_ID,
        loggedAt: "2026-02-03T13:45:00.000Z",
        drug: "Methadone",
        deaSchedule: "II",
        lotNumber: "LOT-88",
        unit: "MG",
        amountDrawn: 10,
        amountAdministered: 8,
        amountWasted: 2,
        wastedWitness: "Nurse Patel",
        balanceBefore: 100,
        balanceAfter: 90,
      },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          administeredBy: USER_ID,
          patientId: PATIENT_ID,
          encounterId: ENCOUNTER_ID,
          drug: "Methadone",
          deaSchedule: "II",
          lotNumber: "LOT-88",
          unit: "MG",
          amountDrawn: 10,
          amountAdministered: 8,
          amountWasted: 2,
          wastedWitness: "Nurse Patel",
          balanceBefore: 100,
          balanceAfter: 90,
          loggedAt: new Date("2026-02-03T13:45:00.000Z"),
        },
      ],
      status: 201,
      fallback: "Failed to create controlled substance log entry",
      // amountDrawn must be positive.
      invalidPayload: {
        loggedAt: "2026-02-03T13:45:00.000Z",
        drug: "Methadone",
        deaSchedule: "II",
        unit: "MG",
        amountDrawn: 0,
        amountAdministered: 0,
      },
    },
    {
      handler: "get",
      params: { organisationId: ORG_ID, logId: RECORD_ID },
      serviceMethod: "get",
      expectArgs: [RECORD_ID, ORG_ID],
      fallback: "Failed to get controlled substance log entry",
    },
    {
      handler: "update",
      params: { organisationId: ORG_ID, logId: RECORD_ID },
      body: { amountWasted: 1.5, wastedWitness: "Dr Reid" },
      serviceMethod: "update",
      // correctedBy is stamped from the session and applied after the body
      // spread, so the DEA audit actor for a correction can never be
      // caller-controlled via `administeredBy`.
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        {
          amountWasted: 1.5,
          wastedWitness: "Dr Reid",
          correctedBy: "user_clinical_1",
        },
      ],
      fallback: "Failed to update controlled substance log entry",
      invalidPayload: { amountWasted: -1 },
    },
    {
      handler: "delete",
      params: { organisationId: ORG_ID, logId: RECORD_ID },
      serviceMethod: "delete",
      // Without voidedBy the service fell back to `existing.administeredBy`, so
      // the VOID audit named the original administrator as the reverser.
      expectArgs: [RECORD_ID, ORG_ID, { voidedBy: "user_clinical_1" }],
      status: 204,
      fallback: "Failed to delete controlled substance log entry",
    },
  ],
});
