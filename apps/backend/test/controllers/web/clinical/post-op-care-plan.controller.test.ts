import { jest } from "@jest/globals";
import { PostOpCarePlanController } from "src/controllers/web/post-op-care-plan.controller";
import {
  PostOpCarePlanService,
  PostOpCarePlanError,
} from "src/services/post-op-care-plan.service";
import {
  ENCOUNTER_ID,
  ORG_ID,
  PATIENT_ID,
  RECORD_ID,
  SECOND_ID,
  USER_ID,
  runClinicalControllerSuite,
} from "./clinical-suite";

jest.mock("src/services/post-op-care-plan.service", () => {
  const actual = jest.requireActual(
    "src/services/post-op-care-plan.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    PostOpCarePlanService: {
      list: jest.fn(),
      create: jest.fn(),
      get: jest.fn(),
      review: jest.fn(),
      update: jest.fn(),
    },
  };
});

runClinicalControllerSuite({
  name: "PostOpCarePlanController",
  controller: PostOpCarePlanController,
  service: PostOpCarePlanService as unknown as Record<string, unknown>,
  errorClass: PostOpCarePlanError,
  cases: [
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      query: { patientId: PATIENT_ID, status: "ACTIVE" },
      serviceMethod: "list",
      expectArgs: [
        { organisationId: ORG_ID, patientId: PATIENT_ID, status: "ACTIVE" },
      ],
      fallback: "Failed to list post-op care plans",
      invalidPayload: { status: "HEALING" },
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      body: {
        patientId: PATIENT_ID,
        encounterId: ENCOUNTER_ID,
        surgicalProcedureId: SECOND_ID,
        painScore: 3,
        analgesiaProtocol: "Methadone q4h then meloxicam",
        firstReviewAt: "2026-03-15T08:00:00.000Z",
        nextReviewAt: "2026-03-16T08:00:00.000Z",
      },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          prescribedBy: USER_ID,
          patientId: PATIENT_ID,
          encounterId: ENCOUNTER_ID,
          surgicalProcedureId: SECOND_ID,
          painScore: 3,
          analgesiaProtocol: "Methadone q4h then meloxicam",
          firstReviewAt: new Date("2026-03-15T08:00:00.000Z"),
          nextReviewAt: new Date("2026-03-16T08:00:00.000Z"),
        },
      ],
      status: 201,
      fallback: "Failed to create post-op care plan",
      // The pain score runs 0-10.
      invalidPayload: { patientId: PATIENT_ID, painScore: 20 },
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      // Nothing to coerce: the payload passes through untouched.
      body: { patientId: PATIENT_ID, dietaryNotes: "Small meals" },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          prescribedBy: USER_ID,
          patientId: PATIENT_ID,
          dietaryNotes: "Small meals",
        },
      ],
      status: 201,
      fallback: "Failed to create post-op care plan",
    },
    {
      handler: "get",
      params: { organisationId: ORG_ID, planId: RECORD_ID },
      serviceMethod: "get",
      expectArgs: [RECORD_ID, ORG_ID],
      fallback: "Failed to get post-op care plan",
    },
    {
      handler: "review",
      params: { organisationId: ORG_ID, planId: RECORD_ID },
      body: {
        painScore: 1,
        reviewNotes: "Comfortable, eating well",
        nextReviewAt: "2026-03-18T08:00:00.000Z",
        status: "ACTIVE",
      },
      serviceMethod: "review",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        {
          painScore: 1,
          reviewNotes: "Comfortable, eating well",
          status: "ACTIVE",
          nextReviewAt: new Date("2026-03-18T08:00:00.000Z"),
        },
        USER_ID,
      ],
      fallback: "Failed to review post-op care plan",
      // Review notes are mandatory.
      invalidPayload: { painScore: 1 },
    },
    {
      handler: "review",
      params: { organisationId: ORG_ID, planId: RECORD_ID },
      body: { reviewNotes: "Discharged, no further reviews" },
      serviceMethod: "review",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        { reviewNotes: "Discharged, no further reviews" },
        USER_ID,
      ],
      fallback: "Failed to review post-op care plan",
    },
    {
      handler: "update",
      params: { organisationId: ORG_ID, planId: RECORD_ID },
      body: {
        status: "COMPLETED",
        nextReviewAt: "2026-03-20T08:00:00.000Z",
        woundCareInstructions: "Remove sutures at day 12",
      },
      serviceMethod: "update",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        {
          status: "COMPLETED",
          woundCareInstructions: "Remove sutures at day 12",
          nextReviewAt: new Date("2026-03-20T08:00:00.000Z"),
        },
      ],
      fallback: "Failed to update post-op care plan",
      invalidPayload: { firstReviewAt: "tomorrow" },
    },
  ],
});
