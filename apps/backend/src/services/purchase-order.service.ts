import { Prisma, PurchaseOrderStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "src/config/prisma";
import { roundMoney } from "src/services/finance/pricing";

export class PurchaseOrderServiceError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "PurchaseOrderServiceError";
  }
}

const queryId = (value: unknown): string => {
  const result = z.string().min(1).safeParse(value);
  if (!result.success) {
    throw new PurchaseOrderServiceError("Invalid identifier", 400);
  }
  return result.data;
};

export interface CreatePurchaseOrderInput {
  organisationId: string;
  vendorId: string;
  orderNumber?: string;
  expectedDate?: Date;
  currency: string;
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
  idempotencyKey: string;
  deliveryDate?: Date;
  receivedBy?: string;
  notes?: string;
  lines: ReceiveDeliveryLineInput[];
}

export interface ReceiveDeliveryLineInput {
  purchaseOrderLineId: string;
  quantityReceived: number;
  batchId?: string;
  batchNumber?: string;
  lotNumber?: string;
  expiryDate?: Date;
}

export interface ReturnDeliveryInput {
  organisationId: string;
  deliveryId: string;
  idempotencyKey: string;
  returnedBy?: string;
  notes?: string;
  lines: ReturnDeliveryLineInput[];
}

export interface ReturnDeliveryLineInput {
  deliveryLineId: string;
  quantityReturned: number;
}

type Tx = Prisma.TransactionClient;
type OrderLine = Prisma.PurchaseOrderLineGetPayload<object>;
type DeliveryLine = Prisma.PurchaseOrderDeliveryLineGetPayload<object>;

const OPEN_STATUSES: PurchaseOrderStatus[] = [
  "DRAFT",
  "CONFIRMED",
  "PARTIALLY_RECEIVED",
];
const RECEIVING_STATUSES: PurchaseOrderStatus[] = [
  "CONFIRMED",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
];
const DELIVERY_INCLUDE = { lines: true, returns: true } as const;

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002";

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

// ponytail: count-based numbering; two orders created in the same instant can
// collide and the second answers 409, a per-organisation sequence fixes that.
const generateOrderNumber = async (organisationId: string): Promise<string> => {
  const today = new Date();
  const prefix = `PO-${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, "0")}`;
  const count = await prisma.purchaseOrder.count({
    where: { organisationId, orderNumber: { startsWith: prefix } },
  });
  return `${prefix}-${(count + 1).toString().padStart(4, "0")}`;
};

/**
 * Moves an order between CONFIRMED, PARTIALLY_RECEIVED and RECEIVED from what
 * its lines hold. A cancelled or draft order keeps its status.
 */
const syncStatusFromLines = async (purchaseOrderId: string, tx: Tx) => {
  const safePurchaseOrderId = queryId(purchaseOrderId);
  const lines = await tx.purchaseOrderLine.findMany({
    where: { purchaseOrderId: safePurchaseOrderId },
    select: {
      purchaseOrderId: true,
      quantityOrdered: true,
      quantityReceived: true,
    },
  });
  if (!lines.length) return;

  let status: PurchaseOrderStatus = "PARTIALLY_RECEIVED";
  if (lines.every((l) => l.quantityReceived === 0)) status = "CONFIRMED";
  else if (lines.every((l) => l.quantityReceived >= l.quantityOrdered)) {
    status = "RECEIVED";
  }

  await tx.purchaseOrder.updateMany({
    where: {
      id: { equals: lines[0].purchaseOrderId },
      status: { in: RECEIVING_STATUSES },
    },
    data: { status },
  });
};

const validateReceiptLines = async (
  purchaseOrderId: string,
  organisationId: string,
  lines: ReceiveDeliveryLineInput[],
  tx: Tx,
) => {
  const orderLines = await tx.purchaseOrderLine.findMany({
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
    ? await tx.inventoryBatch.findMany({
        where: { id: { in: batchIds }, organisationId },
        select: { id: true, itemId: true },
      })
    : [];
  const batchById = new Map(batches.map((batch) => [batch.id, batch]));

  for (const line of lines) {
    const orderLine = orderLineById.get(line.purchaseOrderLineId)!;
    if (!Number.isInteger(line.quantityReceived) || line.quantityReceived < 1) {
      throw new PurchaseOrderServiceError(
        "Received quantity must be a whole number above zero",
        400,
      );
    }
    const remaining = orderLine.quantityOrdered - orderLine.quantityReceived;
    if (line.quantityReceived > remaining) {
      throw new PurchaseOrderServiceError(
        `Cannot receive ${line.quantityReceived} units. Only ${remaining} remaining to receive for this line.`,
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

/** Posts the received quantity to a batch and returns the batch id. */
const postReceiptToBatch = async (
  deliveryId: string,
  organisationId: string,
  line: ReceiveDeliveryLineInput,
  orderLine: OrderLine,
  tx: Tx,
): Promise<string> => {
  const { itemId } = orderLine;
  if (line.batchId) {
    await updateOrThrow(
      () =>
        tx.inventoryBatch.update({
          where: { id: line.batchId, itemId, organisationId },
          data: { quantity: { increment: line.quantityReceived } },
        }),
      "Inventory batch not found",
      404,
    );
    return line.batchId;
  }
  const batch = await tx.inventoryBatch.create({
    data: {
      itemId,
      organisationId,
      batchNumber:
        line.batchNumber ??
        orderLine.batchNumber ??
        `PO-${deliveryId.slice(0, 8)}`,
      lotNumber: line.lotNumber ?? orderLine.lotNumber,
      expiryDate: line.expiryDate ?? orderLine.expiryDate,
      quantity: line.quantityReceived,
      allocated: 0,
    },
  });
  return batch.id;
};

const applyReceiptLine = async (
  deliveryId: string,
  organisationId: string,
  receivedBy: string | undefined,
  line: ReceiveDeliveryLineInput,
  orderLine: OrderLine,
  tx: Tx,
) => {
  const { purchaseOrderLineId, quantityReceived } = line;
  const { itemId } = orderLine;

  await updateOrThrow(
    () =>
      tx.purchaseOrderLine.update({
        where: {
          id: purchaseOrderLineId,
          quantityReceived: {
            lte: orderLine.quantityOrdered - quantityReceived,
          },
        },
        data: { quantityReceived: { increment: quantityReceived } },
      }),
    "Receipt exceeds the ordered quantity",
    409,
  );

  const batchId = await postReceiptToBatch(
    deliveryId,
    organisationId,
    line,
    orderLine,
    tx,
  );

  await tx.purchaseOrderDeliveryLine.create({
    data: {
      deliveryId,
      purchaseOrderLineId,
      itemId,
      quantityReceived,
      batchId,
    },
  });
  await tx.inventoryStockMovement.create({
    data: {
      itemId,
      batchId,
      change: quantityReceived,
      reason: "PURCHASE",
      referenceId: deliveryId,
      userId: receivedBy,
    },
  });
  await updateOrThrow(
    () =>
      tx.inventoryItem.update({
        where: { id: itemId, organisationId },
        data: { onHand: { increment: quantityReceived } },
      }),
    "Inventory item not found",
    404,
  );
};

const findDeliveryByKey = (
  client: Tx | typeof prisma,
  purchaseOrderId: string,
  organisationId: string,
  idempotencyKey: string,
) =>
  client.purchaseOrderDelivery.findFirst({
    where: {
      purchaseOrderId,
      idempotencyKey,
      purchaseOrder: { organisationId },
    },
    include: DELIVERY_INCLUDE,
  });

const receiveDeliveryInTransaction = async (
  input: ReceiveDeliveryInput,
  tx: Tx,
) => {
  const { organisationId, purchaseOrderId, idempotencyKey, receivedBy, lines } =
    input;

  // A retry of a receipt that already went through returns it unchanged,
  // even once that receipt has completed the order.
  const replay = await findDeliveryByKey(
    tx,
    purchaseOrderId,
    organisationId,
    idempotencyKey,
  );
  if (replay) return replay;

  const purchaseOrder = await tx.purchaseOrder.findFirst({
    where: { id: purchaseOrderId, organisationId },
  });
  if (!purchaseOrder) {
    throw new PurchaseOrderServiceError("Purchase order not found", 404);
  }
  if (purchaseOrder.status === "DRAFT") {
    throw new PurchaseOrderServiceError(
      "Confirm the order before receiving a delivery",
      400,
    );
  }
  if (purchaseOrder.status === "CANCELLED") {
    throw new PurchaseOrderServiceError(
      "Cannot receive a delivery for a cancelled order",
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
    tx,
  );

  const delivery = await tx.purchaseOrderDelivery.create({
    data: {
      purchaseOrderId,
      vendorId: purchaseOrder.vendorId,
      idempotencyKey,
      deliveryDate: input.deliveryDate ?? new Date(),
      receivedBy,
      notes: input.notes,
      status: "RECEIVED",
    },
  });

  // Each line touches its own order line, and every stock change is an
  // atomic increment or a guarded update, so the lines need no ordering.
  await Promise.all(
    lines.map((line) =>
      applyReceiptLine(
        delivery.id,
        organisationId,
        receivedBy,
        line,
        orderLineById.get(line.purchaseOrderLineId)!,
        tx,
      ),
    ),
  );

  await syncStatusFromLines(purchaseOrderId, tx);

  return tx.purchaseOrderDelivery.findUniqueOrThrow({
    where: { id: delivery.id },
    include: DELIVERY_INCLUDE,
  });
};

/** Takes the returned quantity out of the batch the delivery posted it to. */
const takeReturnFromBatch = async (
  deliveryLine: DeliveryLine,
  organisationId: string,
  quantityReturned: number,
  tx: Tx,
) => {
  const { itemId, batchId } = deliveryLine;
  const batch = await tx.inventoryBatch.findFirst({
    where: { id: batchId, itemId, organisationId },
    select: { quantity: true, allocated: true },
  });
  if (!batch || batch.quantity - batch.allocated < quantityReturned) {
    throw new PurchaseOrderServiceError(
      "Not enough unallocated stock in the received batch to return",
      409,
    );
  }
  // quantity >= returned + allocated-at-read and allocated <= allocated-at-read
  // together keep quantity - allocated >= returned against a concurrent change.
  await updateOrThrow(
    () =>
      tx.inventoryBatch.update({
        where: {
          id: batchId,
          itemId,
          organisationId,
          quantity: { gte: quantityReturned + batch.allocated },
          allocated: { lte: batch.allocated },
        },
        data: { quantity: { decrement: quantityReturned } },
      }),
    "Not enough unallocated stock in the received batch to return",
    409,
  );
};

const takeReturnFromItem = async (
  itemId: string,
  organisationId: string,
  quantityReturned: number,
  tx: Tx,
) => {
  const item = await tx.inventoryItem.findFirst({
    where: { id: itemId, organisationId },
    select: { onHand: true, allocated: true },
  });
  if (!item || item.onHand - item.allocated < quantityReturned) {
    throw new PurchaseOrderServiceError(
      "Not enough unallocated stock to return",
      409,
    );
  }
  await updateOrThrow(
    () =>
      tx.inventoryItem.update({
        where: {
          id: itemId,
          organisationId,
          onHand: { gte: quantityReturned + item.allocated },
          allocated: { lte: item.allocated },
        },
        data: { onHand: { decrement: quantityReturned } },
      }),
    "Not enough unallocated stock to return",
    409,
  );
};

const applyReturnLine = async (
  returnId: string,
  organisationId: string,
  returnedBy: string | undefined,
  deliveryLine: DeliveryLine,
  quantityReturned: number,
  tx: Tx,
) => {
  const remaining =
    deliveryLine.quantityReceived - deliveryLine.quantityReturned;
  if (quantityReturned > remaining) {
    throw new PurchaseOrderServiceError(
      `Cannot return ${quantityReturned} units. Only ${remaining} from this delivery line are left to return.`,
      400,
    );
  }

  await updateOrThrow(
    () =>
      tx.purchaseOrderDeliveryLine.update({
        where: {
          id: deliveryLine.id,
          quantityReturned: {
            lte: deliveryLine.quantityReceived - quantityReturned,
          },
        },
        data: { quantityReturned: { increment: quantityReturned } },
      }),
    "Return exceeds the quantity left on this delivery line",
    409,
  );
  await updateOrThrow(
    () =>
      tx.purchaseOrderLine.update({
        where: {
          id: deliveryLine.purchaseOrderLineId,
          quantityReceived: { gte: quantityReturned },
        },
        data: {
          quantityReceived: { decrement: quantityReturned },
          quantityReturned: { increment: quantityReturned },
        },
      }),
    "Return exceeds the quantity received on this order line",
    409,
  );

  await takeReturnFromBatch(deliveryLine, organisationId, quantityReturned, tx);
  await takeReturnFromItem(
    deliveryLine.itemId,
    organisationId,
    quantityReturned,
    tx,
  );
  await tx.inventoryStockMovement.create({
    data: {
      itemId: deliveryLine.itemId,
      batchId: deliveryLine.batchId,
      change: -quantityReturned,
      reason: "PURCHASE_RETURN",
      referenceId: returnId,
      userId: returnedBy,
    },
  });
};

const findDeliveryForOrg = (
  client: Tx | typeof prisma,
  deliveryId: string,
  organisationId: string,
) =>
  client.purchaseOrderDelivery.findFirst({
    where: { id: deliveryId, purchaseOrder: { organisationId } },
    include: DELIVERY_INCLUDE,
  });

const returnDeliveryInTransaction = async (
  input: ReturnDeliveryInput,
  tx: Tx,
) => {
  const { organisationId, deliveryId, idempotencyKey, returnedBy, lines } =
    input;

  const delivery = await findDeliveryForOrg(tx, deliveryId, organisationId);
  if (!delivery) {
    throw new PurchaseOrderServiceError("Delivery not found", 404);
  }
  if (delivery.returns.some((r) => r.idempotencyKey === idempotencyKey)) {
    return delivery;
  }

  const deliveryLineById = new Map(delivery.lines.map((l) => [l.id, l]));
  if (lines.some((line) => !deliveryLineById.has(line.deliveryLineId))) {
    throw new PurchaseOrderServiceError("Delivery line not found", 404);
  }

  const purchaseReturn = await tx.purchaseOrderReturn.create({
    data: { deliveryId, idempotencyKey, returnedBy, notes: input.notes },
  });

  await Promise.all(
    lines.map((line) =>
      applyReturnLine(
        purchaseReturn.id,
        organisationId,
        returnedBy,
        deliveryLineById.get(line.deliveryLineId)!,
        line.quantityReturned,
        tx,
      ),
    ),
  );

  await syncStatusFromLines(delivery.purchaseOrderId, tx);

  return tx.purchaseOrderDelivery.findUniqueOrThrow({
    where: { id: deliveryId },
    include: DELIVERY_INCLUDE,
  });
};

/**
 * Two identical requests racing past the replay check both try to insert the
 * same key; the loser's transaction rolls back on the unique index and it
 * answers with what the winner recorded.
 */
const replayOnDuplicateKey = async <T>(
  run: () => Promise<T>,
  readBack: () => Promise<T | null>,
): Promise<T> => {
  try {
    return await run();
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const existing = await readBack();
    if (!existing) throw error;
    return existing;
  }
};

/** Applies a status change only from the allowed statuses, atomically. */
const transitionStatus = async (
  purchaseOrderId: string,
  organisationId: string,
  from: PurchaseOrderStatus[],
  to: PurchaseOrderStatus,
  refusal: string,
) => {
  const safePurchaseOrderId = queryId(purchaseOrderId);
  const safeOrganisationId = queryId(organisationId);
  const scopedOrder = await prisma.purchaseOrder.findFirst({
    where: { id: safePurchaseOrderId, organisationId: safeOrganisationId },
    select: { id: true, organisationId: true },
  });
  if (!scopedOrder) {
    throw new PurchaseOrderServiceError("Purchase order not found", 404);
  }
  try {
    return await prisma.purchaseOrder.update({
      where: {
        id: scopedOrder.id,
        organisationId: scopedOrder.organisationId,
        status: { in: from },
      },
      data: { status: to },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      const stillExists = await prisma.purchaseOrder.findFirst({
        where: {
          id: scopedOrder.id,
          organisationId: scopedOrder.organisationId,
        },
        select: { id: true },
      });
      if (!stillExists) {
        throw new PurchaseOrderServiceError("Purchase order not found", 404);
      }
      throw new PurchaseOrderServiceError(refusal, 400);
    }
    throw error;
  }
};

export const PurchaseOrderService = {
  async createOrder(input: CreatePurchaseOrderInput) {
    const { organisationId, vendorId, currency, lines } = input;

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

    const lineData = lines.map((line) => ({
      itemId: line.itemId,
      vendorId,
      quantityOrdered: line.quantityOrdered,
      unitCost: line.unitCost,
      totalCost: roundMoney(line.quantityOrdered * line.unitCost, currency),
      packSize: line.packSize ?? 1,
      batchNumber: line.batchNumber,
      lotNumber: line.lotNumber,
      expiryDate: line.expiryDate,
    }));
    const totalAmount = roundMoney(
      lineData.reduce((sum, line) => sum + line.totalCost, 0),
      currency,
    );
    const orderNumber =
      input.orderNumber ?? (await generateOrderNumber(organisationId));

    try {
      return await prisma.purchaseOrder.create({
        data: {
          organisationId,
          vendorId,
          orderNumber,
          expectedDate: input.expectedDate,
          currency,
          notes: input.notes,
          createdBy: input.createdBy,
          status: "DRAFT",
          totalAmount,
          lines: { create: lineData },
        },
        include: { lines: true },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new PurchaseOrderServiceError("Order number already exists", 409);
      }
      throw error;
    }
  },

  confirmOrder(purchaseOrderId: string, organisationId: string) {
    return transitionStatus(
      purchaseOrderId,
      organisationId,
      ["DRAFT"],
      "CONFIRMED",
      "Only draft orders can be confirmed",
    );
  },

  cancelOrder(purchaseOrderId: string, organisationId: string) {
    return transitionStatus(
      purchaseOrderId,
      organisationId,
      OPEN_STATUSES,
      "CANCELLED",
      "Only an order that is not fully received or already cancelled can be cancelled",
    );
  },

  receiveDelivery(input: ReceiveDeliveryInput) {
    const safeInput = {
      ...input,
      organisationId: queryId(input.organisationId),
      purchaseOrderId: queryId(input.purchaseOrderId),
    };
    return replayOnDuplicateKey(
      () =>
        prisma.$transaction((tx) =>
          receiveDeliveryInTransaction(safeInput, tx),
        ),
      () =>
        findDeliveryByKey(
          prisma,
          safeInput.purchaseOrderId,
          safeInput.organisationId,
          safeInput.idempotencyKey,
        ),
    );
  },

  returnDelivery(input: ReturnDeliveryInput) {
    return replayOnDuplicateKey(
      () => prisma.$transaction((tx) => returnDeliveryInTransaction(input, tx)),
      async () => {
        const delivery = await findDeliveryForOrg(
          prisma,
          input.deliveryId,
          input.organisationId,
        );
        return delivery?.returns.some(
          (r) => r.idempotencyKey === input.idempotencyKey,
        )
          ? delivery
          : null;
      },
    );
  },

  getPurchaseOrder(purchaseOrderId: string, organisationId: string) {
    return prisma.purchaseOrder.findFirst({
      where: { id: purchaseOrderId, organisationId },
      include: {
        lines: { include: { deliveryLines: true } },
        deliveries: { include: DELIVERY_INCLUDE },
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

  getOutstandingDeliveries(organisationId: string) {
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
