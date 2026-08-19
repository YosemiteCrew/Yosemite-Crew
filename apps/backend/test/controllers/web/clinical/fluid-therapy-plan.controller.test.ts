import { jest } from "@jest/globals";
import { FluidTherapyPlanController } from "src/controllers/web/fluid-therapy-plan.controller";
import {
  FluidTherapyPlanService,
  FluidTherapyPlanError,
} from "src/services/fluid-therapy-plan.service";
import {
  ENCOUNTER_ID,
  ORG_ID,
  PATIENT_ID,
  RECORD_ID,
  SECOND_ID,
  USER_ID,
  runClinicalControllerSuite,
} from "./clinical-suite";

jest.mock("src/services/fluid-therapy-plan.service", () => {
  const actual = jest.requireActual(
    "src/services/fluid-therapy-plan.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    FluidTherapyPlanService: {
      list: jest.fn(),
      create: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
    },
  };
});

runClinicalControllerSuite({
  name: "FluidTherapyPlanController",
  controller: FluidTherapyPlanController,
  service: FluidTherapyPlanService as unknown as Record<string, unknown>,
  errorClass: FluidTherapyPlanError,
  cases: [
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      query: {
        patientId: PATIENT_ID,
        admissionId: SECOND_ID,
        status: "ACTIVE",
      },
      serviceMethod: "list",
      expectArgs: [
        {
          organisationId: ORG_ID,
          patientId: PATIENT_ID,
          admissionId: SECOND_ID,
          status: "ACTIVE",
        },
      ],
      fallback: "Failed to list fluid therapy plans",
      invalidPayload: { status: "STOPPED" },
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      body: {
        patientId: PATIENT_ID,
        encounterId: ENCOUNTER_ID,
        fluidType: "LACTATED_RINGERS",
        rateMlPerHour: 45,
        totalVolumeMl: 540,
        startedAt: "2026-02-25T07:00:00.000Z",
        endedAt: "2026-02-25T19:00:00.000Z",
        indication: "Dehydration",
      },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          prescribedBy: USER_ID,
          patientId: PATIENT_ID,
          encounterId: ENCOUNTER_ID,
          fluidType: "LACTATED_RINGERS",
          rateMlPerHour: 45,
          totalVolumeMl: 540,
          indication: "Dehydration",
          startedAt: new Date("2026-02-25T07:00:00.000Z"),
          endedAt: new Date("2026-02-25T19:00:00.000Z"),
        },
      ],
      status: 201,
      fallback: "Failed to create fluid therapy plan",
      // The rate must be positive.
      invalidPayload: {
        patientId: PATIENT_ID,
        fluidType: "SALINE_09",
        rateMlPerHour: 0,
        startedAt: "2026-02-25T07:00:00.000Z",
      },
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      // An open-ended plan must not carry an `endedAt` key at all.
      body: {
        patientId: PATIENT_ID,
        fluidType: "CUSTOM",
        customFluidName: "Compounded electrolyte mix",
        rateMlPerHour: 20,
        startedAt: "2026-02-26T07:00:00.000Z",
      },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          prescribedBy: USER_ID,
          patientId: PATIENT_ID,
          fluidType: "CUSTOM",
          customFluidName: "Compounded electrolyte mix",
          rateMlPerHour: 20,
          startedAt: new Date("2026-02-26T07:00:00.000Z"),
        },
      ],
      status: 201,
      fallback: "Failed to create fluid therapy plan",
    },
    {
      handler: "get",
      params: { organisationId: ORG_ID, planId: RECORD_ID },
      serviceMethod: "get",
      expectArgs: [RECORD_ID, ORG_ID],
      fallback: "Failed to get fluid therapy plan",
    },
    {
      handler: "update",
      params: { organisationId: ORG_ID, planId: RECORD_ID },
      body: {
        status: "COMPLETED",
        endedAt: "2026-02-25T18:30:00.000Z",
        rateMlPerHour: 30,
      },
      serviceMethod: "update",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        {
          status: "COMPLETED",
          rateMlPerHour: 30,
          endedAt: new Date("2026-02-25T18:30:00.000Z"),
        },
        USER_ID,
      ],
      fallback: "Failed to update fluid therapy plan",
      invalidPayload: { rateMlPerHour: -5 },
    },
    {
      handler: "update",
      params: { organisationId: ORG_ID, planId: RECORD_ID },
      body: { status: "PAUSED" },
      serviceMethod: "update",
      expectArgs: [RECORD_ID, ORG_ID, { status: "PAUSED" }, USER_ID],
      fallback: "Failed to update fluid therapy plan",
    },
  ],
});
