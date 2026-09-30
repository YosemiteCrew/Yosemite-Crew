import type { Request, Response } from "express";
import { ClientCollectionsController } from "../../src/controllers/app/client-collections.controller";
import {
  ClientCollectionsError,
  ClientCollectionsService,
} from "../../src/services/finance/client-collections";
import logger from "src/utils/logger";

jest.mock("../../src/services/finance/client-collections", () => ({
  ClientCollectionsError: class ClientCollectionsError extends Error {
    constructor(
      message: string,
      public readonly statusCode: number,
    ) {
      super(message);
    }
  },
  ClientCollectionsService: {
    getPaymentTerms: jest.fn(),
    setPaymentTerms: jest.fn(),
    listOverdue: jest.fn(),
    markReviewed: jest.fn(),
  },
}));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn() },
}));

const service = ClientCollectionsService as unknown as {
  getPaymentTerms: jest.Mock;
  setPaymentTerms: jest.Mock;
  listOverdue: jest.Mock;
  markReviewed: jest.Mock;
};
const mockedLogger = logger as unknown as { error: jest.Mock };
const PARENT = "22222222-2222-4222-8222-222222222222";
const INVOICE = "33333333-3333-4333-8333-333333333333";

const buildRes = () =>
  ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  }) as unknown as Response;

const buildReq = (overrides: Record<string, unknown> = {}) =>
  ({
    params: { organisationId: "org-1", parentId: PARENT, invoiceId: INVOICE },
    body: {},
    organisationId: "org-1",
    userId: "staff-1",
    ...overrides,
  }) as unknown as Request;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ClientCollectionsController.getPaymentTerms", () => {
  it("returns the client's terms for the authorized practice", async () => {
    const terms = { netDays: 30, updatedAt: new Date(), updatedBy: "staff-1" };
    service.getPaymentTerms.mockResolvedValue(terms);
    const res = buildRes();

    await ClientCollectionsController.getPaymentTerms(buildReq(), res);

    expect(service.getPaymentTerms).toHaveBeenCalledWith("org-1", PARENT);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: terms, error: null });
  });

  it("rejects an invalid client id without querying the service", async () => {
    const res = buildRes();
    await ClientCollectionsController.getPaymentTerms(
      buildReq({ params: { organisationId: "org-1", parentId: "bad" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(service.getPaymentTerms).not.toHaveBeenCalled();
  });

  it("uses the authorized practice, not an untrusted path practice", async () => {
    const res = buildRes();
    await ClientCollectionsController.getPaymentTerms(
      buildReq({
        params: { organisationId: "org-2", parentId: PARENT },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(service.getPaymentTerms).not.toHaveBeenCalled();
  });

  it("maps a missing account to 404 and unexpected failure to 500", async () => {
    const missing = buildRes();
    service.getPaymentTerms.mockRejectedValueOnce(
      new ClientCollectionsError("Client account not found.", 404),
    );
    await ClientCollectionsController.getPaymentTerms(buildReq(), missing);
    expect(missing.status).toHaveBeenCalledWith(404);

    const failed = buildRes();
    service.getPaymentTerms.mockRejectedValueOnce(new Error("database down"));
    await ClientCollectionsController.getPaymentTerms(buildReq(), failed);
    expect(failed.status).toHaveBeenCalledWith(500);
    expect(mockedLogger.error).toHaveBeenCalled();
  });
});

describe("ClientCollectionsController.setPaymentTerms", () => {
  it("stores validated terms against the verified practice and user", async () => {
    const terms = { netDays: 14, updatedAt: new Date(), updatedBy: "staff-1" };
    service.setPaymentTerms.mockResolvedValue(terms);
    const res = buildRes();

    await ClientCollectionsController.setPaymentTerms(
      buildReq({ body: { netDays: 14 } }),
      res,
    );

    expect(service.setPaymentTerms).toHaveBeenCalledWith({
      organisationId: "org-1",
      parentId: PARENT,
      netDays: 14,
      updatedBy: "staff-1",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: terms, error: null });
  });

  it("requires an authenticated reviewer and valid input", async () => {
    const unauthenticated = buildRes();
    await ClientCollectionsController.setPaymentTerms(
      buildReq({ userId: undefined, body: { netDays: 14 } }),
      unauthenticated,
    );
    expect(unauthenticated.status).toHaveBeenCalledWith(401);

    const invalid = buildRes();
    await ClientCollectionsController.setPaymentTerms(
      buildReq({ body: { netDays: 366 } }),
      invalid,
    );
    expect(invalid.status).toHaveBeenCalledWith(400);
    expect(service.setPaymentTerms).not.toHaveBeenCalled();
  });

  it("rejects invalid client ids and practice mismatches", async () => {
    const invalid = buildRes();
    await ClientCollectionsController.setPaymentTerms(
      buildReq({
        params: { organisationId: "org-1", parentId: "bad" },
        body: { netDays: 30 },
      }),
      invalid,
    );
    expect(invalid.status).toHaveBeenCalledWith(400);

    const mismatch = buildRes();
    await ClientCollectionsController.setPaymentTerms(
      buildReq({ organisationId: "org-2", body: { netDays: 30 } }),
      mismatch,
    );
    expect(mismatch.status).toHaveBeenCalledWith(403);
    expect(service.setPaymentTerms).not.toHaveBeenCalled();
  });

  it("maps service errors without exposing unexpected details", async () => {
    const expected = buildRes();
    service.setPaymentTerms.mockRejectedValueOnce(
      new ClientCollectionsError("Client account not found.", 404),
    );
    await ClientCollectionsController.setPaymentTerms(
      buildReq({ body: { netDays: 30 } }),
      expected,
    );
    expect(expected.status).toHaveBeenCalledWith(404);

    const failed = buildRes();
    service.setPaymentTerms.mockRejectedValueOnce(new Error("private"));
    await ClientCollectionsController.setPaymentTerms(
      buildReq({ body: { netDays: 30 } }),
      failed,
    );
    expect(failed.status).toHaveBeenCalledWith(500);
    expect(failed.json).toHaveBeenCalledWith({
      message: "Internal server error",
    });
  });
});

describe("ClientCollectionsController.listOverdue", () => {
  it("returns the practice's overdue collection rows", async () => {
    const rows = [{ invoiceId: INVOICE, parentId: PARENT, balance: 40 }];
    service.listOverdue.mockResolvedValue(rows);
    const res = buildRes();

    await ClientCollectionsController.listOverdue(buildReq(), res);

    expect(service.listOverdue).toHaveBeenCalledWith("org-1");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: rows, error: null });
  });

  it("returns a generic failure when overdue accounts cannot be loaded", async () => {
    service.listOverdue.mockRejectedValue(new Error("database down"));
    const res = buildRes();

    await ClientCollectionsController.listOverdue(buildReq(), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal server error" });
  });

  it("does not read overdue accounts from another practice", async () => {
    const res = buildRes();
    await ClientCollectionsController.listOverdue(
      buildReq({ organisationId: "org-2" }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(service.listOverdue).not.toHaveBeenCalled();
  });
});

describe("ClientCollectionsController.markReviewed", () => {
  it("records review by the verified staff member", async () => {
    const reviewed = {
      id: INVOICE,
      collectionsReviewedAt: new Date(),
      collectionsReviewedBy: "staff-1",
    };
    service.markReviewed.mockResolvedValue(reviewed);
    const res = buildRes();

    await ClientCollectionsController.markReviewed(buildReq(), res);

    expect(service.markReviewed).toHaveBeenCalledWith({
      organisationId: "org-1",
      invoiceId: INVOICE,
      reviewedBy: "staff-1",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: reviewed, error: null });
  });

  it("rejects unauthenticated reviewers and invalid invoice ids", async () => {
    const unauthenticated = buildRes();
    await ClientCollectionsController.markReviewed(
      buildReq({ userId: undefined }),
      unauthenticated,
    );
    expect(unauthenticated.status).toHaveBeenCalledWith(401);

    const invalid = buildRes();
    await ClientCollectionsController.markReviewed(
      buildReq({ params: { organisationId: "org-1", invoiceId: "bad" } }),
      invalid,
    );
    expect(invalid.status).toHaveBeenCalledWith(400);
    expect(service.markReviewed).not.toHaveBeenCalled();
  });

  it("does not review invoices from another practice", async () => {
    const res = buildRes();
    await ClientCollectionsController.markReviewed(
      buildReq({ organisationId: "org-2" }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(service.markReviewed).not.toHaveBeenCalled();
  });

  it("maps an invoice no longer due to 409", async () => {
    service.markReviewed.mockRejectedValue(
      new ClientCollectionsError("Invoice is no longer overdue.", 409),
    );
    const res = buildRes();

    await ClientCollectionsController.markReviewed(buildReq(), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invoice is no longer overdue.",
    });
  });
});
