import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";
import { assertPatientOrgMembership } from "./shared/patient-org-membership";

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
  "DRAFT" | "SENT" | "APPROVED" | "DECLINED" | "EXPIRED" | "CONVERTED";

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

    // The caller is authenticated against this organisation, but the patient id
    // arrives from the request. Without this the row would be written against
    // another tenant's companion, invisible to every view that scopes by org.
    await assertPatientOrgMembership(patientId, organisationId, () => {
      throw new EstimateError("Companion not found.", 404);
    });
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

  /**
   * Turn an approved estimate into an invoice.
   *
   * This is the only method here that creates money in a second table, so it does
   * not follow the read-then-write shape the rest of the file uses. That shape is
   * safe when the only durable effect is one row's status; here it would mint two
   * invoices for one estimate under a double-click, because both requests read
   * `convertedToInvoiceId` as null before either wrote.
   *
   * Instead the estimate is *claimed* with a conditional `updateMany`: the
   * transition guard and the idempotency guard live in the WHERE clause, so
   * Postgres re-evaluates them against the committed row version and the loser of
   * a race matches nothing. `update({ where: { id } })` has no predicate to
   * re-check and is last-write-wins. Both statements run in one interactive
   * transaction, and the claim failing throws inside it, so a losing request
   * cannot leave an orphan invoice behind.
   */
  async convert(id: string, organisationId: string, convertedBy: string) {
    const existing = await assertEstimate(id, organisationId);

    // Replay rather than fail. If the response to a successful conversion was
    // lost - a proxy timeout, a dropped connection - a 409 here would tell the
    // user it failed, and the usual next step is to raise the invoice by hand.
    // That produces a duplicate that looks like an operator error rather than a
    // bug. Returning the already-converted estimate is the same outcome the
    // caller asked for.
    if (existing.convertedToInvoiceId) {
      const invoice = await prisma.invoice.findFirst({
        // Org-scoped: convertedToInvoiceId has no foreign key, so it is not
        // safe to assume the id it holds belongs to this tenant.
        where: { id: existing.convertedToInvoiceId, organisationId },
        select: { id: true },
      });
      if (invoice) {
        return existing;
      }
    }

    if (existing.status !== "APPROVED") {
      throw new EstimateError("Only APPROVED estimates can be converted.", 409);
    }

    if (existing.items.length === 0) {
      throw new EstimateError("Cannot convert an estimate with no items.", 409);
    }

    // The invoice must bill exactly what the client approved, so the totals are
    // copied rather than recomputed. Recomputing would let a later change to the
    // pricing rules silently move an agreed figure.
    //
    // `EstimateItem.lineTotal` is tax-exclusive, so these lines sum to
    // `subtotal`, not `total`. `Invoice` carries a single `taxPercent` while an
    // estimate taxes per line, so the blended rate is derived from the totals
    // and rounded to two places; the authoritative figure is `taxTotal`.
    const items = existing.items.map((item) => ({
      // Deliberately no `id`. The invoice line `id` is matched against
      // `WorkspaceTreatmentItem.invoiceRowId` when settling treatment items, so
      // copying the EstimateItem id here could mark an unrelated treatment row
      // settled.
      name: item.description,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.lineTotal,
    }));

    const taxPercent =
      existing.subtotal > 0
        ? Math.round((existing.taxAmount / existing.subtotal) * 10000) / 100
        : 0;

    const estimate = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          organisationId,
          patientId: existing.patientId,
          // No appointmentId: an estimate hangs off an encounter, and Invoice
          // has a unique on appointmentId that the appointment's own draft
          // invoice already owns.
          //
          // No parentId either: Estimate has no parent link, and the only way to
          // derive one is ParentPatient, which carries no organisationId - so
          // resolving it here could address the invoice to another tenant's
          // parent. The consequence is that a converted invoice does not yet
          // reach a pet parent's expense feed; see the PR description.
          estimateId: existing.id,
          items,
          subtotal: existing.subtotal,
          taxTotal: existing.taxAmount,
          taxPercent,
          totalAmount: existing.total,
          currency: existing.currency,
          metadata: {
            estimateId: existing.id,
            ...(existing.encounterId
              ? { encounterId: existing.encounterId }
              : {}),
            ...(existing.notes ? { notes: existing.notes } : {}),
          },
        },
        select: { id: true },
      });

      const claimed = await tx.estimate.updateMany({
        where: {
          id,
          organisationId,
          status: "APPROVED",
          convertedToInvoiceId: null,
        },
        data: { status: "CONVERTED", convertedToInvoiceId: invoice.id },
      });

      // Losing the race means another request already converted this estimate.
      // Throwing rolls the invoice back with it, so the winner's invoice is the
      // only one that exists.
      if (claimed.count !== 1) {
        throw new EstimateError("Estimate has already been converted.", 409);
      }

      return tx.estimate.findFirstOrThrow({
        where: { id },
        select: estimateSelect,
      });
    });

    // Outside the transaction, matching every other method here. recordSafely
    // closes over the module-level client, so calling it with the transaction
    // open would run on a different connection and could block on the row this
    // transaction still holds.
    await AuditTrailService.recordSafely({
      organisationId,
      patientId: estimate.patientId,
      eventType: "ESTIMATE_CONVERTED",
      actorType: "PMS_USER",
      actorId: convertedBy,
      entityType: "COMPANION",
      entityId: id,
      metadata: {
        invoiceId: estimate.convertedToInvoiceId ?? "",
        total: estimate.total,
      },
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
