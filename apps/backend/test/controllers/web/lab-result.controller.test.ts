import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Request, Response } from "express";
import { LabResultController } from "../../../src/controllers/web/lab-result.controller";
import {
  LabResultService,
  LabResultServiceError,
} from "../../../src/services/lab-result.service";
import { IdexxResultsQueryService } from "../../../src/services/idexx-results-query.service";
import { mapAxiosError } from "../../../src/utils/external-error";
import logger from "../../../src/utils/logger";

jest.mock("../../../src/services/lab-result.service", () => {
  const actual = jest.requireActual(
    "../../../src/services/lab-result.service",
  ) as typeof import("../../../src/services/lab-result.service");
  return {
    ...actual,
    LabResultService: {
      getByResultId: jest.fn(),
      list: jest.fn(),
    },
  };
});

jest.mock("../../../src/services/idexx-results-query.service", () => ({
  IdexxResultsQueryService: {
    getResultNotificationsPdf: jest.fn(),
    getResultPdf: jest.fn(),
  },
}));

jest.mock("../../../src/utils/external-error", () => ({
  mapAxiosError: jest.fn(),
}));

jest.mock("../../../src/utils/logger");

const mockedLabResultService = LabResultService as any;
const mockedIdexxResultsQueryService = IdexxResultsQueryService as any;
const mockedMapAxiosError = mapAxiosError as any;
const mockedLogger = logger as any;

describe("LabResultController", () => {
  let req: Partial<Request>;
  let res: Response;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;
  let sendMock: jest.Mock;
  let setHeaderMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    sendMock = jest.fn();
    setHeaderMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({
      json: jsonMock,
      send: sendMock,
    });

    req = {
      params: {
        organisationId: "org-1",
        provider: "IDEXX",
        resultId: "result-1",
      },
      query: {},
      body: {},
    };

    res = {
      status: statusMock,
      json: jsonMock,
      send: sendMock,
      setHeader: setHeaderMock,
    } as unknown as Response;

    jest.clearAllMocks();
    mockedMapAxiosError.mockReturnValue(null);
  });

  describe("list", () => {
    it("lists results using query params", async () => {
      req.query = {
        orderId: "order-1",
        companionId: "comp-1",
        limit: "10",
      };
      mockedLabResultService.list.mockResolvedValue([{ id: "res-1" }] as any);

      await LabResultController.list(req as Request, res);

      expect(mockedLabResultService.list).toHaveBeenCalledWith({
        organisationId: "org-1",
        provider: "IDEXX",
        orderId: "order-1",
        companionId: "comp-1",
        limit: 10,
      });
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith([{ id: "res-1" }]);
    });

    it("maps service errors", async () => {
      mockedLabResultService.list.mockRejectedValue(
        new LabResultServiceError("Bad request.", 400),
      );

      await LabResultController.list(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ message: "Bad request." });
    });

    it("maps axios-style errors", async () => {
      mockedLabResultService.list.mockRejectedValue(new Error("boom"));
      mockedMapAxiosError.mockReturnValue({
        status: 502,
        message: "IDEXX request failed",
        details: { reason: "upstream" },
      });

      await LabResultController.list(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(502);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "IDEXX request failed",
        details: { reason: "upstream" },
      });
    });
  });

  describe("get", () => {
    it("rejects missing organisation identifier", async () => {
      req.params = { provider: "IDEXX", resultId: "result-1" };

      await LabResultController.get(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "organisationId required.",
      });
    });

    it("rejects missing provider or result id", async () => {
      req.params = { organisationId: "org-1", provider: "IDEXX" };

      await LabResultController.get(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "provider and resultId required.",
      });
    });

    it("returns 404 when the result is missing", async () => {
      mockedLabResultService.getByResultId.mockResolvedValue(null);

      await LabResultController.get(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Result not found.",
      });
    });

    it("returns the stored result", async () => {
      mockedLabResultService.getByResultId.mockResolvedValue({
        id: "result-1",
      } as any);

      await LabResultController.get(req as Request, res);

      expect(mockedLabResultService.getByResultId).toHaveBeenCalledWith(
        "org-1",
        "IDEXX",
        "result-1",
      );
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ id: "result-1" });
    });
  });

  describe("getPdf", () => {
    it("rejects unsupported providers", async () => {
      req.params = {
        organisationId: "org-1",
        provider: "VETSCAN",
        resultId: "result-1",
      };

      await LabResultController.getPdf(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Unsupported provider.",
      });
    });

    it("returns 404 when the result is missing", async () => {
      mockedLabResultService.getByResultId.mockResolvedValue(null);

      await LabResultController.getPdf(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Result not found.",
      });
    });

    it("returns 500 when the PDF is unavailable", async () => {
      mockedLabResultService.getByResultId.mockResolvedValue({
        id: "result-1",
      });
      mockedIdexxResultsQueryService.getResultPdf.mockResolvedValue(null);

      await LabResultController.getPdf(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "PDF unavailable.",
      });
    });

    it("sends the PDF response with headers", async () => {
      mockedLabResultService.getByResultId.mockResolvedValue({
        id: "result-1",
      });
      mockedIdexxResultsQueryService.getResultPdf.mockResolvedValue({
        data: new Uint8Array([1, 2, 3]).buffer,
        headers: {
          "content-disposition": 'attachment; filename="result.pdf"',
        },
      });

      await LabResultController.getPdf(req as Request, res);

      expect(setHeaderMock).toHaveBeenCalledWith(
        "Content-Type",
        "application/pdf",
      );
      expect(setHeaderMock).toHaveBeenCalledWith(
        "Content-Disposition",
        'attachment; filename="result.pdf"',
      );
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(sendMock).toHaveBeenCalled();
    });
  });

  describe("getNotificationsPdf", () => {
    it("sends the notifications PDF response", async () => {
      mockedLabResultService.getByResultId.mockResolvedValue({
        id: "result-1",
      });
      mockedIdexxResultsQueryService.getResultNotificationsPdf.mockResolvedValue(
        {
          data: new Uint8Array([4, 5, 6]).buffer,
          headers: {},
        },
      );

      await LabResultController.getNotificationsPdf(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(sendMock).toHaveBeenCalled();
    });
  });

  describe("search", () => {
    it("requires a provider", async () => {
      req.params = { organisationId: "org-1", resultId: "result-1" };

      await LabResultController.search(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "provider required.",
      });
    });

    it("returns results for IDEXX searches", async () => {
      req.query = {
        orderId: "order-1",
        companionId: "comp-1",
        limit: "5",
      };
      mockedLabResultService.list.mockResolvedValue([{ id: "res-1" }] as any);

      await LabResultController.search(req as Request, res);

      expect(mockedLabResultService.list).toHaveBeenCalledWith({
        organisationId: "org-1",
        provider: "IDEXX",
        orderId: "order-1",
        companionId: "comp-1",
        limit: 5,
      });
      expect(statusMock).toHaveBeenCalledWith(200);
    });
  });
});
