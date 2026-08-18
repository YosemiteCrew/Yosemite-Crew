import { jest } from "@jest/globals";
import { EmergencyTriageController } from "src/controllers/web/emergency-triage.controller";
import {
  EmergencyTriageService,
  EmergencyTriageError,
} from "src/services/emergency-triage.service";
import {
  ENCOUNTER_ID,
  ORG_ID,
  PATIENT_ID,
  RECORD_ID,
  USER_ID,
  runClinicalControllerSuite,
} from "./clinical-suite";

jest.mock("src/services/emergency-triage.service", () => {
  const actual = jest.requireActual(
    "src/services/emergency-triage.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    EmergencyTriageService: {
      list: jest.fn(),
      record: jest.fn(),
      get: jest.fn(),
      escalate: jest.fn(),
    },
  };
});

runClinicalControllerSuite({
  name: "EmergencyTriageController",
  controller: EmergencyTriageController,
  service: EmergencyTriageService as unknown as Record<string, unknown>,
  errorClass: EmergencyTriageError,
  cases: [
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      query: {
        patientId: PATIENT_ID,
        from: "2026-02-01T00:00:00.000Z",
        to: "2026-02-28T00:00:00.000Z",
      },
      serviceMethod: "list",
      expectArgs: [
        {
          organisationId: ORG_ID,
          patientId: PATIENT_ID,
          from: new Date("2026-02-01T00:00:00.000Z"),
          to: new Date("2026-02-28T00:00:00.000Z"),
        },
      ],
      fallback: "Failed to list triage records",
      invalidPayload: { to: "end of month" },
    },
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      query: { encounterId: ENCOUNTER_ID },
      serviceMethod: "list",
      expectArgs: [{ organisationId: ORG_ID, encounterId: ENCOUNTER_ID }],
      fallback: "Failed to list triage records",
    },
    {
      handler: "record",
      params: { organisationId: ORG_ID },
      body: {
        patientId: PATIENT_ID,
        encounterId: ENCOUNTER_ID,
        triagePriority: "IMMEDIATE",
        chiefComplaint: "Collapse and pale gums",
        presentationAt: "2026-02-22T02:10:00.000Z",
        heartRate: 190,
        respiratoryRate: 60,
        temperature: 37.2,
        oxygenSaturation: 91,
        capillaryRefillTime: 3,
        mentalStatus: "Obtunded",
      },
      serviceMethod: "record",
      expectArgs: [
        {
          organisationId: ORG_ID,
          triageBy: USER_ID,
          patientId: PATIENT_ID,
          encounterId: ENCOUNTER_ID,
          triagePriority: "IMMEDIATE",
          chiefComplaint: "Collapse and pale gums",
          heartRate: 190,
          respiratoryRate: 60,
          temperature: 37.2,
          oxygenSaturation: 91,
          capillaryRefillTime: 3,
          mentalStatus: "Obtunded",
          presentationAt: new Date("2026-02-22T02:10:00.000Z"),
        },
      ],
      status: 201,
      fallback: "Failed to record triage",
      // The chief complaint may not be blank.
      invalidPayload: {
        patientId: PATIENT_ID,
        triagePriority: "URGENT",
        chiefComplaint: "",
        presentationAt: "2026-02-22T02:10:00.000Z",
      },
    },
    {
      handler: "get",
      params: { organisationId: ORG_ID, triageId: RECORD_ID },
      serviceMethod: "get",
      expectArgs: [RECORD_ID, ORG_ID],
      fallback: "Failed to get triage record",
    },
    {
      handler: "escalate",
      params: { organisationId: ORG_ID, triageId: RECORD_ID },
      body: { escalatedReason: "Deteriorating respiratory effort" },
      serviceMethod: "escalate",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        { escalatedReason: "Deteriorating respiratory effort" },
        USER_ID,
      ],
      fallback: "Failed to escalate triage",
      invalidPayload: { escalatedReason: "" },
    },
  ],
});
