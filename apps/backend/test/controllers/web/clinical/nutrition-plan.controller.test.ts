import { jest } from "@jest/globals";
import { NutritionPlanController } from "src/controllers/web/nutrition-plan.controller";
import {
  NutritionPlanService,
  NutritionPlanError,
} from "src/services/nutrition-plan.service";
import {
  ENCOUNTER_ID,
  ORG_ID,
  PATIENT_ID,
  RECORD_ID,
  USER_ID,
  runClinicalControllerSuite,
} from "./clinical-suite";

jest.mock("src/services/nutrition-plan.service", () => {
  const actual = jest.requireActual(
    "src/services/nutrition-plan.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    NutritionPlanService: {
      list: jest.fn(),
      create: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
    },
  };
});

runClinicalControllerSuite({
  name: "NutritionPlanController",
  controller: NutritionPlanController,
  service: NutritionPlanService as unknown as Record<string, unknown>,
  errorClass: NutritionPlanError,
  cases: [
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      query: { patientId: PATIENT_ID, status: "ACTIVE" },
      serviceMethod: "list",
      expectArgs: [
        { organisationId: ORG_ID, patientId: PATIENT_ID, status: "ACTIVE" },
      ],
      fallback: "Failed to list nutrition plans",
      invalidPayload: { status: "PAUSED" },
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      body: {
        patientId: PATIENT_ID,
        encounterId: ENCOUNTER_ID,
        dietName: "Renal support wet",
        calories: 380,
        calorieUnit: "kcal/day",
        protein: 12,
        feedingFrequency: "Three times daily",
        reviewDate: "2026-04-15T09:00:00.000Z",
      },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          prescribedBy: USER_ID,
          patientId: PATIENT_ID,
          encounterId: ENCOUNTER_ID,
          dietName: "Renal support wet",
          calories: 380,
          calorieUnit: "kcal/day",
          protein: 12,
          feedingFrequency: "Three times daily",
          reviewDate: new Date("2026-04-15T09:00:00.000Z"),
        },
      ],
      status: 201,
      fallback: "Failed to create nutrition plan",
      // The diet name may not be blank.
      invalidPayload: { patientId: PATIENT_ID, dietName: "" },
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      body: { patientId: PATIENT_ID, dietName: "Weight management dry" },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          prescribedBy: USER_ID,
          patientId: PATIENT_ID,
          dietName: "Weight management dry",
        },
      ],
      status: 201,
      fallback: "Failed to create nutrition plan",
    },
    {
      handler: "get",
      params: { organisationId: ORG_ID, planId: RECORD_ID },
      serviceMethod: "get",
      expectArgs: [RECORD_ID, ORG_ID],
      fallback: "Failed to get nutrition plan",
    },
    {
      handler: "update",
      params: { organisationId: ORG_ID, planId: RECORD_ID },
      body: { status: "COMPLETED", reviewDate: "2026-05-15T09:00:00.000Z" },
      serviceMethod: "update",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        {
          status: "COMPLETED",
          reviewDate: new Date("2026-05-15T09:00:00.000Z"),
        },
        USER_ID,
      ],
      fallback: "Failed to update nutrition plan",
      invalidPayload: { calories: 0 },
    },
    {
      handler: "update",
      params: { organisationId: ORG_ID, planId: RECORD_ID },
      body: { portionSize: "80g" },
      serviceMethod: "update",
      expectArgs: [RECORD_ID, ORG_ID, { portionSize: "80g" }, USER_ID],
      fallback: "Failed to update nutrition plan",
    },
  ],
});
