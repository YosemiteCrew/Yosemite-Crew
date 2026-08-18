import { jest } from "@jest/globals";
import { MARController } from "src/controllers/web/mar.controller";
import { MARService, MARError } from "src/services/mar.service";
import {
  ENCOUNTER_ID,
  ORG_ID,
  PATIENT_ID,
  RECORD_ID,
  SECOND_ID,
  USER_ID,
  runClinicalControllerSuite,
} from "./clinical-suite";

jest.mock("src/services/mar.service", () => {
  const actual = jest.requireActual("src/services/mar.service") as Record<
    string,
    unknown
  >;
  return {
    ...actual,
    MARService: {
      list: jest.fn(),
      create: jest.fn(),
      get: jest.fn(),
      administer: jest.fn(),
      hold: jest.fn(),
      markMissed: jest.fn(),
    },
  };
});

runClinicalControllerSuite({
  name: "MARController",
  controller: MARController,
  service: MARService as unknown as Record<string, unknown>,
  errorClass: MARError,
  cases: [
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      query: {
        patientId: PATIENT_ID,
        status: "SCHEDULED",
        from: "2026-03-01T00:00:00.000Z",
        to: "2026-03-02T00:00:00.000Z",
      },
      serviceMethod: "list",
      expectArgs: [
        {
          organisationId: ORG_ID,
          patientId: PATIENT_ID,
          status: "SCHEDULED",
          from: new Date("2026-03-01T00:00:00.000Z"),
          to: new Date("2026-03-02T00:00:00.000Z"),
        },
      ],
      fallback: "Failed to list MAR entries",
      invalidPayload: { status: "SKIPPED" },
    },
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      query: { encounterId: ENCOUNTER_ID },
      serviceMethod: "list",
      expectArgs: [{ organisationId: ORG_ID, encounterId: ENCOUNTER_ID }],
      fallback: "Failed to list MAR entries",
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      body: {
        patientId: PATIENT_ID,
        encounterId: ENCOUNTER_ID,
        prescriptionId: SECOND_ID,
        medicationName: "Buprenorphine",
        dose: "0.02 mg/kg",
        route: "IV",
        scheduledAt: "2026-03-01T08:00:00.000Z",
      },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          createdBy: USER_ID,
          patientId: PATIENT_ID,
          encounterId: ENCOUNTER_ID,
          prescriptionId: SECOND_ID,
          medicationName: "Buprenorphine",
          dose: "0.02 mg/kg",
          route: "IV",
          scheduledAt: new Date("2026-03-01T08:00:00.000Z"),
        },
      ],
      status: 201,
      fallback: "Failed to create MAR entry",
      // The dose may not be blank.
      invalidPayload: {
        patientId: PATIENT_ID,
        medicationName: "Buprenorphine",
        dose: "",
        route: "IV",
        scheduledAt: "2026-03-01T08:00:00.000Z",
      },
    },
    {
      handler: "get",
      params: { organisationId: ORG_ID, marEntryId: RECORD_ID },
      serviceMethod: "get",
      expectArgs: [RECORD_ID, ORG_ID],
      fallback: "Failed to get MAR entry",
    },
    {
      handler: "administer",
      params: { organisationId: ORG_ID, marEntryId: RECORD_ID },
      body: {
        administeredAt: "2026-03-01T08:05:00.000Z",
        notes: "Given with food",
      },
      serviceMethod: "administer",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        {
          notes: "Given with food",
          administeredBy: USER_ID,
          administeredAt: new Date("2026-03-01T08:05:00.000Z"),
        },
      ],
      fallback: "Failed to administer MAR entry",
      invalidPayload: { administeredAt: "just now" },
    },
    {
      handler: "administer",
      params: { organisationId: ORG_ID, marEntryId: RECORD_ID },
      // Without an explicit time the service is left to stamp its own, so the
      // key must be absent rather than an Invalid Date.
      body: {},
      serviceMethod: "administer",
      expectArgs: [RECORD_ID, ORG_ID, { administeredBy: USER_ID }],
      fallback: "Failed to administer MAR entry",
    },
    {
      handler: "hold",
      params: { organisationId: ORG_ID, marEntryId: RECORD_ID },
      body: { notes: "Patient vomiting" },
      serviceMethod: "hold",
      expectArgs: [RECORD_ID, ORG_ID, "Patient vomiting", USER_ID],
      fallback: "Failed to hold MAR entry",
      invalidPayload: { notes: 12 },
    },
    {
      handler: "markMissed",
      params: { organisationId: ORG_ID, marEntryId: RECORD_ID },
      body: {},
      serviceMethod: "markMissed",
      expectArgs: [RECORD_ID, ORG_ID, undefined, USER_ID],
      fallback: "Failed to mark MAR entry as missed",
    },
  ],
});
