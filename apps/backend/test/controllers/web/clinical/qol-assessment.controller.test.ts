import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request, Response } from "express";
import { QolAssessmentController } from "src/controllers/web/qol-assessment.controller";
import {
  QolAssessmentService,
  QolAssessmentError,
} from "src/services/qol-assessment.service";
import {
  ENCOUNTER_ID,
  ORG_ID,
  PATIENT_ID,
  RECORD_ID,
  USER_ID,
  runClinicalControllerSuite,
} from "./clinical-suite";

jest.mock("src/services/qol-assessment.service", () => {
  const actual = jest.requireActual(
    "src/services/qol-assessment.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    QolAssessmentService: {
      list: jest.fn(),
      create: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      trend: jest.fn(),
      delete: jest.fn(),
    },
  };
});

const mockedTrend = QolAssessmentService.trend as unknown as jest.Mock;

runClinicalControllerSuite({
  name: "QolAssessmentController",
  controller: QolAssessmentController,
  service: QolAssessmentService as unknown as Record<string, unknown>,
  errorClass: QolAssessmentError,
  cases: [
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      query: {
        patientId: PATIENT_ID,
        encounterId: ENCOUNTER_ID,
        ownerAssessed: "true",
      },
      serviceMethod: "list",
      expectArgs: [
        {
          organisationId: ORG_ID,
          patientId: PATIENT_ID,
          encounterId: ENCOUNTER_ID,
          ownerAssessed: true,
        },
      ],
      fallback: "Failed to list QoL assessments",
      invalidPayload: { patientId: "not-a-uuid" },
    },
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      // Anything that is not "true"/"false" leaves the flag unset.
      query: { ownerAssessed: "sometimes" },
      serviceMethod: "list",
      expectArgs: [
        {
          organisationId: ORG_ID,
          patientId: undefined,
          encounterId: undefined,
          ownerAssessed: undefined,
        },
      ],
      fallback: "Failed to list QoL assessments",
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      body: {
        patientId: PATIENT_ID,
        encounterId: ENCOUNTER_ID,
        assessedAt: "2026-03-19T10:00:00.000Z",
        hhhhhmmScore: 44,
        painScore: 4,
        appetiteScore: 6,
        moreDaysGood: true,
        ownerAssessed: true,
        euthanasiaDiscussed: false,
      },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          assessedBy: USER_ID,
          patientId: PATIENT_ID,
          encounterId: ENCOUNTER_ID,
          hhhhhmmScore: 44,
          painScore: 4,
          appetiteScore: 6,
          moreDaysGood: true,
          ownerAssessed: true,
          euthanasiaDiscussed: false,
          assessedAt: new Date("2026-03-19T10:00:00.000Z"),
        },
      ],
      status: 201,
      fallback: "Failed to create QoL assessment",
      // The individual HHHHHMM sub-scores run 1-10.
      invalidPayload: {
        patientId: PATIENT_ID,
        assessedAt: "2026-03-19T10:00:00.000Z",
        painScore: 0,
      },
    },
    {
      handler: "get",
      params: { organisationId: ORG_ID, assessmentId: RECORD_ID },
      serviceMethod: "get",
      expectArgs: [RECORD_ID, ORG_ID],
      fallback: "Failed to get QoL assessment",
    },
    {
      handler: "update",
      params: { organisationId: ORG_ID, assessmentId: RECORD_ID },
      body: {
        assessedAt: "2026-03-20T10:00:00.000Z",
        happinessScore: 3,
        euthanasiaDiscussed: true,
      },
      serviceMethod: "update",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        {
          happinessScore: 3,
          euthanasiaDiscussed: true,
          assessedAt: new Date("2026-03-20T10:00:00.000Z"),
        },
      ],
      fallback: "Failed to update QoL assessment",
      invalidPayload: { hhhhhmmScore: 90 },
    },
    {
      handler: "update",
      params: { organisationId: ORG_ID, assessmentId: RECORD_ID },
      body: { clinicianNotes: "Reviewed with the owner" },
      serviceMethod: "update",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        { clinicianNotes: "Reviewed with the owner" },
      ],
      fallback: "Failed to update QoL assessment",
    },
    {
      handler: "trend",
      params: { organisationId: ORG_ID },
      query: { patientId: PATIENT_ID, limit: "6" },
      serviceMethod: "trend",
      expectArgs: [PATIENT_ID, ORG_ID, 6],
      fallback: "Failed to get QoL assessment trend",
    },
    {
      handler: "delete",
      params: { organisationId: ORG_ID, assessmentId: RECORD_ID },
      serviceMethod: "delete",
      expectArgs: [RECORD_ID, ORG_ID],
      status: 204,
      fallback: "Failed to delete QoL assessment",
    },
  ],
});

/**
 * `trend` is hand-written rather than built by `createClinicalHandlers`, so its
 * own guard and its optional `limit` need covering directly.
 */
describe("QolAssessmentController.trend", () => {
  const buildResponse = () => {
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    return { json, status } as unknown as Response & {
      json: jest.Mock;
      status: jest.Mock;
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects a request with no patientId before touching the service", async () => {
    const res = buildResponse();

    await QolAssessmentController.trend(
      { params: { organisationId: ORG_ID }, query: {} } as unknown as Request,
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "patientId is required" });
    expect(mockedTrend).not.toHaveBeenCalled();
  });

  it("omits the limit when the query does not carry one", async () => {
    const records = [{ id: RECORD_ID, overallScore: 62 }];
    mockedTrend.mockResolvedValue(records as never);
    const res = buildResponse();

    await QolAssessmentController.trend(
      {
        params: { organisationId: ORG_ID },
        query: { patientId: PATIENT_ID },
      } as unknown as Request,
      res,
    );

    expect(mockedTrend).toHaveBeenCalledWith(PATIENT_ID, ORG_ID, undefined);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(records);
  });
});
