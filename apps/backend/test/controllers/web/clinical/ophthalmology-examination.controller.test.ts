import { jest } from "@jest/globals";
import { OphthalmologyExaminationController } from "src/controllers/web/ophthalmology-examination.controller";
import {
  OphthalmologyExaminationService,
  OphthalmologyExaminationError,
} from "src/services/ophthalmology-examination.service";
import {
  ENCOUNTER_ID,
  ORG_ID,
  PATIENT_ID,
  RECORD_ID,
  USER_ID,
  runClinicalControllerSuite,
} from "./clinical-suite";

jest.mock("src/services/ophthalmology-examination.service", () => {
  const actual = jest.requireActual(
    "src/services/ophthalmology-examination.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    OphthalmologyExaminationService: {
      list: jest.fn(),
      create: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
});

const findingsLeft = {
  discharge: "MUCOID" as const,
  cornealClarity: "ULCER" as const,
  conjunctiva: "HYPERAEMIC" as const,
  notes: "Superficial ulcer, fluorescein positive",
};

runClinicalControllerSuite({
  name: "OphthalmologyExaminationController",
  controller: OphthalmologyExaminationController,
  service: OphthalmologyExaminationService as unknown as Record<
    string,
    unknown
  >,
  errorClass: OphthalmologyExaminationError,
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
      fallback: "Failed to list ophthalmology examinations",
      invalidPayload: { patientId: "x".repeat(65) },
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      body: {
        patientId: PATIENT_ID,
        examinedAt: "2026-03-11T13:00:00.000Z",
        visionLeft: "REDUCED",
        visionRight: "NORMAL",
        menaceLeft: false,
        plrDirectLeft: "SLUGGISH",
        sttLeft: 12,
        iopLeft: 18.5,
        fluoresceinLeft: true,
        findingsLeft,
        diagnoses: ["Corneal ulcer OS"],
      },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          examinedBy: USER_ID,
          patientId: PATIENT_ID,
          visionLeft: "REDUCED",
          visionRight: "NORMAL",
          menaceLeft: false,
          plrDirectLeft: "SLUGGISH",
          sttLeft: 12,
          iopLeft: 18.5,
          fluoresceinLeft: true,
          findingsLeft,
          diagnoses: ["Corneal ulcer OS"],
          examinedAt: new Date("2026-03-11T13:00:00.000Z"),
        },
      ],
      status: 201,
      fallback: "Failed to create ophthalmology examination",
      // Schirmer tear test readings are capped at 50mm.
      invalidPayload: {
        patientId: PATIENT_ID,
        examinedAt: "2026-03-11T13:00:00.000Z",
        sttLeft: 90,
      },
    },
    {
      handler: "get",
      params: { organisationId: ORG_ID, examId: RECORD_ID },
      serviceMethod: "get",
      expectArgs: [RECORD_ID, ORG_ID],
      fallback: "Failed to get ophthalmology examination",
    },
    {
      handler: "update",
      params: { organisationId: ORG_ID, examId: RECORD_ID },
      body: { visionLeft: "NORMAL", fluoresceinLeft: false },
      serviceMethod: "update",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        { visionLeft: "NORMAL", fluoresceinLeft: false },
      ],
      fallback: "Failed to update ophthalmology examination",
      invalidPayload: { findingsRight: { retina: "SPARKLY" } },
    },
    {
      handler: "delete",
      params: { organisationId: ORG_ID, examId: RECORD_ID },
      serviceMethod: "delete",
      expectArgs: [RECORD_ID, ORG_ID],
      status: 204,
      fallback: "Failed to delete ophthalmology examination",
    },
  ],
});
