import { prisma } from "src/config/prisma";
import { resolvePracticeTimeZone } from "src/services/finance/client-collections";
import {
  buildClientStatementSnapshot,
  ClientStatementError,
  ClientStatementService,
  type StatementInvoice,
  type StatementReceipt,
} from "src/services/finance/client-statement";

jest.mock("src/services/finance/client-collections", () => ({
  resolvePracticeTimeZone: jest.fn(),
}));

jest.mock("src/config/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    invoice: { findMany: jest.fn(), count: jest.fn() },
    invoiceRevision: { findMany: jest.fn(), count: jest.fn() },
    providerReceiptAllocation: { findMany: jest.fn(), count: jest.fn() },
    providerReceipt: { findMany: jest.fn(), count: jest.fn() },
    providerReceiptRefund: { findMany: jest.fn(), count: jest.fn() },
    payment: { count: jest.fn() },
    refund: { count: jest.fn() },
    creditNote: { count: jest.fn() },
    financeEvent: { count: jest.fn(), findMany: jest.fn() },
    parent: { findUnique: jest.fn() },
    clientStatement: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

const mockedPrisma = prisma as unknown as {
  $transaction: jest.Mock;
  invoice: { findMany: jest.Mock; count: jest.Mock };
  invoiceRevision: { findMany: jest.Mock; count: jest.Mock };
  providerReceiptAllocation: { findMany: jest.Mock; count: jest.Mock };
  providerReceipt: { findMany: jest.Mock; count: jest.Mock };
  providerReceiptRefund: { findMany: jest.Mock; count: jest.Mock };
  payment: { count: jest.Mock };
  refund: { count: jest.Mock };
  creditNote: { count: jest.Mock };
  financeEvent: { count: jest.Mock; findMany: jest.Mock };
  parent: { findUnique: jest.Mock };
  clientStatement: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
};

const ORG = "11111111-1111-4111-8111-111111111111";
const PARENT = "22222222-2222-4222-8222-222222222222";
const STATEMENT = "33333333-3333-4333-8333-333333333333";
const ACTOR = "44444444-4444-4444-8444-444444444444";
const PERIOD_START = new Date("2026-09-01T00:00:00.000Z");
const PERIOD_END = new Date("2026-09-30T23:59:59.999Z");
const NOW = new Date("2026-10-01T00:00:00.000Z");

const client = {
  id: PARENT,
  firstName: "Synthetic",
  lastName: "Client",
  email: "synthetic@example.test",
};

const invoice = (over: Partial<StatementInvoice> = {}): StatementInvoice => ({
  id: "invoice-1",
  currency: "GBP",
  totalAmount: 100,
  depositCollectedAmount: 0,
  finalizedAt: new Date("2026-08-01T00:00:00.000Z"),
  dueAt: new Date("2026-08-01T00:00:00.000Z"),
  paidAt: null,
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
  payments: [],
  creditNotes: [],
  ...over,
});

const snapshot = () =>
  buildClientStatementSnapshot({
    client,
    periodStart: PERIOD_START,
    periodEnd: PERIOD_END,
    generatedAt: NOW,
    invoices: [invoice()],
  });

type Revision = NonNullable<StatementInvoice["revisions"]>[number];
const revision = (over: Partial<Revision> = {}): Revision => ({
  id: 1n,
  totalAmount: 100,
  currency: "GBP",
  status: "AWAITING_PAYMENT",
  organisationId: ORG,
  parentId: PARENT,
  finalizedAt: new Date("2026-08-01T00:00:00.000Z"),
  dueAt: new Date("2026-08-20T00:00:00.000Z"),
  recordedAt: new Date("2026-08-01T00:00:00.000Z"),
  baseline: false,
  ...over,
});
const historical = (
  revisions: Revision[],
  over: Partial<StatementInvoice> = {},
) =>
  buildClientStatementSnapshot({
    client,
    periodStart: PERIOD_START,
    periodEnd: PERIOD_END,
    generatedAt: NOW,
    invoices: [
      invoice({
        totalAmount: 999,
        dueAt: NOW,
        finalizedAt: NOW,
        ...over,
        revisions,
      }),
    ],
  });

describe("dated invoice revisions", () => {
  it("keeps recovered deposits in the currency at their occurrence", () => {
    const result = historical(
      [revision(), revision({ id: 2n, currency: "EUR", recordedAt: NOW })],
      {
        currency: "EUR",
        depositCollectedAmount: 40,
        deposits: [{ id: "deposit", amount: 40, occurredAt: PERIOD_START }],
      },
    );
    expect(result.currencies).toEqual([
      expect.objectContaining({
        currency: "gbp",
        openingBalance: 100,
        closingBalance: 60,
        aging: expect.objectContaining({ totalOutstanding: 60 }),
        entries: [
          expect.objectContaining({ id: "payment:deposit", amount: 40 }),
        ],
      }),
    ]);
  });

  it("validates recovered deposits against dated currency instead of the current invoice", async () => {
    mockedPrisma.invoice.findMany.mockResolvedValue([
      invoice({ currency: "EUR", depositCollectedAmount: 40 }),
    ]);
    mockedPrisma.invoiceRevision.findMany.mockResolvedValue([
      { ...revision(), invoiceId: "invoice-1" },
      {
        ...revision({ id: 2n, currency: "EUR", recordedAt: NOW }),
        invoiceId: "invoice-1",
      },
    ]);
    mockedPrisma.financeEvent.findMany.mockResolvedValue([depositEvent()]);

    await expect(generate()).resolves.toMatchObject({ id: STATEMENT });

    expect(
      mockedPrisma.clientStatement.create.mock.calls[0][0].data.snapshot
        .currencies,
    ).toEqual([
      expect.objectContaining({
        currency: "gbp",
        openingBalance: 100,
        closingBalance: 60,
      }),
    ]);
  });

  it("ignores later amendments and due dates when rebuilding a past period", () => {
    const result = historical([
      revision(),
      revision({ id: 2n, totalAmount: 150, recordedAt: NOW, dueAt: NOW }),
    ]);
    expect(result.currencies[0]).toEqual(
      expect.objectContaining({
        openingBalance: 100,
        closingBalance: 100,
        entries: [],
        aging: {
          current: 0,
          days1To30: 0,
          days31To60: 100,
          days61To90: 0,
          days91Plus: 0,
          totalOutstanding: 100,
        },
      }),
    );
  });

  it("dates increases and reductions without changing the opening balance", () => {
    const increase = new Date("2026-09-10T00:00:00.000Z");
    const reduction = new Date("2026-09-20T00:00:00.000Z");
    const result = historical([
      revision(),
      revision({ id: 2n, totalAmount: 150, recordedAt: increase }),
      revision({ id: 3n, totalAmount: 120, recordedAt: reduction }),
    ]).currencies[0];
    expect(result.openingBalance).toBe(100);
    expect(result.closingBalance).toBe(120);
    expect(result.entries).toEqual([
      {
        id: "invoice:invoice-1:revision:2",
        invoiceId: "invoice-1",
        occurredAt: increase.toISOString(),
        kind: "INVOICE",
        direction: "DEBIT",
        amount: 50,
      },
      {
        id: "invoice:invoice-1:revision:3",
        invoiceId: "invoice-1",
        occurredAt: reduction.toISOString(),
        kind: "INVOICE",
        direction: "CREDIT",
        amount: 30,
      },
    ]);
  });

  it("retains the earlier charge when cancellation is after the cutoff", () => {
    expect(
      historical([
        revision(),
        revision({ id: 2n, status: "CANCELLED", recordedAt: NOW }),
      ]).currencies[0].closingBalance,
    ).toBe(100);
  });

  it("reverses a charge on its cancellation date", () => {
    const result = historical([
      revision(),
      revision({ id: 2n, status: "CANCELLED", recordedAt: PERIOD_START }),
    ]).currencies[0];
    expect(result.openingBalance).toBe(100);
    expect(result.closingBalance).toBe(0);
    expect(result.aging.totalOutstanding).toBe(0);
    expect(result.entries).toEqual([
      expect.objectContaining({
        occurredAt: PERIOD_START.toISOString(),
        direction: "CREDIT",
        amount: 100,
      }),
    ]);
  });

  it("reverses an active credit note when its unpaid invoice is cancelled", () => {
    const cancelledAt = new Date("2026-09-20T00:00:00.000Z");
    const versions = [
      revision(),
      revision({ id: 2n, status: "CANCELLED", recordedAt: cancelledAt }),
    ];
    const creditNotes = [{ id: "credit", amount: 20, createdAt: PERIOD_START }];
    const before = historical([versions[0]], { creditNotes }).currencies[0];
    expect(before.closingBalance).toBe(80);
    const after = historical(versions, { creditNotes }).currencies[0];
    expect(after.closingBalance).toBe(0);
    expect(after.entries).toContainEqual(
      expect.objectContaining({
        id: "credit-note-void:credit",
        direction: "DEBIT",
        amount: 20,
        occurredAt: cancelledAt.toISOString(),
      }),
    );
  });

  it("uses the latest due date at the cutoff even when the amount is unchanged", () => {
    const result = historical([
      revision(),
      revision({
        id: 2n,
        recordedAt: PERIOD_START,
        dueAt: new Date("2026-09-25T00:00:00.000Z"),
      }),
    ]).currencies[0];
    expect(result.entries).toEqual([]);
    expect(result.aging.days1To30).toBe(100);
    expect(result.aging.days31To60).toBe(0);
  });

  it("uses a revision date while the invoice has no due date", () => {
    const result = historical([
      revision(),
      revision({ id: 2n, recordedAt: PERIOD_END, dueAt: null }),
    ]).currencies[0];
    expect(result.aging.current).toBe(100);
  });

  it("orders changes by revision number when timestamps are equal", () => {
    const result = historical([
      revision({ id: 3n, totalAmount: 150, recordedAt: PERIOD_START }),
      revision(),
      revision({ id: 2n, totalAmount: 120, recordedAt: PERIOD_START }),
    ]).currencies[0];
    expect(result.closingBalance).toBe(150);
    expect(result.entries.map(({ amount }) => amount)).toEqual([20, 30]);
  });

  it("keeps reopened amendments unposted until they are finalized again", () => {
    const reopened = revision({
      id: 2n,
      totalAmount: 150,
      finalizedAt: null,
      recordedAt: PERIOD_START,
      dueAt: NOW,
    });
    const before = historical([revision(), reopened]).currencies[0];
    expect(before.closingBalance).toBe(100);
    expect(before.entries).toEqual([]);
    expect(before.aging.days31To60).toBe(100);
    const finalizedAt = new Date("2026-09-20T00:00:00.000Z");
    const after = historical([
      revision(),
      reopened,
      revision({
        id: 3n,
        totalAmount: 150,
        finalizedAt,
        recordedAt: finalizedAt,
      }),
    ]).currencies[0];
    expect(after.closingBalance).toBe(150);
    expect(after.entries).toEqual([
      expect.objectContaining({
        id: "invoice:invoice-1:revision:3",
        occurredAt: finalizedAt.toISOString(),
        amount: 50,
      }),
    ]);
  });

  it("orders same-time multi-digit revisions by their numeric sequence", () => {
    const result = historical([
      revision(),
      revision({ id: 10n, totalAmount: 150, recordedAt: PERIOD_START }),
      revision({ id: 2n, totalAmount: 120, recordedAt: PERIOD_START }),
    ]).currencies[0];
    expect(result.entries.map(({ id, amount }) => ({ id, amount }))).toEqual([
      { id: "invoice:invoice-1:revision:2", amount: 20 },
      { id: "invoice:invoice-1:revision:10", amount: 30 },
    ]);
    expect(result.closingBalance).toBe(150);
  });

  it("posts a paid-at-creation invoice without finalization metadata", () => {
    const result = historical([revision({ status: "PAID", finalizedAt: null })])
      .currencies[0];

    expect(result.closingBalance).toBe(100);
    expect(result.openingBalance).toBe(100);
  });

  it("reverses the invoice charge when a paid invoice is refunded", () => {
    const refundedAt = new Date("2026-09-20T00:00:00.000Z");
    const result = historical([
      revision({ status: "PAID" }),
      revision({
        id: 2n,
        status: "REFUNDED",
        finalizedAt: null,
        recordedAt: refundedAt,
      }),
    ]).currencies[0];

    expect(result.closingBalance).toBe(0);
    expect(result.entries).toEqual([
      expect.objectContaining({
        id: "invoice:invoice-1:revision:2",
        direction: "CREDIT",
        amount: 100,
      }),
    ]);
  });

  it("includes the exact cutoff and excludes the following millisecond", () => {
    const result = historical([
      revision(),
      revision({ id: 2n, totalAmount: 120, recordedAt: PERIOD_END }),
      revision({
        id: 3n,
        totalAmount: 150,
        recordedAt: new Date(PERIOD_END.getTime() + 1),
      }),
    ]).currencies[0];
    expect(result.closingBalance).toBe(120);
    expect(result.entries).toEqual([
      expect.objectContaining({
        amount: 20,
        occurredAt: PERIOD_END.toISOString(),
      }),
    ]);
  });

  it("keeps an available baseline in the opening balance", () => {
    const result = historical([revision({ baseline: true })]).currencies[0];
    expect(result.openingBalance).toBe(100);
    expect(result.closingBalance).toBe(100);
    expect(result.entries).toEqual([]);
  });

  it.each([
    { revisions: [] },
    { revisions: [revision({ baseline: true, recordedAt: PERIOD_END })] },
    { revisions: [revision({ recordedAt: NOW })] },
  ])(
    "refuses a period that needs unavailable invoice history (%#)",
    ({ revisions }) => {
      expect(() => historical(revisions)).toThrow(
        "An invoice is missing its dated charge history.",
      );
    },
  );

  it("does not include an invoice first created after the period", () => {
    expect(
      historical([revision({ recordedAt: NOW })], { createdAt: NOW })
        .currencies,
    ).toEqual([]);
  });

  it("keeps zero-value invoices without inventing movements", () => {
    const result = historical([revision({ totalAmount: 0 })]).currencies[0];
    expect(result.closingBalance).toBe(0);
    expect(result.entries).toEqual([]);
  });

  it("rounds each posted total before calculating the amendment", () => {
    const result = historical([
      revision({ currency: "JPY", totalAmount: 100.4 }),
      revision({
        id: 2n,
        currency: "JPY",
        totalAmount: 100.6,
        recordedAt: PERIOD_START,
      }),
    ]).currencies[0];
    expect(result.currency).toBe("jpy");
    expect(result.openingBalance).toBe(100);
    expect(result.closingBalance).toBe(101);
    expect(result.entries).toEqual([expect.objectContaining({ amount: 1 })]);
  });

  it("normalizes currency labels without creating an exchange movement", () => {
    const result = historical([
      revision(),
      revision({ id: 2n, currency: " gbp ", recordedAt: PERIOD_START }),
    ]);
    expect(result.currencies).toHaveLength(1);
    expect(result.currencies[0].entries).toEqual([]);
  });

  it("keeps earlier payments, refunds and credit reversals in their original currency", () => {
    const result = historical(
      [
        revision(),
        revision({
          id: 2n,
          totalAmount: 150,
          currency: "EUR",
          recordedAt: new Date("2026-09-10T00:00:00Z"),
        }),
      ],
      {
        currency: "EUR",
        payments: [
          {
            id: "paid",
            amount: 40,
            currency: "GBP",
            paidAt: new Date("2026-08-20T00:00:00Z"),
            createdAt: PERIOD_START,
            refunds: [
              {
                id: "returned",
                amount: 10,
                currency: "GBP",
                createdAt: new Date("2026-09-15T00:00:00Z"),
              },
            ],
          },
        ],
        creditNotes: [
          {
            id: "note",
            amount: 20,
            createdAt: PERIOD_START,
            voidedAt: new Date("2026-09-20T00:00:00Z"),
          },
        ],
      },
    );
    expect(
      result.currencies.map(({ currency, openingBalance, closingBalance }) => ({
        currency,
        openingBalance,
        closingBalance,
      })),
    ).toEqual([
      { currency: "eur", openingBalance: 0, closingBalance: 150 },
      { currency: "gbp", openingBalance: 60, closingBalance: -30 },
    ]);
    expect(
      result.currencies[1].entries.map(({ direction, amount }) => ({
        direction,
        amount,
      })),
    ).toEqual([
      { direction: "CREDIT", amount: 20 },
      { direction: "CREDIT", amount: 100 },
      { direction: "DEBIT", amount: 10 },
      { direction: "DEBIT", amount: 20 },
    ]);
  });

  it("opens the new currency without reversing an already cancelled charge", () => {
    const result = historical([
      revision({ status: "CANCELLED" }),
      revision({
        id: 2n,
        currency: "EUR",
        totalAmount: 50,
        recordedAt: PERIOD_START,
      }),
    ]);
    expect(result.currencies[0].closingBalance).toBe(50);
    expect(result.currencies[1].closingBalance).toBe(0);
    expect(result.currencies[1].entries).toEqual([]);
  });

  it("uses recorded revision amounts for stored statements instead of the current row", async () => {
    mockedPrisma.invoice.findMany.mockResolvedValue([
      {
        ...invoice({ totalAmount: 150, finalizedAt: NOW }),
        status: "CANCELLED",
      },
    ]);
    mockedPrisma.invoiceRevision.findMany.mockResolvedValue([
      { ...revision(), invoiceId: "invoice-1" },
      {
        ...revision({ id: 2n, totalAmount: 150, recordedAt: NOW }),
        invoiceId: "invoice-1",
      },
    ]);
    await generate();
    expect(mockedPrisma.invoice.findMany.mock.calls[0][0].where).toEqual({
      OR: [
        { organisationId: ORG, parentId: PARENT },
        { id: { in: ["invoice-1", "invoice-1"] } },
      ],
      createdAt: { lte: PERIOD_END },
    });
    expect(
      mockedPrisma.clientStatement.create.mock.calls[0][0].data.snapshot
        .currencies[0].closingBalance,
    ).toBe(100);
    const where = {
      invoiceId: { in: ["invoice-1"] },
    };
    expect(mockedPrisma.invoiceRevision.count).toHaveBeenCalledWith({ where });
    expect(mockedPrisma.invoiceRevision.findMany).toHaveBeenCalledWith({
      where,
      orderBy: { id: "desc" },
    });
  });

  it.each([
    { parentId: "other-client", organisationId: ORG },
    { parentId: PARENT, organisationId: "other-practice" },
  ])(
    "selects historical invoices after later reassignment %j",
    async (owner) => {
      const row = { ...invoice(), ...owner };
      mockedPrisma.invoice.findMany.mockImplementation(async ({ where }) =>
        where.OR.some((scope: { id?: { in: string[] } }) =>
          scope.id?.in.includes(row.id),
        )
          ? [row]
          : [],
      );
      mockedPrisma.invoiceRevision.findMany.mockImplementation(
        async ({ select }) =>
          select
            ? [{ invoiceId: row.id }]
            : [
                { ...revision(), invoiceId: row.id },
                {
                  ...revision({ id: 2n, recordedAt: NOW, ...owner }),
                  invoiceId: row.id,
                },
              ],
      );
      await expect(generate()).resolves.toMatchObject({ id: STATEMENT });
      expect(
        mockedPrisma.clientStatement.create.mock.calls[0][0].data.snapshot
          .currencies[0].closingBalance,
      ).toBe(100);
      expect(mockedPrisma.invoiceRevision.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organisationId: ORG,
            parentId: PARENT,
            recordedAt: { lte: PERIOD_END },
          },
          select: { invoiceId: true },
        }),
      );
      expect(mockedPrisma.invoiceRevision.findMany).toHaveBeenCalledWith({
        where: { invoiceId: { in: [row.id] } },
        orderBy: { id: "desc" },
      });
    },
  );

  it("excludes an invoice assigned to this client only after the cutoff", async () => {
    mockedPrisma.invoiceRevision.findMany.mockImplementation(
      async ({ select }) =>
        select
          ? []
          : [
              {
                ...revision({ parentId: "other-client" }),
                invoiceId: "invoice-1",
              },
              {
                ...revision({ id: 2n, recordedAt: NOW }),
                invoiceId: "invoice-1",
              },
            ],
    );
    await expect(generate()).rejects.toMatchObject({ statusCode: 404 });
    expect(mockedPrisma.clientStatement.create).not.toHaveBeenCalled();
  });

  it("uses the latest eligible owner when an invoice returns after the cutoff", async () => {
    const versions = [
      { ...revision(), invoiceId: "invoice-1" },
      {
        ...revision({
          id: 2n,
          parentId: "other-client",
          recordedAt: PERIOD_START,
        }),
        invoiceId: "invoice-1",
      },
      { ...revision({ id: 3n, recordedAt: NOW }), invoiceId: "invoice-1" },
    ];
    mockedPrisma.invoiceRevision.findMany.mockImplementation(
      async ({ select, orderBy }) =>
        select
          ? [{ invoiceId: "invoice-1" }]
          : [...versions].sort(
              (left, right) =>
                (left.id > right.id ? 1 : -1) *
                (orderBy.id === "desc" ? -1 : 1),
            ),
    );
    await expect(generate()).rejects.toMatchObject({ statusCode: 404 });
    expect(mockedPrisma.clientStatement.create).not.toHaveBeenCalled();
  });

  it("loads intervening ownership revisions when an invoice returns to the account", async () => {
    const versions = [
      { ...revision(), invoiceId: "invoice-1" },
      {
        ...revision({
          id: 2n,
          parentId: "other-client",
          totalAmount: 150,
          recordedAt: PERIOD_START,
        }),
        invoiceId: "invoice-1",
      },
      {
        ...revision({
          id: 3n,
          totalAmount: 120,
          recordedAt: new Date("2026-09-20T00:00:00.000Z"),
        }),
        invoiceId: "invoice-1",
      },
    ];
    mockedPrisma.invoiceRevision.findMany.mockImplementation(
      async ({ where, select, orderBy }) =>
        select
          ? [{ invoiceId: "invoice-1" }]
          : versions
              .filter(
                (version) =>
                  !where.parentId || version.parentId === where.parentId,
              )
              .sort((left, right) =>
                orderBy.id === "desc"
                  ? left.id > right.id
                    ? -1
                    : 1
                  : left.id < right.id
                    ? -1
                    : 1,
              ),
    );
    await generate();
    const statement =
      mockedPrisma.clientStatement.create.mock.calls[0][0].data.snapshot
        .currencies[0];
    expect(statement.closingBalance).toBe(120);
    expect(
      statement.entries.map(({ amount }: { amount: number }) => amount),
    ).toEqual([50, 30]);
  });

  it("rejects missing stored revisions rather than falling back to today's invoice", async () => {
    mockedPrisma.invoiceRevision.findMany.mockResolvedValue([]);
    await expect(generate()).rejects.toMatchObject({ statusCode: 409 });
    expect(mockedPrisma.clientStatement.create).not.toHaveBeenCalled();
  });

  it("counts revisions before loading an oversized history", async () => {
    mockedPrisma.invoiceRevision.count.mockResolvedValue(10_000);
    await expect(generate()).rejects.toMatchObject({ statusCode: 422 });
    expect(mockedPrisma.invoiceRevision.findMany).not.toHaveBeenCalled();
    expect(mockedPrisma.clientStatement.create).not.toHaveBeenCalled();
  });

  it("bounds complete ownership history before loading its revisions", async () => {
    mockedPrisma.invoiceRevision.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(10_000);
    await expect(generate()).rejects.toMatchObject({ statusCode: 422 });
    expect(mockedPrisma.invoiceRevision.findMany).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.clientStatement.create).not.toHaveBeenCalled();
  });

  it("accepts the exact combined limit including invoice revisions", async () => {
    mockedPrisma.invoiceRevision.count.mockResolvedValue(9_999);
    await expect(generate()).resolves.toMatchObject({ id: STATEMENT });
  });

  it("treats a baseline at the start as an opening balance rather than a new charge", () => {
    const result = historical([
      revision({ baseline: true, recordedAt: PERIOD_START }),
    ]).currencies[0];
    expect(result.openingBalance).toBe(100);
    expect(result.closingBalance).toBe(100);
    expect(result.entries).toEqual([]);
  });

  it("does not backdate ageing for a refund currency with no invoice due date", () => {
    const result = historical([revision()], {
      payments: [
        {
          id: "paid",
          amount: 40,
          currency: "GBP",
          paidAt: PERIOD_START,
          createdAt: PERIOD_START,
          refunds: [
            {
              id: "returned",
              amount: 10,
              currency: "EUR",
              createdAt: PERIOD_END,
            },
          ],
        },
      ],
    });
    expect(result.currencies[0]).toEqual(
      expect.objectContaining({
        currency: "eur",
        closingBalance: 10,
        aging: {
          current: 10,
          days1To30: 0,
          days31To60: 0,
          days61To90: 0,
          days91Plus: 0,
          totalOutstanding: 10,
        },
      }),
    );
    expect(result.currencies[1]).toEqual(
      expect.objectContaining({ currency: "gbp", closingBalance: 60 }),
    );
  });
});

const stored = (over: Partial<Record<string, unknown>> = {}) => ({
  id: STATEMENT,
  organisationId: ORG,
  parentId: PARENT,
  periodStart: PERIOD_START,
  periodEnd: PERIOD_END,
  idempotencyKey: "statement-key",
  generatedById: ACTOR,
  snapshot: snapshot(),
  createdAt: NOW,
  ...over,
});

const generate = (over: Partial<Record<string, unknown>> = {}) =>
  ClientStatementService.generate({
    organisationId: ORG,
    parentId: PARENT,
    generatedById: ACTOR,
    idempotencyKey: "statement-key",
    periodStart: PERIOD_START,
    periodEnd: PERIOD_END,
    now: NOW,
    ...over,
  });

const depositEvent = (over: Partial<Record<string, unknown>> = {}) => ({
  entityId: "deposit-payment",
  occurredAt: new Date("2026-09-05T12:00:00.000Z"),
  payload: {
    invoiceId: "invoice-1",
    paymentId: "deposit-payment",
    amount: 40,
    currency: "GBP",
  },
  ...over,
});

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(resolvePracticeTimeZone).mockResolvedValue("UTC");
  mockedPrisma.$transaction.mockImplementation(async (run) =>
    run(mockedPrisma),
  );
  mockedPrisma.invoice.count.mockResolvedValue(1);
  mockedPrisma.invoiceRevision.count.mockResolvedValue(1);
  mockedPrisma.providerReceiptAllocation.count.mockResolvedValue(0);
  mockedPrisma.providerReceipt.count.mockResolvedValue(0);
  mockedPrisma.providerReceipt.findMany.mockResolvedValue([]);
  mockedPrisma.providerReceiptRefund.count.mockResolvedValue(0);
  mockedPrisma.providerReceiptRefund.findMany.mockResolvedValue([]);
  mockedPrisma.providerReceiptAllocation.findMany.mockResolvedValue([]);
  mockedPrisma.invoiceRevision.findMany.mockImplementation(async (args) => {
    if (args?.select) return [{ invoiceId: "invoice-1" }];
    const rows: StatementInvoice[] =
      await mockedPrisma.invoice.findMany.mock.results.at(-1)?.value;
    return rows.map((row, index) => ({
      id: BigInt(index + 1),
      invoiceId: row.id,
      organisationId: ORG,
      parentId: PARENT,
      totalAmount: row.totalAmount,
      currency: row.currency,
      status: "AWAITING_PAYMENT",
      finalizedAt: row.finalizedAt,
      dueAt: row.dueAt,
      recordedAt: row.finalizedAt ?? row.createdAt,
      baseline: false,
    }));
  });
  mockedPrisma.payment.count.mockResolvedValue(0);
  mockedPrisma.refund.count.mockResolvedValue(0);
  mockedPrisma.creditNote.count.mockResolvedValue(0);
  mockedPrisma.financeEvent.count.mockResolvedValue(0);
  mockedPrisma.financeEvent.findMany.mockResolvedValue([]);
  mockedPrisma.clientStatement.findUnique.mockResolvedValue(null);
  mockedPrisma.parent.findUnique.mockResolvedValue(client);
  mockedPrisma.invoice.findMany.mockResolvedValue([invoice()]);
  mockedPrisma.clientStatement.create.mockResolvedValue(stored());
});

describe("buildClientStatementSnapshot", () => {
  it("refuses to build a statement from an undated deposit balance", () => {
    expect(() =>
      buildClientStatementSnapshot({
        client,
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
        generatedAt: NOW,
        invoices: [invoice({ depositCollectedAmount: 40 })],
      }),
    ).toThrow("A deposit is missing its dated payment history.");
  });

  it("does not age a fully settled invoice", () => {
    const result = buildClientStatementSnapshot({
      client,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      generatedAt: NOW,
      invoices: [
        invoice({
          depositCollectedAmount: 100,
          deposits: [{ id: "complete", amount: 100, occurredAt: PERIOD_START }],
        }),
      ],
    });
    expect(result.currencies[0].aging).toEqual({
      current: 0,
      days1To30: 0,
      days31To60: 0,
      days61To90: 0,
      days91Plus: 0,
      totalOutstanding: 0,
    });
    expect(result.currencies[0].closingBalance).toBe(0);
  });

  it("uses recorded creation dates when older rows lack finalization, due or paid dates", () => {
    const result = buildClientStatementSnapshot({
      client,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      generatedAt: NOW,
      invoices: [
        invoice({
          finalizedAt: null,
          dueAt: null,
          payments: [
            {
              id: "payment",
              amount: 40,
              paidAt: null,
              createdAt: new Date("2026-09-02T12:00:00.000Z"),
              refunds: [],
            },
          ],
        }),
      ],
    });

    expect(result.currencies[0]).toMatchObject({
      openingBalance: 100,
      closingBalance: 60,
      aging: { days31To60: 60 },
    });
    expect(result.currencies[0].entries[0].occurredAt).toBe(
      "2026-09-02T12:00:00.000Z",
    );
  });
  it.each([
    ["2026-03-08T04:59:59.999Z", "2026-03-08T05:00:00.000Z", "days1To30"],
    ["2026-03-08T04:59:59.999Z", "2026-04-07T04:00:00.000Z", "days31To60"],
    ["2026-03-08T04:59:59.999Z", "2026-05-07T04:00:00.000Z", "days61To90"],
    ["2026-03-08T04:59:59.999Z", "2026-06-06T04:00:00.000Z", "days91Plus"],
    ["2026-10-03T04:00:00.000Z", "2026-11-03T04:59:59.999Z", "days1To30"],
  ])("ages %s to %s by practice dates in %s", (due, end, bucket) => {
    const result = buildClientStatementSnapshot({
      client,
      periodStart: new Date("2026-01-01T00:00:00.000Z"),
      periodEnd: new Date(end),
      generatedAt: new Date("2026-12-01T00:00:00.000Z"),
      timeZone: "America/New_York",
      invoices: [
        invoice({
          dueAt: new Date(due),
          createdAt: new Date(due),
          finalizedAt: new Date(due),
        }),
      ],
    });

    expect(result.currencies[0].aging).toEqual({
      current: 0,
      days1To30: 0,
      days31To60: 0,
      days61To90: 0,
      days91Plus: 0,
      totalOutstanding: 100,
      [bucket]: 100,
    });
  });

  it("keeps a credit note that is voided after the statement cutoff", () => {
    const result = buildClientStatementSnapshot({
      client,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      generatedAt: NOW,
      invoices: [
        invoice({
          creditNotes: [
            {
              id: "note",
              amount: 40,
              createdAt: new Date("2026-09-02T12:00:00.000Z"),
              voidedAt: new Date("2026-10-02T12:00:00.000Z"),
            },
          ],
        }),
      ],
    });

    expect(result.currencies[0]).toMatchObject({
      openingBalance: 100,
      closingBalance: 60,
    });
    expect(result.currencies[0].entries).toEqual([
      expect.objectContaining({
        id: "credit-note:note",
        kind: "CREDIT_NOTE",
        direction: "CREDIT",
        amount: 40,
      }),
    ]);
  });

  it("records the original credit and its dated reversal within the period", () => {
    const voidedAt = new Date("2026-09-12T12:00:00.000Z");
    const result = buildClientStatementSnapshot({
      client,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      generatedAt: NOW,
      invoices: [
        invoice({
          creditNotes: [
            {
              id: "note",
              amount: 40,
              createdAt: new Date("2026-09-02T12:00:00.000Z"),
              voidedAt,
            },
          ],
        }),
      ],
    });

    expect(result.currencies[0]).toMatchObject({
      openingBalance: 100,
      closingBalance: 100,
    });
    expect(result.currencies[0].entries).toEqual([
      expect.objectContaining({
        kind: "CREDIT_NOTE",
        direction: "CREDIT",
        amount: 40,
      }),
      expect.objectContaining({
        kind: "CREDIT_NOTE_VOID",
        direction: "DEBIT",
        amount: 40,
        occurredAt: voidedAt.toISOString(),
      }),
    ]);
  });

  it("retains an opening credit when its reversal falls on the cutoff", () => {
    const result = buildClientStatementSnapshot({
      client,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      generatedAt: NOW,
      invoices: [
        invoice({
          creditNotes: [
            {
              id: "note",
              amount: 40,
              createdAt: new Date("2026-08-02T12:00:00.000Z"),
              voidedAt: PERIOD_END,
            },
          ],
        }),
      ],
    });

    expect(result.currencies[0]).toMatchObject({
      openingBalance: 60,
      closingBalance: 100,
    });
    expect(result.currencies[0].entries).toEqual([
      expect.objectContaining({
        kind: "CREDIT_NOTE_VOID",
        direction: "DEBIT",
        amount: 40,
      }),
    ]);
  });
  it("fixes opening and closing balances from movements in the requested period", () => {
    const result = buildClientStatementSnapshot({
      client,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      generatedAt: NOW,
      invoices: [
        invoice({
          payments: [
            {
              id: "payment-before",
              amount: 20,
              paidAt: new Date("2026-08-15T00:00:00.000Z"),
              createdAt: new Date("2026-08-15T00:00:00.000Z"),
              refunds: [],
            },
            {
              id: "payment-period",
              amount: 30,
              paidAt: new Date("2026-09-10T00:00:00.000Z"),
              createdAt: new Date("2026-09-10T00:00:00.000Z"),
              refunds: [
                {
                  id: "refund-period",
                  amount: 5,
                  createdAt: new Date("2026-09-20T00:00:00.000Z"),
                },
              ],
            },
          ],
          creditNotes: [
            {
              id: "credit-period",
              amount: 10,
              createdAt: new Date("2026-09-15T00:00:00.000Z"),
            },
          ],
        }),
      ],
    });

    expect(result.currencies[0]).toMatchObject({
      currency: "gbp",
      openingBalance: 80,
      closingBalance: 45,
      aging: {
        days31To60: 45,
        totalOutstanding: 45,
      },
    });
    expect(result.currencies[0].entries.map((entry) => entry.kind)).toEqual([
      "PAYMENT",
      "CREDIT_NOTE",
      "REFUND",
    ]);
  });

  it("keeps currencies separate and matches their codes case-insensitively", () => {
    const result = buildClientStatementSnapshot({
      client,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      generatedAt: NOW,
      invoices: [
        invoice({ id: "gbp-upper", currency: "GBP", totalAmount: 10 }),
        invoice({ id: "gbp-lower", currency: "gbp", totalAmount: 20 }),
        invoice({ id: "eur", currency: "EUR", totalAmount: 5 }),
      ],
    });

    expect(result.currencies.map((entry) => entry.currency)).toEqual([
      "eur",
      "gbp",
    ]);
    expect(result.currencies.map((entry) => entry.closingBalance)).toEqual([
      5, 30,
    ]);
  });

  it.each([
    ["HUF", 19.125, 19.13],
    ["JPY", 19.6, 20],
    ["KWD", 19.1235, 19.124],
  ])(
    "preserves invoice precision for %s",
    (currency, totalAmount, expected) => {
      const result = buildClientStatementSnapshot({
        client,
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
        generatedAt: NOW,
        invoices: [invoice({ currency, totalAmount })],
      });

      expect(result.currencies[0].closingBalance).toBe(expected);
      expect(result.currencies[0].aging.totalOutstanding).toBe(expected);
    },
  );

  it("places outstanding balances in every age band", () => {
    const daysBeforeEnd = (days: number) =>
      new Date(PERIOD_END.getTime() - days * 24 * 60 * 60 * 1000);
    const result = buildClientStatementSnapshot({
      client,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      generatedAt: NOW,
      invoices: [0, 15, 45, 75, 100].map((days) =>
        invoice({
          id: `invoice-${days}`,
          totalAmount: 10,
          finalizedAt: daysBeforeEnd(days),
          dueAt: daysBeforeEnd(days),
          createdAt: daysBeforeEnd(days),
        }),
      ),
    });

    expect(result.currencies[0].aging).toEqual({
      current: 10,
      days1To30: 10,
      days31To60: 10,
      days61To90: 10,
      days91Plus: 10,
      totalOutstanding: 50,
    });
  });

  it("ages outstanding balances from their due dates", () => {
    const result = buildClientStatementSnapshot({
      client,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      generatedAt: NOW,
      invoices: [
        invoice({
          finalizedAt: new Date("2026-08-01T00:00:00.000Z"),
          dueAt: new Date("2026-09-25T00:00:00.000Z"),
        }),
      ],
    });

    expect(result.currencies[0].aging).toEqual({
      current: 0,
      days1To30: 100,
      days31To60: 0,
      days61To90: 0,
      days91Plus: 0,
      totalOutstanding: 100,
    });
  });

  it("excludes later movements from both closing balance and aged debt", () => {
    const result = buildClientStatementSnapshot({
      client,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      generatedAt: NOW,
      invoices: [
        invoice({
          payments: [
            {
              id: "later-payment",
              amount: 100,
              paidAt: new Date("2026-10-02T00:00:00.000Z"),
              createdAt: new Date("2026-10-02T00:00:00.000Z"),
              refunds: [],
            },
          ],
        }),
      ],
    });

    expect(result.currencies[0].closingBalance).toBe(100);
    expect(result.currencies[0].aging.totalOutstanding).toBe(100);
    expect(result.currencies[0].entries).toEqual([]);
  });

  it("uses a recorded deposit only for the amount not represented by payments", () => {
    const result = buildClientStatementSnapshot({
      client,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      generatedAt: NOW,
      invoices: [
        invoice({
          depositCollectedAmount: 40,
          paidAt: new Date("2026-09-05T00:00:00.000Z"),
          deposits: [
            {
              id: "older-deposit",
              amount: 15,
              occurredAt: new Date("2026-09-05T00:00:00.000Z"),
            },
            {
              id: "recorded-payment",
              amount: 25,
              occurredAt: new Date("2026-09-05T00:00:00.000Z"),
            },
          ],
          payments: [
            {
              id: "recorded-payment",
              amount: 25,
              paidAt: new Date("2026-09-05T00:00:00.000Z"),
              createdAt: new Date("2026-09-05T00:00:00.000Z"),
              refunds: [],
            },
          ],
        }),
      ],
    });

    expect(result.currencies[0].closingBalance).toBe(60);
    expect(result.currencies[0].entries.map((entry) => entry.amount)).toEqual([
      15, 25,
    ]);
  });

  it("does not use an ordinary payment as evidence of an earlier deposit", () => {
    expect(() =>
      buildClientStatementSnapshot({
        client,
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
        generatedAt: NOW,
        invoices: [
          invoice({
            depositCollectedAmount: 40,
            payments: [
              {
                id: "later-payment",
                amount: 60,
                paidAt: PERIOD_END,
                createdAt: PERIOD_END,
                refunds: [],
              },
            ],
          }),
        ],
      }),
    ).toThrow("A deposit is missing its dated payment history.");
  });

  it("does not backdate a deposit collected after the statement period", () => {
    const result = buildClientStatementSnapshot({
      client,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      generatedAt: NOW,
      invoices: [
        invoice({
          depositCollectedAmount: 40,
          deposits: [
            {
              id: "later-deposit",
              amount: 40,
              occurredAt: new Date("2026-10-02T00:00:00.000Z"),
            },
          ],
          payments: [
            {
              id: "later-deposit",
              amount: 40,
              paidAt: new Date("2026-10-02T00:00:00.000Z"),
              createdAt: new Date("2026-10-02T00:00:00.000Z"),
              refunds: [],
            },
          ],
        }),
      ],
    });

    expect(result.currencies[0].closingBalance).toBe(100);
    expect(result.currencies[0].entries).toEqual([]);
  });

  it.each([20, 100])(
    "keeps a refunded deposit of %s in the closing balance",
    (refundedAmount) => {
      const paidAt = new Date("2026-09-05T00:00:00.000Z");
      const result = buildClientStatementSnapshot({
        client,
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
        generatedAt: NOW,
        invoices: [
          invoice({
            depositCollectedAmount: 100,
            paidAt,
            deposits: [
              { id: "deposit-payment", amount: 100, occurredAt: paidAt },
            ],
            payments: [
              {
                id: "deposit-payment",
                amount: 100,
                paidAt,
                createdAt: paidAt,
                refunds: [
                  {
                    id: "deposit-refund",
                    amount: refundedAmount,
                    createdAt: new Date("2026-09-20T00:00:00.000Z"),
                  },
                ],
              },
            ],
          }),
        ],
      });

      expect(result.currencies[0].closingBalance).toBe(refundedAmount);
      expect(result.currencies[0].aging.totalOutstanding).toBe(refundedAmount);
      expect(result.currencies[0].entries.map((entry) => entry.kind)).toEqual([
        "PAYMENT",
        "REFUND",
      ]);
    },
  );

  it("sorts same-time entries by their stable ids", () => {
    const at = new Date("2026-09-05T00:00:00.000Z");
    const result = buildClientStatementSnapshot({
      client,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      generatedAt: NOW,
      invoices: [
        invoice({
          payments: [
            { id: "b", amount: 10, paidAt: at, createdAt: at, refunds: [] },
            { id: "a", amount: 10, paidAt: at, createdAt: at, refunds: [] },
          ],
        }),
      ],
    });

    expect(result.currencies[0].entries.map((entry) => entry.id)).toEqual([
      "payment:a",
      "payment:b",
    ]);
  });
});

describe("ClientStatementService.generate", () => {
  describe("dated allocations", () => {
    beforeEach(() => {
      mockedPrisma.invoice.findMany.mockResolvedValue([
        invoice({
          payments: [
            {
              id: "allocated-payment",
              amount: 40,
              paidAt: new Date("2026-08-01"),
              createdAt: new Date("2026-08-01"),
              refunds: [],
            },
          ],
        }),
      ]);
      mockedPrisma.providerReceiptAllocation.count.mockResolvedValue(1);
    });
    const allocation = (over: Record<string, unknown> = {}) => ({
      invoiceId: "invoice-1",
      paymentId: "allocated-payment",
      amount: 40,
      appliedAt: new Date("2026-09-15"),
      ...over,
    });
    it.each([
      ["2026-09-15", 60, 1],
      ["2026-10-01", 100, 0],
    ])(
      "uses application date %s instead of capture date",
      async (date, balance, count) => {
        mockedPrisma.providerReceiptAllocation.findMany.mockResolvedValue([
          allocation({ appliedAt: new Date(date) }),
        ]);
        await generate();
        const currency =
          mockedPrisma.clientStatement.create.mock.calls[0][0].data.snapshot
            .currencies[0];
        expect(currency.openingBalance).toBe(100);
        expect(currency.closingBalance).toBe(balance);
        expect(currency.aging.totalOutstanding).toBe(balance);
        expect(currency.entries).toHaveLength(count);
        if (count)
          expect(currency.entries[0].occurredAt).toBe(
            new Date(date).toISOString(),
          );
        expect(
          mockedPrisma.providerReceiptAllocation.findMany,
        ).toHaveBeenCalledWith({
          where: {
            receipt: { organisationId: ORG },
            invoiceId: { in: ["invoice-1"] },
            paymentId: { in: ["allocated-payment"] },
          },
          select: {
            paymentId: true,
            receiptId: true,
            invoiceId: true,
            amount: true,
            appliedAt: true,
          },
        });
      },
    );
    it.each([
      ["date", { appliedAt: null }],
      ["amount", { amount: 30 }],
      ["invoice", { invoiceId: "other" }],
    ])("refuses incomplete allocation %s", async (_name, changed) => {
      mockedPrisma.providerReceiptAllocation.findMany.mockResolvedValue([
        allocation(changed),
      ]);
      await expect(generate()).rejects.toMatchObject({ statusCode: 409 });
      expect(mockedPrisma.clientStatement.create).not.toHaveBeenCalled();
    });
    it("refuses conflicting duplicate payment allocations", async () => {
      mockedPrisma.providerReceiptAllocation.findMany.mockResolvedValue([
        allocation(),
        allocation({ appliedAt: new Date("2026-09-20") }),
      ]);
      await expect(generate()).rejects.toMatchObject({ statusCode: 409 });
      expect(mockedPrisma.clientStatement.create).not.toHaveBeenCalled();
    });
    it("bounds allocation rows before loading them", async () => {
      mockedPrisma.providerReceiptAllocation.count.mockResolvedValue(10_000);
      await expect(generate()).rejects.toMatchObject({ statusCode: 422 });
      expect(
        mockedPrisma.providerReceiptAllocation.findMany,
      ).not.toHaveBeenCalled();
    });
  });
  it("includes a dated partial deposit when the invoice is not fully paid", async () => {
    mockedPrisma.invoice.findMany.mockResolvedValue([
      invoice({ depositCollectedAmount: 40, paidAt: null }),
    ]);
    mockedPrisma.financeEvent.count.mockResolvedValue(1);
    mockedPrisma.financeEvent.findMany.mockResolvedValue([
      {
        entityId: "deposit-payment",
        occurredAt: new Date("2026-09-05T12:00:00.000Z"),
        payload: {
          invoiceId: "invoice-1",
          paymentId: "deposit-payment",
          amount: 40,
          currency: "GBP",
        },
      },
    ]);

    await generate();

    const currency =
      mockedPrisma.clientStatement.create.mock.calls[0][0].data.snapshot
        .currencies[0];
    expect(currency).toMatchObject({
      openingBalance: 100,
      closingBalance: 60,
      aging: { totalOutstanding: 60 },
    });
    expect(currency.entries).toEqual([
      expect.objectContaining({
        kind: "PAYMENT",
        amount: 40,
        occurredAt: "2026-09-05T12:00:00.000Z",
      }),
    ]);
  });

  it.each([
    ["2026-08-20T12:00:00.000Z", 60, 60, 0],
    ["2026-09-30T23:59:59.999Z", 100, 60, 1],
    ["2026-10-01T00:00:00.000Z", 100, 100, 0],
  ])(
    "uses the deposit date %s rather than full settlement",
    async (date, opening, closing, entries) => {
      mockedPrisma.invoice.findMany.mockResolvedValue([
        invoice({
          depositCollectedAmount: 40,
          paidAt: new Date("2026-09-15T00:00:00.000Z"),
        }),
      ]);
      mockedPrisma.financeEvent.findMany.mockResolvedValue([
        depositEvent({ occurredAt: new Date(date) }),
      ]);

      await generate();

      const currency =
        mockedPrisma.clientStatement.create.mock.calls[0][0].data.snapshot
          .currencies[0];
      expect(currency.openingBalance).toBe(opening);
      expect(currency.closingBalance).toBe(closing);
      expect(currency.entries).toHaveLength(entries);
    },
  );

  it("counts an existing payment and repeated history only once", async () => {
    mockedPrisma.invoice.findMany.mockResolvedValue([
      invoice({
        depositCollectedAmount: 40,
        payments: [
          {
            id: "existing",
            amount: 25,
            paidAt: PERIOD_START,
            createdAt: PERIOD_START,
            refunds: [],
          },
        ],
      }),
    ]);
    const older = depositEvent({
      payload: {
        invoiceId: "invoice-1",
        paymentId: "deposit-payment",
        amount: 15,
        currency: " gbp ",
      },
    });
    mockedPrisma.financeEvent.findMany.mockResolvedValue([
      depositEvent({
        entityId: "existing",
        payload: {
          invoiceId: "invoice-1",
          paymentId: "existing",
          amount: 25,
          currency: "GBP",
        },
      }),
      older,
      older,
    ]);

    await generate();

    const currency =
      mockedPrisma.clientStatement.create.mock.calls[0][0].data.snapshot
        .currencies[0];
    expect(currency.closingBalance).toBe(60);
    expect(
      currency.entries.map((entry: { amount: number }) => entry.amount),
    ).toEqual([25, 15]);
  });

  it("keeps separate deposits on their own occurrence dates", async () => {
    mockedPrisma.invoice.findMany.mockResolvedValue([
      invoice({ depositCollectedAmount: 40 }),
    ]);
    mockedPrisma.financeEvent.findMany.mockResolvedValue([
      depositEvent({
        occurredAt: new Date("2026-08-20T00:00:00.000Z"),
        payload: {
          invoiceId: "invoice-1",
          paymentId: "deposit-payment",
          amount: 15,
          currency: "GBP",
        },
      }),
      depositEvent({
        entityId: "second",
        payload: {
          invoiceId: "invoice-1",
          paymentId: "second",
          amount: 25,
          currency: "GBP",
        },
      }),
    ]);

    await generate();

    const currency =
      mockedPrisma.clientStatement.create.mock.calls[0][0].data.snapshot
        .currencies[0];
    expect(currency).toMatchObject({ openingBalance: 85, closingBalance: 60 });
    expect(currency.entries).toEqual([
      expect.objectContaining({ id: "payment:second", amount: 25 }),
    ]);
  });

  it("limits deposit history to the organisation and affected invoice ids", async () => {
    mockedPrisma.invoice.findMany.mockResolvedValue([
      invoice({ depositCollectedAmount: 40 }),
      invoice({ id: "no-deposit" }),
    ]);
    mockedPrisma.financeEvent.findMany.mockResolvedValue([depositEvent()]);

    await generate();

    const where = {
      organisationId: ORG,
      eventType: "PAYMENT_SUCCEEDED",
      entityType: "PAYMENT",
      OR: [{ payload: { path: ["invoiceId"], equals: "invoice-1" } }],
    };
    expect(mockedPrisma.financeEvent.count).toHaveBeenCalledWith({ where });
    expect(mockedPrisma.financeEvent.findMany).toHaveBeenCalledWith({
      where,
      select: { entityId: true, occurredAt: true, payload: true },
    });
  });

  it("keeps a fully represented future deposit outside the statement period", async () => {
    mockedPrisma.invoice.findMany.mockResolvedValue([
      invoice({
        depositCollectedAmount: 40,
        payments: [
          { id: "paid", amount: 40, paidAt: NOW, createdAt: NOW, refunds: [] },
        ],
      }),
    ]);
    mockedPrisma.financeEvent.findMany.mockResolvedValue([
      depositEvent({
        entityId: "paid",
        occurredAt: NOW,
        payload: {
          invoiceId: "invoice-1",
          paymentId: "paid",
          amount: 40,
          currency: "GBP",
        },
      }),
    ]);

    await generate();

    expect(mockedPrisma.financeEvent.findMany).toHaveBeenCalledTimes(1);
    expect(
      mockedPrisma.clientStatement.create.mock.calls[0][0].data.snapshot
        .currencies[0].closingBalance,
    ).toBe(100);
  });

  it("does not let later settlement hide an earlier partial deposit", async () => {
    mockedPrisma.invoice.findMany.mockResolvedValue([
      invoice({
        depositCollectedAmount: 40,
        paidAt: NOW,
        payments: [
          {
            id: "settlement",
            amount: 60,
            paidAt: NOW,
            createdAt: NOW,
            refunds: [],
          },
        ],
      }),
    ]);
    mockedPrisma.financeEvent.findMany.mockResolvedValue([depositEvent()]);

    await generate();

    const currency =
      mockedPrisma.clientStatement.create.mock.calls[0][0].data.snapshot
        .currencies[0];
    expect(currency).toMatchObject({
      openingBalance: 100,
      closingBalance: 60,
      aging: { totalOutstanding: 60 },
    });
    expect(currency.entries).toEqual([
      expect.objectContaining({ id: "payment:deposit-payment", amount: 40 }),
    ]);
  });

  it("does not query payment history for invoices with no recorded deposit", async () => {
    await generate();
    expect(mockedPrisma.financeEvent.count).not.toHaveBeenCalled();
    expect(mockedPrisma.financeEvent.findMany).not.toHaveBeenCalled();
  });

  it("bounds deposit history together with the other statement rows", async () => {
    mockedPrisma.invoice.findMany.mockResolvedValue([
      invoice({ depositCollectedAmount: 40 }),
    ]);
    mockedPrisma.payment.count.mockResolvedValue(5_000);
    mockedPrisma.financeEvent.count.mockResolvedValue(5_000);

    await expect(generate()).rejects.toMatchObject({ statusCode: 422 });
    expect(mockedPrisma.financeEvent.findMany).not.toHaveBeenCalled();
    expect(mockedPrisma.clientStatement.create).not.toHaveBeenCalled();
  });

  it("accepts exactly the row limit including deposit history", async () => {
    mockedPrisma.invoice.findMany.mockResolvedValue([
      invoice({ depositCollectedAmount: 40 }),
    ]);
    mockedPrisma.financeEvent.count.mockResolvedValue(9_998);
    mockedPrisma.financeEvent.findMany.mockResolvedValue([depositEvent()]);

    await expect(generate()).resolves.toMatchObject({ id: STATEMENT });
  });

  it.each([null, new Date("2026-09-05T00:00:00.000Z")])(
    "refuses an undated deposit even with full-settlement date %s",
    async (paidAt) => {
      mockedPrisma.invoice.findMany.mockResolvedValue([
        invoice({ depositCollectedAmount: 40, paidAt }),
      ]);

      await expect(generate()).rejects.toMatchObject({
        statusCode: 409,
        message: "A deposit is missing its dated payment history.",
      });
      expect(mockedPrisma.clientStatement.create).not.toHaveBeenCalled();
    },
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects non-finite deposit amount %s",
    async (amount) => {
      mockedPrisma.invoice.findMany.mockResolvedValue([
        invoice({ depositCollectedAmount: 40 }),
      ]);
      mockedPrisma.financeEvent.findMany.mockResolvedValue([
        depositEvent({
          payload: {
            invoiceId: "invoice-1",
            paymentId: "deposit-payment",
            amount,
            currency: "GBP",
          },
        }),
      ]);
      await expect(generate()).rejects.toMatchObject({ statusCode: 409 });
    },
  );

  it.each([
    null,
    [],
    {
      invoiceId: "invoice-1",
      paymentId: "deposit-payment",
      amount: -40,
      currency: "GBP",
    },
    {
      invoiceId: "invoice-1",
      paymentId: "deposit-payment",
      amount: 0,
      currency: "GBP",
    },
    {
      invoiceId: "invoice-1",
      paymentId: "deposit-payment",
      amount: "40",
      currency: "GBP",
    },
    {
      invoiceId: "invoice-1",
      paymentId: "deposit-payment",
      amount: 40,
      currency: "",
    },
  ])("rejects incomplete deposit payload %j", async (payload) => {
    mockedPrisma.invoice.findMany.mockResolvedValue([
      invoice({ depositCollectedAmount: 40 }),
    ]);
    mockedPrisma.financeEvent.findMany.mockResolvedValue([
      depositEvent({ payload }),
    ]);

    await expect(generate()).rejects.toMatchObject({ statusCode: 409 });
    expect(mockedPrisma.clientStatement.create).not.toHaveBeenCalled();
  });

  it.each([
    { occurredAt: new Date(Number.NaN) },
    { entityId: "different-payment" },
    {
      payload: {
        invoiceId: "other-invoice",
        paymentId: "deposit-payment",
        amount: 40,
        currency: "GBP",
      },
    },
    {
      payload: {
        invoiceId: "invoice-1",
        paymentId: "deposit-payment",
        amount: 40,
        currency: "EUR",
      },
    },
  ])("rejects inconsistent deposit record %j", async (override) => {
    mockedPrisma.invoice.findMany.mockResolvedValue([
      invoice({ depositCollectedAmount: 40 }),
    ]);
    mockedPrisma.financeEvent.findMany.mockResolvedValue([
      depositEvent(override),
    ]);

    await expect(generate()).rejects.toMatchObject({ statusCode: 409 });
  });

  it.each([15, 60])(
    "reconciles dated payment amount %s against the recorded deposit",
    async (amount) => {
      mockedPrisma.invoice.findMany.mockResolvedValue([
        invoice({ depositCollectedAmount: 40 }),
      ]);
      mockedPrisma.financeEvent.findMany.mockResolvedValue([
        depositEvent({
          payload: {
            invoiceId: "invoice-1",
            paymentId: "deposit-payment",
            amount,
            currency: "GBP",
          },
        }),
      ]);

      if (amount < 40) {
        await expect(generate()).rejects.toMatchObject({ statusCode: 409 });
      } else {
        await generate();
        expect(
          mockedPrisma.clientStatement.create.mock.calls[0][0].data.snapshot
            .currencies[0].closingBalance,
        ).toBe(40);
      }
    },
  );

  it.each([
    { occurredAt: new Date("2026-09-06T00:00:00.000Z") },
    {
      payload: {
        invoiceId: "invoice-1",
        paymentId: "deposit-payment",
        amount: 25,
        currency: "GBP",
      },
    },
  ])("rejects conflicting copies of the same deposit %j", async (override) => {
    mockedPrisma.invoice.findMany.mockResolvedValue([
      invoice({ depositCollectedAmount: 40 }),
    ]);
    mockedPrisma.financeEvent.findMany.mockResolvedValue([
      depositEvent(override),
      depositEvent(),
    ]);

    await expect(generate()).rejects.toMatchObject({ statusCode: 409 });
  });

  it("records the current generation time when no clock override is supplied", async () => {
    jest.useFakeTimers().setSystemTime(NOW);
    try {
      await generate({ now: undefined });
      expect(
        mockedPrisma.clientStatement.create.mock.calls[0][0].data.snapshot
          .generatedAt,
      ).toBe(NOW.toISOString());
    } finally {
      jest.useRealTimers();
    }
  });
  it.each(["periodStart", "periodEnd"])(
    "rejects an invalid %s before reading the database",
    async (field) => {
      await expect(
        generate({ [field]: new Date(Number.NaN) }),
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(mockedPrisma.clientStatement.findUnique).not.toHaveBeenCalled();
    },
  );

  it("rejects a statement covering more than 366 calendar dates", async () => {
    await expect(
      generate({
        periodStart: new Date("2025-09-01T00:00:00.000Z"),
        periodEnd: new Date("2026-09-02T00:00:00.000Z"),
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Statement period must be 366 days or less.",
    });
    expect(mockedPrisma.clientStatement.findUnique).not.toHaveBeenCalled();
  });

  it("accepts the last millisecond of a 366-day period", async () => {
    await expect(
      generate({
        periodStart: new Date("2025-09-01T00:00:00.000Z"),
        periodEnd: new Date("2026-09-01T23:59:59.999Z"),
      }),
    ).resolves.toMatchObject({ id: STATEMENT });
  });

  it.each(["invoice", "payment", "refund", "creditNote"] as const)(
    "bounds %s rows before materializing any history",
    async (table) => {
      mockedPrisma[table].count.mockResolvedValue(10_001);

      await expect(generate()).rejects.toMatchObject({ statusCode: 422 });
      expect(mockedPrisma.invoice.findMany).not.toHaveBeenCalled();
      expect(mockedPrisma.clientStatement.create).not.toHaveBeenCalled();
    },
  );

  it("bounds the combined history rather than each collection independently", async () => {
    mockedPrisma.invoice.count.mockResolvedValue(2_500);
    mockedPrisma.payment.count.mockResolvedValue(2_500);
    mockedPrisma.refund.count.mockResolvedValue(2_500);
    mockedPrisma.creditNote.count.mockResolvedValue(2_501);

    await expect(generate()).rejects.toMatchObject({ statusCode: 422 });
    expect(mockedPrisma.invoice.findMany).not.toHaveBeenCalled();
  });

  it("accepts exactly 10,000 rows and counts within the same bounded snapshot", async () => {
    mockedPrisma.payment.count.mockResolvedValue(9_998);

    await generate();

    const where = mockedPrisma.invoice.findMany.mock.calls[0][0].where;
    expect(mockedPrisma.invoice.count).toHaveBeenCalledWith({ where });
    const paymentWhere = {
      invoice: where,
      status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"] },
    };
    expect(mockedPrisma.payment.count).toHaveBeenCalledWith({
      where: paymentWhere,
    });
    expect(mockedPrisma.refund.count).toHaveBeenCalledWith({
      where: { payment: paymentWhere, status: "SUCCEEDED" },
    });
    expect(mockedPrisma.creditNote.count).toHaveBeenCalledWith({
      where: { invoice: where, status: { in: ["ISSUED", "VOIDED"] } },
    });
    expect(mockedPrisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: "RepeatableRead", timeout: 10_000 },
    );
    expect(mockedPrisma.clientStatement.create).toHaveBeenCalledTimes(1);
  });

  it("uses the organisation's practice timezone for stored ageing", async () => {
    jest.mocked(resolvePracticeTimeZone).mockResolvedValue("America/New_York");
    mockedPrisma.invoice.findMany.mockResolvedValue([
      invoice({
        dueAt: new Date("2026-03-08T04:59:59.999Z"),
        finalizedAt: new Date("2026-03-01T00:00:00.000Z"),
      }),
    ]);

    await generate({
      periodStart: new Date("2026-04-01T00:00:00.000Z"),
      periodEnd: new Date("2026-04-07T04:00:00.000Z"),
    });

    expect(resolvePracticeTimeZone).toHaveBeenCalledWith(ORG);
    expect(
      mockedPrisma.clientStatement.create.mock.calls[0][0].data.snapshot
        .currencies[0].aging.days31To60,
    ).toBe(100);
  });

  it.each([
    ["2026-09-12T12:00:00.000Z", 100, 2],
    ["2026-10-12T12:00:00.000Z", 60, 1],
  ])(
    "loads issued and voided notes with their recorded reversal at %s",
    async (voidedAt, closingBalance, entries) => {
      mockedPrisma.invoice.findMany.mockResolvedValue([
        {
          ...invoice(),
          creditNotes: [
            {
              id: "note",
              amount: 40,
              createdAt: new Date("2026-09-02T00:00:00.000Z"),
              status: "VOIDED",
              metadata: { voidedAt },
            },
          ],
        },
      ]);

      await generate();

      expect(
        mockedPrisma.invoice.findMany.mock.calls[0][0].select.creditNotes,
      ).toEqual({
        where: { status: { in: ["ISSUED", "VOIDED"] } },
        select: {
          id: true,
          amount: true,
          createdAt: true,
          status: true,
          metadata: true,
        },
      });
      const currency =
        mockedPrisma.clientStatement.create.mock.calls[0][0].data.snapshot
          .currencies[0];
      expect(currency.closingBalance).toBe(closingBalance);
      expect(currency.entries).toHaveLength(entries);
    },
  );

  it.each([
    null,
    [],
    "unexpected",
    {},
    { voidedAt: 123 },
    { voidedAt: "invalid" },
    { voidedAt: "2026-08-01T00:00:00.000Z" },
  ])(
    "refuses to invent a reversal date for a voided note with %j",
    async (metadata) => {
      mockedPrisma.invoice.findMany.mockResolvedValue([
        {
          ...invoice(),
          creditNotes: [
            {
              id: "note",
              amount: 40,
              status: "VOIDED",
              metadata,
              createdAt: new Date("2026-09-02T00:00:00.000Z"),
            },
          ],
        },
      ]);

      await expect(generate()).rejects.toMatchObject({
        statusCode: 409,
        message: "A credit note is missing its reversal date.",
      });
      expect(mockedPrisma.clientStatement.create).not.toHaveBeenCalled();
    },
  );

  it("does not treat metadata on an issued note as a reversal", async () => {
    mockedPrisma.invoice.findMany.mockResolvedValue([
      {
        ...invoice(),
        creditNotes: [
          {
            id: "note",
            amount: 40,
            status: "ISSUED",
            metadata: { voidedAt: "2026-09-12T12:00:00.000Z" },
            createdAt: new Date("2026-09-02T00:00:00.000Z"),
          },
        ],
      },
    ]);

    await generate();

    expect(
      mockedPrisma.clientStatement.create.mock.calls[0][0].data.snapshot
        .currencies[0].closingBalance,
    ).toBe(60);
  });

  it("rejects an inverted period before reading the database", async () => {
    await expect(
      generate({ periodStart: PERIOD_END, periodEnd: PERIOD_START }),
    ).rejects.toEqual(expect.objectContaining({ statusCode: 400 }));
    expect(mockedPrisma.clientStatement.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a period ending in the future", async () => {
    await expect(
      generate({ periodEnd: new Date("2026-10-02T00:00:00.000Z") }),
    ).rejects.toBeInstanceOf(ClientStatementError);
  });

  it("returns the original snapshot for an idempotent retry", async () => {
    mockedPrisma.clientStatement.findUnique.mockResolvedValue(stored());

    await expect(generate()).resolves.toEqual({
      id: STATEMENT,
      createdAt: NOW,
      snapshot: snapshot(),
    });
    expect(mockedPrisma.clientStatement.findUnique).toHaveBeenCalledWith({
      where: {
        organisationId_parentId_idempotencyKey: {
          organisationId: ORG,
          parentId: PARENT,
          idempotencyKey: "statement-key",
        },
      },
    });
    expect(mockedPrisma.invoice.findMany).not.toHaveBeenCalled();
    expect(mockedPrisma.clientStatement.create).not.toHaveBeenCalled();
  });

  it("refuses reuse of an idempotency key for another period", async () => {
    mockedPrisma.clientStatement.findUnique.mockResolvedValue(
      stored({ periodStart: new Date("2026-08-01T00:00:00.000Z") }),
    );

    await expect(generate()).rejects.toEqual(
      expect.objectContaining({ statusCode: 409 }),
    );
  });

  it("scopes source invoices and stores the immutable snapshot", async () => {
    const result = await generate();

    expect(mockedPrisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { organisationId: ORG, parentId: PARENT },
            { id: { in: ["invoice-1"] } },
          ],
          createdAt: { lte: PERIOD_END },
        }),
        select: expect.objectContaining({ dueAt: true }),
      }),
    );
    expect(mockedPrisma.clientStatement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organisationId: ORG,
        parentId: PARENT,
        generatedById: ACTOR,
        idempotencyKey: "statement-key",
        snapshot: expect.objectContaining({ version: 1 }),
      }),
    });
    expect(result.id).toBe(STATEMENT);
    expect(mockedPrisma.clientStatement.update).not.toHaveBeenCalled();
    expect(mockedPrisma.clientStatement.delete).not.toHaveBeenCalled();
  });

  it("does not reveal a global client with no invoices in this organisation", async () => {
    mockedPrisma.invoice.findMany.mockResolvedValue([]);

    await expect(generate()).rejects.toEqual(
      expect.objectContaining({ statusCode: 404 }),
    );
    expect(mockedPrisma.parent.findUnique).not.toHaveBeenCalled();
    expect(mockedPrisma.clientStatement.create).not.toHaveBeenCalled();
  });

  it("requires the client record to still exist", async () => {
    mockedPrisma.parent.findUnique.mockResolvedValue(null);

    await expect(generate()).rejects.toEqual(
      expect.objectContaining({ statusCode: 404 }),
    );
  });

  it("reads back the winner when a concurrent create takes the key", async () => {
    mockedPrisma.clientStatement.create.mockRejectedValue({ code: "P2002" });
    mockedPrisma.clientStatement.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(stored());

    await expect(generate()).resolves.toEqual(
      expect.objectContaining({ id: STATEMENT }),
    );
    expect(mockedPrisma.clientStatement.findUnique).toHaveBeenNthCalledWith(2, {
      where: {
        organisationId_parentId_idempotencyKey: {
          organisationId: ORG,
          parentId: PARENT,
          idempotencyKey: "statement-key",
        },
      },
    });
  });

  it("does not hide a non-unique database failure", async () => {
    const failure = new Error("database unavailable");
    mockedPrisma.clientStatement.create.mockRejectedValue(failure);

    await expect(generate()).rejects.toBe(failure);
  });

  it("rethrows a unique failure if the winning row cannot be read", async () => {
    const failure = { code: "P2002" };
    mockedPrisma.clientStatement.create.mockRejectedValue(failure);
    mockedPrisma.clientStatement.findUnique.mockResolvedValue(null);

    await expect(generate()).rejects.toBe(failure);
  });
});

describe("receipt account movements", () => {
  const capturedAt = new Date("2026-09-05T12:00:00Z");
  const receipt = (over: Partial<StatementReceipt> = {}): StatementReceipt => ({
    id: "receipt-1",
    invoiceId: "invoice-1",
    currency: "gbp",
    amount: 150,
    allocatedAmount: 100,
    refundedAmount: 0,
    capturedAt,
    refunds: [],
    ...over,
  });
  const paidInvoice = (over: Partial<StatementInvoice> = {}) =>
    invoice({
      payments: [
        {
          id: "payment-1",
          amount: 100,
          currency: "gbp",
          receiptId: "receipt-1",
          provider: "STRIPE",
          providerPaymentId: "capture-1",
          paidAt: capturedAt,
          createdAt: capturedAt,
          refunds: [],
        },
      ],
      ...over,
    });
  const build = (receipts = [receipt()], invoices = [paidInvoice()]) =>
    buildClientStatementSnapshot({
      client,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      generatedAt: NOW,
      receipts,
      invoices,
    }).currencies[0];
  it("includes excess captured credit once without changing paid invoice ageing", () => {
    expect(build()).toMatchObject({
      openingBalance: 100,
      closingBalance: -50,
      aging: { totalOutstanding: 0 },
    });
    expect(build().entries.filter((e) => e.kind === "RECEIPT")).toEqual([
      expect.objectContaining({
        amount: 150,
        occurredAt: capturedAt.toISOString(),
      }),
    ]);
  });
  it("keeps unapplied captures separate from unpaid invoice ageing", () => {
    expect(build([receipt({ allocatedAmount: 0 })], [invoice()])).toMatchObject(
      { closingBalance: -50, aging: { totalOutstanding: 100 } },
    );
  });
  it("accepts a booking receipt allocated directly without a Payment row", () => {
    expect(
      build([receipt({ amount: 100, allocatedAmount: 100 })], [invoice()]),
    ).toMatchObject({ closingBalance: 0, aging: { totalOutstanding: 0 } });
  });
  it("records successive partial refunds as deltas even when delivered out of order", () => {
    const result = build([
      receipt({
        refundedAmount: 50,
        refunds: [
          {
            id: "second",
            cumulativeAmount: 50,
            amount: 30,
            currency: "GBP",
            occurredAt: new Date("2026-09-20"),
          },
          {
            id: "first",
            cumulativeAmount: 20,
            amount: 20,
            currency: "gbp",
            occurredAt: new Date("2026-09-10"),
          },
        ],
      }),
    ]);
    expect(result.closingBalance).toBe(0);
    expect(
      result.entries
        .filter((e) => e.kind === "RECEIPT_REFUND")
        .map((e) => e.amount),
    ).toEqual([20, 30]);
  });
  it("does not bring a later refund into an earlier period", () => {
    expect(
      build([
        receipt({
          refundedAmount: 50,
          refunds: [
            {
              id: "later",
              cumulativeAmount: 50,
              amount: 50,
              currency: "gbp",
              occurredAt: new Date("2026-10-02"),
            },
          ],
        }),
      ]).closingBalance,
    ).toBe(-50);
  });
  it("does not count an invoice refund twice", () => {
    const date = new Date("2026-09-10");
    const i = paidInvoice();
    i.payments[0].refunds = [
      { id: "invoice-refund", amount: 20, currency: "gbp", createdAt: date },
    ];
    expect(
      build(
        [
          receipt({
            refundedAmount: 20,
            refunds: [
              {
                id: "receipt-refund",
                cumulativeAmount: 20,
                amount: 20,
                currency: "gbp",
                occurredAt: date,
              },
            ],
          }),
        ],
        [i],
      ),
    ).toMatchObject({ closingBalance: -30, aging: { totalOutstanding: 20 } });
  });
  it("keeps receipt-only currencies without ageing unapplied credit", () => {
    expect(
      build([receipt({ currency: "eur", allocatedAmount: 0 })], []),
    ).toMatchObject({
      currency: "eur",
      closingBalance: -150,
      aging: { totalOutstanding: 0 },
    });
  });
  it("ignores repeated cumulative totals and orders equal-date refunds by amount", () => {
    const date = new Date("2026-09-10");
    const result = build([
      receipt({
        refundedAmount: 50,
        refunds: [
          {
            id: "fifty",
            cumulativeAmount: 50,
            amount: 30,
            currency: "gbp",
            occurredAt: date,
          },
          {
            id: "twenty",
            cumulativeAmount: 20,
            amount: 20,
            currency: "gbp",
            occurredAt: date,
          },
          {
            id: "repeated",
            cumulativeAmount: 50,
            currency: "gbp",
            occurredAt: new Date("2026-09-11"),
          },
        ],
      }),
    ]);
    expect(result.closingBalance).toBe(0);
    expect(
      result.entries.filter((e) => e.kind === "RECEIPT_REFUND"),
    ).toHaveLength(2);
  });
  it("rejects refund totals that decrease over time", () => {
    expect(() =>
      build([
        receipt({
          refundedAmount: 20,
          refunds: [
            {
              id: "first",
              cumulativeAmount: 50,
              currency: "gbp",
              occurredAt: new Date("2026-09-10"),
            },
            {
              id: "later",
              cumulativeAmount: 20,
              currency: "gbp",
              occurredAt: new Date("2026-09-11"),
            },
          ],
        }),
      ]),
    ).toThrow("A receipt is missing its dated payment history.");
  });
  it.each(["payment currency", "payment date", "refund currency"])(
    "rejects conflicting %s",
    (field) => {
      const i = paidInvoice();
      if (field === "payment currency") i.payments[0].currency = "eur";
      if (field === "payment date")
        i.payments[0].paidAt = new Date("2026-09-01");
      if (field === "refund currency")
        i.payments[0].refunds = [
          {
            id: "bad",
            amount: 20,
            currency: "eur",
            createdAt: new Date("2026-09-10"),
          },
        ];
      expect(() => build([receipt()], [i])).toThrow(
        "A receipt is missing its dated payment history.",
      );
    },
  );
  it("uses recorded payment creation and invoice currency for older payment rows", () => {
    const i = paidInvoice();
    i.payments[0].paidAt = null;
    i.payments[0].currency = undefined;
    i.payments[0].refunds = [
      { id: "refund", amount: 20, createdAt: new Date("2026-09-10") },
    ];
    expect(
      build(
        [
          receipt({
            refundedAmount: 20,
            refunds: [
              {
                id: "refund",
                cumulativeAmount: 20,
                amount: 20,
                currency: "gbp",
                occurredAt: new Date("2026-09-10"),
              },
            ],
          }),
        ],
        [i],
      ).closingBalance,
    ).toBe(-30);
  });
  it.each([
    ["missing refund", { refundedAmount: 20 }],
    ["missing application", { allocatedAmount: 120 }],
    [
      "refund currency",
      {
        refundedAmount: 20,
        refunds: [
          {
            id: "bad",
            cumulativeAmount: 20,
            amount: 20,
            currency: "eur",
            occurredAt: new Date("2026-09-10"),
          },
        ],
      },
    ],
    [
      "refund before capture",
      {
        refundedAmount: 20,
        refunds: [
          {
            id: "bad",
            cumulativeAmount: 20,
            amount: 20,
            currency: "gbp",
            occurredAt: new Date("2026-09-01"),
          },
        ],
      },
    ],
    [
      "refund beyond capture",
      {
        refundedAmount: 200,
        refunds: [
          {
            id: "bad",
            cumulativeAmount: 200,
            amount: 200,
            currency: "gbp",
            occurredAt: new Date("2026-09-10"),
          },
        ],
      },
    ],
  ])("refuses incomplete %s history", (_name, changed) => {
    expect(() =>
      build([receipt(changed as Partial<StatementReceipt>)]),
    ).toThrow("A receipt is missing its dated payment history.");
  });
  it("loads scoped receipts and their refund history for stored statements", async () => {
    mockedPrisma.invoice.findMany.mockResolvedValue([paidInvoice()]);
    mockedPrisma.providerReceipt.count.mockResolvedValue(1);
    mockedPrisma.providerReceipt.findMany.mockResolvedValue([
      { ...receipt(), provider: "STRIPE", paymentRef: "capture-1" },
    ]);
    await generate();
    expect(
      mockedPrisma.clientStatement.create.mock.calls[0][0].data.snapshot
        .currencies[0].closingBalance,
    ).toBe(-50);
    expect(
      mockedPrisma.providerReceipt.findMany.mock.calls[0][0].where,
    ).toEqual({
      organisationId: ORG,
      invoiceId: { in: ["invoice-1"] },
      capturedAt: { lte: PERIOD_END },
    });
    expect(mockedPrisma.providerReceiptRefund.findMany).toHaveBeenCalledWith({
      where: { receiptId: { in: ["receipt-1"] } },
    });
  });
  it("refuses a later cumulative refund that contains undated earlier refunds", () => {
    expect(() =>
      build([
        receipt({
          refundedAmount: 70,
          undatedRefundAmount: 50,
          refunds: [
            {
              id: "later",
              cumulativeAmount: 70,
              currency: "gbp",
              occurredAt: new Date("2026-09-10"),
            },
          ],
        }),
      ]),
    ).toThrow("A receipt is missing its dated payment history.");
  });
  it("refuses cumulative totals without the individual refund amounts", () => {
    expect(() =>
      build([
        receipt({
          refundedAmount: 50,
          refunds: [
            {
              id: "later",
              cumulativeAmount: 50,
              currency: "gbp",
              occurredAt: new Date("2026-09-20"),
            },
          ],
        }),
      ]),
    ).toThrow("A receipt is missing its dated payment history.");
  });
  it("recovers dated refunds even when only the later notification was delivered", () => {
    const result = build([
      receipt({
        refundedAmount: 50,
        undatedRefundAmount: 20,
        refunds: [
          {
            id: "later",
            cumulativeAmount: 50,
            amount: 30,
            currency: "gbp",
            occurredAt: new Date("2026-09-20"),
          },
          {
            id: "earlier",
            cumulativeAmount: 50,
            amount: 20,
            currency: "gbp",
            occurredAt: new Date("2026-09-10"),
          },
        ],
      }),
    ]);
    expect(
      result.entries
        .filter((entry) => entry.kind === "RECEIPT_REFUND")
        .map((entry) => [entry.amount, entry.occurredAt]),
    ).toEqual([
      [20, "2026-09-10T00:00:00.000Z"],
      [30, "2026-09-20T00:00:00.000Z"],
    ]);
    expect(result.closingBalance).toBe(0);
  });
  it("loads undated refund evidence before storing a statement", async () => {
    mockedPrisma.invoice.findMany.mockResolvedValue([paidInvoice()]);
    mockedPrisma.providerReceipt.findMany.mockResolvedValue([
      {
        ...receipt({ refundedAmount: 70, undatedRefundAmount: 50 }),
        provider: "STRIPE",
        paymentRef: "capture-1",
      },
    ]);
    mockedPrisma.providerReceiptRefund.findMany.mockResolvedValue([
      {
        id: "later",
        receiptId: "receipt-1",
        cumulativeAmount: 70,
        currency: "gbp",
        occurredAt: new Date("2026-09-10"),
      },
    ]);
    await expect(generate()).rejects.toMatchObject({ statusCode: 409 });
    expect(
      mockedPrisma.providerReceipt.findMany.mock.calls[0][0].select
        .undatedRefundAmount,
    ).toBe(true);
    expect(mockedPrisma.clientStatement.create).not.toHaveBeenCalled();
  });
  it("loads dated refunds into stored account balances", async () => {
    mockedPrisma.invoice.findMany.mockResolvedValue([paidInvoice()]);
    mockedPrisma.providerReceipt.findMany.mockResolvedValue([
      {
        ...receipt({ refundedAmount: 20 }),
        provider: "STRIPE",
        paymentRef: "capture-1",
      },
    ]);
    mockedPrisma.providerReceiptRefund.findMany.mockResolvedValue([
      {
        id: "refund",
        receiptId: "receipt-1",
        cumulativeAmount: 20,
        amount: 20,
        currency: "gbp",
        occurredAt: new Date("2026-09-10"),
      },
    ]);
    await generate();
    expect(
      mockedPrisma.clientStatement.create.mock.calls[0][0].data.snapshot
        .currencies[0].closingBalance,
    ).toBe(-30);
  });
  it("matches credit applied to a different invoice through its allocation", async () => {
    const target = paidInvoice({ id: "invoice-2" });
    target.payments[0].providerPaymentId = "different-reference";
    mockedPrisma.invoice.findMany.mockResolvedValue([invoice(), target]);
    mockedPrisma.providerReceipt.findMany.mockResolvedValue([
      { ...receipt(), provider: "STRIPE", paymentRef: "capture-1" },
    ]);
    mockedPrisma.providerReceiptAllocation.findMany.mockResolvedValue([
      {
        paymentId: "payment-1",
        invoiceId: "invoice-2",
        receiptId: "receipt-1",
        amount: 100,
        appliedAt: capturedAt,
      },
    ]);
    await generate();
    expect(
      mockedPrisma.clientStatement.create.mock.calls[0][0].data.snapshot
        .currencies[0],
    ).toMatchObject({ closingBalance: 50, aging: { totalOutstanding: 100 } });
  });
  it("refuses ambiguous capture references across receipts", async () => {
    mockedPrisma.invoice.findMany.mockResolvedValue([paidInvoice()]);
    mockedPrisma.providerReceipt.findMany.mockResolvedValue(
      ["receipt-1", "receipt-2"].map((id) => ({
        ...receipt({ id }),
        provider: "STRIPE",
        paymentRef: "capture-1",
      })),
    );
    await expect(generate()).rejects.toMatchObject({
      statusCode: 409,
      message: "A payment matches more than one receipt.",
    });
    expect(mockedPrisma.clientStatement.create).not.toHaveBeenCalled();
  });
  it("refuses a receipt without its account invoice", async () => {
    mockedPrisma.providerReceipt.findMany.mockResolvedValue([
      {
        ...receipt({ allocatedAmount: 0 }),
        invoiceId: null,
        provider: "STRIPE",
        paymentRef: "capture-1",
      },
    ]);
    await expect(generate()).rejects.toMatchObject({ statusCode: 409 });
    expect(mockedPrisma.clientStatement.create).not.toHaveBeenCalled();
  });
  it.each(["providerReceipt", "providerReceiptRefund"] as const)(
    "bounds %s with the other history",
    async (table) => {
      mockedPrisma[table].count.mockResolvedValue(10_000);
      await expect(generate()).rejects.toMatchObject({ statusCode: 422 });
      expect(mockedPrisma[table].findMany).not.toHaveBeenCalled();
    },
  );
});

describe("ClientStatementService.getById", () => {
  it("scopes readback to the organisation and client", async () => {
    mockedPrisma.clientStatement.findFirst.mockResolvedValue(stored());

    await expect(
      ClientStatementService.getById({
        organisationId: ORG,
        parentId: PARENT,
        statementId: STATEMENT,
      }),
    ).resolves.toEqual(expect.objectContaining({ id: STATEMENT }));
    expect(mockedPrisma.clientStatement.findFirst).toHaveBeenCalledWith({
      where: { id: STATEMENT, organisationId: ORG, parentId: PARENT },
    });
  });

  it("returns null when the scoped statement is absent", async () => {
    mockedPrisma.clientStatement.findFirst.mockResolvedValue(null);

    await expect(
      ClientStatementService.getById({
        organisationId: ORG,
        parentId: PARENT,
        statementId: STATEMENT,
      }),
    ).resolves.toBeNull();
  });
});
