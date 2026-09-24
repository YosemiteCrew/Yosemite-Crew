import { Request, Response } from "express";
import { SupplierBillController } from "../../src/controllers/app/supplier-bill.controller";
import {
  SupplierBillService,
  SupplierBillServiceError,
} from "../../src/services/supplier-bills";

jest.mock("../../src/services/supplier-bills", () => {
  class SupplierBillServiceError extends Error {
    constructor(
      message: string,
      public readonly statusCode: number,
    ) {
      super(message);
    }
  }
  return {
    SupplierBillServiceError,
    SupplierBillService: {
      createDraft: jest.fn(),
      getById: jest.fn(),
      list: jest.fn(),
      postBill: jest.fn(),
      voidBill: jest.fn(),
      createCredit: jest.fn(),
      createPayment: jest.fn(),
      getSupplierAccount: jest.fn(),
      getSupplierAccountStatement: jest.fn(),
    },
  };
});

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const service = SupplierBillService as unknown as Record<string, jest.Mock>;

const makeRes = () => {
  const res = {} as Response & { status: jest.Mock; json: jest.Mock };
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const makeReq = (overrides: Record<string, unknown> = {}) =>
  ({
    userId: "user-1",
    organisationId: "org-a",
    params: {},
    query: {},
    body: {},
    ...overrides,
  }) as unknown as Request;

const run = async (
  handler: (req: Request, res: Response) => Promise<unknown>,
  req: Request,
) => {
  const res = makeRes();
  await handler(req, res);
  return res;
};

const line = {
  lineType: "STOCK",
  description: "Synthetic gauze pack",
  quantityReceived: 10,
  quantityBilled: 10,
  unitCost: 2,
};

beforeEach(() => jest.clearAllMocks());

describe("SupplierBillController", () => {
  it("takes the organisation from the verified request, never the body", async () => {
    service.createDraft.mockResolvedValue({ id: "bill-1" });
    const res = await run(
      SupplierBillController.createDraft,
      makeReq({
        body: {
          organisationId: "org-b",
          vendorId: "vendor-a",
          currency: "gbp",
          externalReference: "BILL-1",
          lines: [line],
        },
      }),
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ bill: { id: "bill-1" } });
    expect(service.createDraft).toHaveBeenCalledWith(
      expect.objectContaining({ organisationId: "org-a", currency: "GBP" }),
    );
  });

  // Every route also names an organisation in the path, query or body. Only
  // the one withOrgPermissions verified may reach the service.
  const foreign = { organisationId: "org-b" };
  it.each([
    [
      "createDraft",
      {
        body: {
          vendorId: "vendor-a",
          currency: "GBP",
          externalReference: "BILL-1",
          lines: [line],
        },
      },
    ],
    ["getById", { params: { id: "bill-1" } }],
    ["list", { params: {}, query: {} }],
    [
      "postBill",
      {
        params: { id: "bill-1" },
        body: { expectedVersion: 0, idempotencyKey: "post-1" },
      },
    ],
    [
      "voidBill",
      {
        params: { id: "bill-1" },
        body: { reason: "Entered twice", expectedVersion: 1 },
      },
    ],
    [
      "createCredit",
      {
        body: {
          vendorId: "vendor-a",
          currency: "GBP",
          externalReference: "CN-1",
          amount: 3,
        },
      },
    ],
    [
      "createPayment",
      {
        body: {
          vendorId: "vendor-a",
          currency: "GBP",
          amount: 5,
          paidAt: "2026-02-01T00:00:00.000Z",
          method: "CASH",
          reference: "Till",
          allocations: [{ billId: "bill-1", amount: 5 }],
          idempotencyKey: "pay-1",
        },
      },
    ],
    [
      "getSupplierAccount",
      { params: { vendorId: "vendor-a", currency: "GBP" } },
    ],
    [
      "getSupplierAccountStatement",
      { params: { vendorId: "vendor-a", currency: "GBP" } },
    ],
  ] as const)(
    "%s acts only for the verified organisation",
    async (name, input) => {
      const inputRecord = input as Record<string, Record<string, unknown>>;
      service[name].mockResolvedValue({});
      const res = await run(
        (
          SupplierBillController as Record<
            string,
            typeof SupplierBillController.getById
          >
        )[name],
        makeReq({
          params: { ...inputRecord.params, ...foreign },
          query: { ...inputRecord.query, ...foreign },
          body: { ...inputRecord.body, ...foreign },
        }),
      );

      expect(res.status.mock.calls[0][0]).toBeLessThan(300);
      expect(service[name]).toHaveBeenCalledTimes(1);
      const args = JSON.stringify(service[name].mock.calls[0]);
      expect(args).toContain("org-a");
      expect(args).not.toContain("org-b");
    },
  );

  it.each([
    ["organisation", { organisationId: undefined }],
    ["user", { userId: undefined }],
  ])("answers 401 without a verified %s", async (_label, overrides) => {
    const res = await run(SupplierBillController.getById, makeReq(overrides));
    expect(res.status).toHaveBeenCalledWith(401);
    expect(service.getById).not.toHaveBeenCalled();
  });

  it("answers 400 with details for an invalid body", async () => {
    const res = await run(
      SupplierBillController.createDraft,
      makeReq({
        body: { vendorId: "vendor-a", currency: "POUNDS", lines: [] },
      }),
    );
    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body.error).toBe("Validation error");
    expect(Object.keys(body.details.fieldErrors)).toEqual(
      expect.arrayContaining(["currency", "externalReference", "lines"]),
    );
    expect(service.createDraft).not.toHaveBeenCalled();
  });

  it("passes a service error's status through", async () => {
    service.getById.mockRejectedValue(
      new SupplierBillServiceError("Supplier bill not found", 404),
    );
    const res = await run(
      SupplierBillController.getById,
      makeReq({ params: { id: "bill-1" } }),
    );
    expect(service.getById).toHaveBeenCalledWith("bill-1", "org-a");
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Supplier bill not found" });
  });

  it("answers 500 for an unexpected failure instead of rejecting", async () => {
    service.list.mockRejectedValue(new Error("db down"));
    const res = await run(SupplierBillController.list, makeReq());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
  });

  it("lists with parsed query filters", async () => {
    service.list.mockResolvedValue({ bills: [], nextCursor: undefined });
    const res = await run(
      SupplierBillController.list,
      makeReq({ query: { status: "POSTED", limit: "5" } }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(service.list).toHaveBeenCalledWith({
      organisationId: "org-a",
      status: "POSTED",
      limit: 5,
    });
  });

  it("posts the bill named in the path with the authenticated actor", async () => {
    service.postBill.mockResolvedValue({ id: "bill-1" });
    const res = await run(
      SupplierBillController.postBill,
      makeReq({
        params: { id: "bill-1" },
        body: { billId: "bill-2", expectedVersion: 0, idempotencyKey: "k" },
      }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(service.postBill).toHaveBeenCalledWith({
      billId: "bill-1",
      organisationId: "org-a",
      actorId: "user-1",
      expectedVersion: 0,
      idempotencyKey: "k",
    });
  });

  it("voids the bill named in the path", async () => {
    service.voidBill.mockResolvedValue({ id: "bill-1" });
    await run(
      SupplierBillController.voidBill,
      makeReq({
        params: { id: "bill-1" },
        body: { reason: "Entered twice", expectedVersion: 1 },
      }),
    );
    expect(service.voidBill).toHaveBeenCalledWith({
      billId: "bill-1",
      organisationId: "org-a",
      actorId: "user-1",
      reason: "Entered twice",
      expectedVersion: 1,
    });
  });

  it("creates a credit", async () => {
    service.createCredit.mockResolvedValue({ id: "credit-1" });
    const res = await run(
      SupplierBillController.createCredit,
      makeReq({
        body: {
          vendorId: "vendor-a",
          currency: "GBP",
          externalReference: "CN-1",
          amount: 4,
          billId: "bill-1",
        },
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(service.createCredit).toHaveBeenCalledWith(
      expect.objectContaining({ organisationId: "org-a", amount: 4 }),
    );
  });

  it("creates a payment with a parsed date and rejects a bad one", async () => {
    service.createPayment.mockResolvedValue({ id: "payment-1" });
    const body = {
      vendorId: "vendor-a",
      currency: "GBP",
      amount: 16,
      paidAt: "2026-02-01T00:00:00.000Z",
      method: "BANK_TRANSFER",
      reference: "Transfer 1",
      allocations: [{ billId: "bill-1", amount: 16 }],
      idempotencyKey: "pay-1",
    };
    const res = await run(
      SupplierBillController.createPayment,
      makeReq({ body }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(service.createPayment.mock.calls[0][0].paidAt).toEqual(
      new Date("2026-02-01T00:00:00.000Z"),
    );

    const bad = await run(
      SupplierBillController.createPayment,
      makeReq({ body: { ...body, paidAt: "yesterday" } }),
    );
    expect(bad.status).toHaveBeenCalledWith(400);
    expect(service.createPayment).toHaveBeenCalledTimes(1);
  });

  it("reads the account from path parameters", async () => {
    service.getSupplierAccount.mockResolvedValue({ id: "acct-1" });
    const res = await run(
      SupplierBillController.getSupplierAccount,
      makeReq({ params: { vendorId: "vendor-a", currency: "gbp" } }),
    );
    expect(res.json).toHaveBeenCalledWith({ account: { id: "acct-1" } });
    expect(service.getSupplierAccount).toHaveBeenCalledWith(
      "org-a",
      "vendor-a",
      "GBP",
    );
  });

  it("reads the statement from path parameters and a date range", async () => {
    service.getSupplierAccountStatement.mockResolvedValue({ entries: [] });
    const res = await run(
      SupplierBillController.getSupplierAccountStatement,
      makeReq({
        params: { vendorId: "vendor-a", currency: "GBP" },
        query: { fromDate: "2026-01-01T00:00:00Z" },
      }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(service.getSupplierAccountStatement).toHaveBeenCalledWith({
      organisationId: "org-a",
      vendorId: "vendor-a",
      currency: "GBP",
      fromDate: new Date("2026-01-01T00:00:00Z"),
      toDate: undefined,
    });
  });
});
