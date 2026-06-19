import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { Request, Response } from "express";
import { CompanionHistoryController } from "../../../src/controllers/web/companion-history.controller";
import { CompanionHistoryService } from "../../../src/services/companion-history.service";
import logger from "../../../src/utils/logger";

jest.mock("../../../src/services/companion-history.service");
jest.mock("../../../src/utils/logger");

const mockedCompanionHistoryService = jest.mocked(CompanionHistoryService);
const mockedLogger = jest.mocked(logger);

describe("CompanionHistoryController", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  const organisationId = "aaaaaaaaaaaaaaaaaaaaaaaa";
  const patientId = "bbbbbbbbbbbbbbbbbbbbbbbb";

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    req = {
      params: { organisationId, patientId },
      query: {},
    };

    res = {
      status: statusMock,
      json: jsonMock,
    } as unknown as Response;

    mockedCompanionHistoryService.listForCompanion.mockReset();
    mockedLogger.error.mockReset();
  });

  it("returns 403 when types includes LAB_RESULT without labs:view:any", async () => {
    (req as any).userPermissions = ["companions:view:any"];
    req.query = { types: "LAB_RESULT" };

    await CompanionHistoryController.listForCompanion(req as any, res as any);

    expect(statusMock).toHaveBeenCalledWith(403);
    expect(jsonMock).toHaveBeenCalledWith({
      message: "Forbidden – insufficient permissions",
    });
    expect(
      mockedCompanionHistoryService.listForCompanion,
    ).not.toHaveBeenCalled();
  });

  it("filters out LAB_RESULT by default when labs:view:any is missing", async () => {
    (req as any).userPermissions = ["companions:view:any"];

    const response = {
      entries: [],
      nextCursor: null,
      summary: {
        totalReturned: 0,
        countsByType: {
          APPOINTMENT: 0,
          TASK: 0,
          FORM_SUBMISSION: 0,
          DOCUMENT: 0,
          LAB_RESULT: 0,
          INVOICE: 0,
        },
      },
    };

    mockedCompanionHistoryService.listForCompanion.mockResolvedValue(
      response as any,
    );

    await CompanionHistoryController.listForCompanion(req as any, res as any);

    expect(mockedCompanionHistoryService.listForCompanion).toHaveBeenCalledWith(
      {
        organisationId,
        patientId,
        limit: undefined,
        cursor: undefined,
        types: [
          "APPOINTMENT",
          "TASK",
          "FORM_SUBMISSION",
          "DOCUMENT",
          "INVOICE",
        ],
      },
    );
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(response);
  });

  it("allows LAB_RESULT when labs:view:any is present", async () => {
    (req as any).userPermissions = ["companions:view:any", "labs:view:any"];
    req.query = { types: "LAB_RESULT" };

    mockedCompanionHistoryService.listForCompanion.mockResolvedValue({
      entries: [],
      nextCursor: null,
      summary: {
        totalReturned: 0,
        countsByType: {
          APPOINTMENT: 0,
          TASK: 0,
          FORM_SUBMISSION: 0,
          DOCUMENT: 0,
          LAB_RESULT: 0,
          INVOICE: 0,
        },
      },
    } as any);

    await CompanionHistoryController.listForCompanion(req as any, res as any);

    expect(mockedCompanionHistoryService.listForCompanion).toHaveBeenCalledWith(
      expect.objectContaining({
        types: ["LAB_RESULT"],
      }),
    );
    expect(statusMock).toHaveBeenCalledWith(200);
  });

  it("includes LAB_RESULT by default when labs:view:any is present", async () => {
    (req as any).userPermissions = ["companions:view:any", "labs:view:any"];

    mockedCompanionHistoryService.listForCompanion.mockResolvedValue({
      entries: [],
      nextCursor: null,
      summary: {
        totalReturned: 0,
        countsByType: {
          APPOINTMENT: 0,
          TASK: 0,
          FORM_SUBMISSION: 0,
          DOCUMENT: 0,
          LAB_RESULT: 0,
          INVOICE: 0,
        },
      },
    } as any);

    await CompanionHistoryController.listForCompanion(req as any, res as any);

    expect(mockedCompanionHistoryService.listForCompanion).toHaveBeenCalledWith(
      expect.objectContaining({
        types: [
          "APPOINTMENT",
          "TASK",
          "FORM_SUBMISSION",
          "DOCUMENT",
          "LAB_RESULT",
          "INVOICE",
        ],
      }),
    );
    expect(statusMock).toHaveBeenCalledWith(200);
  });

  it("returns 500 when permissions are not loaded", async () => {
    await CompanionHistoryController.listForCompanion(req as any, res as any);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({
      message:
        "Permissions not loaded. Include withOrgPermissions before handler.",
    });
  });
});
