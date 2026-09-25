import { Prisma } from "@prisma/client";
import { prisma } from "src/config/prisma";
import {
  PurchaseOrderService,
  PurchaseOrderServiceError,
} from "src/services/purchase-order.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    purchaseOrder: {
      count: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    purchaseOrderLine: {
      fields: { quantityOrdered: "quantityOrdered" },
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    purchaseOrderDelivery: { create: jest.fn(), findFirst: jest.fn() },
    purchaseOrderDeliveryLine: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    inventoryVendor: { findFirst: jest.fn() },
    inventoryItem: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    inventoryBatch: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    inventoryStockMovement: { create: jest.fn() },
  },
}));

const db = prisma as unknown as {
  $transaction: jest.Mock;
  purchaseOrder: Record<string, jest.Mock>;
  purchaseOrderLine: Record<string, jest.Mock>;
  purchaseOrderDelivery: Record<string, jest.Mock>;
  purchaseOrderDeliveryLine: Record<string, jest.Mock>;
  inventoryVendor: Record<string, jest.Mock>;
  inventoryItem: Record<string, jest.Mock>;
  inventoryBatch: Record<string, jest.Mock>;
  inventoryStockMovement: Record<string, jest.Mock>;
};

const order = (overrides: Record<string, unknown> = {}) => ({
  id: "po-1",
  organisationId: "org-1",
  vendorId: "vendor-1",
  status: "CONFIRMED",
  ...overrides,
});

const orderLine = (overrides: Record<string, unknown> = {}) => ({
  id: "line-1",
  purchaseOrderId: "po-1",
  itemId: "item-1",
  vendorId: "vendor-1",
  quantityOrdered: 5,
  quantityReceived: 0,
  quantityReturned: 0,
  unitCost: 2,
  totalCost: 10,
  packSize: 1,
  batchNumber: "lot-1",
  lotNumber: "lot-1",
  expiryDate: null,
  ...overrides,
});

const prismaNotFound = () =>
  new Prisma.PrismaClientKnownRequestError("Record not found", {
    code: "P2025",
    clientVersion: "6.19.3",
  });

beforeEach(() => {
  jest.clearAllMocks();
  db.$transaction.mockImplementation(
    async (callback: (tx: unknown) => unknown) => callback(prisma),
  );
  db.inventoryVendor.findFirst.mockResolvedValue({ id: "vendor-1" });
  db.inventoryItem.findMany.mockResolvedValue([{ id: "item-1" }]);
  db.inventoryItem.findFirst.mockResolvedValue({ onHand: 10, allocated: 0 });
  db.purchaseOrder.findUnique.mockResolvedValue(order());
  db.purchaseOrder.findFirst.mockResolvedValue(order());
  db.purchaseOrder.findMany.mockResolvedValue([]);
  db.purchaseOrder.count.mockResolvedValue(0);
  db.purchaseOrder.create.mockResolvedValue(order({ status: "DRAFT" }));
  db.purchaseOrder.update.mockResolvedValue(order());
  db.purchaseOrderLine.create.mockResolvedValue(orderLine());
  db.purchaseOrderLine.findMany.mockResolvedValue([orderLine()]);
  db.purchaseOrderLine.update.mockResolvedValue(orderLine());
  db.purchaseOrderDelivery.create.mockResolvedValue({ id: "delivery-1" });
  db.purchaseOrderDelivery.findFirst.mockResolvedValue({
    id: "delivery-1",
    purchaseOrderId: "po-1",
    purchaseOrder: order(),
  });
  db.purchaseOrderDeliveryLine.create.mockResolvedValue({
    id: "delivery-line-1",
  });
  db.purchaseOrderDeliveryLine.findMany.mockResolvedValue([
    {
      id: "delivery-line-1",
      deliveryId: "delivery-1",
      purchaseOrderLineId: "line-1",
      itemId: "item-1",
      quantityReceived: 2,
      quantityReturned: 0,
      batchId: "batch-1",
      purchaseOrderLine: orderLine({ quantityReceived: 2 }),
    },
  ]);
  db.purchaseOrderDeliveryLine.update.mockResolvedValue({});
  db.inventoryBatch.findMany.mockResolvedValue([]);
  db.inventoryBatch.findFirst.mockResolvedValue({
    id: "batch-1",
    quantity: 5,
    allocated: 0,
  });
  db.inventoryBatch.create.mockResolvedValue({ id: "batch-new" });
  db.inventoryBatch.update.mockResolvedValue({ id: "batch-1" });
  db.inventoryItem.update.mockResolvedValue({ id: "item-1" });
  db.inventoryStockMovement.create.mockResolvedValue({});
});

describe("PurchaseOrderService.createOrder", () => {
  it("creates an order with tenant-owned vendor and items", async () => {
    db.purchaseOrder.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValue(order());
    const result = await PurchaseOrderService.createOrder({
      organisationId: "org-1",
      vendorId: "vendor-1",
      orderNumber: "PO-1",
      lines: [{ itemId: "item-1", quantityOrdered: 3, unitCost: 2 }],
    });

    expect(db.inventoryVendor.findFirst).toHaveBeenCalledWith({
      where: { id: "vendor-1", organisationId: "org-1" },
      select: { id: true },
    });
    expect(db.purchaseOrderLine.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ vendorId: "vendor-1", totalCost: 6 }),
      }),
    );
    expect(result).toMatchObject({ id: "po-1" });
  });

  it("rejects vendors and items from other organisations", async () => {
    await expect(
      PurchaseOrderService.createOrder({
        organisationId: " ",
        vendorId: "vendor-1",
        lines: [{ itemId: "item-1", quantityOrdered: 1, unitCost: 1 }],
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    db.inventoryVendor.findFirst.mockResolvedValue(null);
    await expect(
      PurchaseOrderService.createOrder({
        organisationId: "org-1",
        vendorId: "foreign-vendor",
        lines: [{ itemId: "item-1", quantityOrdered: 1, unitCost: 1 }],
      }),
    ).rejects.toMatchObject({ statusCode: 404 });

    db.inventoryVendor.findFirst.mockResolvedValue({ id: "vendor-1" });
    db.inventoryItem.findMany.mockResolvedValue([]);
    await expect(
      PurchaseOrderService.createOrder({
        organisationId: "org-1",
        vendorId: "vendor-1",
        lines: [{ itemId: "foreign-item", quantityOrdered: 1, unitCost: 1 }],
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("rejects duplicate order numbers and invalid quantities", async () => {
    db.purchaseOrder.findUnique.mockResolvedValue(order());
    await expect(
      PurchaseOrderService.createOrder({
        organisationId: "org-1",
        vendorId: "vendor-1",
        orderNumber: "PO-1",
        lines: [{ itemId: "item-1", quantityOrdered: 1, unitCost: 1 }],
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    db.purchaseOrder.findUnique.mockResolvedValue(null);
    await expect(
      PurchaseOrderService.createOrder({
        organisationId: "org-1",
        vendorId: "vendor-1",
        orderNumber: "PO-2",
        lines: [{ itemId: "item-1", quantityOrdered: 0, unitCost: 1 }],
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    db.purchaseOrder.findUnique.mockResolvedValue(null);
    await expect(
      PurchaseOrderService.createOrder({
        organisationId: "org-1",
        vendorId: "vendor-1",
        orderNumber: "PO-3",
        lines: [{ itemId: "item-1", quantityOrdered: 1, unitCost: -1 }],
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("generates an order number from the tenant's current count", async () => {
    db.purchaseOrder.count.mockResolvedValue(8);
    db.purchaseOrder.findUnique.mockResolvedValue(null);
    await PurchaseOrderService.createOrder({
      organisationId: "org-1",
      vendorId: "vendor-1",
      lines: [{ itemId: "item-1", quantityOrdered: 2, unitCost: 3 }],
    });
    expect(db.purchaseOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderNumber: expect.stringMatching(/^PO-\d{6}-0009$/),
        }),
      }),
    );
  });
});

describe("PurchaseOrderService.receiveDelivery", () => {
  const receiveInput = {
    organisationId: "org-1",
    purchaseOrderId: "po-1",
    receivedBy: "user-1",
    lines: [{ purchaseOrderLineId: "line-1", quantityReceived: 2 }],
  };

  it("receives against scoped order lines and creates an inventory batch", async () => {
    const result = await PurchaseOrderService.receiveDelivery(receiveInput);

    expect(db.purchaseOrder.findFirst).toHaveBeenCalledWith({
      where: { id: "po-1", organisationId: "org-1" },
    });
    expect(db.purchaseOrderLine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["line-1"] }, purchaseOrderId: "po-1" },
      }),
    );
    expect(db.purchaseOrderLine.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "line-1", quantityReceived: { lte: 3 } },
      }),
    );
    expect(db.purchaseOrderDelivery.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ vendorId: "vendor-1" }),
      }),
    );
    expect(db.inventoryBatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          itemId: "item-1",
          organisationId: "org-1",
        }),
      }),
    );
    expect(db.inventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "item-1", organisationId: "org-1" },
      }),
    );
    expect(result).toMatchObject({ id: "delivery-1" });
  });

  it("uses only a batch belonging to the received item and organisation", async () => {
    db.inventoryBatch.findMany.mockResolvedValue([
      { id: "batch-1", itemId: "foreign-item" },
    ]);
    await expect(
      PurchaseOrderService.receiveDelivery({
        ...receiveInput,
        lines: [{ ...receiveInput.lines[0], batchId: "batch-1" }],
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(db.purchaseOrderDelivery.create).not.toHaveBeenCalled();

    db.inventoryBatch.findMany.mockResolvedValue([
      { id: "batch-1", itemId: "item-1" },
    ]);
    db.inventoryBatch.update.mockRejectedValue(
      new Error("database unavailable"),
    );
    await expect(
      PurchaseOrderService.receiveDelivery({
        ...receiveInput,
        lines: [{ ...receiveInput.lines[0], batchId: "batch-1" }],
      }),
    ).rejects.toThrow("database unavailable");
  });

  it("updates an existing batch and rejects a failed scoped update", async () => {
    db.inventoryBatch.findMany.mockResolvedValue([
      { id: "batch-1", itemId: "item-1" },
    ]);
    db.purchaseOrderLine.findMany.mockImplementation(
      async (args: { select?: unknown }) =>
        args.select
          ? [orderLine({ quantityReceived: 2 })]
          : [orderLine({ quantityReceived: 0 })],
    );
    await PurchaseOrderService.receiveDelivery({
      ...receiveInput,
      lines: [{ ...receiveInput.lines[0], batchId: "batch-1" }],
    });
    expect(db.inventoryBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "batch-1", itemId: "item-1", organisationId: "org-1" },
      }),
    );
    expect(db.purchaseOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "PARTIALLY_RECEIVED" } }),
    );

    db.inventoryBatch.update.mockRejectedValue(prismaNotFound());
    await expect(
      PurchaseOrderService.receiveDelivery({
        ...receiveInput,
        lines: [{ ...receiveInput.lines[0], batchId: "batch-1" }],
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("marks an order received after its final quantity is received", async () => {
    db.purchaseOrderLine.findMany.mockImplementation(
      async (args: { select?: unknown }) =>
        args.select
          ? [orderLine({ quantityReceived: 5 })]
          : [orderLine({ quantityReceived: 0 })],
    );
    await PurchaseOrderService.receiveDelivery({
      ...receiveInput,
      lines: [{ purchaseOrderLineId: "line-1", quantityReceived: 5 }],
    });
    expect(db.purchaseOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "RECEIVED" } }),
    );
  });

  it.each([
    ["missing order", null, 404],
    ["cancelled order", order({ status: "CANCELLED" }), 400],
    ["fully received order", order({ status: "RECEIVED" }), 400],
  ])("rejects receiving for a %s", async (_label, found, statusCode) => {
    db.purchaseOrder.findFirst.mockResolvedValue(found);
    await expect(
      PurchaseOrderService.receiveDelivery(receiveInput),
    ).rejects.toMatchObject({
      statusCode,
    });
  });

  it("rejects missing lines and quantities above the remaining amount", async () => {
    db.purchaseOrderLine.findMany.mockResolvedValue([]);
    await expect(
      PurchaseOrderService.receiveDelivery(receiveInput),
    ).rejects.toMatchObject({
      statusCode: 404,
    });

    db.purchaseOrderLine.findMany.mockResolvedValue([
      orderLine({ quantityReceived: 4 }),
    ]);
    await expect(
      PurchaseOrderService.receiveDelivery(receiveInput),
    ).rejects.toMatchObject({
      statusCode: 400,
    });

    db.purchaseOrderLine.findMany.mockResolvedValue([orderLine()]);
    await expect(
      PurchaseOrderService.receiveDelivery({
        ...receiveInput,
        lines: [{ purchaseOrderLineId: "line-1", quantityReceived: 0 }],
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    db.inventoryItem.update.mockRejectedValue(prismaNotFound());
    await expect(
      PurchaseOrderService.receiveDelivery(receiveInput),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("PurchaseOrderService.returnDelivery", () => {
  const returnInput = {
    organisationId: "org-1",
    deliveryId: "delivery-1",
    lines: [{ deliveryLineId: "delivery-line-1", quantityReturned: 1 }],
  };

  it("returns delivered stock from its recorded batch", async () => {
    const result = await PurchaseOrderService.returnDelivery(returnInput);

    expect(db.purchaseOrderDelivery.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "delivery-1", purchaseOrder: { organisationId: "org-1" } },
      }),
    );
    expect(db.inventoryBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "batch-1",
          itemId: "item-1",
          organisationId: "org-1",
        }),
        data: { quantity: { decrement: 1 } },
      }),
    );
    expect(db.purchaseOrderDeliveryLine.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "delivery-line-1", quantityReturned: { lte: 1 } },
      }),
    );
    expect(db.purchaseOrderLine.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "line-1", quantityReceived: { gte: 1 } },
      }),
    );
    expect(db.inventoryStockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          change: -1,
          reason: "PURCHASE_RETURN",
        }),
      }),
    );
    expect(result).toMatchObject({ id: "delivery-1" });
  });

  it("rejects cross-tenant deliveries, unavailable stock, and excessive returns", async () => {
    db.purchaseOrderDelivery.findFirst.mockResolvedValue(null);
    await expect(
      PurchaseOrderService.returnDelivery(returnInput),
    ).rejects.toMatchObject({
      statusCode: 404,
    });

    db.purchaseOrderDelivery.findFirst.mockResolvedValue({
      id: "delivery-1",
      purchaseOrderId: "po-1",
      purchaseOrder: order(),
    });
    db.purchaseOrderDeliveryLine.findMany.mockResolvedValue([]);
    await expect(
      PurchaseOrderService.returnDelivery(returnInput),
    ).rejects.toMatchObject({
      statusCode: 404,
    });

    db.purchaseOrderDeliveryLine.findMany.mockResolvedValue([
      {
        id: "delivery-line-1",
        deliveryId: "delivery-1",
        purchaseOrderLineId: "line-1",
        itemId: "item-1",
        quantityReceived: 2,
        quantityReturned: 0,
        batchId: "batch-1",
        purchaseOrderLine: orderLine({ quantityReceived: 2 }),
      },
    ]);
    db.inventoryBatch.findFirst.mockResolvedValue({
      quantity: 0,
      allocated: 0,
    });
    await expect(
      PurchaseOrderService.returnDelivery(returnInput),
    ).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("rejects a line return above the delivered quantity", async () => {
    db.purchaseOrderDeliveryLine.findMany.mockResolvedValue([
      {
        id: "delivery-line-1",
        deliveryId: "delivery-1",
        purchaseOrderLineId: "line-1",
        itemId: "item-1",
        quantityReceived: 1,
        quantityReturned: 0,
        batchId: "batch-1",
        purchaseOrderLine: orderLine({ quantityReceived: 1 }),
      },
    ]);
    await expect(
      PurchaseOrderService.returnDelivery({
        ...returnInput,
        lines: [{ deliveryLineId: "delivery-line-1", quantityReturned: 2 }],
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects returns beyond the order quantity and consumes an available batch", async () => {
    db.purchaseOrderDeliveryLine.findMany.mockResolvedValue([
      {
        id: "delivery-line-1",
        deliveryId: "delivery-1",
        purchaseOrderLineId: "line-1",
        itemId: "item-1",
        quantityReceived: 2,
        quantityReturned: 0,
        batchId: null,
        purchaseOrderLine: orderLine({ quantityReceived: 0 }),
      },
    ]);
    await expect(
      PurchaseOrderService.returnDelivery(returnInput),
    ).rejects.toMatchObject({ statusCode: 400 });

    db.purchaseOrderDeliveryLine.findMany.mockResolvedValue([
      {
        id: "delivery-line-1",
        deliveryId: "delivery-1",
        purchaseOrderLineId: "line-1",
        itemId: "item-1",
        quantityReceived: 2,
        quantityReturned: 0,
        batchId: null,
        purchaseOrderLine: orderLine({ quantityReceived: 2 }),
      },
    ]);
    db.inventoryBatch.findMany.mockResolvedValue([
      {
        id: "batch-2",
        quantity: 4,
        allocated: 0,
      },
    ]);
    await PurchaseOrderService.returnDelivery(returnInput);
    expect(db.inventoryStockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ batchId: "batch-2" }),
      }),
    );
  });

  it("rejects missing or changed batch stock while returning unbatched stock", async () => {
    db.purchaseOrderDeliveryLine.findMany.mockResolvedValue([
      {
        id: "delivery-line-1",
        deliveryId: "delivery-1",
        purchaseOrderLineId: "line-1",
        itemId: "item-1",
        quantityReceived: 2,
        quantityReturned: 0,
        batchId: null,
        purchaseOrderLine: orderLine({ quantityReceived: 2 }),
      },
    ]);
    db.inventoryBatch.findMany.mockResolvedValue([]);
    await expect(
      PurchaseOrderService.returnDelivery(returnInput),
    ).rejects.toMatchObject({
      statusCode: 400,
    });

    db.inventoryBatch.findMany.mockResolvedValue([
      {
        id: "batch-2",
        quantity: 4,
        allocated: 0,
      },
    ]);
    db.inventoryBatch.update.mockRejectedValue(prismaNotFound());
    await expect(
      PurchaseOrderService.returnDelivery(returnInput),
    ).rejects.toMatchObject({
      statusCode: 400,
    });

    db.inventoryBatch.update.mockResolvedValue({ id: "batch-2" });
    db.inventoryItem.update.mockRejectedValue(prismaNotFound());
    await expect(
      PurchaseOrderService.returnDelivery(returnInput),
    ).rejects.toMatchObject({ statusCode: 400 });

    db.inventoryBatch.update.mockResolvedValue({ id: "batch-2" });
    db.inventoryItem.findFirst.mockResolvedValue({ onHand: 1, allocated: 1 });
    await expect(
      PurchaseOrderService.returnDelivery(returnInput),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects concurrent receipt and return quantity changes", async () => {
    db.purchaseOrderLine.update.mockRejectedValueOnce(prismaNotFound());
    await expect(
      PurchaseOrderService.receiveDelivery({
        organisationId: "org-1",
        purchaseOrderId: "po-1",
        lines: [{ purchaseOrderLineId: "line-1", quantityReceived: 2 }],
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    db.purchaseOrderDeliveryLine.update.mockRejectedValueOnce(prismaNotFound());
    await expect(
      PurchaseOrderService.returnDelivery({
        organisationId: "org-1",
        deliveryId: "delivery-1",
        lines: [{ deliveryLineId: "delivery-line-1", quantityReturned: 1 }],
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("PurchaseOrderService.listPurchaseOrders", () => {
  it("returns tenant-scoped pages and rejects zero or oversized limits", async () => {
    await expect(
      PurchaseOrderService.listPurchaseOrders({
        organisationId: "org-1",
        pageSize: 0,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      PurchaseOrderService.listPurchaseOrders({
        organisationId: "org-1",
        pageSize: 101,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      PurchaseOrderService.listPurchaseOrders({
        organisationId: "org-1",
        page: 0,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    db.purchaseOrder.findMany.mockResolvedValue([order()]);
    db.purchaseOrder.count.mockResolvedValue(1);
    await expect(
      PurchaseOrderService.listPurchaseOrders({ organisationId: "org-1" }),
    ).resolves.toMatchObject({
      page: 1,
      pageSize: 25,
      totalPages: 1,
      items: [order()],
    });
  });
});

describe("PurchaseOrderService status and reads", () => {
  it("confirms a draft order and rejects missing or non-draft orders", async () => {
    db.purchaseOrder.findFirst.mockResolvedValue(order({ status: "DRAFT" }));
    await PurchaseOrderService.confirmOrder("po-1", "org-1");
    expect(db.purchaseOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "po-1" },
        data: { status: "CONFIRMED" },
      }),
    );

    db.purchaseOrder.findFirst.mockResolvedValue(null);
    await expect(
      PurchaseOrderService.confirmOrder("po-1", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
    db.purchaseOrder.findFirst.mockResolvedValue(order());
    await expect(
      PurchaseOrderService.confirmOrder("po-1", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("reads by organisation, cancels unfinished orders, and lists outstanding lines", async () => {
    await PurchaseOrderService.getPurchaseOrder("po-1", "org-1");
    expect(db.purchaseOrder.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "po-1", organisationId: "org-1" },
      }),
    );
    await PurchaseOrderService.cancelOrder("po-1", "org-1");
    await PurchaseOrderService.getOutstandingDeliveries("org-1");
    expect(db.purchaseOrderLine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          purchaseOrder: {
            organisationId: "org-1",
            status: { in: ["CONFIRMED", "PARTIALLY_RECEIVED"] },
          },
        }),
      }),
    );

    db.purchaseOrder.findFirst.mockResolvedValue(order({ status: "RECEIVED" }));
    await expect(
      PurchaseOrderService.cancelOrder("po-1", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 400,
    });
    db.purchaseOrder.findFirst.mockResolvedValue(null);
    await expect(
      PurchaseOrderService.cancelOrder("po-1", "org-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("exposes the expected service error shape", () => {
    expect(new PurchaseOrderServiceError("invalid", 422)).toMatchObject({
      name: "PurchaseOrderServiceError",
      statusCode: 422,
    });
  });
});
