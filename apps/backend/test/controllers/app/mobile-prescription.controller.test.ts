const listPrescriptionsForParent = jest.fn();
const getByProviderUserId = jest.fn();
const resolveVerifiedUserId = jest.fn();

jest.mock("src/services/mobile-prescription.service", () => ({
  MobilePrescriptionService: { listPrescriptionsForParent },
}));

jest.mock("src/services/authUserMobile.service", () => ({
  AuthUserMobileService: { getByProviderUserId },
}));

jest.mock("src/utils/request", () => ({ resolveVerifiedUserId }));

jest.mock("src/utils/logger", () => ({ error: jest.fn(), warn: jest.fn() }));

import type { Request, Response } from "express";
import { MobilePrescriptionController } from "src/controllers/app/prescription.controller";

type MockResponse = {
  status: jest.Mock;
  json: jest.Mock;
};

const response = () => {
  const res = {} as MockResponse;
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const asRes = (r: MockResponse) => r as unknown as Response;
const asReq = (query: Record<string, unknown> = {}) =>
  ({ query }) as unknown as Request;

const page = (overrides: Record<string, unknown> = {}) => ({
  prescriptions: [],
  nextCursor: null,
  hasMore: false,
  limit: 20,
  ...overrides,
});

describe("MobilePrescriptionController.listPrescriptions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveVerifiedUserId.mockReturnValue("auth-1");
    getByProviderUserId.mockResolvedValue({ parentId: "parent-1" });
    listPrescriptionsForParent.mockResolvedValue(page());
  });

  it("refuses an unauthenticated caller before reading anything", async () => {
    resolveVerifiedUserId.mockReturnValue(undefined);
    const res = response();

    await MobilePrescriptionController.listPrescriptions(asReq(), asRes(res));

    expect(res.status).toHaveBeenCalledWith(401);
    expect(getByProviderUserId).not.toHaveBeenCalled();
    expect(listPrescriptionsForParent).not.toHaveBeenCalled();
  });

  it("answers 404 when the verified user has no parent record", async () => {
    getByProviderUserId.mockResolvedValue(null);
    const res = response();

    await MobilePrescriptionController.listPrescriptions(asReq(), asRes(res));

    expect(res.status).toHaveBeenCalledWith(404);
    expect(listPrescriptionsForParent).not.toHaveBeenCalled();
  });

  /*
   * Rejected before the query rather than after it. If a malformed cursor
   * reached Prisma, the resulting throw would be indistinguishable from a
   * database outage and this endpoint would answer 400 for both.
   */
  it("rejects a malformed cursor without querying", async () => {
    const res = response();

    await MobilePrescriptionController.listPrescriptions(
      asReq({ cursor: "not-a-uuid" }),
      asRes(res),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(listPrescriptionsForParent).not.toHaveBeenCalled();
  });

  it("passes a well-formed cursor and the requested limit through", async () => {
    const cursor = "3f7c1a9e-2b4d-4c8e-9a1f-0d6b5e4c3a2b";
    const res = response();

    await MobilePrescriptionController.listPrescriptions(
      asReq({ cursor, limit: "5" }),
      asRes(res),
    );

    expect(listPrescriptionsForParent).toHaveBeenCalledWith("parent-1", {
      cursor,
      limit: "5",
    });
  });

  it("sends no cursor when the caller sent none", async () => {
    const res = response();

    await MobilePrescriptionController.listPrescriptions(asReq(), asRes(res));

    expect(listPrescriptionsForParent).toHaveBeenCalledWith("parent-1", {
      cursor: undefined,
      limit: undefined,
    });
  });

  /*
   * The three fields beside `prescriptions` are the whole point of #2709: a
   * response carrying only the array cannot tell a client the difference
   * between the end of the data and the end of a page.
   */
  it("returns the page metadata alongside the prescriptions", async () => {
    listPrescriptionsForParent.mockResolvedValue(
      page({
        prescriptions: [{ id: "rx-1" }],
        nextCursor: "rx-1",
        hasMore: true,
        limit: 1,
      }),
    );
    const res = response();

    await MobilePrescriptionController.listPrescriptions(
      asReq({ limit: "1" }),
      asRes(res),
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      prescriptions: [{ id: "rx-1" }],
      nextCursor: "rx-1",
      hasMore: true,
      limit: 1,
    });
  });

  it("answers 500 when the read fails, rather than an empty page", async () => {
    listPrescriptionsForParent.mockRejectedValue(new Error("db down"));
    const res = response();

    await MobilePrescriptionController.listPrescriptions(asReq(), asRes(res));

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Failed to list prescriptions.",
    });
  });
});
