import type { Request, Response } from "express";
import { DeveloperUsageController } from "../../../src/controllers/web/developer-usage.controller";
import { DeveloperUsageService } from "../../../src/services/developer-usage.service";

jest.mock("../../../src/services/developer-usage.service", () => ({
  DeveloperUsageService: { getUsage: jest.fn() },
}));

jest.mock("../../../src/utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), info: jest.fn() },
}));

const usageMock = DeveloperUsageService.getUsage as jest.Mock;

const buildRes = (): Response => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
};

const buildReq = (
  organisationId?: string,
  query: Record<string, string> = {},
): Request =>
  ({
    organisationId,
    query,
  }) as unknown as Request;

const sampleUsage = { billingPeriod: "2026-06", callCount: 42, limit: 1000 };

describe("DeveloperUsageController.getUsage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("400 when organisationId is missing", async () => {
    const res = buildRes();
    await DeveloperUsageController.getUsage(buildReq(undefined), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(usageMock).not.toHaveBeenCalled();
  });

  it("returns usage data for the current period", async () => {
    usageMock.mockResolvedValue(sampleUsage);
    const res = buildRes();
    await DeveloperUsageController.getUsage(buildReq("org-1"), res);
    expect(usageMock).toHaveBeenCalledWith("org-1", undefined);
    expect(res.json).toHaveBeenCalledWith({ data: sampleUsage });
  });

  it("passes query.period to the service", async () => {
    usageMock.mockResolvedValue(sampleUsage);
    const res = buildRes();
    await DeveloperUsageController.getUsage(
      buildReq("org-1", { period: "2026-05" }),
      res,
    );
    expect(usageMock).toHaveBeenCalledWith("org-1", "2026-05");
  });

  it("500 when service throws", async () => {
    usageMock.mockRejectedValue(new Error("db offline"));
    const res = buildRes();
    await DeveloperUsageController.getUsage(buildReq("org-1"), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
