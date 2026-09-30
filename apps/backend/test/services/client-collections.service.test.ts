import {
  calculateInvoiceDueAt,
  ClientCollectionsError,
  ClientCollectionsService,
  resolvePracticeTimeZone,
} from "../../src/services/finance/client-collections";
import { getInvoiceFinancialSummaries } from "src/services/finance/payment";
import { prisma } from "src/config/prisma";

jest.mock("src/config/prisma", () => ({
  prisma: {
    invoice: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    clientPaymentTerm: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    userProfile: { findFirst: jest.fn() },
  },
}));

jest.mock("src/services/finance/payment", () => ({
  getInvoiceFinancialSummaries: jest.fn(),
}));

const mockedPrisma = prisma as unknown as {
  invoice: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
  clientPaymentTerm: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
    upsert: jest.Mock;
  };
  userProfile: { findFirst: jest.Mock };
};
const mockedSummaries = getInvoiceFinancialSummaries as unknown as jest.Mock;

const ORG = "11111111-1111-4111-8111-111111111111";
const PARENT = "22222222-2222-4222-8222-222222222222";
const INVOICE = "33333333-3333-4333-8333-333333333333";
const NOW = new Date("2026-09-26T12:00:00.000Z");

const invoice = (overrides: Record<string, unknown> = {}) => ({
  id: INVOICE,
  parentId: PARENT,
  dueAt: new Date("2026-09-25T12:00:00.000Z"),
  currency: "GBP",
  totalAmount: 100,
  depositCollectedAmount: 0,
  collectionsReviewedAt: null,
  collectionsReviewedBy: null,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockedPrisma.clientPaymentTerm.findMany.mockResolvedValue([]);
  mockedPrisma.userProfile.findFirst.mockResolvedValue(null);
});

describe("calculateInvoiceDueAt", () => {
  it("is due by the end of the practice's day after the net days", () => {
    // 12:00 UTC on 26 Sep is 08:00 in New York, so the practice's day is the
    // 26th and 30 days later is 26 Oct, which ends at 04:00 UTC on the 27th.
    expect(calculateInvoiceDueAt(NOW, 30, "America/New_York")).toEqual(
      new Date("2026-10-27T03:59:59.999Z"),
    );
  });

  it("uses the practice's calendar date, not the UTC one", () => {
    // 20:00 UTC on 26 Sep is already the 27th in Sydney.
    expect(
      calculateInvoiceDueAt(
        new Date("2026-09-26T20:00:00.000Z"),
        0,
        "Australia/Sydney",
      ),
    ).toEqual(new Date("2026-09-27T13:59:59.999Z"));
  });

  it("counts calendar days across a daylight saving change", () => {
    // London leaves summer time on 25 Oct 2026; the due day still ends at
    // local midnight, now UTC+0.
    expect(
      calculateInvoiceDueAt(
        new Date("2026-10-20T09:00:00.000Z"),
        10,
        "Europe/London",
      ),
    ).toEqual(new Date("2026-10-30T23:59:59.999Z"));
  });

  it("leaves due-on-receipt invoices due by the end of the finalizing day", () => {
    expect(calculateInvoiceDueAt(NOW, 0, "UTC")).toEqual(
      new Date("2026-09-26T23:59:59.999Z"),
    );
  });
});

describe("resolvePracticeTimeZone", () => {
  it("reads the zone saved on the practice's earliest staff profile", async () => {
    mockedPrisma.userProfile.findFirst.mockResolvedValue({
      personalDetails: { timezone: "Asia/Kuwait" },
    });

    await expect(resolvePracticeTimeZone(ORG)).resolves.toBe("Asia/Kuwait");
    expect(mockedPrisma.userProfile.findFirst).toHaveBeenCalledWith({
      where: { organizationId: ORG },
      orderBy: { createdAt: "asc" },
      select: { personalDetails: true },
    });
  });

  it.each([
    ["no profile", null],
    ["no saved zone", { personalDetails: {} }],
    ["an unknown zone", { personalDetails: { timezone: "Mars/Olympus" } }],
  ])("falls back to UTC with %s", async (_label, profile) => {
    mockedPrisma.userProfile.findFirst.mockResolvedValue(profile);

    await expect(resolvePracticeTimeZone(ORG)).resolves.toBe("UTC");
  });
});

describe("getPaymentTerms", () => {
  it("returns default terms for an existing client account", async () => {
    mockedPrisma.invoice.findFirst.mockResolvedValue({ id: INVOICE });
    mockedPrisma.clientPaymentTerm.findUnique.mockResolvedValue(null);

    await expect(
      ClientCollectionsService.getPaymentTerms(ORG, PARENT),
    ).resolves.toEqual({ netDays: 0, updatedAt: null, updatedBy: null });
  });

  it("returns configured terms", async () => {
    const terms = { netDays: 30, updatedAt: NOW, updatedBy: "staff-1" };
    mockedPrisma.invoice.findFirst.mockResolvedValue({ id: INVOICE });
    mockedPrisma.clientPaymentTerm.findUnique.mockResolvedValue(terms);

    await expect(
      ClientCollectionsService.getPaymentTerms(ORG, PARENT),
    ).resolves.toEqual(terms);
    expect(mockedPrisma.clientPaymentTerm.findUnique).toHaveBeenCalledWith({
      where: {
        organisationId_parentId: { organisationId: ORG, parentId: PARENT },
      },
      select: { netDays: true, updatedAt: true, updatedBy: true },
    });
  });

  it("does not expose terms for a client without an account in the practice", async () => {
    mockedPrisma.invoice.findFirst.mockResolvedValue(null);

    await expect(
      ClientCollectionsService.getPaymentTerms(ORG, PARENT),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mockedPrisma.clientPaymentTerm.findUnique).not.toHaveBeenCalled();
  });
});

describe("setPaymentTerms", () => {
  it("stores practice-scoped terms and the verified editor", async () => {
    mockedPrisma.invoice.findFirst.mockResolvedValue({ id: INVOICE });
    const terms = { netDays: 14, updatedAt: NOW, updatedBy: "staff-1" };
    mockedPrisma.clientPaymentTerm.upsert.mockResolvedValue(terms);

    await expect(
      ClientCollectionsService.setPaymentTerms({
        organisationId: ORG,
        parentId: PARENT,
        netDays: 14,
        updatedBy: "staff-1",
      }),
    ).resolves.toEqual(terms);
    expect(mockedPrisma.clientPaymentTerm.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organisationId_parentId: { organisationId: ORG, parentId: PARENT },
        },
        create: expect.objectContaining({ netDays: 14, updatedBy: "staff-1" }),
        update: { netDays: 14, updatedBy: "staff-1" },
      }),
    );
  });

  it.each([-1, 366, 1.5, Number.NaN])(
    "rejects invalid term length %s",
    async (netDays) => {
      await expect(
        ClientCollectionsService.setPaymentTerms({
          organisationId: ORG,
          parentId: PARENT,
          netDays,
          updatedBy: "staff-1",
        }),
      ).rejects.toBeInstanceOf(ClientCollectionsError);
      expect(mockedPrisma.invoice.findFirst).not.toHaveBeenCalled();
    },
  );

  it("refuses to configure a client without an account in this practice", async () => {
    mockedPrisma.invoice.findFirst.mockResolvedValue(null);

    await expect(
      ClientCollectionsService.setPaymentTerms({
        organisationId: ORG,
        parentId: PARENT,
        netDays: 30,
        updatedBy: "staff-1",
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mockedPrisma.clientPaymentTerm.upsert).not.toHaveBeenCalled();
  });
});

describe("listOverdue", () => {
  it("returns overdue invoices with a positive derived balance and review state", async () => {
    const due = invoice({
      collectionsReviewedAt: NOW,
      collectionsReviewedBy: "staff-1",
    });
    const paid = invoice({ id: "paid-invoice" });
    mockedPrisma.invoice.findMany.mockResolvedValue([due, paid]);
    mockedPrisma.clientPaymentTerm.findMany.mockResolvedValue([
      { parentId: PARENT, netDays: 14 },
    ]);
    mockedPrisma.userProfile.findFirst.mockResolvedValue({
      personalDetails: { timezone: "Pacific/Auckland" },
    });
    mockedSummaries.mockResolvedValue(
      new Map([
        [INVOICE, { balance: 42 }],
        ["paid-invoice", { balance: 0 }],
      ]),
    );

    await expect(
      ClientCollectionsService.listOverdue(ORG, NOW),
    ).resolves.toEqual([
      {
        invoiceId: INVOICE,
        parentId: PARENT,
        dueAt: due.dueAt,
        // 12:00 UTC on 25 Sep is already the 26th in Auckland.
        dueDate: "2026-09-26",
        currency: "GBP",
        balance: 42,
        netDays: 14,
        reviewedAt: NOW,
        reviewedBy: "staff-1",
      },
    ]);
    expect(mockedPrisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organisationId: ORG,
          dueAt: { lt: NOW },
          parentId: { not: null },
        }),
        orderBy: [{ dueAt: "asc" }, { id: "asc" }],
      }),
    );
    expect(mockedPrisma.clientPaymentTerm.findMany).toHaveBeenCalledWith({
      where: { organisationId: ORG, parentId: { in: [PARENT] } },
      select: { parentId: true, netDays: true },
    });
  });

  it("keeps each invoice in its own currency and precision", async () => {
    mockedPrisma.invoice.findMany.mockResolvedValue([
      invoice({ id: "kwd", currency: "KWD" }),
      invoice({ id: "gbp", currency: "GBP" }),
    ]);
    mockedSummaries.mockResolvedValue(
      new Map([
        ["kwd", { balance: 1.235 }],
        ["gbp", { balance: 2.5 }],
      ]),
    );

    const rows = await ClientCollectionsService.listOverdue(ORG, NOW);

    expect(
      rows.map(({ currency, balance, netDays }) => [
        currency,
        balance,
        netDays,
      ]),
    ).toEqual([
      ["KWD", 1.235, 0],
      ["GBP", 2.5, 0],
    ]);
    expect(mockedSummaries).toHaveBeenCalledWith([
      expect.objectContaining({ id: "kwd", currency: "KWD" }),
      expect.objectContaining({ id: "gbp", currency: "GBP" }),
    ]);
  });

  it("returns an empty list without loading summaries when no invoices are overdue", async () => {
    mockedPrisma.invoice.findMany.mockResolvedValue([]);

    await expect(
      ClientCollectionsService.listOverdue(ORG, NOW),
    ).resolves.toEqual([]);
    expect(mockedSummaries).not.toHaveBeenCalled();
    expect(mockedPrisma.clientPaymentTerm.findMany).not.toHaveBeenCalled();
  });

  it("ignores malformed rows without a client or due date", async () => {
    mockedPrisma.invoice.findMany.mockResolvedValue([
      invoice({ parentId: null }),
      invoice({ id: "no-due-date", dueAt: null }),
    ]);
    mockedSummaries.mockResolvedValue(
      new Map([
        [INVOICE, { balance: 5 }],
        ["no-due-date", { balance: 5 }],
      ]),
    );

    await expect(
      ClientCollectionsService.listOverdue(ORG, NOW),
    ).resolves.toEqual([]);
  });

  it("drops an overdue invoice when no financial summary is available", async () => {
    mockedPrisma.invoice.findMany.mockResolvedValue([invoice()]);
    mockedSummaries.mockResolvedValue(new Map());

    await expect(
      ClientCollectionsService.listOverdue(ORG, NOW),
    ).resolves.toEqual([]);
  });
});

describe("markReviewed", () => {
  it("records the verified reviewer on an overdue invoice", async () => {
    const reviewed = {
      id: INVOICE,
      collectionsReviewedAt: NOW,
      collectionsReviewedBy: "staff-1",
    };
    mockedSummaries.mockResolvedValue(new Map([[INVOICE, { balance: 20 }]]));
    mockedPrisma.invoice.update.mockResolvedValue(reviewed);
    mockedPrisma.invoice.findFirst.mockResolvedValue({
      id: INVOICE,
      currency: "KWD",
      totalAmount: 100,
      depositCollectedAmount: 0,
    });

    await expect(
      ClientCollectionsService.markReviewed({
        organisationId: ORG,
        invoiceId: INVOICE,
        reviewedBy: "staff-1",
        now: NOW,
      }),
    ).resolves.toEqual(reviewed);
    // The balance is rounded in the invoice's own currency.
    expect(mockedPrisma.invoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ currency: true }),
      }),
    );
    expect(mockedSummaries).toHaveBeenCalledWith([
      expect.objectContaining({ id: INVOICE, currency: "KWD" }),
    ]);
    expect(mockedPrisma.invoice.update).toHaveBeenCalledWith({
      where: { id: INVOICE },
      data: { collectionsReviewedAt: NOW, collectionsReviewedBy: "staff-1" },
      select: {
        id: true,
        collectionsReviewedAt: true,
        collectionsReviewedBy: true,
      },
    });
  });

  it("uses the current time when the caller does not supply one", async () => {
    mockedPrisma.invoice.findFirst.mockResolvedValue({
      id: INVOICE,
      totalAmount: 100,
      depositCollectedAmount: 0,
    });
    mockedSummaries.mockResolvedValue(new Map([[INVOICE, { balance: 20 }]]));
    mockedPrisma.invoice.update.mockResolvedValue({ id: INVOICE });

    await ClientCollectionsService.markReviewed({
      organisationId: ORG,
      invoiceId: INVOICE,
      reviewedBy: "staff-1",
    });

    const query = mockedPrisma.invoice.findFirst.mock.calls[0][0];
    expect(query.where.dueAt.lt).toBeInstanceOf(Date);
  });

  it("rejects invoices that are not overdue in this practice", async () => {
    mockedPrisma.invoice.findFirst.mockResolvedValue(null);

    await expect(
      ClientCollectionsService.markReviewed({
        organisationId: ORG,
        invoiceId: INVOICE,
        reviewedBy: "staff-1",
        now: NOW,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mockedPrisma.invoice.update).not.toHaveBeenCalled();
  });

  it("rejects an invoice with no remaining balance", async () => {
    mockedPrisma.invoice.findFirst.mockResolvedValue({
      id: INVOICE,
      totalAmount: 100,
      depositCollectedAmount: 0,
    });
    mockedSummaries.mockResolvedValue(new Map([[INVOICE, { balance: 0 }]]));

    await expect(
      ClientCollectionsService.markReviewed({
        organisationId: ORG,
        invoiceId: INVOICE,
        reviewedBy: "staff-1",
        now: NOW,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(mockedPrisma.invoice.update).not.toHaveBeenCalled();
  });

  it("rejects an invoice when its financial summary is missing", async () => {
    mockedPrisma.invoice.findFirst.mockResolvedValue({
      id: INVOICE,
      totalAmount: 100,
      depositCollectedAmount: 0,
    });
    mockedSummaries.mockResolvedValue(new Map());

    await expect(
      ClientCollectionsService.markReviewed({
        organisationId: ORG,
        invoiceId: INVOICE,
        reviewedBy: "staff-1",
        now: NOW,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(mockedPrisma.invoice.update).not.toHaveBeenCalled();
  });
});
