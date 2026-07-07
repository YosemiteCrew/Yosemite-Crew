import type { Request, Response } from "express";
import { DeveloperRequestLogController } from "../../../src/controllers/web/developer-request-log.controller";
import { DeveloperRequestLogService } from "../../../src/services/developer-request-log.service";
import { InvalidCursorError } from "../../../src/utils/cursor-pagination";

jest.mock("../../../src/services/developer-request-log.service", () => ({
  DeveloperRequestLogService: { list: jest.fn() },
  STATUS_CLASSES: ["2xx", "3xx", "4xx", "5xx"],
}));

jest.mock("../../../src/utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), info: jest.fn() },
}));

const listMock = DeveloperRequestLogService.list as jest.Mock;

const buildRes = (): Response => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
};

// null means "no organisation context" - an explicit undefined argument would
// trigger the default parameter and silently test the wrong thing.
const buildReq = (
  query: Record<string, unknown> = {},
  organisationId: string | null = "org-1",
): Request =>
  ({
    query,
    organisationId: organisationId ?? undefined,
  }) as unknown as Request;

const emptyPage = {
  items: [],
  pagination: { nextCursor: null, hasMore: false, limit: 50 },
};

describe("DeveloperRequestLogController.listRequestLogs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listMock.mockResolvedValue(emptyPage);
  });

  it("400s with invalid_request when there is no organisation context", async () => {
    const res = buildRes();
    await DeveloperRequestLogController.listRequestLogs(
      buildReq({}, null),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Missing organisation context",
      code: "invalid_request",
    });
    expect(listMock).not.toHaveBeenCalled();
  });

  it.each([
    ["bad statusClass", { statusClass: "6xx" }],
    ["non-numeric limit", { limit: "many" }],
    ["bad dateFrom", { dateFrom: "yesterday" }],
    ["empty cursor", { cursor: "" }],
  ])("400s with invalid_request on %s", async (_label, query) => {
    const res = buildRes();
    await DeveloperRequestLogController.listRequestLogs(buildReq(query), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid query parameters",
      code: "invalid_request",
    });
    expect(listMock).not.toHaveBeenCalled();
  });

  it("returns the { data, pagination } envelope", async () => {
    const page = {
      items: [{ id: "log-1" }],
      pagination: { nextCursor: "abc", hasMore: true, limit: 50 },
    };
    listMock.mockResolvedValue(page);
    const res = buildRes();
    await DeveloperRequestLogController.listRequestLogs(buildReq(), res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      data: page.items,
      pagination: page.pagination,
    });
  });

  it("passes filters through and clamps the limit", async () => {
    const res = buildRes();
    await DeveloperRequestLogController.listRequestLogs(
      buildReq({
        limit: "500",
        cursor: "cur",
        apiKeyId: "key-1",
        statusClass: "4xx",
        dateFrom: "2026-07-01T00:00:00.000Z",
        dateTo: "2026-07-07T00:00:00.000Z",
      }),
      res,
    );
    expect(listMock).toHaveBeenCalledWith({
      organisationId: "org-1",
      limit: 100,
      cursor: "cur",
      apiKeyId: "key-1",
      statusClass: "4xx",
      dateFrom: "2026-07-01T00:00:00.000Z",
      dateTo: "2026-07-07T00:00:00.000Z",
    });
  });

  it("defaults the limit to 50", async () => {
    const res = buildRes();
    await DeveloperRequestLogController.listRequestLogs(buildReq(), res);
    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 50 }),
    );
  });

  it("maps InvalidCursorError to a 400", async () => {
    listMock.mockRejectedValue(new InvalidCursorError());
    const res = buildRes();
    await DeveloperRequestLogController.listRequestLogs(
      buildReq({ cursor: "forged" }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid pagination cursor",
      code: "invalid_request",
    });
  });

  it("500s with internal_error on unexpected failures", async () => {
    listMock.mockRejectedValue(new Error("db down"));
    const res = buildRes();
    await DeveloperRequestLogController.listRequestLogs(buildReq(), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Internal server error",
      code: "internal_error",
    });
  });
});
