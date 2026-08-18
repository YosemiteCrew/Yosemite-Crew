import { jest } from "@jest/globals";
import { PhysiotherapyPlanController } from "src/controllers/web/physiotherapy-plan.controller";
import {
  PhysiotherapyPlanService,
  PhysiotherapyPlanError,
} from "src/services/physiotherapy-plan.service";
import {
  ENCOUNTER_ID,
  ORG_ID,
  PATIENT_ID,
  RECORD_ID,
  SECOND_ID,
  USER_ID,
  runClinicalControllerSuite,
} from "./clinical-suite";

jest.mock("src/services/physiotherapy-plan.service", () => {
  const actual = jest.requireActual(
    "src/services/physiotherapy-plan.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    PhysiotherapyPlanService: {
      list: jest.fn(),
      create: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
    },
  };
});

runClinicalControllerSuite({
  name: "PhysiotherapyPlanController",
  controller: PhysiotherapyPlanController,
  service: PhysiotherapyPlanService as unknown as Record<string, unknown>,
  errorClass: PhysiotherapyPlanError,
  cases: [
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      query: { patientId: PATIENT_ID, status: "ACTIVE" },
      serviceMethod: "list",
      expectArgs: [
        { organisationId: ORG_ID, patientId: PATIENT_ID, status: "ACTIVE" },
      ],
      fallback: "Failed to list physiotherapy plans",
      invalidPayload: { status: "PENDING" },
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      body: {
        patientId: PATIENT_ID,
        encounterId: ENCOUNTER_ID,
        surgicalProcedureId: SECOND_ID,
        diagnosis: "Post TPLO rehabilitation",
        goals: "Restore full weight bearing",
        frequency: "Twice weekly",
        durationMinutes: 45,
        totalSessions: 12,
        hydrotherapy: true,
        laserTherapy: true,
        startDate: "2026-03-16T09:00:00.000Z",
        endDate: "2026-05-16T09:00:00.000Z",
        nextSessionAt: "2026-03-18T09:00:00.000Z",
        therapist: "Sam Choi",
      },
      serviceMethod: "create",
      // The handler rebuilds the payload field by field, so every mapped
      // property must arrive with its dates coerced.
      expectArgs: [
        {
          organisationId: ORG_ID,
          prescribedBy: USER_ID,
          patientId: PATIENT_ID,
          encounterId: ENCOUNTER_ID,
          surgicalProcedureId: SECOND_ID,
          diagnosis: "Post TPLO rehabilitation",
          goals: "Restore full weight bearing",
          frequency: "Twice weekly",
          durationMinutes: 45,
          totalSessions: 12,
          exercisePrescription: undefined,
          hydrotherapy: true,
          laserTherapy: true,
          therapeuticUltrasound: undefined,
          massage: undefined,
          acupuncture: undefined,
          tapeApplication: undefined,
          precautions: undefined,
          homeExercises: undefined,
          startDate: new Date("2026-03-16T09:00:00.000Z"),
          endDate: new Date("2026-05-16T09:00:00.000Z"),
          nextSessionAt: new Date("2026-03-18T09:00:00.000Z"),
          therapist: "Sam Choi",
          notes: undefined,
        },
      ],
      status: 201,
      fallback: "Failed to create physiotherapy plan",
      // The diagnosis is mandatory.
      invalidPayload: { patientId: PATIENT_ID, diagnosis: "" },
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      // No dates supplied at all: each coercion must yield `undefined`.
      body: { patientId: PATIENT_ID, diagnosis: "Hip dysplasia support" },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          prescribedBy: USER_ID,
          patientId: PATIENT_ID,
          diagnosis: "Hip dysplasia support",
          startDate: undefined,
          endDate: undefined,
          nextSessionAt: undefined,
        },
      ],
      status: 201,
      fallback: "Failed to create physiotherapy plan",
    },
    {
      handler: "get",
      params: { organisationId: ORG_ID, planId: RECORD_ID },
      serviceMethod: "get",
      expectArgs: [RECORD_ID, ORG_ID],
      fallback: "Failed to get physiotherapy plan",
    },
    {
      handler: "update",
      params: { organisationId: ORG_ID, planId: RECORD_ID },
      body: {
        status: "COMPLETED",
        lastSessionAt: "2026-05-10T09:00:00.000Z",
        nextSessionAt: "2026-05-17T09:00:00.000Z",
        totalSessions: 14,
      },
      serviceMethod: "update",
      // Only the four declared date keys are coerced; everything else is
      // forwarded untouched.
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        {
          status: "COMPLETED",
          totalSessions: 14,
          lastSessionAt: new Date("2026-05-10T09:00:00.000Z"),
          nextSessionAt: new Date("2026-05-17T09:00:00.000Z"),
        },
        USER_ID,
      ],
      fallback: "Failed to update physiotherapy plan",
      invalidPayload: { durationMinutes: 0 },
    },
    {
      handler: "update",
      params: { organisationId: ORG_ID, planId: RECORD_ID },
      body: { precautions: "No stairs for two weeks" },
      serviceMethod: "update",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        { precautions: "No stairs for two weeks" },
        USER_ID,
      ],
      fallback: "Failed to update physiotherapy plan",
    },
  ],
});
