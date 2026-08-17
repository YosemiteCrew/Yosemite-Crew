import { jest } from "@jest/globals";
import { SurgicalProcedureController } from "src/controllers/web/surgical-procedure.controller";
import {
  SurgicalProcedureService,
  SurgicalProcedureError,
} from "src/services/surgical-procedure.service";
import {
  ENCOUNTER_ID,
  ORG_ID,
  PATIENT_ID,
  RECORD_ID,
  USER_ID,
  runClinicalControllerSuite,
} from "./clinical-suite";

jest.mock("src/services/surgical-procedure.service", () => {
  const actual = jest.requireActual(
    "src/services/surgical-procedure.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    SurgicalProcedureService: {
      list: jest.fn(),
      create: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
    },
  };
});

runClinicalControllerSuite({
  name: "SurgicalProcedureController",
  controller: SurgicalProcedureController,
  service: SurgicalProcedureService as unknown as Record<string, unknown>,
  errorClass: SurgicalProcedureError,
  cases: [
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      query: { patientId: PATIENT_ID, outcome: "SUCCESS" },
      serviceMethod: "list",
      expectArgs: [
        { organisationId: ORG_ID, patientId: PATIENT_ID, outcome: "SUCCESS" },
      ],
      fallback: "Failed to list surgical procedures",
      invalidPayload: { outcome: "FINE" },
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      body: {
        patientId: PATIENT_ID,
        encounterId: ENCOUNTER_ID,
        procedureName: "Ovariohysterectomy",
        surgeon: "Dr Ito",
        assistants: ["Nurse Bell"],
        anesthesiaType: "GENERAL",
        startedAt: "2026-03-21T09:00:00.000Z",
        endedAt: "2026-03-21T10:05:00.000Z",
        durationMinutes: 65,
        outcome: "SUCCESS",
        specimensSent: ["Ovaries"],
      },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          performedBy: USER_ID,
          patientId: PATIENT_ID,
          encounterId: ENCOUNTER_ID,
          procedureName: "Ovariohysterectomy",
          surgeon: "Dr Ito",
          assistants: ["Nurse Bell"],
          anesthesiaType: "GENERAL",
          durationMinutes: 65,
          outcome: "SUCCESS",
          specimensSent: ["Ovaries"],
          startedAt: new Date("2026-03-21T09:00:00.000Z"),
          endedAt: new Date("2026-03-21T10:05:00.000Z"),
        },
      ],
      status: 201,
      fallback: "Failed to record surgical procedure",
      // The procedure name is mandatory.
      invalidPayload: { patientId: PATIENT_ID, procedureName: "" },
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      // No timings recorded yet: neither date key is rewritten.
      body: { patientId: PATIENT_ID, procedureName: "Wound debridement" },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          performedBy: USER_ID,
          patientId: PATIENT_ID,
          procedureName: "Wound debridement",
        },
      ],
      status: 201,
      fallback: "Failed to record surgical procedure",
    },
    {
      handler: "get",
      params: { organisationId: ORG_ID, procedureId: RECORD_ID },
      serviceMethod: "get",
      expectArgs: [RECORD_ID, ORG_ID],
      fallback: "Failed to get surgical procedure",
    },
    {
      handler: "update",
      params: { organisationId: ORG_ID, procedureId: RECORD_ID },
      body: {
        procedureName: "Ovariohysterectomy",
        outcome: "COMPLICATION",
        complications: "Minor haemorrhage, controlled",
        endedAt: "2026-03-21T10:30:00.000Z",
      },
      serviceMethod: "update",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        {
          procedureName: "Ovariohysterectomy",
          outcome: "COMPLICATION",
          complications: "Minor haemorrhage, controlled",
          endedAt: new Date("2026-03-21T10:30:00.000Z"),
        },
        USER_ID,
      ],
      fallback: "Failed to update surgical procedure",
      invalidPayload: { procedureName: "Repair", anesthesiaDoseMs: -1 },
    },
  ],
});
