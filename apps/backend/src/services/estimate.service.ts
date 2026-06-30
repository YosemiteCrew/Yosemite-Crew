import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class EstimateError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "EstimateError";
  }
}

type EstimateStatus =
  | "DRAFT"
  | "SENT"
  | "APPROVED"
  | "DECLINED"
  | "EXPIRED"
  | "CONVERTED";

export interface EstimateItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  notes?: string;
}

export interface CreateEstimateParams {
  organisationId: string;
  patientId: string;
  encounterId?: string;
  validUntil?: Date;
  currency?: string;
  notes?: string;
  items: EstimateItemInput[];
  createdBy?: string;
}

export interface UpdateEstimateParams {
  validUntil?: Date;
  currency?: string;
  notes?: string;
  items?: EstimateItemInput[];
}

export interface ListEstimateParams {
  organisationId: string;
  patientId?: string;
  status?: EstimateStatus;
}

const computeTotals = (items: EstimateItemInput[]) => {
  let subtotal = 0;
  let taxAmount = 0;
  for (const item of items) {
    const lineTotal = item.quantity * item.unitPrice;
    const lineTax = lineTotal * ((item.taxRate ?? 0) / 100);
    subtotal += lineTotal;
    taxAmount += lineTax;
  }
  return { subtotal, taxAmount, total: subtotal + taxAmount };
};

const estimateSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  encounterId: true,
  status: true,
  validUntil: true,
  subtotal: true,
  taxAmount: true,
  total: true,
  currency: true,
  notes: true,
  approvedBy: true,
  approvedAt: true,
  declinedAt: true,
  declineReason: true,
  convertedToInvoiceId: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
  items: {
    select: {
      id: true,
      description: true,
      quantity: true,
      unitPrice: true,
      taxRate: true,
      lineTotal: true,
      notes: true,
    },
  },
} satisfies Prisma.EstimateSelect;

const assertEstimate = async (id: string, organisationId: string) => {
  const estimate = await prisma.estimate.findFirst({
    where: { id, organisationId },
    select: estimateSelect,
  });
  if (!estimate) {
    throw new EstimateError("Estimate not found.", 404);
  }
  return estimate;
};

export const EstimateService = {
  async create(params: CreateEstimateParams) {
    const { organisationId, patientId, createdBy, items, ...rest } = params;
    const { subtotal, taxAmount, total } = computeTotals(items);

    const estimate = await prisma.estimate.create({
      data: {
        organisationId,
        patientId,
        encounterId: rest.encounterId ?? null,
        validUntil: rest.validUntil ?? null,
        currency: rest.currency ?? "GBP",
        notes: rest.notes ?? null,
        subtotal,
        taxAmount,
        total,
        createdBy: createdBy ?? null,
        items: {
          create: items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxRate: item.taxRate ?? 0,
            lineTotal: item.quantity * item.unitPrice,
            notes: item.notes ?? null,
          })),
        },
      },
      select: estimateSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "ESTIMATE_CREATED",
      actorType: "PMS_USER",
      actorId: createdBy ?? null,
      entityType: "COMPANION",
      entityId: estimate.id,
      metadata: { total, itemCount: items.length },
    });

    return estimate;
  },

  async get(id: string, organisationId: string) {
    return assertEstimate(id, organisationId);
  },

  async list(params: ListEstimateParams) {
    const { organisationId, patientId, status } = params;
    return prisma.estimate.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(status ? { status } : {}),
      },
      select: estimateSelect,
      orderBy: { createdAt: "desc" },
    });
  },

  async update(
    id: string,
    organisationId: string,
    params: UpdateEstimateParams,
  ) {
    const existing = await assertEstimate(id, organisationId);
    if (existing.status !== "DRAFT" && existing.status !== "SENT") {
      throw new EstimateError(
        "Only DRAFT or SENT estimates can be edited.",
        409,
      );
    }

    const data: Prisma.EstimateUpdateInput = {};
    if (params.validUntil !== undefined) data.validUntil = params.validUntil;
    if (params.currency !== undefined) data.currency = params.currency;
    if (params.notes !== undefined) data.notes = params.notes;

    if (params.items) {
      const { subtotal, taxAmount, total } = computeTotals(params.items);
      data.subtotal = subtotal;
      data.taxAmount = taxAmount;
      data.total = total;
      data.items = {
        deleteMany: {},
        create: params.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate ?? 0,
          lineTotal: item.quantity * item.unitPrice,
          notes: item.notes ?? null,
        })),
      };
    }

    return prisma.estimate.update({
      where: { id },
      data,
      select: estimateSelect,
    });
  },

  async approve(id: string, organisationId: string, approvedBy: string) {
    const existing = await assertEstimate(id, organisationId);
    if (existing.status !== "SENT" && existing.status !== "DRAFT") {
      throw new EstimateError(
        "Only DRAFT or SENT estimates can be approved.",
        409,
      );
    }

    const estimate = await prisma.estimate.update({
      where: { id },
      data: { status: "APPROVED", approvedBy, approvedAt: new Date() },
      select: estimateSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: estimate.patientId,
      eventType: "ESTIMATE_APPROVED",
      actorType: "PMS_USER",
      actorId: approvedBy,
      entityType: "COMPANION",
      entityId: id,
      metadata: { total: estimate.total },
    });

    return estimate;
  },

  async decline(
    id: string,
    organisationId: string,
    declinedBy: string,
    reason?: string,
  ) {
    const existing = await assertEstimate(id, organisationId);
    if (existing.status !== "SENT" && existing.status !== "DRAFT") {
      throw new EstimateError(
        "Only DRAFT or SENT estimates can be declined.",
        409,
      );
    }

    const estimate = await prisma.estimate.update({
      where: { id },
      data: {
        status: "DECLINED",
        declinedAt: new Date(),
        declineReason: reason ?? null,
      },
      select: estimateSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: estimate.patientId,
      eventType: "ESTIMATE_DECLINED",
      actorType: "PMS_USER",
      actorId: declinedBy,
      entityType: "COMPANION",
      entityId: id,
      metadata: { reason: reason ?? null },
    });

    return estimate;
  },

  async markSent(id: string, organisationId: string) {
    const existing = await assertEstimate(id, organisationId);
    if (existing.status !== "DRAFT") {
      throw new EstimateError(
        "Only DRAFT estimates can be marked as sent.",
        409,
      );
    }
    return prisma.estimate.update({
      where: { id },
      data: { status: "SENT" },
      select: estimateSelect,
    });
  },

  async delete(id: string, organisationId: string) {
    const existing = await assertEstimate(id, organisationId);
    if (existing.status !== "DRAFT") {
      throw new EstimateError("Only DRAFT estimates can be deleted.", 409);
    }
    await prisma.estimate.delete({ where: { id } });
  },
};
