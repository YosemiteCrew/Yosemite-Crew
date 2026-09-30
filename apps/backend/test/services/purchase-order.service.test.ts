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
      updateMany: jest.fn(),
    },
    purchaseOrderLine: {
      fields: { quantityOrdered: "quantityOrdered" },
      findMany: jest.fn(),
      update: jest.fn(),
    },
    purchaseOrderDelivery: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    purchaseOrderDeliveryLine: { create: jest.fn(), update: jest.fn() },
    purchaseOrderReturn: { create: jest.fn() },
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

const db = prisma as unknown as Record<string, Record<string, jest.Mock>> & {
  $transaction: jest.Mock;
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

const deliveryLine = (overrides: Record<string, unknown> = {}) => ({
  id: "delivery-line-1",
  deliveryId: "delivery-1",
  purchaseOrderLineId: "line-1",
  itemId: "item-1",
  quantityReceived: 3,
  quantityReturned: 0,
  batchId: "batch-1",
  ...overrides,
});

const delivery = (overrides: Record<string, unknown> = {}) => ({
  id: "delivery-1",
  purchaseOrderId: "po-1",
  idempotencyKey: "receipt-1",
  lines: [deliveryLine()],
  returns: [] as Array<{ idempotencyKey: string }>,
  ...overrides,
});

const knownError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError(code, {
    code,
    clientVersion: "6.19.3",
  });

beforeEach(() => {
  jest.clearAllMocks();
  db.$transaction.mockImplementation(
    async (callback: (tx: unknown) => unknown) => callback(prisma),
  );
  db.inventoryVendor.findFirst.mockResolvedValue({ id: "vendor-1" });
  db.inventoryItem.findMany.mockResolvedValue([{ id: "item-1" }]);
  db.inventoryItem.findFirst.mockResolvedValue({ onHand: 10, allocated: 2 });
  db.inventoryItem.update.mockResolvedValue({});
  db.purchaseOrder.findFirst.mockResolvedValue(order());
  db.purchaseOrder.findMany.mockResolvedValue([]);
  db.purchaseOrder.count.mockResolvedValue(0);
  db.purchaseOrder.create.mockResolvedValue(order({ status: "DRAFT" }));
  db.purchaseOrder.updateMany.mockResolvedValue({ count: 1 });
  db.purchaseOrderLine.findMany.mockResolvedValue([orderLine()]);
  db.purchaseOrderLine.update.mockResolvedValue({});
  db.purchaseOrderDelivery.create.mockResolvedValue({ id: "delivery-1" });
  db.purchaseOrderDelivery.findFirst.mockResolvedValue(null);
  db.purchaseOrderDelivery.findUniqueOrThrow.mockResolvedValue(delivery());
  db.purchaseOrderDeliveryLine.create.mockResolvedValue({});
  db.purchaseOrderDeliveryLine.update.mockResolvedValue({});
  db.purchaseOrderReturn.create.mockResolvedValue({ id: "return-1" });
  db.inventoryBatch.findMany.mockResolvedValue([]);
  db.inventoryBatch.findFirst.mockResolvedValue({ quantity: 5, allocated: 1 });
  db.inventoryBatch.create.mockResolvedValue({ id: "batch-new" });
  db.inventoryBatch.update.mockResolvedValue({});
  db.inventoryStockMovement.create.mockResolvedValue({});
});

describe("PurchaseOrderService.createOrder", () => {
  const input = {
    organisationId: "org-1",
    vendorId: "vendor-1",
    currency: "EUR",
    lines: [
      { itemId: "item-1", quantityOrdered: 3, unitCost: 0.1 },
      { itemId: "item-1", quantityOrdered: 1, unitCost: 0.2 },
    ],
  };

  it("creates the order and its lines at rounded totals in one write", async () => {
    await PurchaseOrderService.createOrder({ ...input, orderNumber: "PO-1" });

    expect(db.inventoryVendor.findFirst).toHaveBeenCalledWith({
      where: { id: "vendor-1", organisationId: "org-1" },
      select: { id: true },
    });
    expect(db.inventoryItem.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["item-1"] }, organisationId: "org-1" },
      select: { id: true },
    });
    const { data } = db.purchaseOrder.create.mock.calls[0][0];
    expect(data).toMatchObject({
      organisationId: "org-1",
      orderNumber: "PO-1",
      currency: "EUR",
      status: "DRAFT",
      totalAmount: 0.5,
    });
    expect(
      data.lines.create.map((l: { totalCost: number }) => l.totalCost),
    ).toEqual([0.3, 0.2]);
  });

  it("refuses a vendor or item the organisation does not own", async () => {
    db.inventoryVendor.findFirst.mockResolvedValueOnce(null);
    await expect(PurchaseOrderService.createOrder(input)).rejects.toMatchObject(
      {
        statusCode: 404,
        message: "Vendor not found",
      },
    );

    db.inventoryItem.findMany.mockResolvedValueOnce([]);
    await expect(PurchaseOrderService.createOrder(input)).rejects.toMatchObject(
      {
        statusCode: 404,
        message: "Inventory item not found",
      },
    );
    expect(db.purchaseOrder.create).not.toHaveBeenCalled();
  });

  it("answers 409 for an order number the organisation already used", async () => {
    db.purchaseOrder.create.mockRejectedValueOnce(knownError("P2002"));
    await expect(
      PurchaseOrderService.createOrder({ ...input, orderNumber: "PO-1" }),
    ).rejects.toMatchObject({ statusCode: 409 });

    db.purchaseOrder.create.mockRejectedValueOnce(new Error("db down"));
    await expect(PurchaseOrderService.createOrder(input)).rejects.toThrow(
      "db down",
    );
  });

  it("numbers an order from the organisation's count for the month", async () => {
    db.purchaseOrder.count.mockResolvedValue(8);
    await PurchaseOrderService.createOrder(input);

    expect(db.purchaseOrder.count).toHaveBeenCalledWith({
      where: {
        organisationId: "org-1",
        orderNumber: { startsWith: expect.stringMatching(/^PO-\d{6}$/) },
      },
    });
    expect(db.purchaseOrder.create.mock.calls[0][0].data.orderNumber).toMatch(
      /^PO-\d{6}-0009$/,
    );
  });
});

describe("PurchaseOrderService.receiveDelivery", () => {
  const input = {
    organisationId: "org-1",
    purchaseOrderId: "po-1",
    idempotencyKey: "receipt-1",
    receivedBy: "user-1",
    lines: [{ purchaseOrderLineId: "line-1", quantityReceived: 2 }],
  };

  it("posts the receipt to a new batch, the item and the order in one transaction", async () => {
    db.purchaseOrderLine.findMany
      .mockResolvedValueOnce([orderLine()])
      .mockResolvedValueOnce([orderLine({ quantityReceived: 2 })]);

    const result = await PurchaseOrderService.receiveDelivery(input);

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.purchaseOrderDelivery.findFirst).toHaveBeenCalledWith({
      where: {
        purchaseOrderId: "po-1",
        idempotencyKey: "receipt-1",
        purchaseOrder: { organisationId: "org-1" },
      },
      include: { lines: true, returns: true },
    });
    expect(db.purchaseOrder.findFirst).toHaveBeenCalledWith({
      where: { id: "po-1", organisationId: "org-1" },
    });
    expect(db.purchaseOrderDelivery.create.mock.calls[0][0].data).toMatchObject(
      {
        purchaseOrderId: "po-1",
        vendorId: "vendor-1",
        idempotencyKey: "receipt-1",
      },
    );
    expect(db.purchaseOrderLine.update).toHaveBeenCalledWith({
      where: { id: "line-1", quantityReceived: { lte: 3 } },
      data: { quantityReceived: { increment: 2 } },
    });
    expect(db.inventoryBatch.create.mock.calls[0][0].data).toMatchObject({
      itemId: "item-1",
      organisationId: "org-1",
      batchNumber: "lot-1",
      quantity: 2,
    });
    expect(db.purchaseOrderDeliveryLine.create).toHaveBeenCalledWith({
      data: {
        deliveryId: "delivery-1",
        purchaseOrderLineId: "line-1",
        itemId: "item-1",
        quantityReceived: 2,
        batchId: "batch-new",
      },
    });
    expect(db.inventoryStockMovement.create).toHaveBeenCalledWith({
      data: {
        itemId: "item-1",
        batchId: "batch-new",
        change: 2,
        reason: "PURCHASE",
        referenceId: "delivery-1",
        userId: "user-1",
      },
    });
    expect(db.inventoryItem.update).toHaveBeenCalledWith({
      where: { id: "item-1", organisationId: "org-1" },
      data: { onHand: { increment: 2 } },
    });
    expect(db.purchaseOrder.updateMany).toHaveBeenCalledWith({
      where: {
        id: "po-1",
        status: { in: ["CONFIRMED", "PARTIALLY_RECEIVED", "RECEIVED"] },
      },
      data: { status: "PARTIALLY_RECEIVED" },
    });
    expect(result).toEqual(delivery());
  });

  it("names a fallback batch after the delivery when the line has no batch number", async () => {
    db.purchaseOrderLine.findMany.mockResolvedValue([
      orderLine({ batchNumber: null }),
    ]);
    db.purchaseOrderDelivery.create.mockResolvedValue({
      id: "abcdef12-3456",
    });

    await PurchaseOrderService.receiveDelivery(input);

    expect(db.inventoryBatch.create.mock.calls[0][0].data.batchNumber).toBe(
      "PO-abcdef12",
    );
  });

  it("posts every line of a multi-line delivery", async () => {
    db.purchaseOrderLine.findMany.mockResolvedValue([
      orderLine(),
      orderLine({ id: "line-2", itemId: "item-2", batchNumber: "lot-2" }),
    ]);

    await PurchaseOrderService.receiveDelivery({
      ...input,
      lines: [
        { purchaseOrderLineId: "line-1", quantityReceived: 2 },
        { purchaseOrderLineId: "line-2", quantityReceived: 4 },
      ],
    });

    expect(
      db.inventoryItem.update.mock.calls.map(([arg]) => [
        arg.where.id,
        arg.data.onHand.increment,
      ]),
    ).toEqual([
      ["item-1", 2],
      ["item-2", 4],
    ]);
    expect(db.purchaseOrderDeliveryLine.create).toHaveBeenCalledTimes(2);
    expect(db.purchaseOrderDelivery.create).toHaveBeenCalledTimes(1);
  });

  it("returns the recorded delivery for a repeated key without moving stock again", async () => {
    db.purchaseOrderDelivery.findFirst.mockResolvedValue(delivery());
    db.purchaseOrder.findFirst.mockResolvedValue(order({ status: "RECEIVED" }));

    const result = await PurchaseOrderService.receiveDelivery(input);

    expect(result).toEqual(delivery());
    expect(db.purchaseOrderDelivery.create).not.toHaveBeenCalled();
    expect(db.purchaseOrderLine.update).not.toHaveBeenCalled();
    expect(db.inventoryItem.update).not.toHaveBeenCalled();
    expect(db.inventoryStockMovement.create).not.toHaveBeenCalled();
  });

  it("answers a racing duplicate with the delivery the first request recorded", async () => {
    db.$transaction.mockRejectedValueOnce(knownError("P2002"));
    db.purchaseOrderDelivery.findFirst.mockResolvedValueOnce(delivery());
    await expect(PurchaseOrderService.receiveDelivery(input)).resolves.toEqual(
      delivery(),
    );

    db.$transaction.mockRejectedValueOnce(knownError("P2002"));
    db.purchaseOrderDelivery.findFirst.mockResolvedValueOnce(null);
    await expect(PurchaseOrderService.receiveDelivery(input)).rejects.toThrow(
      "P2002",
    );

    db.$transaction.mockRejectedValueOnce(new Error("db down"));
    await expect(PurchaseOrderService.receiveDelivery(input)).rejects.toThrow(
      "db down",
    );
  });

  it.each([
    [null, 404, "Purchase order not found"],
    ["DRAFT", 400, "Confirm the order before receiving a delivery"],
    ["CANCELLED", 400, "Cannot receive a delivery for a cancelled order"],
    ["RECEIVED", 400, "Order already fully received"],
  ])("refuses an order in state %s", async (status, statusCode, message) => {
    db.purchaseOrder.findFirst.mockResolvedValue(
      status ? order({ status }) : null,
    );
    await expect(PurchaseOrderService.receiveDelivery(input)).rejects.toEqual(
      new PurchaseOrderServiceError(message, statusCode),
    );
    expect(db.purchaseOrderDelivery.create).not.toHaveBeenCalled();
  });

  it("refuses lines that are missing, over the remaining quantity, fractional or on a foreign batch", async () => {
    db.purchaseOrderLine.findMany.mockResolvedValueOnce([]);
    await expect(
      PurchaseOrderService.receiveDelivery(input),
    ).rejects.toMatchObject({ statusCode: 404 });

    db.purchaseOrderLine.findMany.mockResolvedValueOnce([
      orderLine({ quantityReceived: 4 }),
    ]);
    await expect(
      PurchaseOrderService.receiveDelivery(input),
    ).rejects.toMatchObject({
      statusCode: 400,
      message:
        "Cannot receive 2 units. Only 1 remaining to receive for this line.",
    });

    await expect(
      PurchaseOrderService.receiveDelivery({
        ...input,
        lines: [{ purchaseOrderLineId: "line-1", quantityReceived: 1.5 }],
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    db.inventoryBatch.findMany.mockResolvedValueOnce([
      { id: "batch-1", itemId: "other-item" },
    ]);
    await expect(
      PurchaseOrderService.receiveDelivery({
        ...input,
        lines: [{ ...input.lines[0], batchId: "batch-1" }],
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(db.inventoryBatch.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["batch-1"] }, organisationId: "org-1" },
      select: { id: true, itemId: true },
    });
    expect(db.purchaseOrderDelivery.create).not.toHaveBeenCalled();
  });

  it("adds to an existing batch of the same item and organisation", async () => {
    db.inventoryBatch.findMany.mockResolvedValue([
      { id: "batch-1", itemId: "item-1" },
    ]);
    const withBatch = {
      ...input,
      lines: [{ ...input.lines[0], batchId: "batch-1" }],
    };

    await PurchaseOrderService.receiveDelivery(withBatch);

    expect(db.inventoryBatch.update).toHaveBeenCalledWith({
      where: { id: "batch-1", itemId: "item-1", organisationId: "org-1" },
      data: { quantity: { increment: 2 } },
    });
    expect(db.inventoryBatch.create).not.toHaveBeenCalled();
    expect(
      db.purchaseOrderDeliveryLine.create.mock.calls[0][0].data.batchId,
    ).toBe("batch-1");

    db.inventoryBatch.update.mockRejectedValueOnce(knownError("P2025"));
    await expect(
      PurchaseOrderService.receiveDelivery(withBatch),
    ).rejects.toMatchObject({ statusCode: 404 });

    db.inventoryBatch.update.mockRejectedValueOnce(new Error("db down"));
    await expect(
      PurchaseOrderService.receiveDelivery(withBatch),
    ).rejects.toThrow("db down");
  });

  it("refuses a receipt that a concurrent one has already filled, and a vanished item", async () => {
    db.purchaseOrderLine.update.mockRejectedValueOnce(knownError("P2025"));
    await expect(
      PurchaseOrderService.receiveDelivery(input),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(db.inventoryBatch.create).not.toHaveBeenCalled();

    db.inventoryItem.update.mockRejectedValueOnce(knownError("P2025"));
    await expect(
      PurchaseOrderService.receiveDelivery(input),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("marks the order received only when every line is complete", async () => {
    db.purchaseOrderLine.findMany
      .mockResolvedValueOnce([orderLine({ quantityReceived: 3 })])
      .mockResolvedValueOnce([
        orderLine({ quantityReceived: 5 }),
        orderLine({ id: "line-2", quantityOrdered: 1, quantityReceived: 1 }),
      ]);
    await PurchaseOrderService.receiveDelivery(input);
    expect(db.purchaseOrder.updateMany.mock.calls[0][0].data).toEqual({
      status: "RECEIVED",
    });

    db.purchaseOrderLine.findMany
      .mockResolvedValueOnce([orderLine({ quantityReceived: 3 })])
      .mockResolvedValueOnce([
        orderLine({ quantityOrdered: 1, quantityReceived: 5 }),
        orderLine({ id: "line-2", quantityOrdered: 5, quantityReceived: 1 }),
      ]);
    await PurchaseOrderService.receiveDelivery(input);
    expect(db.purchaseOrder.updateMany.mock.calls[1][0].data).toEqual({
      status: "PARTIALLY_RECEIVED",
    });
  });
});

describe("PurchaseOrderService.returnDelivery", () => {
  const input = {
    organisationId: "org-1",
    deliveryId: "delivery-1",
    idempotencyKey: "return-1",
    returnedBy: "user-2",
    notes: "damaged",
    lines: [{ deliveryLineId: "delivery-line-1", quantityReturned: 2 }],
  };

  beforeEach(() => {
    db.purchaseOrderDelivery.findFirst.mockResolvedValue(delivery());
    db.purchaseOrderLine.findMany.mockResolvedValue([
      orderLine({ quantityReceived: 1 }),
    ]);
  });

  it("takes the stock out of the batch it was received into and records the return", async () => {
    const result = await PurchaseOrderService.returnDelivery(input);

    expect(db.purchaseOrderDelivery.findFirst).toHaveBeenCalledWith({
      where: { id: "delivery-1", purchaseOrder: { organisationId: "org-1" } },
      include: { lines: true, returns: true },
    });
    expect(db.purchaseOrderReturn.create).toHaveBeenCalledWith({
      data: {
        deliveryId: "delivery-1",
        idempotencyKey: "return-1",
        returnedBy: "user-2",
        notes: "damaged",
      },
    });
    expect(db.purchaseOrderDeliveryLine.update).toHaveBeenCalledWith({
      where: { id: "delivery-line-1", quantityReturned: { lte: 1 } },
      data: { quantityReturned: { increment: 2 } },
    });
    expect(db.purchaseOrderLine.update).toHaveBeenCalledWith({
      where: { id: "line-1", quantityReceived: { gte: 2 } },
      data: {
        quantityReceived: { decrement: 2 },
        quantityReturned: { increment: 2 },
      },
    });
    expect(db.inventoryBatch.findFirst).toHaveBeenCalledWith({
      where: { id: "batch-1", itemId: "item-1", organisationId: "org-1" },
      select: { quantity: true, allocated: true },
    });
    expect(db.inventoryBatch.update).toHaveBeenCalledWith({
      where: {
        id: "batch-1",
        itemId: "item-1",
        organisationId: "org-1",
        quantity: { gte: 3 },
        allocated: { lte: 1 },
      },
      data: { quantity: { decrement: 2 } },
    });
    expect(db.inventoryItem.update).toHaveBeenCalledWith({
      where: {
        id: "item-1",
        organisationId: "org-1",
        onHand: { gte: 4 },
        allocated: { lte: 2 },
      },
      data: { onHand: { decrement: 2 } },
    });
    expect(db.inventoryStockMovement.create).toHaveBeenCalledWith({
      data: {
        itemId: "item-1",
        batchId: "batch-1",
        change: -2,
        reason: "PURCHASE_RETURN",
        referenceId: "return-1",
        userId: "user-2",
      },
    });
    expect(db.purchaseOrder.updateMany.mock.calls[0][0]).toEqual({
      where: {
        id: "po-1",
        status: { in: ["CONFIRMED", "PARTIALLY_RECEIVED", "RECEIVED"] },
      },
      data: { status: "PARTIALLY_RECEIVED" },
    });
    expect(result).toEqual(delivery());
  });

  it("reopens an order to confirmed once everything received has gone back", async () => {
    db.purchaseOrderLine.findMany.mockResolvedValue([orderLine()]);
    await PurchaseOrderService.returnDelivery(input);
    expect(db.purchaseOrder.updateMany.mock.calls[0][0].data).toEqual({
      status: "CONFIRMED",
    });

    db.purchaseOrderLine.findMany.mockResolvedValue([]);
    await PurchaseOrderService.returnDelivery(input);
    expect(db.purchaseOrder.updateMany).toHaveBeenCalledTimes(1);
  });

  it("returns the delivery for a repeated key without moving stock again", async () => {
    const done = delivery({ returns: [{ idempotencyKey: "return-1" }] });
    db.purchaseOrderDelivery.findFirst.mockResolvedValue(done);

    await expect(PurchaseOrderService.returnDelivery(input)).resolves.toEqual(
      done,
    );
    expect(db.purchaseOrderReturn.create).not.toHaveBeenCalled();
    expect(db.inventoryBatch.update).not.toHaveBeenCalled();
    expect(db.inventoryItem.update).not.toHaveBeenCalled();
  });

  it("answers a racing duplicate with the return the first request recorded", async () => {
    const done = delivery({ returns: [{ idempotencyKey: "return-1" }] });
    db.$transaction.mockRejectedValueOnce(knownError("P2002"));
    db.purchaseOrderDelivery.findFirst.mockResolvedValueOnce(done);
    await expect(PurchaseOrderService.returnDelivery(input)).resolves.toEqual(
      done,
    );

    db.$transaction.mockRejectedValueOnce(knownError("P2002"));
    db.purchaseOrderDelivery.findFirst.mockResolvedValueOnce(delivery());
    await expect(PurchaseOrderService.returnDelivery(input)).rejects.toThrow(
      "P2002",
    );

    db.$transaction.mockRejectedValueOnce(knownError("P2002"));
    db.purchaseOrderDelivery.findFirst.mockResolvedValueOnce(null);
    await expect(PurchaseOrderService.returnDelivery(input)).rejects.toThrow(
      "P2002",
    );
  });

  it("refuses another organisation's delivery, an unknown line and more than is left", async () => {
    db.purchaseOrderDelivery.findFirst.mockResolvedValueOnce(null);
    await expect(
      PurchaseOrderService.returnDelivery(input),
    ).rejects.toMatchObject({ statusCode: 404, message: "Delivery not found" });

    await expect(
      PurchaseOrderService.returnDelivery({
        ...input,
        lines: [{ deliveryLineId: "other-line", quantityReturned: 1 }],
      }),
    ).rejects.toMatchObject({ statusCode: 404 });

    db.purchaseOrderDelivery.findFirst.mockResolvedValueOnce(
      delivery({ lines: [deliveryLine({ quantityReturned: 2 })] }),
    );
    await expect(
      PurchaseOrderService.returnDelivery(input),
    ).rejects.toMatchObject({
      statusCode: 400,
      message:
        "Cannot return 2 units. Only 1 from this delivery line are left to return.",
    });
    expect(db.purchaseOrderReturn.create).toHaveBeenCalledTimes(1);
    expect(db.inventoryBatch.update).not.toHaveBeenCalled();
  });

  it("refuses when a concurrent return changed the delivery or order line", async () => {
    db.purchaseOrderDeliveryLine.update.mockRejectedValueOnce(
      knownError("P2025"),
    );
    await expect(
      PurchaseOrderService.returnDelivery(input),
    ).rejects.toMatchObject({ statusCode: 409 });

    db.purchaseOrderLine.update.mockRejectedValueOnce(knownError("P2025"));
    await expect(
      PurchaseOrderService.returnDelivery(input),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(db.inventoryBatch.update).not.toHaveBeenCalled();
  });

  it("refuses to return stock the batch no longer holds unallocated", async () => {
    db.inventoryBatch.findFirst.mockResolvedValueOnce({
      quantity: 5,
      allocated: 4,
    });
    await expect(
      PurchaseOrderService.returnDelivery(input),
    ).rejects.toMatchObject({ statusCode: 409 });

    db.inventoryBatch.findFirst.mockResolvedValueOnce(null);
    await expect(
      PurchaseOrderService.returnDelivery(input),
    ).rejects.toMatchObject({ statusCode: 409 });

    db.inventoryBatch.update.mockRejectedValueOnce(knownError("P2025"));
    await expect(
      PurchaseOrderService.returnDelivery(input),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(db.inventoryItem.update).not.toHaveBeenCalled();
  });

  it("refuses to return stock the item no longer holds unallocated", async () => {
    db.inventoryItem.findFirst.mockResolvedValueOnce({
      onHand: 3,
      allocated: 2,
    });
    await expect(
      PurchaseOrderService.returnDelivery(input),
    ).rejects.toMatchObject({ statusCode: 409 });

    db.inventoryItem.findFirst.mockResolvedValueOnce(null);
    await expect(
      PurchaseOrderService.returnDelivery(input),
    ).rejects.toMatchObject({ statusCode: 409 });

    db.inventoryItem.update.mockRejectedValueOnce(knownError("P2025"));
    await expect(
      PurchaseOrderService.returnDelivery(input),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(db.inventoryStockMovement.create).not.toHaveBeenCalled();
  });
});

describe("PurchaseOrderService status changes", () => {
  it("confirms only a draft order of the organisation", async () => {
    await expect(
      PurchaseOrderService.confirmOrder("po-1", "org-1"),
    ).resolves.toEqual(order());
    expect(db.purchaseOrder.updateMany).toHaveBeenCalledWith({
      where: { id: "po-1", organisationId: "org-1", status: { in: ["DRAFT"] } },
      data: { status: "CONFIRMED" },
    });

    db.purchaseOrder.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      PurchaseOrderService.confirmOrder("po-1", "org-1"),
    ).rejects.toMatchObject({ statusCode: 400 });

    db.purchaseOrder.updateMany.mockResolvedValueOnce({ count: 0 });
    db.purchaseOrder.findFirst.mockResolvedValueOnce(null);
    await expect(
      PurchaseOrderService.confirmOrder("po-1", "org-2"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("cancels only an order that is still open", async () => {
    await PurchaseOrderService.cancelOrder("po-1", "org-1");
    expect(db.purchaseOrder.updateMany).toHaveBeenCalledWith({
      where: {
        id: "po-1",
        organisationId: "org-1",
        status: { in: ["DRAFT", "CONFIRMED", "PARTIALLY_RECEIVED"] },
      },
      data: { status: "CANCELLED" },
    });

    db.purchaseOrder.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      PurchaseOrderService.cancelOrder("po-1", "org-1"),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("PurchaseOrderService reads", () => {
  it("pages the organisation's orders with filters and rejects bad page sizes", async () => {
    db.purchaseOrder.findMany.mockResolvedValue([order()]);
    db.purchaseOrder.count.mockResolvedValue(51);

    await expect(
      PurchaseOrderService.listPurchaseOrders({
        organisationId: "org-1",
        vendorId: "vendor-1",
        status: "CONFIRMED",
        page: 3,
        pageSize: 25,
      }),
    ).resolves.toEqual({
      items: [order()],
      page: 3,
      pageSize: 25,
      total: 51,
      totalPages: 3,
    });
    expect(db.purchaseOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organisationId: "org-1",
          vendorId: "vendor-1",
          status: "CONFIRMED",
        },
        skip: 50,
        take: 25,
      }),
    );

    await PurchaseOrderService.listPurchaseOrders({ organisationId: "org-1" });
    expect(db.purchaseOrder.count).toHaveBeenLastCalledWith({
      where: { organisationId: "org-1" },
    });

    await expect(
      PurchaseOrderService.listPurchaseOrders({
        organisationId: "org-1",
        page: 0,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      PurchaseOrderService.listPurchaseOrders({
        organisationId: "org-1",
        pageSize: 101,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("reads one order and the outstanding lines within the organisation", async () => {
    await PurchaseOrderService.getPurchaseOrder("po-1", "org-1");
    expect(db.purchaseOrder.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "po-1", organisationId: "org-1" },
      }),
    );

    await PurchaseOrderService.getOutstandingDeliveries("org-1");
    expect(db.purchaseOrderLine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          purchaseOrder: {
            organisationId: "org-1",
            status: { in: ["CONFIRMED", "PARTIALLY_RECEIVED"] },
          },
          quantityReceived: { lt: "quantityOrdered" },
        },
      }),
    );
  });
});
