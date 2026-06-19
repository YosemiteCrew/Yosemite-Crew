import { createHash } from "crypto";
import {
  InventoryConsumptionAction,
  InventoryConsumptionSourceType,
  Prisma,
} from "@prisma/client";
import { prisma } from "src/config/prisma";

export class InventoryConsumptionServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = "InventoryConsumptionServiceError";
  }
}

export type InventoryConsumptionLineInput = {
  sourceLineKey: string;
  inventoryItemId?: string;
  inventoryItemSku?: string;
  batchId?: string;
  quantity: number;
  metadata?: Prisma.InputJsonValue;
};

export type InventoryConsumptionRuleInput = {
  organisationId: string;
  sourceType: InventoryConsumptionSourceType;
  sourceKey: string;
  inventoryItemId: string;
  quantityMultiplier?: number;
  notes?: string | null;
  active?: boolean;
};

export type InventoryConsumptionRequest = {
  organisationId: string;
  sourceType: InventoryConsumptionSourceType;
  sourceId: string;
  action?: InventoryConsumptionAction;
  idempotencyKey?: string;
  metadata?: Prisma.InputJsonValue;
  lines: InventoryConsumptionLineInput[];
};

const asNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const asPositiveInteger = (value: unknown): number | undefined => {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const integer = Math.trunc(value);
  return integer > 0 ? integer : undefined;
};

const normalizeKey = (value: string) => value.trim().toLowerCase();

const buildIdempotencyKey = (request: InventoryConsumptionRequest) =>
  request.idempotencyKey ??
  createHash("sha256")
    .update(
      JSON.stringify({
        organisationId: request.organisationId,
        sourceType: request.sourceType,
        sourceId: request.sourceId,
        action: request.action ?? "CONSUME",
        lines: request.lines.map((line) => ({
          sourceLineKey: line.sourceLineKey,
          inventoryItemId: line.inventoryItemId ?? null,
          inventoryItemSku: line.inventoryItemSku ?? null,
          quantity: line.quantity,
        })),
      }),
    )
    .digest("hex");

const ensureQuantity = (quantity: number) => {
  const safe = asPositiveInteger(quantity);
  if (!safe) {
    throw new InventoryConsumptionServiceError(
      "quantity must be a positive integer",
      400,
    );
  }
  return safe;
};

const consumeInventoryItem = async (
  tx: Prisma.TransactionClient,
  organisationId: string,
  inventoryItemId: string,
  quantity: number,
  metadata: Prisma.InputJsonValue | undefined,
  sourceType: InventoryConsumptionSourceType,
  sourceId: string,
  sourceLineKey: string,
  action: InventoryConsumptionAction,
  idempotencyKey: string,
  batchId?: string,
  movementReason?: string,
) => {
  const existingEvent = await tx.inventoryConsumptionEvent.findUnique({
    where: { idempotencyKey },
  });
  if (existingEvent) {
    return existingEvent;
  }

  if (action === "RESERVE") {
    return tx.inventoryConsumptionEvent.create({
      data: {
        organisationId,
        sourceType,
        sourceId,
        sourceLineKey,
        action,
        idempotencyKey,
        inventoryItemId,
        quantity,
        status: "APPLIED",
        metadata,
      },
    });
  }

  if (action === "RELEASE") {
    const movements = await tx.inventoryStockMovement.findMany({
      where: {
        itemId: inventoryItemId,
        referenceId: sourceId,
        change: { lt: 0 },
        ...(batchId ? { batchId } : {}),
      },
      orderBy: [{ createdAt: "desc" }],
    });

    if (!movements.length) {
      throw new InventoryConsumptionServiceError(
        "No prior consumption found to release",
        400,
      );
    }

    let remainingRelease = quantity;
    for (const movement of movements) {
      if (remainingRelease <= 0) break;
      const consumedQuantity = Math.abs(movement.change ?? 0);
      if (consumedQuantity <= 0) continue;
      const restore = Math.min(remainingRelease, consumedQuantity);
      remainingRelease -= restore;

      if (movement.batchId) {
        await tx.inventoryBatch.update({
          where: { id: movement.batchId },
          data: { quantity: { increment: restore } },
        });
      }

      await tx.inventoryStockMovement.create({
        data: {
          itemId: inventoryItemId,
          batchId: movement.batchId ?? undefined,
          change: restore,
          reason: movementReason ?? "PRESCRIPTION_RELEASE",
          referenceId: sourceId,
        },
      });
    }

    if (remainingRelease > 0) {
      throw new InventoryConsumptionServiceError(
        "Failed to release full requested quantity",
        500,
      );
    }

    await updateInventoryItemTotals(tx, organisationId, inventoryItemId);

    return createInventoryConsumptionEvent(tx, {
      organisationId,
      sourceType,
      sourceId,
      sourceLineKey,
      action,
      idempotencyKey,
      inventoryItemId,
      quantity,
      status: "APPLIED",
      metadata,
    });
  } else if (action !== "CONSUME") {
    return createInventoryConsumptionEvent(tx, {
      organisationId,
      sourceType,
      sourceId,
      sourceLineKey,
      action,
      idempotencyKey,
      inventoryItemId,
      quantity,
      status: "SKIPPED",
      metadata,
    });
  }

  const item = await tx.inventoryItem.findFirst({
    where: { id: inventoryItemId, organisationId },
  });
  if (!item) {
    throw new InventoryConsumptionServiceError("Inventory item not found", 404);
  }
  if ((item.onHand ?? 0) < quantity) {
    throw new InventoryConsumptionServiceError("Insufficient stock", 400);
  }

  let remaining = quantity;
  const batches = await tx.inventoryBatch.findMany({
    where: {
      itemId: inventoryItemId,
      organisationId,
      ...(batchId ? { id: batchId } : {}),
    },
    orderBy: [{ expiryDate: "asc" }, { createdAt: "asc" }],
  });

  for (const batch of batches) {
    if (remaining <= 0) break;
    const available = batch.quantity ?? 0;
    if (available <= 0) continue;
    const consume = Math.min(available, remaining);
    remaining -= consume;

    await tx.inventoryBatch.update({
      where: { id: batch.id },
      data: { quantity: available - consume },
    });

    await tx.inventoryStockMovement.create({
      data: {
        itemId: inventoryItemId,
        batchId: batch.id,
        change: -consume,
        reason: movementReason ?? "MANUAL_ADJUSTMENT",
        referenceId: sourceId,
      },
    });
  }

  if (remaining > 0) {
    throw new InventoryConsumptionServiceError(
      "Failed to consume full requested quantity",
      500,
    );
  }

  await updateInventoryItemTotals(tx, organisationId, inventoryItemId);

  return createInventoryConsumptionEvent(tx, {
    organisationId,
    sourceType,
    sourceId,
    sourceLineKey,
    action,
    idempotencyKey,
    inventoryItemId,
    quantity,
    status: "APPLIED",
    metadata,
  });
};

const resolveInventoryItemFromRule = async (
  tx: Prisma.TransactionClient,
  organisationId: string,
  sourceType: InventoryConsumptionSourceType,
  sourceKey: string,
) => {
  const rule = await tx.inventoryConsumptionRule.findFirst({
    where: {
      organisationId,
      sourceType,
      sourceKey,
      active: true,
    },
  });

  return rule ?? null;
};

const resolveInventoryItemIdBySku = async (
  tx: Prisma.TransactionClient,
  organisationId: string,
  sku: string,
) => {
  const item = await tx.inventoryItem.findFirst({
    where: { organisationId, sku },
    select: { id: true },
  });
  return item?.id ?? null;
};

const resolveInventoryItemIdByBatch = async (
  tx: Prisma.TransactionClient,
  organisationId: string,
  batchSelector: {
    batchId?: string | null;
    batchNumber?: string | null;
    lotNumber?: string | null;
    expiryDate?: string | Date | null;
  },
) => {
  const batchId = asNonEmptyString(batchSelector.batchId);
  const batchNumber = asNonEmptyString(batchSelector.batchNumber);
  const lotNumber = asNonEmptyString(batchSelector.lotNumber);
  const expiryDate =
    batchSelector.expiryDate instanceof Date
      ? batchSelector.expiryDate
      : typeof batchSelector.expiryDate === "string" &&
          batchSelector.expiryDate.trim()
        ? new Date(batchSelector.expiryDate)
        : undefined;

  if (!batchId && !batchNumber && !lotNumber && !expiryDate) {
    return null;
  }

  const batch = await tx.inventoryBatch.findFirst({
    where: {
      organisationId,
      ...(batchId
        ? { id: batchId }
        : batchNumber
          ? { batchNumber }
          : lotNumber
            ? { lotNumber }
            : {}),
      ...(expiryDate && !Number.isNaN(expiryDate.getTime())
        ? { expiryDate }
        : {}),
    },
    select: { id: true, itemId: true },
  });

  return batch ?? null;
};

const updateInventoryItemTotals = async (
  tx: Prisma.TransactionClient,
  organisationId: string,
  inventoryItemId: string,
) => {
  const batchesAfter = await tx.inventoryBatch.findMany({
    where: { itemId: inventoryItemId, organisationId },
  });
  const onHand = batchesAfter.reduce(
    (sum, batch) => sum + (batch.quantity ?? 0),
    0,
  );
  const allocated = batchesAfter.reduce(
    (sum, batch) => sum + (batch.allocated ?? 0),
    0,
  );

  await tx.inventoryItem.update({
    where: { id: inventoryItemId },
    data: { onHand, allocated },
  });
};

const createInventoryConsumptionEvent = (
  tx: Prisma.TransactionClient,
  data: {
    organisationId: string;
    sourceType: InventoryConsumptionSourceType;
    sourceId: string;
    sourceLineKey: string;
    action: InventoryConsumptionAction;
    idempotencyKey: string;
    inventoryItemId: string;
    quantity: number;
    status: "APPLIED" | "SKIPPED";
    metadata?: Prisma.InputJsonValue;
  },
) =>
  tx.inventoryConsumptionEvent.create({
    data,
  });

const consumeResolvedLines = async (
  tx: Prisma.TransactionClient,
  request: InventoryConsumptionRequest,
  resolvedLines: InventoryConsumptionLineInput[],
  options?: { movementReason?: string },
) => {
  const organisationId = asNonEmptyString(request.organisationId);
  const sourceId = asNonEmptyString(request.sourceId);
  if (!organisationId || !sourceId) {
    throw new InventoryConsumptionServiceError(
      "organisationId and sourceId are required",
      400,
    );
  }
  if (!resolvedLines.length) return [];

  const action = request.action ?? "CONSUME";
  const idempotencyBase = buildIdempotencyKey({
    ...request,
    organisationId,
    sourceId,
    action,
  });

  const events = [];
  for (const line of resolvedLines) {
    const quantity = ensureQuantity(line.quantity);
    const inventoryItemId = asNonEmptyString(line.inventoryItemId);
    if (!inventoryItemId) {
      throw new InventoryConsumptionServiceError(
        `Unable to resolve inventory item for ${line.sourceLineKey}.`,
        400,
      );
    }
    const event = await consumeInventoryItem(
      tx,
      organisationId,
      inventoryItemId,
      quantity,
      line.metadata ?? request.metadata,
      request.sourceType,
      sourceId,
      line.sourceLineKey,
      action,
      `${idempotencyBase}:${line.sourceLineKey}:${inventoryItemId}`,
      line.batchId,
      options?.movementReason,
    );
    events.push(event);
  }
  return events;
};

const normalizePrescriptionLines = (medications: unknown) => {
  if (!Array.isArray(medications)) return [];

  return medications.flatMap((entry, index) => {
    if (!entry || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    const quantity = asPositiveInteger(
      record.quantity ??
        record.units ??
        record.count ??
        record.dispenseQuantity,
    );
    if (!quantity) return [];

    const sourceLineKey =
      asNonEmptyString(record.sourceLineKey) ??
      asNonEmptyString(record.id) ??
      asNonEmptyString(record.medicationCode) ??
      asNonEmptyString(record.drugCode) ??
      asNonEmptyString(record.code) ??
      asNonEmptyString(record.name) ??
      `line-${index}`;

    return [
      {
        sourceLineKey,
        quantity,
        inventoryItemId: asNonEmptyString(record.inventoryItemId),
        inventoryItemSku:
          asNonEmptyString(record.inventoryItemSku) ??
          asNonEmptyString(record.sku),
        batchId: asNonEmptyString(record.batchId),
        batchNumber: asNonEmptyString(record.batchNumber),
        lotNumber: asNonEmptyString(record.lotNumber),
        expiryDate:
          typeof record.expiryDate === "string" ||
          record.expiryDate instanceof Date
            ? record.expiryDate
            : undefined,
        ruleKeys: [
          asNonEmptyString(record.inventoryItemCode),
          asNonEmptyString(record.medicationCode),
          asNonEmptyString(record.drugCode),
          asNonEmptyString(record.code),
          asNonEmptyString(record.name),
        ].filter((value): value is string => Boolean(value)),
        metadata: record.metadata as Prisma.InputJsonValue | undefined,
      },
    ];
  });
};

const resolvePrescriptionLines = async (
  tx: Prisma.TransactionClient,
  organisationId: string,
  medications: unknown,
) => {
  const prescriptionLines = normalizePrescriptionLines(medications);
  const resolved: InventoryConsumptionLineInput[] = [];

  for (const line of prescriptionLines) {
    const batchMatch = await resolveInventoryItemIdByBatch(tx, organisationId, {
      batchId: line.batchId,
      batchNumber: line.batchNumber,
      lotNumber: line.lotNumber,
      expiryDate: line.expiryDate,
    });

    if (line.inventoryItemId) {
      resolved.push({
        sourceLineKey: line.sourceLineKey,
        inventoryItemId: line.inventoryItemId,
        quantity: line.quantity,
        metadata: line.metadata,
        batchId: batchMatch?.id ?? line.batchId ?? undefined,
      });
      continue;
    }

    if (line.inventoryItemSku) {
      const inventoryItemId = await resolveInventoryItemIdBySku(
        tx,
        organisationId,
        line.inventoryItemSku,
      );
      if (inventoryItemId) {
        resolved.push({
          sourceLineKey: line.sourceLineKey,
          inventoryItemId,
          quantity: line.quantity,
          metadata: line.metadata,
          batchId: batchMatch?.id ?? line.batchId ?? undefined,
        });
        continue;
      }
    }

    if (batchMatch?.itemId) {
      resolved.push({
        sourceLineKey: line.sourceLineKey,
        inventoryItemId: batchMatch.itemId,
        quantity: line.quantity,
        metadata: line.metadata,
        batchId: batchMatch.id,
      });
      continue;
    }

    for (const ruleKey of line.ruleKeys) {
      const rule = await resolveInventoryItemFromRule(
        tx,
        organisationId,
        "PRESCRIPTION",
        normalizeKey(ruleKey),
      );
      if (rule) {
        resolved.push({
          sourceLineKey: line.sourceLineKey,
          inventoryItemId: rule.inventoryItemId,
          quantity: Math.max(
            1,
            Math.round(line.quantity * rule.quantityMultiplier),
          ),
          metadata: line.metadata,
          batchId: batchMatch?.id ?? line.batchId ?? undefined,
        });
        break;
      }
    }
  }

  return resolved;
};

const runPrescriptionInventoryAction = async (params: {
  organisationId: string;
  prescriptionId: string;
  medications: unknown;
  metadata?: Prisma.InputJsonValue;
  action: InventoryConsumptionAction;
  movementReason?: string;
}) => {
  const organisationId = asNonEmptyString(params.organisationId);
  const prescriptionId = asNonEmptyString(params.prescriptionId);
  if (!organisationId || !prescriptionId) {
    throw new InventoryConsumptionServiceError(
      "organisationId and prescriptionId are required",
      400,
    );
  }

  return prisma.$transaction(async (tx) => {
    const lines = await resolvePrescriptionLines(
      tx,
      organisationId,
      params.medications,
    );
    if (!lines.length) return [];

    return consumeResolvedLines(
      tx,
      {
        organisationId,
        sourceType: "PRESCRIPTION",
        sourceId: prescriptionId,
        action: params.action,
        metadata: params.metadata,
        lines,
      },
      lines,
      params.movementReason
        ? { movementReason: params.movementReason }
        : undefined,
    );
  });
};

export const InventoryConsumptionService = {
  async upsertRule(input: InventoryConsumptionRuleInput) {
    const organisationId = asNonEmptyString(input.organisationId);
    const sourceKey = asNonEmptyString(input.sourceKey);
    const inventoryItemId = asNonEmptyString(input.inventoryItemId);
    if (!organisationId || !sourceKey || !inventoryItemId) {
      throw new InventoryConsumptionServiceError(
        "organisationId, sourceKey, and inventoryItemId are required",
        400,
      );
    }

    return prisma.inventoryConsumptionRule.upsert({
      where: {
        organisationId_sourceType_sourceKey_inventoryItemId: {
          organisationId,
          sourceType: input.sourceType,
          sourceKey: normalizeKey(sourceKey),
          inventoryItemId,
        },
      },
      create: {
        organisationId,
        sourceType: input.sourceType,
        sourceKey: normalizeKey(sourceKey),
        inventoryItemId,
        quantityMultiplier: input.quantityMultiplier ?? 1,
        notes: input.notes ?? undefined,
        active: input.active ?? true,
      },
      update: {
        quantityMultiplier: input.quantityMultiplier ?? 1,
        notes: input.notes ?? undefined,
        active: input.active ?? true,
      },
    });
  },

  async listRules(organisationId: string) {
    const safeOrganisationId = asNonEmptyString(organisationId);
    if (!safeOrganisationId) {
      throw new InventoryConsumptionServiceError(
        "organisationId is required",
        400,
      );
    }

    return prisma.inventoryConsumptionRule.findMany({
      where: { organisationId: safeOrganisationId },
      orderBy: [{ sourceType: "asc" }, { sourceKey: "asc" }],
    });
  },

  async consume(request: InventoryConsumptionRequest) {
    if (!Array.isArray(request.lines) || request.lines.length === 0) {
      return [];
    }

    return prisma.$transaction(async (tx) => {
      const organisationId = asNonEmptyString(request.organisationId);
      const sourceId = asNonEmptyString(request.sourceId);
      if (!organisationId || !sourceId) {
        throw new InventoryConsumptionServiceError(
          "organisationId and sourceId are required",
          400,
        );
      }

      const action = request.action ?? "CONSUME";
      const idempotencyBase = buildIdempotencyKey({
        ...request,
        organisationId,
        sourceId,
        action,
      });

      const events = [];
      for (const line of request.lines) {
        const quantity = ensureQuantity(line.quantity);
        const inventoryItemId = asNonEmptyString(line.inventoryItemId);
        const inventoryItemSku = asNonEmptyString(line.inventoryItemSku);
        let resolvedInventoryItemId = inventoryItemId ?? null;

        if (!resolvedInventoryItemId && inventoryItemSku) {
          resolvedInventoryItemId = await resolveInventoryItemIdBySku(
            tx,
            organisationId,
            inventoryItemSku,
          );
        }

        if (!resolvedInventoryItemId) {
          throw new InventoryConsumptionServiceError(
            `Unable to resolve inventory item for ${line.sourceLineKey}.`,
            400,
          );
        }

        const event = await consumeInventoryItem(
          tx,
          organisationId,
          resolvedInventoryItemId,
          quantity,
          line.metadata ?? request.metadata,
          request.sourceType,
          sourceId,
          line.sourceLineKey,
          action,
          `${idempotencyBase}:${line.sourceLineKey}:${resolvedInventoryItemId}`,
          line.batchId,
        );
        events.push(event);
      }
      return events;
    });
  },

  async consumePrescription(params: {
    organisationId: string;
    prescriptionId: string;
    medications: unknown;
    metadata?: Prisma.InputJsonValue;
  }) {
    return runPrescriptionInventoryAction({
      organisationId: params.organisationId,
      prescriptionId: params.prescriptionId,
      medications: params.medications,
      metadata: params.metadata,
      action: "CONSUME",
      movementReason: "PRESCRIPTION_DISPENSE",
    });
  },

  async reservePrescription(params: {
    organisationId: string;
    prescriptionId: string;
    medications: unknown;
    metadata?: Prisma.InputJsonValue;
  }) {
    return runPrescriptionInventoryAction({
      organisationId: params.organisationId,
      prescriptionId: params.prescriptionId,
      medications: params.medications,
      metadata: params.metadata,
      action: "RESERVE",
    });
  },

  async releasePrescription(params: {
    organisationId: string;
    prescriptionId: string;
    medications: unknown;
    metadata?: Prisma.InputJsonValue;
  }) {
    return runPrescriptionInventoryAction({
      organisationId: params.organisationId,
      prescriptionId: params.prescriptionId,
      medications: params.medications,
      metadata: params.metadata,
      action: "RELEASE",
      movementReason: "PRESCRIPTION_RELEASE",
    });
  },

  async returnPrescription(params: {
    organisationId: string;
    prescriptionId: string;
    medications: unknown;
    metadata?: Prisma.InputJsonValue;
  }) {
    return runPrescriptionInventoryAction({
      organisationId: params.organisationId,
      prescriptionId: params.prescriptionId,
      medications: params.medications,
      metadata: params.metadata,
      action: "RELEASE",
      movementReason: "PRESCRIPTION_RETURN",
    });
  },

  async voidDispensePrescription(params: {
    organisationId: string;
    prescriptionId: string;
    medications: unknown;
    metadata?: Prisma.InputJsonValue;
  }) {
    return runPrescriptionInventoryAction({
      organisationId: params.organisationId,
      prescriptionId: params.prescriptionId,
      medications: params.medications,
      metadata: {
        voided: true,
        originalMetadata: params.metadata ?? null,
      } as Prisma.InputJsonValue,
      action: "RELEASE",
      movementReason: "PRESCRIPTION_VOID_DISPENSE",
    });
  },

  async consumePackageProduct(params: {
    organisationId: string;
    packageProductItemId: string;
    sourceId: string;
    quantity?: number;
    metadata?: Prisma.InputJsonValue;
  }) {
    const organisationId = asNonEmptyString(params.organisationId);
    const packageProductItemId = asNonEmptyString(params.packageProductItemId);
    const sourceId = asNonEmptyString(params.sourceId);
    if (!organisationId || !packageProductItemId || !sourceId) {
      throw new InventoryConsumptionServiceError(
        "organisationId, packageProductItemId and sourceId are required",
        400,
      );
    }

    const quantity = ensureQuantity(params.quantity ?? 1);
    const product = await prisma.productItem.findFirst({
      where: {
        id: packageProductItemId,
        organisationId,
        kind: "PACKAGE",
      },
      include: {
        package: {
          include: {
            items: {
              orderBy: [{ sortOrder: "asc" }],
            },
          },
        },
      },
    });
    if (!product || !product.package) {
      throw new InventoryConsumptionServiceError(
        "Package product not found",
        404,
      );
    }

    const lines: InventoryConsumptionLineInput[] = [];
    for (const item of product.package.items) {
      const rule = await resolveInventoryItemFromRule(
        prisma,
        organisationId,
        "PACKAGE",
        item.childProductItemId,
      );
      if (!rule) {
        throw new InventoryConsumptionServiceError(
          `Missing inventory mapping for package component ${item.childProductItemId}.`,
          400,
        );
      }
      lines.push({
        sourceLineKey: item.childProductItemId,
        inventoryItemId: rule.inventoryItemId,
        quantity: Math.max(
          1,
          Math.round(quantity * item.quantity * rule.quantityMultiplier),
        ),
      });
    }

    return this.consume({
      organisationId,
      sourceType: "PACKAGE",
      sourceId,
      action: "CONSUME",
      metadata: params.metadata,
      lines,
    });
  },

  async consumeProcedureProduct(params: {
    organisationId: string;
    procedureProductItemId: string;
    sourceId: string;
    quantity?: number;
    metadata?: Prisma.InputJsonValue;
  }) {
    const organisationId = asNonEmptyString(params.organisationId);
    const procedureProductItemId = asNonEmptyString(
      params.procedureProductItemId,
    );
    const sourceId = asNonEmptyString(params.sourceId);
    if (!organisationId || !procedureProductItemId || !sourceId) {
      throw new InventoryConsumptionServiceError(
        "organisationId, procedureProductItemId and sourceId are required",
        400,
      );
    }

    const quantity = ensureQuantity(params.quantity ?? 1);
    const ruleRows = await prisma.inventoryConsumptionRule.findMany({
      where: {
        organisationId,
        sourceType: "PROCEDURE",
        sourceKey: normalizeKey(procedureProductItemId),
        active: true,
      },
    });

    if (!ruleRows.length) {
      throw new InventoryConsumptionServiceError(
        `Missing inventory mapping for procedure ${procedureProductItemId}.`,
        400,
      );
    }

    const lines = ruleRows.map<InventoryConsumptionLineInput>((rule) => ({
      sourceLineKey: procedureProductItemId,
      inventoryItemId: rule.inventoryItemId,
      quantity: Math.max(1, Math.round(quantity * rule.quantityMultiplier)),
    }));

    return this.consume({
      organisationId,
      sourceType: "PROCEDURE",
      sourceId,
      action: "CONSUME",
      metadata: params.metadata,
      lines,
    });
  },
};
