import { InvoiceStatus as PrismaInvoiceStatus } from "@prisma/client";
import { prisma } from "src/config/prisma";
import { getInvoiceFinancialSummaries } from "src/services/finance/payment";
import { CLOSED_INVOICE_STATUSES } from "src/services/finance/provider-receipt";

const CLOSED_STATUSES = [...CLOSED_INVOICE_STATUSES] as PrismaInvoiceStatus[];

export class ClientCollectionsError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "ClientCollectionsError";
  }
}

export const calculateInvoiceDueAt = (finalizedAt: Date, netDays: number) =>
  new Date(finalizedAt.getTime() + netDays * 24 * 60 * 60 * 1000);

const assertNetDays = (netDays: number) => {
  if (!Number.isInteger(netDays) || netDays < 0 || netDays > 365) {
    throw new ClientCollectionsError(
      "Payment terms must be between 0 and 365 days.",
      400,
    );
  }
};

const assertClientAccount = async (
  organisationId: string,
  parentId: string,
) => {
  const invoice = await prisma.invoice.findFirst({
    where: { organisationId, parentId },
    select: { id: true },
  });
  if (!invoice) {
    throw new ClientCollectionsError("Client account not found.", 404);
  }
};

export const ClientCollectionsService = {
  async getPaymentTerms(organisationId: string, parentId: string) {
    await assertClientAccount(organisationId, parentId);
    const terms = await prisma.clientPaymentTerm.findUnique({
      where: { organisationId_parentId: { organisationId, parentId } },
      select: { netDays: true, updatedAt: true, updatedBy: true },
    });
    return terms ?? { netDays: 0, updatedAt: null, updatedBy: null };
  },

  async setPaymentTerms(input: {
    organisationId: string;
    parentId: string;
    netDays: number;
    updatedBy: string;
  }) {
    assertNetDays(input.netDays);
    await assertClientAccount(input.organisationId, input.parentId);
    return prisma.clientPaymentTerm.upsert({
      where: {
        organisationId_parentId: {
          organisationId: input.organisationId,
          parentId: input.parentId,
        },
      },
      create: {
        organisationId: input.organisationId,
        parentId: input.parentId,
        netDays: input.netDays,
        updatedBy: input.updatedBy,
      },
      update: { netDays: input.netDays, updatedBy: input.updatedBy },
      select: { netDays: true, updatedAt: true, updatedBy: true },
    });
  },

  async listOverdue(organisationId: string, now = new Date()) {
    const invoices = await prisma.invoice.findMany({
      where: {
        organisationId,
        parentId: { not: null },
        dueAt: { lt: now },
        status: { notIn: CLOSED_STATUSES },
      },
      select: {
        id: true,
        parentId: true,
        dueAt: true,
        currency: true,
        totalAmount: true,
        depositCollectedAmount: true,
        collectionsReviewedAt: true,
        collectionsReviewedBy: true,
      },
      orderBy: [{ dueAt: "asc" }, { id: "asc" }],
    });
    const summaries = await getInvoiceFinancialSummaries(invoices);

    return invoices.flatMap((invoice) => {
      const balance = summaries.get(invoice.id)?.balance ?? 0;
      if (balance <= 0 || !invoice.dueAt || !invoice.parentId) return [];
      return [
        {
          invoiceId: invoice.id,
          parentId: invoice.parentId,
          dueAt: invoice.dueAt,
          currency: invoice.currency,
          balance,
          reviewedAt: invoice.collectionsReviewedAt,
          reviewedBy: invoice.collectionsReviewedBy,
        },
      ];
    });
  },

  async markReviewed(input: {
    organisationId: string;
    invoiceId: string;
    reviewedBy: string;
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: input.invoiceId,
        organisationId: input.organisationId,
        parentId: { not: null },
        dueAt: { lt: now },
        status: { notIn: CLOSED_STATUSES },
      },
      select: {
        id: true,
        totalAmount: true,
        depositCollectedAmount: true,
      },
    });
    if (!invoice) {
      throw new ClientCollectionsError("Overdue invoice not found.", 404);
    }

    const summary = await getInvoiceFinancialSummaries([invoice]);
    if ((summary.get(invoice.id)?.balance ?? 0) <= 0) {
      throw new ClientCollectionsError("Invoice is no longer overdue.", 409);
    }

    return prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        collectionsReviewedAt: now,
        collectionsReviewedBy: input.reviewedBy,
      },
      select: {
        id: true,
        collectionsReviewedAt: true,
        collectionsReviewedBy: true,
      },
    });
  },
};
