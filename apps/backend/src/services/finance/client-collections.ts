import { InvoiceStatus as PrismaInvoiceStatus } from "@prisma/client";
import moment from "moment-timezone";
import { prisma } from "src/config/prisma";
import { getInvoiceFinancialSummaries } from "src/services/finance/payment";
import { CLOSED_INVOICE_STATUSES } from "src/services/finance/provider-receipt";
import { extractTimezoneFromPersonalDetails } from "src/utils/scheduling";

const CLOSED_STATUSES = [...CLOSED_INVOICE_STATUSES] as PrismaInvoiceStatus[];
const DEFAULT_TIME_ZONE = "UTC";

export class ClientCollectionsError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "ClientCollectionsError";
  }
}

/**
 * The practice's time zone: the one saved on its earliest staff profile, the
 * same source scheduling reads. Anything that is not a known IANA zone falls
 * back to UTC, as the migration that backfilled `dueAt` does.
 */
export const resolvePracticeTimeZone = async (
  organisationId: string,
): Promise<string> => {
  const profile = await prisma.userProfile.findFirst({
    where: { organizationId: organisationId },
    orderBy: { createdAt: "asc" },
    select: { personalDetails: true },
  });
  const timeZone = extractTimezoneFromPersonalDetails(profile?.personalDetails);
  return timeZone && moment.tz.zone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;
};

/**
 * Payment is due by the end of the practice's day `netDays` calendar days
 * after finalization, so the invoice becomes overdue at the practice's next
 * midnight. Counting calendar days in the zone keeps a daylight saving change
 * from moving the due date.
 */
export const calculateInvoiceDueAt = (
  finalizedAt: Date,
  netDays: number,
  timeZone: string,
) =>
  moment
    .tz(finalizedAt, timeZone)
    .startOf("day")
    .add(netDays + 1, "days")
    .subtract(1, "millisecond")
    .toDate();

const toPracticeDate = (instant: Date, timeZone: string) =>
  moment.tz(instant, timeZone).format("YYYY-MM-DD");

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

  /**
   * One row per overdue invoice, each in its own currency. Balances are never
   * added together here: a client can owe in more than one currency.
   */
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
    if (invoices.length === 0) return [];

    const parentIds = [
      ...new Set(invoices.flatMap((invoice) => invoice.parentId ?? [])),
    ];
    const [summaries, terms, timeZone] = await Promise.all([
      getInvoiceFinancialSummaries(invoices),
      prisma.clientPaymentTerm.findMany({
        where: { organisationId, parentId: { in: parentIds } },
        select: { parentId: true, netDays: true },
      }),
      resolvePracticeTimeZone(organisationId),
    ]);
    const netDaysByParent = new Map(
      terms.map((term) => [term.parentId, term.netDays]),
    );

    return invoices.flatMap((invoice) => {
      const balance = summaries.get(invoice.id)?.balance ?? 0;
      if (balance <= 0 || !invoice.dueAt || !invoice.parentId) return [];
      return [
        {
          invoiceId: invoice.id,
          parentId: invoice.parentId,
          dueAt: invoice.dueAt,
          dueDate: toPracticeDate(invoice.dueAt, timeZone),
          currency: invoice.currency,
          balance,
          netDays: netDaysByParent.get(invoice.parentId) ?? 0,
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
        currency: true,
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
