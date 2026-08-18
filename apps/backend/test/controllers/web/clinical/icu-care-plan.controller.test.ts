import { jest } from "@jest/globals";
import { IcuCarePlanController } from "src/controllers/web/icu-care-plan.controller";
import {
  IcuCarePlanService,
  IcuCarePlanError,
} from "src/services/icu-care-plan.service";
import {
  ENCOUNTER_ID,
  ORG_ID,
  PATIENT_ID,
  RECORD_ID,
  USER_ID,
  runClinicalControllerSuite,
} from "./clinical-suite";

jest.mock("src/services/icu-care-plan.service", () => {
  const actual = jest.requireActual(
    "src/services/icu-care-plan.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    IcuCarePlanService: {
      list: jest.fn(),
      create: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      discharge: jest.fn(),
    },
  };
});

runClinicalControllerSuite({
  name: "IcuCarePlanController",
  controller: IcuCarePlanController,
  service: IcuCarePlanService as unknown as Record<string, unknown>,
  errorClass: IcuCarePlanError,
  cases: [
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      query: { patientId: PATIENT_ID, status: "ACTIVE" },
      serviceMethod: "list",
      expectArgs: [
        { organisationId: ORG_ID, patientId: PATIENT_ID, status: "ACTIVE" },
      ],
      fallback: "Failed to list ICU care plans",
      invalidPayload: { status: "STABLE" },
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      // An explicit primary vet must win over the session user.
      body: {
        patientId: PATIENT_ID,
        encounterId: ENCOUNTER_ID,
        admittedAt: "2026-02-27T21:00:00.000Z",
        onVentilator: true,
        hasCentralLine: true,
        primaryVet: "Dr Okafor",
        anticipatedDischarge: "2026-03-02T09:00:00.000Z",
      },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          primaryVet: "Dr Okafor",
          patientId: PATIENT_ID,
          encounterId: ENCOUNTER_ID,
          onVentilator: true,
          hasCentralLine: true,
          admittedAt: new Date("2026-02-27T21:00:00.000Z"),
          anticipatedDischarge: new Date("2026-03-02T09:00:00.000Z"),
        },
      ],
      status: 201,
      fallback: "Failed to create ICU care plan",
      invalidPayload: { patientId: PATIENT_ID, admittedAt: "tonight" },
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      // With no primary vet in the body the session user is recorded, and the
      // anticipated discharge key stays absent.
      body: {
        patientId: PATIENT_ID,
        admittedAt: "2026-02-28T21:00:00.000Z",
        dailyGoals: "Wean oxygen support",
      },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          primaryVet: USER_ID,
          patientId: PATIENT_ID,
          dailyGoals: "Wean oxygen support",
          admittedAt: new Date("2026-02-28T21:00:00.000Z"),
        },
      ],
      status: 201,
      fallback: "Failed to create ICU care plan",
    },
    {
      handler: "get",
      params: { organisationId: ORG_ID, planId: RECORD_ID },
      serviceMethod: "get",
      expectArgs: [RECORD_ID, ORG_ID],
      fallback: "Failed to get ICU care plan",
    },
    {
      handler: "update",
      params: { organisationId: ORG_ID, planId: RECORD_ID },
      body: {
        onOxygenSupport: false,
        anticipatedDischarge: "2026-03-03T09:00:00.000Z",
      },
      serviceMethod: "update",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        {
          onOxygenSupport: false,
          anticipatedDischarge: new Date("2026-03-03T09:00:00.000Z"),
        },
      ],
      fallback: "Failed to update ICU care plan",
      invalidPayload: { onOxygenSupport: "no" },
    },
    {
      handler: "update",
      params: { organisationId: ORG_ID, planId: RECORD_ID },
      body: { nursePrimary: "Nurse Adeyemi" },
      serviceMethod: "update",
      expectArgs: [RECORD_ID, ORG_ID, { nursePrimary: "Nurse Adeyemi" }],
      fallback: "Failed to update ICU care plan",
    },
    {
      handler: "discharge",
      params: { organisationId: ORG_ID, planId: RECORD_ID },
      body: {
        status: "TRANSFERRED",
        dischargeSummary: "Moved to referral ICU",
      },
      serviceMethod: "discharge",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        { status: "TRANSFERRED", dischargeSummary: "Moved to referral ICU" },
        USER_ID,
      ],
      fallback: "Failed to discharge ICU care plan",
      // ACTIVE is a plan status but not a discharge outcome.
      invalidPayload: { status: "ACTIVE" },
    },
  ],
});
