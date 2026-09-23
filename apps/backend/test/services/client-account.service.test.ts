import {
  ClientAccountService,
  summariseClientCredit,
} from "../../src/services/finance/client-account";
import { prisma } from "src/config/prisma";

jest.mock("src/config/prisma", () => ({
  prisma: {
    invoice: {
      findMany: jest.fn(),
      // Never called. Present so that a write added to this read-only service
      // later is a failing test rather than a silent change of what it is.
      update: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
    providerReceipt: {
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
  },
}));

const mockedPrisma = prisma as unknown as {
  invoice: {
    findMany: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    create: jest.Mock;
  };
  providerReceipt: {
    findMany: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    create: jest.Mock;
  };
};

const ORG = "11111111-1111-4111-8111-111111111111";
const PARENT = "22222222-2222-4222-8222-222222222222";

const receipt = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "receipt-1",
  provider: "STRIPE" as const,
  paymentRef: "pi_1",
  invoiceId: "invoice-1",
  currency: "gbp",
  capturedAt: new Date("2026-09-01T10:00:00.000Z"),
  amount: 100,
  refundedAmount: 0,
  allocatedAmount: 0,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("summariseClientCredit", () => {
  it("credits what no invoice took and nothing it did", () => {
    const [credit] = summariseClientCredit([
      receipt({ amount: 100, allocatedAmount: 40 }),
    ]);

    expect(credit.availableCredit).toBe(60);
    expect(credit.lines).toHaveLength(1);
    expect(credit.lines[0].availableCredit).toBe(60);
  });

  it("subtracts a refund as well as an allocation", () => {
    const [credit] = summariseClientCredit([
      receipt({ amount: 100, allocatedAmount: 20, refundedAmount: 30 }),
    ]);

    expect(credit.availableCredit).toBe(50);
  });

  it("drops a capture with nothing left on it", () => {
    expect(
      summariseClientCredit([receipt({ amount: 100, allocatedAmount: 100 })]),
    ).toEqual([]);
  });

  it("never nets one currency against another", () => {
    const credits = summariseClientCredit([
      receipt({ id: "r-gbp", currency: "gbp", amount: 100 }),
      receipt({ id: "r-eur", currency: "eur", paymentRef: "pi_2", amount: 40 }),
    ]);

    expect(credits).toHaveLength(2);
    expect(credits.map((entry) => entry.currency)).toEqual(["eur", "gbp"]);
    expect(credits.map((entry) => entry.availableCredit)).toEqual([40, 100]);
  });

  it("sums several captures in the same currency", () => {
    const [credit] = summariseClientCredit([
      receipt({ id: "r-1", amount: 100, allocatedAmount: 90 }),
      receipt({ id: "r-2", paymentRef: "pi_2", amount: 20 }),
    ]);

    expect(credit.availableCredit).toBe(30);
    expect(credit.lines).toHaveLength(2);
  });

  it("returns the newest capture first and breaks a tie on id", () => {
    const sameInstant = new Date("2026-09-02T00:00:00.000Z");
    const [credit] = summariseClientCredit([
      receipt({ id: "r-a", capturedAt: sameInstant }),
      receipt({
        id: "r-older",
        paymentRef: "pi_old",
        capturedAt: new Date("2026-08-01T00:00:00.000Z"),
      }),
      receipt({ id: "r-b", paymentRef: "pi_b", capturedAt: sameInstant }),
    ]);

    expect(credit.lines.map((line) => line.receiptId)).toEqual([
      "r-b",
      "r-a",
      "r-older",
    ]);
  });

  it("ignores a capture attributed to no invoice", () => {
    // An unattributed capture belongs to the reconciliation queue, not to a
    // client account - there is no invoice on it to say whose money it is.
    expect(summariseClientCredit([receipt({ invoiceId: null })])).toEqual([]);
  });

  it("does not let a rounding remainder accumulate across captures", () => {
    const [credit] = summariseClientCredit([
      receipt({ id: "r-1", amount: 0.1, allocatedAmount: 0 }),
      receipt({ id: "r-2", paymentRef: "pi_2", amount: 0.2 }),
    ]);

    expect(credit.availableCredit).toBe(0.3);
  });
});

describe("ClientAccountService.getAccountCredit", () => {
  it("scopes the invoices to the organisation as well as the client", async () => {
    // A Parent is global rather than owned by one practice, so the client id
    // alone is not a tenancy boundary.
    mockedPrisma.invoice.findMany.mockResolvedValue([]);

    await ClientAccountService.getAccountCredit({
      organisationId: ORG,
      parentId: PARENT,
    });

    expect(mockedPrisma.invoice.findMany).toHaveBeenCalledWith({
      where: { organisationId: ORG, parentId: PARENT },
      select: { id: true },
    });
  });

  it("does not read receipts at all when the client has no invoices here", async () => {
    mockedPrisma.invoice.findMany.mockResolvedValue([]);

    await expect(
      ClientAccountService.getAccountCredit({
        organisationId: ORG,
        parentId: PARENT,
      }),
    ).resolves.toEqual([]);
    expect(mockedPrisma.providerReceipt.findMany).not.toHaveBeenCalled();
  });

  it("scopes the receipts to the organisation and to those invoices", async () => {
    mockedPrisma.invoice.findMany.mockResolvedValue([
      { id: "invoice-1" },
      { id: "invoice-2" },
    ]);
    mockedPrisma.providerReceipt.findMany.mockResolvedValue([]);

    await ClientAccountService.getAccountCredit({
      organisationId: ORG,
      parentId: PARENT,
    });

    expect(mockedPrisma.providerReceipt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organisationId: ORG,
          invoiceId: { in: ["invoice-1", "invoice-2"] },
        },
      }),
    );
  });

  it("does not filter on receipt status", async () => {
    // The status is a label derived from the same figures the credit is
    // computed from. Reading it as well would let a stale label hide money.
    mockedPrisma.invoice.findMany.mockResolvedValue([{ id: "invoice-1" }]);
    mockedPrisma.providerReceipt.findMany.mockResolvedValue([]);

    await ClientAccountService.getAccountCredit({
      organisationId: ORG,
      parentId: PARENT,
    });

    const where = mockedPrisma.providerReceipt.findMany.mock.calls[0][0].where;
    expect(where).not.toHaveProperty("status");
  });

  it("returns the credit the receipts carry", async () => {
    mockedPrisma.invoice.findMany.mockResolvedValue([{ id: "invoice-1" }]);
    mockedPrisma.providerReceipt.findMany.mockResolvedValue([
      receipt({ amount: 100, allocatedAmount: 25 }),
    ]);

    await expect(
      ClientAccountService.getAccountCredit({
        organisationId: ORG,
        parentId: PARENT,
      }),
    ).resolves.toEqual([
      {
        currency: "gbp",
        availableCredit: 75,
        lines: [
          {
            receiptId: "receipt-1",
            provider: "STRIPE",
            paymentRef: "pi_1",
            invoiceId: "invoice-1",
            capturedAt: new Date("2026-09-01T10:00:00.000Z"),
            availableCredit: 75,
          },
        ],
      },
    ]);
  });

  it("writes nothing", async () => {
    mockedPrisma.invoice.findMany.mockResolvedValue([{ id: "invoice-1" }]);
    mockedPrisma.providerReceipt.findMany.mockResolvedValue([receipt()]);

    await ClientAccountService.getAccountCredit({
      organisationId: ORG,
      parentId: PARENT,
    });

    for (const write of [
      mockedPrisma.invoice.update,
      mockedPrisma.invoice.updateMany,
      mockedPrisma.invoice.create,
      mockedPrisma.providerReceipt.update,
      mockedPrisma.providerReceipt.updateMany,
      mockedPrisma.providerReceipt.create,
    ]) {
      expect(write).not.toHaveBeenCalled();
    }
  });
});
