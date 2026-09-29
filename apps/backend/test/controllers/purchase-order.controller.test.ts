import { PurchaseOrderController } from "src/controllers/web/purchase-order.controller";
import { PurchaseOrderService } from "src/services/purchase-order.service";

jest.mock("src/services/purchase-order.service", () => {
  class PurchaseOrderServiceError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 400) {
      super(message);
      this.statusCode = statusCode;
    }
  }
  return {
    PurchaseOrderServiceError,
    PurchaseOrderService: {
      createOrder: jest.fn(),
      confirmOrder: jest.fn(),
      receiveDelivery: jest.fn(),
      returnDelivery: jest.fn(),
      getPurchaseOrder: jest.fn(),
      listPurchaseOrders: jest.fn(),
      cancelOrder: jest.fn(),
      getOutstandingDeliveries: jest.fn(),
    },
  };
});

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn() },
}));

const service = PurchaseOrderService as unknown as Record<string, jest.Mock>;
const response = () => {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
};
const request = (
  params: Record<string, string> = {},
  body: unknown = {},
  query: Record<string, string> = {},
  userId = "user-1",
) => ({ params, body, query, userId, organisationId: "org-1" });

beforeEach(() => {
  jest.clearAllMocks();
  for (const method of Object.values(service))
    method.mockResolvedValue({ id: "result-1" });
});

describe("PurchaseOrderController.createOrder", () => {
  it("rejects invalid input and derives tenant and actor from the request", async () => {
    const invalidResponse = response();
    await PurchaseOrderController.createOrder(
      request({ organisationId: "org-1" }, { lines: [] }) as never,
      invalidResponse as never,
    );
    expect(invalidResponse.status).toHaveBeenCalledWith(400);

    const noCurrency = response();
    await PurchaseOrderController.createOrder(
      request(
        { organisationId: "org-1" },
        {
          vendorId: "11111111-1111-4111-8111-111111111111",
          currency: "euro",
          lines: [
            {
              itemId: "33333333-3333-4333-8333-333333333333",
              quantityOrdered: 1,
              unitCost: 1,
            },
          ],
        },
      ) as never,
      noCurrency as never,
    );
    expect(noCurrency.status).toHaveBeenCalledWith(400);
    expect(service.createOrder).not.toHaveBeenCalled();

    const res = response();
    await PurchaseOrderController.createOrder(
      request(
        { organisationId: "org-1" },
        {
          vendorId: "11111111-1111-4111-8111-111111111111",
          currency: " eur ",
          expectedDate: "2026-09-27T10:00:00.000Z",
          organisationId: "22222222-2222-4222-8222-222222222222",
          createdBy: "attacker",
          lines: [
            {
              itemId: "33333333-3333-4333-8333-333333333333",
              quantityOrdered: 2,
              unitCost: 5,
              expiryDate: "2027-01-01T00:00:00.000Z",
            },
          ],
        },
      ) as never,
      res as never,
    );

    expect(service.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "org-1",
        createdBy: "user-1",
        currency: "EUR",
        expectedDate: new Date("2026-09-27T10:00:00.000Z"),
        lines: [
          expect.objectContaining({
            expiryDate: new Date("2027-01-01T00:00:00.000Z"),
          }),
        ],
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("maps service and unexpected failures", async () => {
    const { PurchaseOrderServiceError } = jest.requireMock(
      "src/services/purchase-order.service",
    );
    const validBody = {
      vendorId: "11111111-1111-4111-8111-111111111111",
      currency: "USD",
      lines: [
        {
          itemId: "33333333-3333-4333-8333-333333333333",
          quantityOrdered: 1,
          unitCost: 1,
        },
      ],
    };
    service.createOrder.mockRejectedValueOnce(
      new PurchaseOrderServiceError("bad order", 422),
    );
    const serviceErrorResponse = response();
    await PurchaseOrderController.createOrder(
      request({ organisationId: "org-1" }, validBody) as never,
      serviceErrorResponse as never,
    );
    expect(serviceErrorResponse.status).toHaveBeenCalledWith(422);

    const serverErrorResponse = response();
    service.createOrder.mockRejectedValueOnce(
      new Error("database unavailable"),
    );
    await PurchaseOrderController.createOrder(
      request({ organisationId: "org-1" }, validBody) as never,
      serverErrorResponse as never,
    );
    expect(
      jest.requireMock("src/utils/logger").default.error,
    ).toHaveBeenCalled();
    expect(serverErrorResponse.status).toHaveBeenCalledWith(500);
    expect(serverErrorResponse.json).toHaveBeenCalledWith({
      message: "Internal Server Error",
    });

    service.createOrder.mockRejectedValueOnce("unknown failure");
    const unknownErrorResponse = response();
    await PurchaseOrderController.createOrder(
      request({ organisationId: "org-1" }, validBody) as never,
      unknownErrorResponse as never,
    );
    expect(unknownErrorResponse.json).toHaveBeenCalledWith({
      message: "Internal Server Error",
    });
  });
});

describe("PurchaseOrderController status and delivery actions", () => {
  it("confirms the route order within the request's organisation", async () => {
    const res = response();
    await PurchaseOrderController.confirmOrder(
      request({ purchaseOrderId: "po-1" }) as never,
      res as never,
    );
    expect(service.confirmOrder).toHaveBeenCalledWith("po-1", "org-1");
    expect(res.json).toHaveBeenCalledWith({ id: "result-1" });
  });

  it("validates and records receipt with the route order and authenticated user", async () => {
    const badRes = response();
    await PurchaseOrderController.receiveDelivery(
      request({ purchaseOrderId: "po-1" }, { lines: [] }) as never,
      badRes as never,
    );
    expect(badRes.status).toHaveBeenCalledWith(400);

    const noKey = response();
    await PurchaseOrderController.receiveDelivery(
      request(
        { purchaseOrderId: "po-1" },
        {
          lines: [
            {
              purchaseOrderLineId: "11111111-1111-4111-8111-111111111111",
              quantityReceived: 1,
            },
          ],
        },
      ) as never,
      noKey as never,
    );
    expect(noKey.status).toHaveBeenCalledWith(400);
    expect(service.receiveDelivery).not.toHaveBeenCalled();

    await PurchaseOrderController.receiveDelivery(
      request(
        { purchaseOrderId: "po-1" },
        {
          purchaseOrderId: "attacker-order",
          vendorId: "attacker-vendor",
          receivedBy: "attacker-user",
          idempotencyKey: " receipt-1 ",
          deliveryDate: "2026-09-27T10:00:00.000Z",
          lines: [
            {
              purchaseOrderLineId: "11111111-1111-4111-8111-111111111111",
              itemId: "attacker-item",
              quantityReceived: 1,
            },
          ],
        },
      ) as never,
      response() as never,
    );
    expect(service.receiveDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "org-1",
        purchaseOrderId: "po-1",
        receivedBy: "user-1",
        idempotencyKey: "receipt-1",
        deliveryDate: new Date("2026-09-27T10:00:00.000Z"),
      }),
    );
  });

  it("validates and records returns using the route delivery", async () => {
    const badRes = response();
    await PurchaseOrderController.returnDelivery(
      request({ deliveryId: "delivery-1" }, { lines: [] }) as never,
      badRes as never,
    );
    expect(badRes.status).toHaveBeenCalledWith(400);

    const noKey = response();
    await PurchaseOrderController.returnDelivery(
      request(
        { deliveryId: "delivery-1" },
        {
          lines: [
            {
              deliveryLineId: "11111111-1111-4111-8111-111111111111",
              quantityReturned: 1,
            },
          ],
        },
      ) as never,
      noKey as never,
    );
    expect(noKey.status).toHaveBeenCalledWith(400);
    expect(service.returnDelivery).not.toHaveBeenCalled();

    await PurchaseOrderController.returnDelivery(
      request(
        { deliveryId: "delivery-1" },
        {
          deliveryId: "attacker-delivery",
          returnedBy: "attacker-user",
          idempotencyKey: "return-1",
          notes: "damaged",
          lines: [
            {
              deliveryLineId: "11111111-1111-4111-8111-111111111111",
              quantityReturned: 1,
            },
          ],
        },
      ) as never,
      response() as never,
    );
    expect(service.returnDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "org-1",
        deliveryId: "delivery-1",
        returnedBy: "user-1",
        idempotencyKey: "return-1",
        notes: "damaged",
      }),
    );
  });

  it("handles service errors from confirmation and delivery actions", async () => {
    const confirmRes = response();
    service.confirmOrder.mockRejectedValueOnce(new Error("confirm failed"));
    await PurchaseOrderController.confirmOrder(
      request({ purchaseOrderId: "po-1" }) as never,
      confirmRes as never,
    );
    const receiveRes = response();
    service.receiveDelivery.mockRejectedValueOnce(new Error("receive failed"));
    await PurchaseOrderController.receiveDelivery(
      request(
        { purchaseOrderId: "po-1" },
        {
          idempotencyKey: "receipt-1",
          lines: [
            {
              purchaseOrderLineId: "11111111-1111-4111-8111-111111111111",
              quantityReceived: 1,
            },
          ],
        },
      ) as never,
      receiveRes as never,
    );
    const returnRes = response();
    service.returnDelivery.mockRejectedValueOnce(new Error("return failed"));
    await PurchaseOrderController.returnDelivery(
      request(
        { deliveryId: "delivery-1" },
        {
          idempotencyKey: "return-1",
          lines: [
            {
              deliveryLineId: "11111111-1111-4111-8111-111111111111",
              quantityReturned: 1,
            },
          ],
        },
      ) as never,
      returnRes as never,
    );
    for (const res of [confirmRes, receiveRes, returnRes]) {
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Internal Server Error",
      });
    }
  });
});

describe("PurchaseOrderController reads", () => {
  it("returns a 404 for missing orders and the order when found", async () => {
    service.getPurchaseOrder.mockResolvedValueOnce(null);
    const missing = response();
    await PurchaseOrderController.getOrder(
      request({ purchaseOrderId: "po-1" }) as never,
      missing as never,
    );
    expect(missing.status).toHaveBeenCalledWith(404);

    const found = response();
    await PurchaseOrderController.getOrder(
      request({ purchaseOrderId: "po-1" }) as never,
      found as never,
    );
    expect(found.json).toHaveBeenCalledWith({ id: "result-1" });
  });

  it("validates query filters, passes parsed pagination, and lists outstanding items", async () => {
    const invalid = response();
    await PurchaseOrderController.listOrders(
      request({ organisationId: "org-1" }, {}, { pageSize: "0" }) as never,
      invalid as never,
    );
    expect(invalid.status).toHaveBeenCalledWith(400);

    await PurchaseOrderController.listOrders(
      request(
        { organisationId: "org-1" },
        {},
        { page: "2", pageSize: "10" },
      ) as never,
      response() as never,
    );
    expect(service.listPurchaseOrders).toHaveBeenCalledWith({
      organisationId: "org-1",
      page: 2,
      pageSize: 10,
    });

    await PurchaseOrderController.getOutstandingDeliveries(
      request({ organisationId: "org-1" }) as never,
      response() as never,
    );
    expect(service.getOutstandingDeliveries).toHaveBeenCalledWith("org-1");
  });

  it("cancels the route order and routes service failures through the error handler", async () => {
    await PurchaseOrderController.cancelOrder(
      request({ purchaseOrderId: "po-1" }) as never,
      response() as never,
    );
    expect(service.cancelOrder).toHaveBeenCalledWith("po-1", "org-1");

    service.cancelOrder.mockRejectedValueOnce(new Error("unexpected"));
    const res = response();
    await PurchaseOrderController.cancelOrder(
      request({ purchaseOrderId: "po-1" }) as never,
      res as never,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("handles read and list service failures", async () => {
    const readRes = response();
    service.getPurchaseOrder.mockRejectedValueOnce(new Error("read failed"));
    await PurchaseOrderController.getOrder(
      request({ purchaseOrderId: "po-1" }) as never,
      readRes as never,
    );
    const listRes = response();
    service.listPurchaseOrders.mockRejectedValueOnce(new Error("list failed"));
    await PurchaseOrderController.listOrders(
      request({ organisationId: "org-1" }) as never,
      listRes as never,
    );
    const outstandingRes = response();
    service.getOutstandingDeliveries.mockRejectedValueOnce(
      new Error("outstanding failed"),
    );
    await PurchaseOrderController.getOutstandingDeliveries(
      request({ organisationId: "org-1" }) as never,
      outstandingRes as never,
    );
    for (const res of [readRes, listRes, outstandingRes]) {
      expect(res.status).toHaveBeenCalledWith(500);
    }
  });
});
