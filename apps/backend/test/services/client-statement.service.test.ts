import { prisma } from "src/config/prisma";
import {
  buildClientStatementSnapshot,
  ClientStatementError,
  ClientStatementService,
  type StatementInvoice,
} from "src/services/finance/client-statement";

jest.mock("src/config/prisma", () => ({
  prisma: {
    invoice: { findMany: jest.fn() },
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
  invoice: { findMany: jest.Mock };
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

beforeEach(() => {
  jest.resetAllMocks();
  mockedPrisma.clientStatement.findUnique.mockResolvedValue(null);
  mockedPrisma.parent.findUnique.mockResolvedValue(client);
  mockedPrisma.invoice.findMany.mockResolvedValue([invoice()]);
  mockedPrisma.clientStatement.create.mockResolvedValue(stored());
});

describe("buildClientStatementSnapshot", () => {
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

  it("does not backdate a deposit collected after the statement period", () => {
    const result = buildClientStatementSnapshot({
      client,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      generatedAt: NOW,
      invoices: [
        invoice({
          depositCollectedAmount: 40,
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
          organisationId: ORG,
          parentId: PARENT,
          status: { not: "CANCELLED" },
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
