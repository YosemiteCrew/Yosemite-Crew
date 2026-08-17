import { jest } from "@jest/globals";
import { BloodTransfusionController } from "src/controllers/web/blood-transfusion.controller";
import {
  BloodTransfusionService,
  BloodTransfusionError,
} from "src/services/blood-transfusion.service";
import {
  ENCOUNTER_ID,
  ORG_ID,
  PATIENT_ID,
  RECORD_ID,
  USER_ID,
  runClinicalControllerSuite,
} from "./clinical-suite";

jest.mock("src/services/blood-transfusion.service", () => {
  const actual = jest.requireActual(
    "src/services/blood-transfusion.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    BloodTransfusionService: {
      list: jest.fn(),
      record: jest.fn(),
      get: jest.fn(),
      reportReaction: jest.fn(),
      update: jest.fn(),
    },
  };
});

runClinicalControllerSuite({
  name: "BloodTransfusionController",
  controller: BloodTransfusionController,
  service: BloodTransfusionService as unknown as Record<string, unknown>,
  errorClass: BloodTransfusionError,
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
      fallback: "Failed to list transfusions",
      invalidPayload: { encounterId: "not-a-uuid" },
    },
    {
      handler: "record",
      params: { organisationId: ORG_ID },
      body: {
        patientId: PATIENT_ID,
        productType: "Packed red blood cells",
        bloodType: "DEA_1_NEGATIVE",
        volumeMl: 120,
        startedAt: "2026-02-14T09:00:00.000Z",
        endedAt: "2026-02-14T12:00:00.000Z",
        crossMatchDone: true,
        preTransfusionPCV: 18,
      },
      serviceMethod: "record",
      expectArgs: [
        {
          organisationId: ORG_ID,
          administeredBy: USER_ID,
          patientId: PATIENT_ID,
          productType: "Packed red blood cells",
          bloodType: "DEA_1_NEGATIVE",
          volumeMl: 120,
          crossMatchDone: true,
          preTransfusionPCV: 18,
          startedAt: new Date("2026-02-14T09:00:00.000Z"),
          endedAt: new Date("2026-02-14T12:00:00.000Z"),
        },
      ],
      status: 201,
      fallback: "Failed to record transfusion",
      // volumeMl must be positive.
      invalidPayload: {
        patientId: PATIENT_ID,
        productType: "Plasma",
        bloodType: "TYPE_A",
        volumeMl: -1,
        startedAt: "2026-02-14T09:00:00.000Z",
      },
    },
    {
      handler: "record",
      params: { organisationId: ORG_ID },
      // A transfusion still running has no `endedAt`, so the key must not be
      // added by the date parser.
      body: {
        patientId: PATIENT_ID,
        productType: "Whole blood",
        bloodType: "UNKNOWN",
        volumeMl: 60,
        startedAt: "2026-02-15T09:00:00.000Z",
      },
      serviceMethod: "record",
      expectArgs: [
        {
          organisationId: ORG_ID,
          administeredBy: USER_ID,
          patientId: PATIENT_ID,
          productType: "Whole blood",
          bloodType: "UNKNOWN",
          volumeMl: 60,
          startedAt: new Date("2026-02-15T09:00:00.000Z"),
        },
      ],
      status: 201,
      fallback: "Failed to record transfusion",
    },
    {
      handler: "get",
      params: { organisationId: ORG_ID, transfusionId: RECORD_ID },
      serviceMethod: "get",
      expectArgs: [RECORD_ID, ORG_ID],
      fallback: "Failed to get transfusion",
    },
    {
      handler: "reportReaction",
      params: { organisationId: ORG_ID, transfusionId: RECORD_ID },
      body: { reaction: "FEBRILE", reactionNotes: "Temp rose to 39.8" },
      serviceMethod: "reportReaction",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        { reaction: "FEBRILE", reactionNotes: "Temp rose to 39.8" },
        USER_ID,
      ],
      fallback: "Failed to report reaction",
      invalidPayload: { reaction: "ITCHY" },
    },
    {
      handler: "update",
      params: { organisationId: ORG_ID, transfusionId: RECORD_ID },
      body: {
        endedAt: "2026-02-14T12:30:00.000Z",
        durationMinutes: 210,
        postTransfusionPCV: 26,
      },
      serviceMethod: "update",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        {
          durationMinutes: 210,
          postTransfusionPCV: 26,
          endedAt: new Date("2026-02-14T12:30:00.000Z"),
        },
      ],
      fallback: "Failed to update transfusion",
      invalidPayload: { durationMinutes: 0 },
    },
    {
      handler: "update",
      params: { organisationId: ORG_ID, transfusionId: RECORD_ID },
      body: { crossMatchResult: "Compatible" },
      serviceMethod: "update",
      expectArgs: [RECORD_ID, ORG_ID, { crossMatchResult: "Compatible" }],
      fallback: "Failed to update transfusion",
    },
  ],
});
