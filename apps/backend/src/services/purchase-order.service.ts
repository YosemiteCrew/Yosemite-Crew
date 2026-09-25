import { Prisma, PurchaseOrderStatus } from "@prisma/client";
import { prisma } from "src/config/prisma";

export { PurchaseOrderStatus };

export class PurchaseOrderServiceError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "PurchaseOrderServiceError";
  }
}

export interface CreatePurchaseOrderInput {
  organisationId: string;
  vendorId: string;
  orderNumber?: string;
  expectedDate?: Date;
  currency?: string;
  notes?: string;
  createdBy?: string;
  lines: CreatePurchaseOrderLineInput[];
}

export interface CreatePurchaseOrderLineInput {
  itemId: string;
  quantityOrdered: number;
  unitCost: number;
  packSize?: number;
  batchNumber?: string;
  lotNumber?: string;
  expiryDate?: Date;
}

export interface ReceiveDeliveryInput {
  organisationId: string;
  purchaseOrderId: string;
  deliveryDate?: Date;
  receivedBy?: string;
  notes?: string;
  lines: ReceiveDeliveryLineInput[];
}

export interface ReceiveDeliveryLineInput {
  purchaseOrderLineId: string;
  quantityReceived: number;
  batchId?: string;
}

export interface ReturnDeliveryInput {
  organisationId: string;
  deliveryId: string;
  lines: ReturnDeliveryLineInput[];
}

export interface ReturnDeliveryLineInput {
  deliveryLineId: string;
  quantityReturned: number;
}

export interface UpdatePurchaseOrderStatusInput {
  purchaseOrderId: string;
  status: PurchaseOrderStatus;
}

type PrismaClientOrTx = typeof prisma | Prisma.TransactionClient;

const ensureObjectId = (id: string, fieldName = "id"): string => {
  if (!id || typeof id !== "string" || id.trim().length === 0) {
    throw new PurchaseOrderServiceError(`Invalid ${fieldName}`, 400);
  }
  return id;
};

const updateOrThrow = async <T>(
  update: () => Promise<T>,
  message: string,
  statusCode: number,
): Promise<T> => {
  try {
    return await update();
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new PurchaseOrderServiceError(message, statusCode);
    }
    throw error;
  }
};

const generateOrderNumber = async (organisationId: string): Promise<string> => {
  const today = new Date();
  const prefix = `PO-${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, "0")}`;
  const count = await prisma.purchaseOrder.count({
    where: {
      organisationId,
      orderNumber: { startsWith: prefix },
    },
  });
  return `${prefix}-${(count + 1).toString().padStart(4, "0")}`;
};

const recalculatePurchaseOrderTotals = async (
  purchaseOrderId: string,
  client: PrismaClientOrTx = prisma,
): Promise<void> => {
  const lines = await client.purchaseOrderLine.findMany({
    where: { purchaseOrderId },
  });

  const totalAmount = lines.reduce((sum, line) => sum + line.totalCost, 0);

  await client.purchaseOrder.update({
    where: { id: purchaseOrderId },
    data: { totalAmount },
  });
};

const updatePurchaseOrderStatusFromLines = async (
  purchaseOrderId: string,
  client: PrismaClientOrTx = prisma,
): Promise<void> => {
  const lines = await client.purchaseOrderLine.findMany({
    where: { purchaseOrderId },
    select: { quantityOrdered: true, quantityReceived: true },
  });

  if (!lines.length) return;

  const totalOrdered = lines.reduce((sum, l) => sum + l.quantityOrdered, 0);
  const totalReceived = lines.reduce((sum, l) => sum + l.quantityReceived, 0);

  let status: PurchaseOrderStatus;
  if (totalReceived === 0) {
    status = "CONFIRMED";
  } else if (totalReceived >= totalOrdered) {
    status = "RECEIVED";
  } else {
    status = "PARTIALLY_RECEIVED";
  }

  await client.purchaseOrder.update({
    where: { id: purchaseOrderId },
    data: { status },
  });
};

const validateReceiptLines = async (
  purchaseOrderId: string,
  organisationId: string,
  lines: ReceiveDeliveryLineInput[],
  client: PrismaClientOrTx,
) => {
  const orderLines = await client.purchaseOrderLine.findMany({
    where: {
      id: { in: lines.map((line) => line.purchaseOrderLineId) },
      purchaseOrderId,
    },
  });
  if (orderLines.length !== lines.length) {
    throw new PurchaseOrderServiceError("Purchase order line not found", 404);
  }
  const orderLineById = new Map(orderLines.map((line) => [line.id, line]));
  const batchIds = lines.flatMap((line) =>
    line.batchId ? [line.batchId] : [],
  );
  const batches = batchIds.length
    ? await client.inventoryBatch.findMany({
        where: { id: { in: batchIds }, organisationId },
        select: { id: true, itemId: true },
      })
    : [];
  const batchById = new Map(batches.map((batch) => [batch.id, batch]));

  for (const line of lines) {
    const orderLine = orderLineById.get(line.purchaseOrderLineId)!;
    if (line.quantityReceived < 1 || !Number.isInteger(line.quantityReceived)) {
      throw new PurchaseOrderServiceError(
        "Received quantity must be a positive integer",
        400,
      );
    }
    if (
      line.quantityReceived >
      orderLine.quantityOrdered - orderLine.quantityReceived
    ) {
      throw new PurchaseOrderServiceError(
        `Cannot receive ${line.quantityReceived} units. Only ${orderLine.quantityOrdered - orderLine.quantityReceived} remaining to receive for this line.`,
        400,
      );
    }
    if (
      line.batchId &&
      batchById.get(line.batchId)?.itemId !== orderLine.itemId
    ) {
      throw new PurchaseOrderServiceError("Inventory batch not found", 404);
    }
  }

  return orderLineById;
};

const applyReceiptLine = async (
  deliveryId: string,
  organisationId: string,
  receivedBy: string | undefined,
  line: ReceiveDeliveryLineInput,
  orderLine: Prisma.PurchaseOrderLineGetPayload<object>,
  client: PrismaClientOrTx,
) => {
  const { purchaseOrderLineId, quantityReceived, batchId } = line;
  const itemId = orderLine.itemId;
  await client.purchaseOrderDeliveryLine.create({
    data: {
      deliveryId,
      purchaseOrderLineId,
      itemId,
      quantityReceived,
      batchId,
    },
  });
  await updateOrThrow(
    () =>
      client.purchaseOrderLine.update({
        where: {
          id: purchaseOrderLineId,
          quantityReceived: {
            lte: orderLine.quantityOrdered - quantityReceived,
          },
        },
        data: { quantityReceived: { increment: quantityReceived } },
      }),
    "Receipt exceeds the ordered quantity",
    400,
  );

  if (batchId) {
    await updateOrThrow(
      () =>
        client.inventoryBatch.update({
          where: { id: batchId, itemId, organisationId },
          data: { quantity: { increment: quantityReceived } },
        }),
      "Inventory batch not found",
      404,
    );
    await client.inventoryStockMovement.create({
      data: {
        itemId,
        batchId,
        change: quantityReceived,
        reason: "PURCHASE_RECEIPT",
        referenceId: deliveryId,
        userId: receivedBy,
      },
    });
  } else {
    const batch = await client.inventoryBatch.create({
      data: {
        itemId,
        organisationId,
        batchNumber: orderLine.batchNumber ?? `PO-${deliveryId.slice(0, 8)}`,
        lotNumber: orderLine.lotNumber,
        expiryDate: orderLine.expiryDate,
        quantity: quantityReceived,
        allocated: 0,
      },
    });
    await client.inventoryStockMovement.create({
      data: {
        itemId,
        batchId: batch.id,
        change: quantityReceived,
        reason: "PURCHASE_RECEIPT",
        referenceId: deliveryId,
        userId: receivedBy,
      },
    });
  }

  await updateOrThrow(
    () =>
      client.inventoryItem.update({
        where: { id: itemId, organisationId },
        data: { onHand: { increment: quantityReceived } },
      }),
    "Inventory item not found",
    404,
  );
};

const receiveDeliveryInTransaction = async (
  input: ReceiveDeliveryInput,
  client: PrismaClientOrTx,
) => {
  const {
    organisationId,
    purchaseOrderId,
    deliveryDate,
    receivedBy,
    notes,
    lines,
  } = input;

  const purchaseOrder = await client.purchaseOrder.findFirst({
    where: { id: purchaseOrderId, organisationId },
  });

  if (!purchaseOrder) {
    throw new PurchaseOrderServiceError("Purchase order not found", 404);
  }

  if (purchaseOrder.status === "CANCELLED") {
    throw new PurchaseOrderServiceError(
      "Cannot receive delivery for cancelled order",
      400,
    );
  }

  if (purchaseOrder.status === "RECEIVED") {
    throw new PurchaseOrderServiceError("Order already fully received", 400);
  }

  const orderLineById = await validateReceiptLines(
    purchaseOrderId,
    organisationId,
    lines,
    client,
  );

  const delivery = await client.purchaseOrderDelivery.create({
    data: {
      purchaseOrderId,
      vendorId: purchaseOrder.vendorId,
      deliveryDate: deliveryDate ?? new Date(),
      receivedBy,
      notes,
      status: "RECEIVED",
    },
  });

  for (const line of lines) {
    await applyReceiptLine(
      delivery.id,
      organisationId,
      receivedBy,
      line,
      orderLineById.get(line.purchaseOrderLineId)!,
      client,
    );
  }

  await updatePurchaseOrderStatusFromLines(purchaseOrderId, client);
  await recalculatePurchaseOrderTotals(purchaseOrderId, client);

  return delivery;
};

type DeliveryLineWithOrderLine = Prisma.PurchaseOrderDeliveryLineGetPayload<{
  include: { purchaseOrderLine: true };
}>;

const applyDeliveryReturnLine = async (
  deliveryId: string,
  organisationId: string,
  deliveryLine: DeliveryLineWithOrderLine,
  quantityReturned: number,
  client: PrismaClientOrTx,
) => {
  const {
    id: deliveryLineId,
    itemId,
    batchId,
    purchaseOrderLineId,
  } = deliveryLine;
  if (
    quantityReturned >
    deliveryLine.quantityReceived - deliveryLine.quantityReturned
  ) {
    throw new PurchaseOrderServiceError(
      "Return exceeds the remaining delivered quantity",
      400,
    );
  }

  const poLine = deliveryLine.purchaseOrderLine;
  if (poLine.quantityReceived < quantityReturned) {
    throw new PurchaseOrderServiceError(
      "Return exceeds received quantity",
      400,
    );
  }
  await updateOrThrow(
    () =>
      client.purchaseOrderDeliveryLine.update({
        where: {
          id: deliveryLineId,
          quantityReturned: {
            lte: deliveryLine.quantityReceived - quantityReturned,
          },
        },
        data: { quantityReturned: { increment: quantityReturned } },
      }),
    "Return exceeds the remaining delivered quantity",
    400,
  );
  await updateOrThrow(
    () =>
      client.purchaseOrderLine.update({
        where: {
          id: purchaseOrderLineId,
          quantityReceived: { gte: quantityReturned },
        },
        data: {
          quantityReceived: { decrement: quantityReturned },
          quantityReturned: { increment: quantityReturned },
        },
      }),
    "Return exceeds received quantity",
    400,
  );

  const batches = batchId
    ? []
    : await client.inventoryBatch.findMany({
        where: {
          itemId,
          organisationId,
          quantity: { gte: quantityReturned },
        },
        orderBy: { createdAt: "asc" },
        select: { id: true, quantity: true, allocated: true },
      });
  const batch = batchId
    ? await client.inventoryBatch.findFirst({
        where: { id: batchId, itemId, organisationId },
        select: { id: true, quantity: true, allocated: true },
      })
    : batches.find(
        (candidate) =>
          candidate.quantity - candidate.allocated >= quantityReturned,
      );
  if (!batch || batch.quantity - batch.allocated < quantityReturned) {
    throw new PurchaseOrderServiceError(
      "Insufficient available batch stock",
      400,
    );
  }

  await updateOrThrow(
    () =>
      client.inventoryBatch.update({
        where: {
          id: batch.id,
          itemId,
          organisationId,
          quantity: { gte: quantityReturned },
          allocated: { lte: batch.quantity - quantityReturned },
        },
        data: { quantity: { decrement: quantityReturned } },
      }),
    "Insufficient available batch stock",
    400,
  );
  await client.inventoryStockMovement.create({
    data: {
      itemId,
      batchId: batch.id,
      change: -quantityReturned,
      reason: "PURCHASE_RETURN",
      referenceId: deliveryId,
    },
  });

  const inventoryItem = await client.inventoryItem.findFirst({
    where: { id: itemId, organisationId },
    select: { onHand: true, allocated: true },
  });
  if (
    !inventoryItem ||
    inventoryItem.onHand - inventoryItem.allocated < quantityReturned
  ) {
    throw new PurchaseOrderServiceError("Insufficient inventory stock", 400);
  }
  await updateOrThrow(
    () =>
      client.inventoryItem.update({
        where: {
          id: itemId,
          organisationId,
          onHand: { gte: quantityReturned + inventoryItem.allocated },
          allocated: { lte: inventoryItem.onHand - quantityReturned },
        },
        data: { onHand: { decrement: quantityReturned } },
      }),
    "Insufficient inventory stock",
    400,
  );
};

const returnDeliveryInTransaction = async (
  input: ReturnDeliveryInput,
  client: PrismaClientOrTx,
) => {
  const { organisationId, deliveryId, lines } = input;

  const delivery = await client.purchaseOrderDelivery.findFirst({
    where: { id: deliveryId, purchaseOrder: { organisationId } },
    include: { purchaseOrder: true },
  });

  if (!delivery) {
    throw new PurchaseOrderServiceError("Delivery not found", 404);
  }

  const deliveryLines = await client.purchaseOrderDeliveryLine.findMany({
    where: {
      id: { in: lines.map((line) => line.deliveryLineId) },
      deliveryId,
    },
    include: { purchaseOrderLine: true },
  });
  if (deliveryLines.length !== lines.length) {
    throw new PurchaseOrderServiceError("Delivery line not found", 404);
  }
  const deliveryLineById = new Map(
    deliveryLines.map((line) => [line.id, line]),
  );

  for (const line of lines) {
    await applyDeliveryReturnLine(
      deliveryId,
      organisationId,
      deliveryLineById.get(line.deliveryLineId)!,
      line.quantityReturned,
      client,
    );
  }

  await updatePurchaseOrderStatusFromLines(delivery.purchaseOrderId, client);
  await recalculatePurchaseOrderTotals(delivery.purchaseOrderId, client);

  return delivery;
};

export const PurchaseOrderService = {
  async createOrder(input: CreatePurchaseOrderInput) {
    const {
      organisationId,
      vendorId,
      orderNumber,
      expectedDate,
      currency,
      notes,
      createdBy,
      lines,
    } = input;

    ensureObjectId(organisationId, "organisationId");
    ensureObjectId(vendorId, "vendorId");

    const vendor = await prisma.inventoryVendor.findFirst({
      where: { id: vendorId, organisationId },
      select: { id: true },
    });
    if (!vendor) throw new PurchaseOrderServiceError("Vendor not found", 404);

    const itemIds = [...new Set(lines.map((line) => line.itemId))];
    const items = await prisma.inventoryItem.findMany({
      where: { id: { in: itemIds }, organisationId },
      select: { id: true },
    });
    if (items.length !== itemIds.length) {
      throw new PurchaseOrderServiceError("Inventory item not found", 404);
    }

    const finalOrderNumber =
      orderNumber ?? (await generateOrderNumber(organisationId));

    const existingOrder = await prisma.purchaseOrder.findUnique({
      where: { orderNumber: finalOrderNumber },
    });

    if (existingOrder) {
      throw new PurchaseOrderServiceError("Order number already exists", 409);
    }

    for (const line of lines) {
      ensureObjectId(line.itemId, "itemId");
      if (line.quantityOrdered <= 0) {
        throw new PurchaseOrderServiceError(
          "Quantity ordered must be positive",
          400,
        );
      }
      if (line.unitCost < 0) {
        throw new PurchaseOrderServiceError(
          "Unit cost cannot be negative",
          400,
        );
      }
    }

    const purchaseOrder = await prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.create({
        data: {
          organisationId,
          vendorId,
          orderNumber: finalOrderNumber,
          expectedDate,
          currency: currency ?? "USD",
          notes,
          createdBy,
          status: "DRAFT",
        },
      });

      for (const line of lines) {
        const totalCost = line.quantityOrdered * line.unitCost;
        await tx.purchaseOrderLine.create({
          data: {
            purchaseOrderId: po.id,
            itemId: line.itemId,
            vendorId,
            quantityOrdered: line.quantityOrdered,
            unitCost: line.unitCost,
            totalCost,
            packSize: line.packSize ?? 1,
            batchNumber: line.batchNumber,
            lotNumber: line.lotNumber,
            expiryDate: line.expiryDate,
          },
        });
      }

      return po;
    });

    await recalculatePurchaseOrderTotals(purchaseOrder.id);

    return prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrder.id },
      include: { lines: true },
    });
  },

  async confirmOrder(purchaseOrderId: string, organisationId: string) {
    ensureObjectId(purchaseOrderId, "purchaseOrderId");

    const purchaseOrder = await prisma.purchaseOrder.findFirst({
      where: { id: purchaseOrderId, organisationId },
    });

    if (!purchaseOrder) {
      throw new PurchaseOrderServiceError("Purchase order not found", 404);
    }

    if (purchaseOrder.status !== "DRAFT") {
      throw new PurchaseOrderServiceError(
        "Only draft orders can be confirmed",
        400,
      );
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: { status: "CONFIRMED" },
    });

    return updated;
  },

  async receiveDelivery(input: ReceiveDeliveryInput) {
    return prisma.$transaction(async (tx) => {
      return receiveDeliveryInTransaction(input, tx);
    });
  },

  async returnDelivery(input: ReturnDeliveryInput) {
    return prisma.$transaction(async (tx) => {
      return returnDeliveryInTransaction(input, tx);
    });
  },

  async getPurchaseOrder(purchaseOrderId: string, organisationId: string) {
    ensureObjectId(purchaseOrderId, "purchaseOrderId");

    return prisma.purchaseOrder.findFirst({
      where: { id: purchaseOrderId, organisationId },
      include: {
        lines: {
          include: { deliveryLines: true },
        },
        deliveries: {
          include: { lines: true },
        },
      },
    });
  },

  async listPurchaseOrders(filter: {
    organisationId: string;
    vendorId?: string;
    status?: PurchaseOrderStatus;
    page?: number;
    pageSize?: number;
  }) {
    const {
      organisationId,
      vendorId,
      status,
      page = 1,
      pageSize = 25,
    } = filter;

    if (!Number.isInteger(page) || page < 1) {
      throw new PurchaseOrderServiceError(
        "Page must be a positive integer",
        400,
      );
    }
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      throw new PurchaseOrderServiceError(
        "Page size must be between 1 and 100",
        400,
      );
    }

    const where: Prisma.PurchaseOrderWhereInput = { organisationId };
    if (vendorId) where.vendorId = vendorId;
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { lines: true, deliveries: true },
      }),
      prisma.purchaseOrder.count({ where }),
    ]);

    return {
      items,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  },

  async cancelOrder(purchaseOrderId: string, organisationId: string) {
    ensureObjectId(purchaseOrderId, "purchaseOrderId");

    const purchaseOrder = await prisma.purchaseOrder.findFirst({
      where: { id: purchaseOrderId, organisationId },
    });

    if (!purchaseOrder) {
      throw new PurchaseOrderServiceError("Purchase order not found", 404);
    }

    if (purchaseOrder.status === "RECEIVED") {
      throw new PurchaseOrderServiceError(
        "Cannot cancel fully received order",
        400,
      );
    }

    return prisma.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: { status: "CANCELLED" },
    });
  },

  async getOutstandingDeliveries(organisationId: string) {
    return prisma.purchaseOrderLine.findMany({
      where: {
        purchaseOrder: {
          organisationId,
          status: { in: ["CONFIRMED", "PARTIALLY_RECEIVED"] },
        },
        quantityReceived: {
          lt: prisma.purchaseOrderLine.fields.quantityOrdered,
        },
      },
      include: {
        purchaseOrder: {
          select: {
            id: true,
            orderNumber: true,
            vendorId: true,
            expectedDate: true,
          },
        },
      },
    });
  },
};
