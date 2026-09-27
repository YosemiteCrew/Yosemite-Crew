import { Request, Response } from "express";
import { encodeKeysetCursor } from "src/services/shared/pagination";
import { BillingReviewService } from "src/services/billing-review.service";
import { BillingReviewController } from "src/controllers/app/billing-review.controller";
import logger from "src/utils/logger";

jest.mock("src/services/billing-review.service", () => ({
  BillingReviewService: { list: jest.fn() },
}));
jest.mock("src/utils/logger", () => ({ error: jest.fn() }));

const service = BillingReviewService.list as jest.Mock;
const org = "org-1";
const buildRequest = (overrides: Record<string, unknown> = {}) =>
  ({
    params: { organisationId: org, ...(overrides.params as object) },
    query: overrides.query ?? {},
    organisationId: overrides.organisationId ?? org,
  }) as unknown as Request;
const buildResponse = () => {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
  } as unknown as Response;
  (res.status as jest.Mock).mockReturnValue(res);
  (res.json as jest.Mock).mockReturnValue(res);
  return res;
};

beforeEach(() => jest.clearAllMocks());

describe("BillingReviewController.list", () => {
  it("returns the authorized organisation's page and metadata", async () => {
    const page = {
      items: [{ id: "visit-1" }],
      nextCursor: "next",
      hasMore: true,
    };
    service.mockResolvedValue(page);
    const res = buildResponse();

    await BillingReviewController.list(
      buildRequest({ query: { limit: "1000" } }),
      res,
    );

    expect(service).toHaveBeenCalledWith(org, 100, undefined);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      data: page.items,
      meta: { nextCursor: "next", hasMore: true, limit: 100 },
      error: null,
    });
  });

  it("rejects a cursor with an invalid shape before querying", async () => {
    const res = buildResponse();

    await BillingReviewController.list(
      buildRequest({ query: { cursor: "bad" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(service).not.toHaveBeenCalled();
  });

  it("does not use a path organisation different from the authorized one", async () => {
    const res = buildResponse();

    await BillingReviewController.list(
      buildRequest({ params: { organisationId: "org-2" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(service).not.toHaveBeenCalled();
  });

  it("forwards a valid keyset cursor", async () => {
    service.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
    const cursor = encodeKeysetCursor({
      createdAt: new Date("2026-09-01T10:00:00.000Z"),
      id: "00000000-0000-4000-8000-000000000001",
    });

    await BillingReviewController.list(
      buildRequest({ query: { cursor } }),
      buildResponse(),
    );

    expect(service).toHaveBeenCalledWith(org, 50, {
      createdAt: new Date("2026-09-01T10:00:00.000Z"),
      id: "00000000-0000-4000-8000-000000000001",
    });
  });

  it("returns a safe server error when the service fails", async () => {
    const failure = new Error("database unavailable");
    service.mockRejectedValue(failure);
    const res = buildResponse();

    await BillingReviewController.list(buildRequest(), res);

    expect(logger.error).toHaveBeenCalledWith(
      "Unable to load completed visits for billing review",
      failure,
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal server error" });
  });
});
