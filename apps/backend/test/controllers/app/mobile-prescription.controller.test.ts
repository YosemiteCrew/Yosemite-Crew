const listPrescriptionsForParent = jest.fn();
const getOwnedPrescriptionForRefill = jest.fn();
const getByProviderUserId = jest.fn();
const resolveVerifiedUserId = jest.fn();
const createPrescriptionDispenseRequest = jest.fn();

jest.mock("src/services/mobile-prescription.service", () => ({
  MobilePrescriptionService: {
    listPrescriptionsForParent,
    getOwnedPrescriptionForRefill,
  },
}));

jest.mock("src/services/inventory-consumption.service", () => {
  class InventoryConsumptionServiceError extends Error {
    constructor(
      message: string,
      public readonly statusCode = 400,
    ) {
      super(message);
    }
  }
  return {
    InventoryConsumptionService: { createPrescriptionDispenseRequest },
    InventoryConsumptionServiceError,
  };
});

jest.mock("src/services/authUserMobile.service", () => ({
  AuthUserMobileService: { getByProviderUserId },
}));

jest.mock("src/utils/request", () => ({ resolveVerifiedUserId }));

jest.mock("src/utils/logger", () => ({ error: jest.fn(), warn: jest.fn() }));

import type { Request, Response } from "express";
import { MobilePrescriptionController } from "src/controllers/app/prescription.controller";
import { InventoryConsumptionServiceError } from "src/services/inventory-consumption.service";
import { encodeKeysetCursor } from "src/services/shared/pagination";

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
const asReqWithParams = (params: Record<string, unknown>) =>
  ({ query: {}, params }) as unknown as Request;

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

  /*
   * The service is handed the decoded position, not the opaque string. The
   * controller owns the 400 for a cursor it cannot decode, so the service can
   * treat every failure below it as a real failure.
   */
  it("passes a well-formed cursor and the requested limit through", async () => {
    const createdAt = new Date("2026-09-01T10:00:00.000Z");
    const id = "3f7c1a9e-2b4d-4c8e-9a1f-0d6b5e4c3a2b";
    const cursor = encodeKeysetCursor({ createdAt, id });
    const res = response();

    await MobilePrescriptionController.listPrescriptions(
      asReq({ cursor, limit: "5" }),
      asRes(res),
    );

    expect(listPrescriptionsForParent).toHaveBeenCalledWith("parent-1", {
      cursor: { createdAt, id },
      limit: "5",
    });
  });

  /*
   * A bare row id was the cursor format before #2720 and is not one now. It
   * decodes to rubbish rather than throwing, so the 400 comes from the shape
   * check and not from an exception - which is the same reason the malformed
   * case above is rejected before the query.
   */
  it("rejects a bare row id, which is what the old cursor format was", async () => {
    const res = response();

    await MobilePrescriptionController.listPrescriptions(
      asReq({ cursor: "3f7c1a9e-2b4d-4c8e-9a1f-0d6b5e4c3a2b" }),
      asRes(res),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(listPrescriptionsForParent).not.toHaveBeenCalled();
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

describe("MobilePrescriptionController.requestRefill", () => {
  const ownedPrescription = {
    id: "rx-1",
    organisationId: "org-1",
    encounterId: "enc-1",
    medications: [{ medication: "Meloxicam" }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resolveVerifiedUserId.mockReturnValue("auth-1");
    getByProviderUserId.mockResolvedValue({ parentId: "parent-1" });
    getOwnedPrescriptionForRefill.mockResolvedValue(ownedPrescription);
    createPrescriptionDispenseRequest.mockResolvedValue({ id: "req-1" });
  });

  it("refuses an unauthenticated caller before reading anything", async () => {
    resolveVerifiedUserId.mockReturnValue(undefined);
    const res = response();

    await MobilePrescriptionController.requestRefill(
      asReqWithParams({ id: "rx-1" }),
      asRes(res),
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(getOwnedPrescriptionForRefill).not.toHaveBeenCalled();
    expect(createPrescriptionDispenseRequest).not.toHaveBeenCalled();
  });

  it("answers 404 for a prescription id the parent does not own, without writing", async () => {
    getOwnedPrescriptionForRefill.mockResolvedValue(null);
    const res = response();

    await MobilePrescriptionController.requestRefill(
      asReqWithParams({ id: "rx-someone-elses" }),
      asRes(res),
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(createPrescriptionDispenseRequest).not.toHaveBeenCalled();
  });

  it("looks the prescription up by the path id under the resolved parent", async () => {
    const res = response();

    await MobilePrescriptionController.requestRefill(
      asReqWithParams({ id: "rx-1" }),
      asRes(res),
    );

    expect(getOwnedPrescriptionForRefill).toHaveBeenCalledWith(
      "parent-1",
      "rx-1",
    );
  });

  it("writes the dispense request from the owned prescription's own fields", async () => {
    const res = response();

    await MobilePrescriptionController.requestRefill(
      asReqWithParams({ id: "rx-1" }),
      asRes(res),
    );

    expect(createPrescriptionDispenseRequest).toHaveBeenCalledWith({
      organisationId: "org-1",
      prescriptionId: "rx-1",
      medications: [{ medication: "Meloxicam" }],
      requestedBy: "parent-1",
      context: { encounterId: "enc-1" },
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ status: "PENDING" });
  });

  it("answers with the service error's own status code", async () => {
    createPrescriptionDispenseRequest.mockRejectedValue(
      new InventoryConsumptionServiceError(
        "organisationId and prescriptionId are required",
        400,
      ),
    );
    const res = response();

    await MobilePrescriptionController.requestRefill(
      asReqWithParams({ id: "rx-1" }),
      asRes(res),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "organisationId and prescriptionId are required",
    });
  });

  it("answers 500 for an unexpected failure, rather than a silent no-op", async () => {
    createPrescriptionDispenseRequest.mockRejectedValue(new Error("db down"));
    const res = response();

    await MobilePrescriptionController.requestRefill(
      asReqWithParams({ id: "rx-1" }),
      asRes(res),
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Failed to request refill.",
    });
  });
});
