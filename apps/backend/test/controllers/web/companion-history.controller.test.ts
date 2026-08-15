import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { Request, Response } from "express";
import { CompanionHistoryController } from "../../../src/controllers/web/companion-history.controller";
import {
  CompanionHistoryService,
  CompanionHistoryServiceError,
} from "../../../src/services/companion-history.service";
import logger from "../../../src/utils/logger";

// The controller narrows on `instanceof CompanionHistoryServiceError`; an auto-mocked
// class would lose `statusCode`/`message`, so expose a real throwable class instead.
jest.mock("../../../src/services/companion-history.service", () => {
  class MockCompanionHistoryServiceError extends Error {
    constructor(
      message: string,
      public statusCode: number,
    ) {
      super(message);
      this.name = "CompanionHistoryServiceError";
    }
  }

  return {
    __esModule: true,
    CompanionHistoryServiceError: MockCompanionHistoryServiceError,
    CompanionHistoryService: {
      listForCompanion: jest.fn(),
    },
  };
});
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

  it("accepts a UUID patientId for postgres compatibility", async () => {
    const uuidPatientId = "6fafc6c4-8440-4070-adf1-8849209186bd";
    (req as any).userPermissions = ["companions:view:any"];
    req.params = {
      organisationId,
      patientId: uuidPatientId,
    };

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
        patientId: uuidPatientId,
      }),
    );
    expect(statusMock).toHaveBeenCalledWith(200);
  });

  it("still accepts a legacy ObjectId patientId", async () => {
    const objectIdPatientId = "507f191e810c19729de860ea";
    (req as any).userPermissions = ["companions:view:any"];
    req.params = {
      organisationId,
      patientId: objectIdPatientId,
    };

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
        patientId: objectIdPatientId,
      }),
    );
    expect(statusMock).toHaveBeenCalledWith(200);
  });

  const emptyPage = {
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

  it("400s an organisationId that is not an ObjectId", async () => {
    (req as any).userPermissions = ["companions:view:any"];
    req.params = { organisationId: "not-an-object-id", patientId };

    await CompanionHistoryController.listForCompanion(req as any, res as any);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({
      message: "Invalid route parameters",
    });
    expect(
      mockedCompanionHistoryService.listForCompanion,
    ).not.toHaveBeenCalled();
  });

  it("coerces a numeric string limit into a number", async () => {
    (req as any).userPermissions = ["companions:view:any"];
    req.query = { limit: "25", cursor: "cursor-1" };
    mockedCompanionHistoryService.listForCompanion.mockResolvedValue(
      emptyPage as any,
    );

    await CompanionHistoryController.listForCompanion(req as any, res as any);

    expect(mockedCompanionHistoryService.listForCompanion).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 25, cursor: "cursor-1" }),
    );
    expect(statusMock).toHaveBeenCalledWith(200);
  });

  it("passes a numeric limit straight through", async () => {
    (req as any).userPermissions = ["companions:view:any"];
    req.query = { limit: 10 } as any;
    mockedCompanionHistoryService.listForCompanion.mockResolvedValue(
      emptyPage as any,
    );

    await CompanionHistoryController.listForCompanion(req as any, res as any);

    expect(mockedCompanionHistoryService.listForCompanion).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10 }),
    );
  });

  it("treats a blank limit as absent rather than zero", async () => {
    (req as any).userPermissions = ["companions:view:any"];
    req.query = { limit: "   " };
    mockedCompanionHistoryService.listForCompanion.mockResolvedValue(
      emptyPage as any,
    );

    await CompanionHistoryController.listForCompanion(req as any, res as any);

    expect(mockedCompanionHistoryService.listForCompanion).toHaveBeenCalledWith(
      expect.objectContaining({ limit: undefined }),
    );
    expect(statusMock).toHaveBeenCalledWith(200);
  });

  it("400s a non-numeric limit", async () => {
    (req as any).userPermissions = ["companions:view:any"];
    req.query = { limit: "many" };

    await CompanionHistoryController.listForCompanion(req as any, res as any);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({
      message: "Invalid query parameters",
    });
    expect(
      mockedCompanionHistoryService.listForCompanion,
    ).not.toHaveBeenCalled();
  });

  it("400s a limit above the page cap", async () => {
    (req as any).userPermissions = ["companions:view:any"];
    req.query = { limit: "101" };

    await CompanionHistoryController.listForCompanion(req as any, res as any);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({
      message: "Invalid query parameters",
    });
  });

  it("falls back to the default types when the types filter is all separators", async () => {
    (req as any).userPermissions = ["companions:view:any", "labs:view:any"];
    req.query = { types: " , , " };
    mockedCompanionHistoryService.listForCompanion.mockResolvedValue(
      emptyPage as any,
    );

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

  it("surfaces a service error with its own status code and does not log it", async () => {
    (req as any).userPermissions = ["companions:view:any"];
    mockedCompanionHistoryService.listForCompanion.mockRejectedValue(
      new CompanionHistoryServiceError("Companion not found", 404),
    );

    await CompanionHistoryController.listForCompanion(req as any, res as any);

    expect(statusMock).toHaveBeenCalledWith(404);
    expect(jsonMock).toHaveBeenCalledWith({ message: "Companion not found" });
    expect(mockedLogger.error).not.toHaveBeenCalled();
  });

  it("500s and logs an unexpected service failure", async () => {
    (req as any).userPermissions = ["companions:view:any"];
    const failure = new Error("connection reset");
    mockedCompanionHistoryService.listForCompanion.mockRejectedValue(failure);

    await CompanionHistoryController.listForCompanion(req as any, res as any);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({ message: "Internal Server Error" });
    expect(mockedLogger.error).toHaveBeenCalledWith(
      "Companion history retrieval failed",
      failure,
    );
  });
});
