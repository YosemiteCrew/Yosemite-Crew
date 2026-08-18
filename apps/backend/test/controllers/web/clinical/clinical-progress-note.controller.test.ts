import { jest } from "@jest/globals";
import { ClinicalProgressNoteController } from "src/controllers/web/clinical-progress-note.controller";
import {
  ClinicalProgressNoteService,
  ClinicalProgressNoteError,
} from "src/services/clinical-progress-note.service";
import {
  ENCOUNTER_ID,
  ORG_ID,
  PATIENT_ID,
  RECORD_ID,
  USER_ID,
  runClinicalControllerSuite,
} from "./clinical-suite";

jest.mock("src/services/clinical-progress-note.service", () => {
  const actual = jest.requireActual(
    "src/services/clinical-progress-note.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    ClinicalProgressNoteService: {
      list: jest.fn(),
      create: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      sign: jest.fn(),
    },
  };
});

runClinicalControllerSuite({
  name: "ClinicalProgressNoteController",
  controller: ClinicalProgressNoteController,
  service: ClinicalProgressNoteService as unknown as Record<string, unknown>,
  errorClass: ClinicalProgressNoteError,
  cases: [
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      query: {
        patientId: PATIENT_ID,
        encounterId: ENCOUNTER_ID,
        noteType: "NURSE_NOTE",
      },
      serviceMethod: "list",
      expectArgs: [
        {
          organisationId: ORG_ID,
          patientId: PATIENT_ID,
          encounterId: ENCOUNTER_ID,
          noteType: "NURSE_NOTE",
        },
      ],
      fallback: "Failed to list clinical notes",
      invalidPayload: { noteType: "SCRIBBLE" },
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      body: {
        patientId: PATIENT_ID,
        encounterId: ENCOUNTER_ID,
        noteType: "PROGRESS_NOTE",
        subjectiveFindings: "Bright, alert, responsive",
        assessment: "Improving",
        plan: "Continue fluids overnight",
      },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          authorId: USER_ID,
          patientId: PATIENT_ID,
          encounterId: ENCOUNTER_ID,
          noteType: "PROGRESS_NOTE",
          subjectiveFindings: "Bright, alert, responsive",
          assessment: "Improving",
          plan: "Continue fluids overnight",
        },
      ],
      status: 201,
      fallback: "Failed to create clinical note",
      invalidPayload: { patientId: PATIENT_ID },
    },
    {
      handler: "get",
      params: { organisationId: ORG_ID, noteId: RECORD_ID },
      serviceMethod: "get",
      expectArgs: [RECORD_ID, ORG_ID],
      fallback: "Failed to get clinical note",
    },
    {
      handler: "update",
      params: { organisationId: ORG_ID, noteId: RECORD_ID },
      body: { assessment: "Stable", plan: "Discharge tomorrow" },
      serviceMethod: "update",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        { assessment: "Stable", plan: "Discharge tomorrow" },
      ],
      fallback: "Failed to update clinical note",
      invalidPayload: { assessment: 5 },
    },
    {
      handler: "sign",
      params: { organisationId: ORG_ID, noteId: RECORD_ID },
      serviceMethod: "sign",
      expectArgs: [RECORD_ID, ORG_ID, USER_ID],
      fallback: "Failed to sign clinical note",
    },
    {
      handler: "sign",
      params: { organisationId: ORG_ID, noteId: RECORD_ID },
      // Signing without a resolved user records the "unknown" placeholder
      // rather than passing undefined through to the service.
      withoutUser: true,
      serviceMethod: "sign",
      expectArgs: [RECORD_ID, ORG_ID, "unknown"],
      fallback: "Failed to sign clinical note",
    },
  ],
});
