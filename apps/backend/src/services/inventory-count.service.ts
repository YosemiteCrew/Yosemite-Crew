import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class InventoryCountError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "InventoryCountError";
  }
}

export interface CreateCountParams {
  organisationId: string;
  inventoryItemId: string;
  inventoryBatchId?: string;
  countedBy?: string;
  countedAt: Date;
  systemCount?: number;
  physicalCount: number;
  notes?: string;
}

export type InventoryCountResolution = "STOCK_ADJUSTED" | "NO_CHANGE";

const countSelect = {
  id: true,
  organisationId: true,
  inventoryItemId: true,
  inventoryBatchId: true,
  countedBy: true,
  countedAt: true,
  systemCount: true,
  physicalCount: true,
  discrepancy: true,
  notes: true,
  resolution: true,
  resolutionNotes: true,
  reconciled: true,
  reconciledAt: true,
  reconciledBy: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.InventoryCountSelect;

const assertCount = async (id: string, organisationId: string) => {
  const record = await prisma.inventoryCount.findFirst({
    where: { id, organisationId },
    select: countSelect,
  });
  if (!record)
    throw new InventoryCountError("Inventory count record not found.", 404);
  return record;
};

const EXPIRED_BATCH_MESSAGE = "This batch has expired and cannot be counted.";

// Expired stock leaves through a write-off, not a count: an adjustment would put
// expired units back into what dispensing draws from. Answered as not found, the
// same as a batch from another organisation.
const assertBatchNotExpired = (expiryDate: Date | null) => {
  if (expiryDate && expiryDate.getTime() <= Date.now()) {
    throw new InventoryCountError(EXPIRED_BATCH_MESSAGE, 404);
  }
};

export const InventoryCountService = {
  async record(params: CreateCountParams) {
    const item = await prisma.inventoryItem.findFirst({
      where: {
        id: params.inventoryItemId,
        organisationId: params.organisationId,
      },
      select: { id: true },
    });
    if (!item) throw new InventoryCountError("Inventory item not found.", 404);

    const batch = params.inventoryBatchId
      ? await prisma.inventoryBatch.findFirst({
          where: {
            id: params.inventoryBatchId,
            itemId: params.inventoryItemId,
            organisationId: params.organisationId,
          },
          select: { id: true, quantity: true, expiryDate: true },
        })
      : null;
    if (params.inventoryBatchId && !batch) {
      throw new InventoryCountError("Inventory batch not found.", 404);
    }
    if (batch) assertBatchNotExpired(batch.expiryDate);

    const systemCount = batch?.quantity ?? params.systemCount;
    if (systemCount === undefined) {
      throw new InventoryCountError("A batch is required for this count.", 400);
    }
    const discrepancy = params.physicalCount - systemCount;

    const count = await prisma.inventoryCount.create({
      data: {
        organisationId: params.organisationId,
        inventoryItemId: params.inventoryItemId,
        inventoryBatchId: batch?.id ?? null,
        countedBy: params.countedBy ?? null,
        countedAt: params.countedAt,
        systemCount,
        physicalCount: params.physicalCount,
        discrepancy,
        notes: params.notes ?? null,
        reconciled: discrepancy === 0,
        reconciledAt: discrepancy === 0 ? new Date() : null,
        resolution: discrepancy === 0 ? "NO_CHANGE" : null,
      },
      select: countSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId: params.organisationId,
      patientId: "",
      eventType: "INVENTORY_COUNT_RECORDED",
      actorType: "PMS_USER",
      actorId: params.countedBy ?? null,
      entityType: "COMPANION",
      entityId: params.inventoryItemId,
      metadata: {
        countId: count.id,
        inventoryItemId: params.inventoryItemId,
        inventoryBatchId: batch?.id ?? null,
        discrepancy,
        hasDiscrepancy: discrepancy !== 0,
      },
    });

    return count;
  },

  async get(id: string, organisationId: string) {
    return assertCount(id, organisationId);
  },

  async list(params: {
    organisationId: string;
    inventoryItemId?: string;
    inventoryBatchId?: string;
    reconciled?: boolean;
    fromDate?: Date;
    toDate?: Date;
  }) {
    const {
      organisationId,
      inventoryItemId,
      inventoryBatchId,
      reconciled,
      fromDate,
      toDate,
    } = params;
    let dateFilter = {};
    if (fromDate || toDate) {
      dateFilter = {
        countedAt: {
          ...(fromDate ? { gte: fromDate } : {}),
          ...(toDate ? { lte: toDate } : {}),
        },
      };
    }

    return prisma.inventoryCount.findMany({
      where: {
        organisationId,
        ...(inventoryItemId ? { inventoryItemId } : {}),
        ...(inventoryBatchId ? { inventoryBatchId } : {}),
        ...(reconciled !== undefined ? { reconciled } : {}),
        ...dateFilter,
      },
      select: countSelect,
      orderBy: { countedAt: "desc" },
    });
  },

  async reconcile(
    id: string,
    organisationId: string,
    reconciledBy: string,
    resolution: InventoryCountResolution,
    resolutionNotes?: string,
  ) {
    const reason = resolutionNotes?.trim();
    if (resolution === "NO_CHANGE" && !reason) {
      throw new InventoryCountError(
        "Explain why the counted stock was left unchanged.",
        400,
      );
    }

    const { existing, count } = await prisma.$transaction(async (tx) => {
      const existing = await tx.inventoryCount.findFirst({
        where: { id, organisationId },
        select: countSelect,
      });
      if (!existing) {
        throw new InventoryCountError("Inventory count record not found.", 404);
      }
      if (existing.reconciled) {
        throw new InventoryCountError(
          "Inventory count is already reconciled.",
          409,
        );
      }

      if (resolution === "STOCK_ADJUSTED") {
        if (!existing.inventoryBatchId) {
          throw new InventoryCountError(
            "Stock adjustments require a batch count.",
            400,
          );
        }
        const batch = await tx.inventoryBatch.findFirst({
          where: {
            id: existing.inventoryBatchId,
            itemId: existing.inventoryItemId,
            organisationId,
          },
          select: {
            id: true,
            quantity: true,
            allocated: true,
            expiryDate: true,
          },
        });
        if (!batch) {
          throw new InventoryCountError("Inventory batch not found.", 404);
        }
        assertBatchNotExpired(batch.expiryDate);
        if (batch.quantity !== existing.systemCount) {
          throw new InventoryCountError(
            "Stock changed after this count was recorded. Record a new count.",
            409,
          );
        }
        if (existing.physicalCount < batch.allocated) {
          throw new InventoryCountError(
            "The count is below stock already allocated for use.",
            409,
          );
        }

        const updatedBatchCount = await tx.$executeRaw`
          UPDATE "InventoryBatch"
          SET "quantity" = ${existing.physicalCount}, "updatedAt" = ${new Date()}
          WHERE "id" = ${batch.id}
            AND "organisationId" = ${organisationId}
            AND "quantity" = ${existing.systemCount}
            AND "allocated" <= ${existing.physicalCount}
        `;
        if (updatedBatchCount !== 1) {
          throw new InventoryCountError(
            "Stock changed after this count was recorded. Record a new count.",
            409,
          );
        }

        // Lock the item row before summing its batches. The batch row is
        // already locked above, so this keeps the batch-then-item order the
        // dispense path uses, and a dispense on another batch of this item that
        // commits while we wait is included in the sum instead of overwritten.
        const [lockedItem] = await tx.$queryRaw<{ allocated: number }[]>`
          SELECT "allocated" FROM "InventoryItem"
          WHERE "id" = ${existing.inventoryItemId}
            AND "organisationId" = ${organisationId}
          FOR UPDATE
        `;
        if (!lockedItem) {
          throw new InventoryCountError("Inventory item not found.", 404);
        }
        const totals = await tx.inventoryBatch.aggregate({
          where: {
            itemId: existing.inventoryItemId,
            organisationId,
          },
          _sum: { quantity: true },
        });
        const onHand = totals._sum.quantity ?? 0;
        if (onHand < lockedItem.allocated) {
          throw new InventoryCountError(
            "The count is below stock already allocated for use.",
            409,
          );
        }
        await tx.inventoryItem.update({
          where: { id: existing.inventoryItemId },
          data: { onHand },
        });
        await tx.inventoryStockMovement.create({
          data: {
            itemId: existing.inventoryItemId,
            batchId: batch.id,
            change: existing.discrepancy,
            reason: "INVENTORY_COUNT_ADJUSTMENT",
            userId: reconciledBy,
            referenceId: id,
          },
        });
      }

      const reconciledAt = new Date();
      const updatedCount = await tx.$executeRaw`
        UPDATE "InventoryCount"
        SET "reconciled" = true,
            "reconciledAt" = ${reconciledAt},
            "reconciledBy" = ${reconciledBy},
            "resolution" = ${resolution}::"InventoryCountResolution",
            "resolutionNotes" = ${reason ?? null},
            "updatedAt" = ${reconciledAt}
        WHERE "id" = ${id}
          AND "organisationId" = ${organisationId}
          AND "reconciled" = false
      `;
      if (updatedCount !== 1) {
        throw new InventoryCountError(
          "Inventory count is already reconciled.",
          409,
        );
      }
      const count = await tx.inventoryCount.findFirst({
        where: { id, organisationId },
        select: countSelect,
      });
      if (!count) {
        throw new InventoryCountError("Inventory count record not found.", 404);
      }
      return { existing, count };
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: "",
      eventType: "INVENTORY_DISCREPANCY_RECONCILED",
      actorType: "PMS_USER",
      actorId: reconciledBy,
      entityType: "COMPANION",
      entityId: existing.inventoryItemId,
      metadata: {
        countId: id,
        inventoryItemId: existing.inventoryItemId,
        inventoryBatchId: existing.inventoryBatchId,
        discrepancy: existing.discrepancy,
        resolution,
        resolutionNotes: reason ?? null,
      },
    });

    return count;
  },

  async unreconciled(organisationId: string) {
    return prisma.inventoryCount.findMany({
      where: { organisationId, reconciled: false },
      select: countSelect,
      orderBy: { countedAt: "desc" },
    });
  },
};
