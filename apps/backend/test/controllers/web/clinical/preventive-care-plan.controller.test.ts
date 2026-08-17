import { jest } from "@jest/globals";
import { PreventiveCarePlanController } from "src/controllers/web/preventive-care-plan.controller";
import {
  PreventiveCarePlanService,
  PreventiveCarePlanError,
} from "src/services/preventive-care-plan.service";
import {
  ORG_ID,
  PATIENT_ID,
  RECORD_ID,
  SECOND_ID,
  USER_ID,
  runClinicalControllerSuite,
} from "./clinical-suite";

jest.mock("src/services/preventive-care-plan.service", () => {
  const actual = jest.requireActual(
    "src/services/preventive-care-plan.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    PreventiveCarePlanService: {
      list: jest.fn(),
      create: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      addItem: jest.fn(),
      completeItem: jest.fn(),
    },
  };
});

runClinicalControllerSuite({
  name: "PreventiveCarePlanController",
  controller: PreventiveCarePlanController,
  service: PreventiveCarePlanService as unknown as Record<string, unknown>,
  errorClass: PreventiveCarePlanError,
  cases: [
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      query: { patientId: PATIENT_ID, status: "ACTIVE" },
      serviceMethod: "list",
      expectArgs: [
        { organisationId: ORG_ID, patientId: PATIENT_ID, status: "ACTIVE" },
      ],
      fallback: "Failed to list care plans",
      invalidPayload: { status: "LAPSED" },
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      // Each item's own `nextDueAt` must be coerced inside the array.
      body: {
        patientId: PATIENT_ID,
        name: "Adult wellness",
        description: "Annual preventive schedule",
        items: [
          {
            careType: "Rabies booster",
            frequency: "ANNUAL",
            nextDueAt: "2026-09-01T09:00:00.000Z",
          },
          { careType: "Flea treatment", frequency: "MONTHLY" },
        ],
      },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          createdBy: USER_ID,
          patientId: PATIENT_ID,
          name: "Adult wellness",
          description: "Annual preventive schedule",
          items: [
            {
              careType: "Rabies booster",
              frequency: "ANNUAL",
              nextDueAt: new Date("2026-09-01T09:00:00.000Z"),
            },
            {
              careType: "Flea treatment",
              frequency: "MONTHLY",
              nextDueAt: undefined,
            },
          ],
        },
      ],
      status: 201,
      fallback: "Failed to create care plan",
      // The frequency must be one of the known cadences.
      invalidPayload: {
        patientId: PATIENT_ID,
        name: "Adult wellness",
        items: [{ careType: "Rabies booster", frequency: "WHENEVER" }],
      },
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      // No items at all: the mapped array stays undefined.
      body: { patientId: PATIENT_ID, name: "Senior wellness" },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          createdBy: USER_ID,
          patientId: PATIENT_ID,
          name: "Senior wellness",
          items: undefined,
        },
      ],
      status: 201,
      fallback: "Failed to create care plan",
    },
    {
      handler: "get",
      params: { organisationId: ORG_ID, planId: RECORD_ID },
      serviceMethod: "get",
      expectArgs: [RECORD_ID, ORG_ID],
      fallback: "Failed to get care plan",
    },
    {
      handler: "update",
      params: { organisationId: ORG_ID, planId: RECORD_ID },
      body: { status: "PAUSED", name: "Adult wellness (paused)" },
      serviceMethod: "update",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        { status: "PAUSED", name: "Adult wellness (paused)" },
        USER_ID,
      ],
      fallback: "Failed to update care plan",
      invalidPayload: { name: "" },
    },
    {
      handler: "addItem",
      params: { organisationId: ORG_ID, planId: RECORD_ID },
      body: {
        careType: "Dental check",
        frequency: "BIANNUAL",
        intervalDays: 182,
        nextDueAt: "2026-10-01T09:00:00.000Z",
      },
      serviceMethod: "addItem",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        {
          careType: "Dental check",
          frequency: "BIANNUAL",
          intervalDays: 182,
          nextDueAt: new Date("2026-10-01T09:00:00.000Z"),
        },
      ],
      status: 201,
      fallback: "Failed to add care plan item",
      invalidPayload: {
        careType: "Dental check",
        frequency: "BIANNUAL",
        intervalDays: 0,
      },
    },
    {
      handler: "addItem",
      params: { organisationId: ORG_ID, planId: RECORD_ID },
      body: { careType: "Weight check", frequency: "QUARTERLY" },
      serviceMethod: "addItem",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        {
          careType: "Weight check",
          frequency: "QUARTERLY",
          nextDueAt: undefined,
        },
      ],
      status: 201,
      fallback: "Failed to add care plan item",
    },
    {
      handler: "completeItem",
      // The item route carries both ids; only the item id reaches the service.
      params: { organisationId: ORG_ID, planId: RECORD_ID, itemId: SECOND_ID },
      body: {
        completedAt: "2026-09-01T10:00:00.000Z",
        nextDueAt: "2027-09-01T10:00:00.000Z",
        notes: "Given at the clinic",
      },
      serviceMethod: "completeItem",
      expectArgs: [
        SECOND_ID,
        ORG_ID,
        {
          notes: "Given at the clinic",
          completedAt: new Date("2026-09-01T10:00:00.000Z"),
          nextDueAt: new Date("2027-09-01T10:00:00.000Z"),
        },
        USER_ID,
      ],
      fallback: "Failed to complete care plan item",
      invalidPayload: { completedAt: "this morning" },
    },
    {
      handler: "completeItem",
      params: { organisationId: ORG_ID, planId: RECORD_ID, itemId: SECOND_ID },
      body: {},
      serviceMethod: "completeItem",
      expectArgs: [
        SECOND_ID,
        ORG_ID,
        { completedAt: undefined, nextDueAt: undefined },
        USER_ID,
      ],
      fallback: "Failed to complete care plan item",
    },
  ],
});
