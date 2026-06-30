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
  countedBy?: string;
  countedAt: Date;
  systemCount: number;
  physicalCount: number;
  notes?: string;
}

const countSelect = {
  id: true,
  organisationId: true,
  inventoryItemId: true,
  countedBy: true,
  countedAt: true,
  systemCount: true,
  physicalCount: true,
  discrepancy: true,
  notes: true,
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

export const InventoryCountService = {
  async record(params: CreateCountParams) {
    const discrepancy = params.physicalCount - params.systemCount;

    const count = await prisma.inventoryCount.create({
      data: {
        organisationId: params.organisationId,
        inventoryItemId: params.inventoryItemId,
        countedBy: params.countedBy ?? null,
        countedAt: params.countedAt,
        systemCount: params.systemCount,
        physicalCount: params.physicalCount,
        discrepancy,
        notes: params.notes ?? null,
        reconciled: discrepancy === 0,
        reconciledAt: discrepancy === 0 ? new Date() : null,
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
    reconciled?: boolean;
    fromDate?: Date;
    toDate?: Date;
  }) {
    const { organisationId, inventoryItemId, reconciled, fromDate, toDate } =
      params;
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
    notes?: string,
  ) {
    const existing = await assertCount(id, organisationId);
    if (existing.reconciled) {
      throw new InventoryCountError(
        "Inventory count is already reconciled.",
        409,
      );
    }

    const count = await prisma.inventoryCount.update({
      where: { id },
      data: {
        reconciled: true,
        reconciledAt: new Date(),
        reconciledBy,
        ...(notes ? { notes } : {}),
      },
      select: countSelect,
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
        discrepancy: existing.discrepancy,
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
