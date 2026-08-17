import { jest } from "@jest/globals";
import { DischargeInstructionController } from "src/controllers/web/discharge-instruction.controller";
import {
  DischargeInstructionService,
  DischargeInstructionError,
} from "src/services/discharge-instruction.service";
import {
  ENCOUNTER_ID,
  ORG_ID,
  PATIENT_ID,
  RECORD_ID,
  USER_ID,
  runClinicalControllerSuite,
} from "./clinical-suite";

jest.mock("src/services/discharge-instruction.service", () => {
  const actual = jest.requireActual(
    "src/services/discharge-instruction.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    DischargeInstructionService: {
      list: jest.fn(),
      create: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      send: jest.fn(),
      acknowledge: jest.fn(),
    },
  };
});

runClinicalControllerSuite({
  name: "DischargeInstructionController",
  controller: DischargeInstructionController,
  service: DischargeInstructionService as unknown as Record<string, unknown>,
  errorClass: DischargeInstructionError,
  cases: [
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      query: { patientId: PATIENT_ID, status: "SENT" },
      serviceMethod: "list",
      expectArgs: [
        { organisationId: ORG_ID, patientId: PATIENT_ID, status: "SENT" },
      ],
      fallback: "Failed to list discharge instructions",
      invalidPayload: { status: "POSTED" },
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      body: {
        patientId: PATIENT_ID,
        encounterId: ENCOUNTER_ID,
        medicationSchedule: "Meloxicam 0.5ml once daily",
        warningSigns: "Vomiting, lethargy",
        followUpDate: "2026-03-10T09:00:00.000Z",
      },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          preparedBy: USER_ID,
          patientId: PATIENT_ID,
          encounterId: ENCOUNTER_ID,
          medicationSchedule: "Meloxicam 0.5ml once daily",
          warningSigns: "Vomiting, lethargy",
          followUpDate: new Date("2026-03-10T09:00:00.000Z"),
        },
      ],
      status: 201,
      fallback: "Failed to create discharge instructions",
      invalidPayload: { patientId: PATIENT_ID, followUpDate: "soon" },
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      // No follow-up booked: the key must be absent from the payload.
      body: { patientId: PATIENT_ID, dietaryNotes: "Bland diet for 3 days" },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          preparedBy: USER_ID,
          patientId: PATIENT_ID,
          dietaryNotes: "Bland diet for 3 days",
        },
      ],
      status: 201,
      fallback: "Failed to create discharge instructions",
    },
    {
      handler: "get",
      params: { organisationId: ORG_ID, dischargeId: RECORD_ID },
      serviceMethod: "get",
      expectArgs: [RECORD_ID, ORG_ID],
      fallback: "Failed to get discharge instructions",
    },
    {
      handler: "update",
      params: { organisationId: ORG_ID, dischargeId: RECORD_ID },
      body: {
        activityNotes: "Lead walks only",
        followUpDate: "2026-03-12T09:00:00.000Z",
      },
      serviceMethod: "update",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        {
          activityNotes: "Lead walks only",
          followUpDate: new Date("2026-03-12T09:00:00.000Z"),
        },
      ],
      fallback: "Failed to update discharge instructions",
      invalidPayload: { activityNotes: 7 },
    },
    {
      handler: "update",
      params: { organisationId: ORG_ID, dischargeId: RECORD_ID },
      body: { woundCareNotes: "Keep the dressing dry" },
      serviceMethod: "update",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        { woundCareNotes: "Keep the dressing dry" },
      ],
      fallback: "Failed to update discharge instructions",
    },
    {
      handler: "send",
      params: { organisationId: ORG_ID, dischargeId: RECORD_ID },
      serviceMethod: "send",
      expectArgs: [RECORD_ID, ORG_ID, USER_ID],
      fallback: "Failed to send discharge instructions",
    },
    {
      handler: "acknowledge",
      params: { organisationId: ORG_ID, dischargeId: RECORD_ID },
      serviceMethod: "acknowledge",
      expectArgs: [RECORD_ID, ORG_ID],
      fallback: "Failed to acknowledge discharge instructions",
    },
  ],
});
