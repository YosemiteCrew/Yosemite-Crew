import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { LabResultController } from "../../src/controllers/web/lab-result.controller";
import { LabResultService } from "../../src/services/lab-result.service";
import { IdexxResultsQueryService } from "../../src/services/idexx-results-query.service";

jest.mock("../../src/services/lab-result.service", () => ({
  LabResultServiceError: class MockLabResultServiceError extends Error {
    constructor(
      message: string,
      public statusCode: number,
    ) {
      super(message);
      this.name = "LabResultServiceError";
    }
  },
  LabResultService: {
    list: jest.fn(),
    getByResultId: jest.fn(),
  },
}));

jest.mock("../../src/services/idexx-results-query.service", () => ({
  IdexxResultsQueryService: {
    getResult: jest.fn(),
    getResultPdf: jest.fn(),
    getResultNotificationsPdf: jest.fn(),
    search: jest.fn(),
  },
}));

describe("LabResultController", () => {
  let req: any;
  let res: any;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      params: {
        organisationId: "org-1",
        provider: "IDEXX",
        resultId: "res-1",
      },
      query: {},
      organisationId: "org-1",
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
      setHeader: jest.fn(),
    };
  });

  it("scopes get by organisationId and does not fallback to remote", async () => {
    (LabResultService.getByResultId as unknown as jest.Mock).mockImplementation(
      async () => null as any,
    );

    await LabResultController.get(req, res);

    expect(LabResultService.getByResultId).toHaveBeenCalledWith(
      "org-1",
      "IDEXX",
      "res-1",
    );
    expect(IdexxResultsQueryService.getResult).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns 404 for pdf if result is not owned by organisation", async () => {
    (LabResultService.getByResultId as unknown as jest.Mock).mockImplementation(
      async () => null as any,
    );

    await LabResultController.getPdf(req, res);

    expect(IdexxResultsQueryService.getResultPdf).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Result not found." });
  });

  it("search returns organisation-scoped stored results", async () => {
    req.query = { orderId: "order-1", limit: "10" };
    (LabResultService.list as unknown as jest.Mock).mockImplementation(
      async () => [{ resultId: "r1" }],
    );

    await LabResultController.search(req, res);

    expect(LabResultService.list).toHaveBeenCalledWith({
      organisationId: "org-1",
      provider: "IDEXX",
      orderId: "order-1",
      companionId: undefined,
      limit: 10,
    });
    expect(IdexxResultsQueryService.search).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([{ resultId: "r1" }]);
  });
});
