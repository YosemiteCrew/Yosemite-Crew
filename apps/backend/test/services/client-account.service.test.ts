import {
  ClientAccountService,
  planClientAllocation,
  summariseClientCredit,
} from "../../src/services/finance/client-account";
import { getInvoiceFinancialSummaries } from "src/services/finance/payment";
import { ProviderReceiptService } from "src/services/finance/provider-receipt";
import type { AllocateResult } from "src/services/finance/provider-receipt";
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
    providerReceiptAllocation: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
    },
  },
}));

// Only the one export this service uses. The whole payment service is not
// needed to plan an allocation, and pulling it in would make a change anywhere
// in it able to fail these tests.
jest.mock("src/services/finance/payment", () => ({
  getInvoiceFinancialSummaries: jest.fn(),
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
  providerReceiptAllocation: { findMany: jest.Mock; create: jest.Mock };
  organization: { findUnique: jest.Mock };
};

const mockedSummaries = getInvoiceFinancialSummaries as unknown as jest.Mock;

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

const credit = (over: Partial<Record<string, unknown>> = {}) => ({
  receiptId: "receipt-1",
  version: 3,
  capturedAt: new Date("2026-09-01T10:00:00.000Z"),
  availableCredit: 150,
  ...over,
});

const debt = (over: Partial<Record<string, unknown>> = {}) => ({
  invoiceId: "invoice-1",
  dueAt: new Date("2026-08-01T00:00:00.000Z"),
  balance: 100,
  ...over,
});

describe("planClientAllocation", () => {
  // The oracle written into #3163: invoices 100 and 80 against 150 of credit.
  it("pays the oldest debt in full and puts the rest on the next", () => {
    const lines = planClientAllocation({
      credits: [credit({ availableCredit: 150 })],
      debts: [
        debt({ invoiceId: "invoice-1", balance: 100 }),
        debt({
          invoiceId: "invoice-2",
          balance: 80,
          dueAt: new Date("2026-08-15T00:00:00.000Z"),
        }),
      ],
      allocatedPairs: new Set<string>(),
    });

    expect(lines).toEqual([
      { receiptId: "receipt-1", invoiceId: "invoice-1", amount: 100 },
      { receiptId: "receipt-1", invoiceId: "invoice-2", amount: 50 },
    ]);
  });

  it("leaves the surplus unplanned rather than over-paying a debt", () => {
    const lines = planClientAllocation({
      credits: [credit({ availableCredit: 50 })],
      debts: [debt({ balance: 30 })],
      allocatedPairs: new Set<string>(),
    });

    expect(lines).toEqual([
      { receiptId: "receipt-1", invoiceId: "invoice-1", amount: 30 },
    ]);
  });

  it("orders debts by due date and not by the order they were read in", () => {
    const lines = planClientAllocation({
      credits: [credit({ availableCredit: 100 })],
      debts: [
        debt({
          invoiceId: "newer",
          balance: 100,
          dueAt: new Date("2026-09-01T00:00:00.000Z"),
        }),
        debt({
          invoiceId: "older",
          balance: 100,
          dueAt: new Date("2026-01-01T00:00:00.000Z"),
        }),
      ],
      allocatedPairs: new Set<string>(),
    });

    expect(lines.map((line) => line.invoiceId)).toEqual(["older"]);
  });

  it("breaks a same-instant debt tie on the id so the plan reproduces", () => {
    const sameInstant = new Date("2026-08-01T00:00:00.000Z");
    const lines = planClientAllocation({
      credits: [credit({ availableCredit: 100 })],
      debts: [
        debt({ invoiceId: "invoice-b", balance: 100, dueAt: sameInstant }),
        debt({ invoiceId: "invoice-a", balance: 100, dueAt: sameInstant }),
      ],
      allocatedPairs: new Set<string>(),
    });

    expect(lines.map((line) => line.invoiceId)).toEqual(["invoice-a"]);
  });

  it("spends the oldest capture before a newer one", () => {
    const lines = planClientAllocation({
      credits: [
        credit({
          receiptId: "newer",
          availableCredit: 100,
          capturedAt: new Date("2026-09-10T00:00:00.000Z"),
        }),
        credit({
          receiptId: "older",
          availableCredit: 100,
          capturedAt: new Date("2026-02-10T00:00:00.000Z"),
        }),
      ],
      debts: [debt({ balance: 100 })],
      allocatedPairs: new Set<string>(),
    });

    expect(lines.map((line) => line.receiptId)).toEqual(["older"]);
  });

  it("breaks a same-instant capture tie on the id so the plan reproduces", () => {
    const sameInstant = new Date("2026-09-01T10:00:00.000Z");
    const lines = planClientAllocation({
      credits: [
        credit({
          receiptId: "receipt-b",
          availableCredit: 100,
          capturedAt: sameInstant,
        }),
        credit({
          receiptId: "receipt-a",
          availableCredit: 100,
          capturedAt: sameInstant,
        }),
      ],
      debts: [debt({ balance: 100 })],
      allocatedPairs: new Set<string>(),
    });

    expect(lines.map((line) => line.receiptId)).toEqual(["receipt-a"]);
  });

  it("draws on a second capture when the first runs out", () => {
    const lines = planClientAllocation({
      credits: [
        credit({
          receiptId: "first",
          availableCredit: 40,
          capturedAt: new Date("2026-02-10T00:00:00.000Z"),
        }),
        credit({
          receiptId: "second",
          availableCredit: 90,
          capturedAt: new Date("2026-03-10T00:00:00.000Z"),
        }),
      ],
      debts: [debt({ balance: 100 })],
      allocatedPairs: new Set<string>(),
    });

    expect(lines).toEqual([
      { receiptId: "first", invoiceId: "invoice-1", amount: 40 },
      { receiptId: "second", invoiceId: "invoice-1", amount: 60 },
    ]);
  });

  /*
   * The journal holds a unique on (receipt, invoice), so the allocation call
   * refuses this pairing as a double-apply. Proposing it would be proposing an
   * action that cannot be taken.
   */
  it("skips a capture already applied to that invoice and uses the next", () => {
    const lines = planClientAllocation({
      credits: [
        credit({
          receiptId: "spent-here",
          availableCredit: 100,
          capturedAt: new Date("2026-02-10T00:00:00.000Z"),
        }),
        credit({
          receiptId: "free",
          availableCredit: 100,
          capturedAt: new Date("2026-03-10T00:00:00.000Z"),
        }),
      ],
      debts: [debt({ invoiceId: "invoice-1", balance: 100 })],
      allocatedPairs: new Set(["spent-here:invoice-1"]),
    });

    expect(lines).toEqual([
      { receiptId: "free", invoiceId: "invoice-1", amount: 100 },
    ]);
  });

  it("plans nothing when every capture is already applied to that invoice", () => {
    const lines = planClientAllocation({
      credits: [credit({ receiptId: "spent-here", availableCredit: 100 })],
      debts: [debt({ invoiceId: "invoice-1", balance: 100 })],
      allocatedPairs: new Set(["spent-here:invoice-1"]),
    });

    expect(lines).toEqual([]);
  });

  it("never plans more from one capture than is left on it", () => {
    const lines = planClientAllocation({
      credits: [credit({ availableCredit: 70 })],
      debts: [
        debt({ invoiceId: "invoice-1", balance: 100 }),
        debt({
          invoiceId: "invoice-2",
          balance: 100,
          dueAt: new Date("2026-08-15T00:00:00.000Z"),
        }),
      ],
      allocatedPairs: new Set<string>(),
    });

    expect(lines).toEqual([
      { receiptId: "receipt-1", invoiceId: "invoice-1", amount: 70 },
    ]);
  });

  it("keeps a part-paid capture to the cent across two debts", () => {
    const lines = planClientAllocation({
      credits: [credit({ availableCredit: 100.1 })],
      debts: [
        debt({ invoiceId: "invoice-1", balance: 33.37 }),
        debt({
          invoiceId: "invoice-2",
          balance: 500,
          dueAt: new Date("2026-08-15T00:00:00.000Z"),
        }),
      ],
      allocatedPairs: new Set<string>(),
    });

    expect(lines).toEqual([
      { receiptId: "receipt-1", invoiceId: "invoice-1", amount: 33.37 },
      { receiptId: "receipt-1", invoiceId: "invoice-2", amount: 66.73 },
    ]);
  });
});

const dbInvoice = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "invoice-1",
  currency: "gbp",
  status: "PENDING",
  totalAmount: 100,
  depositCollectedAmount: 0,
  finalizedAt: new Date("2026-08-01T00:00:00.000Z"),
  createdAt: new Date("2026-07-01T00:00:00.000Z"),
  ...over,
});

const dbReceipt = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "receipt-1",
  merchantAccountRef: "acct_org",
  currency: "gbp",
  capturedAt: new Date("2026-09-01T10:00:00.000Z"),
  amount: 150,
  refundedAmount: 0,
  allocatedAmount: 0,
  version: 3,
  ...over,
});

const balances = (entries: Record<string, number>) =>
  new Map(
    Object.entries(entries).map(([id, balance]) => [
      id,
      { paid: 0, credited: 0, balance },
    ]),
  );

describe("ClientAccountService.proposeAllocation", () => {
  beforeEach(() => {
    mockedPrisma.organization.findUnique.mockResolvedValue({
      stripeAccountId: "acct_org",
    });
    mockedPrisma.providerReceiptAllocation.findMany.mockResolvedValue([]);
  });

  it("plans the oldest debt first and reports what is left on both sides", async () => {
    mockedPrisma.invoice.findMany.mockResolvedValue([
      dbInvoice({ id: "invoice-1", totalAmount: 100 }),
      dbInvoice({
        id: "invoice-2",
        totalAmount: 80,
        finalizedAt: new Date("2026-08-15T00:00:00.000Z"),
      }),
    ]);
    mockedPrisma.providerReceipt.findMany.mockResolvedValue([
      dbReceipt({ amount: 150 }),
    ]);
    mockedSummaries.mockResolvedValue(
      balances({ "invoice-1": 100, "invoice-2": 80 }),
    );

    const [proposal] = await ClientAccountService.proposeAllocation({
      organisationId: ORG,
      parentId: PARENT,
    });

    expect(proposal).toMatchObject({
      currency: "gbp",
      availableCredit: 150,
      proposedAmount: 150,
      residualCredit: 0,
      outstandingBefore: 180,
      outstandingAfter: 30,
    });
    expect(proposal.lines).toEqual([
      { receiptId: "receipt-1", invoiceId: "invoice-1", amount: 100 },
      { receiptId: "receipt-1", invoiceId: "invoice-2", amount: 50 },
    ]);
  });

  it("reports the credit a smaller debt leaves over", async () => {
    mockedPrisma.invoice.findMany.mockResolvedValue([dbInvoice({})]);
    mockedPrisma.providerReceipt.findMany.mockResolvedValue([
      dbReceipt({ amount: 50 }),
    ]);
    mockedSummaries.mockResolvedValue(balances({ "invoice-1": 30 }));

    const [proposal] = await ClientAccountService.proposeAllocation({
      organisationId: ORG,
      parentId: PARENT,
    });

    expect(proposal).toMatchObject({
      proposedAmount: 30,
      residualCredit: 20,
      outstandingAfter: 0,
    });
  });

  it("carries the version each capture was read at", async () => {
    mockedPrisma.invoice.findMany.mockResolvedValue([dbInvoice({})]);
    mockedPrisma.providerReceipt.findMany.mockResolvedValue([
      dbReceipt({ version: 7 }),
    ]);
    mockedSummaries.mockResolvedValue(balances({ "invoice-1": 100 }));

    const [proposal] = await ClientAccountService.proposeAllocation({
      organisationId: ORG,
      parentId: PARENT,
    });

    expect(proposal.credits).toEqual([
      {
        receiptId: "receipt-1",
        version: 7,
        capturedAt: new Date("2026-09-01T10:00:00.000Z"),
        availableCredit: 150,
      },
    ]);
  });

  it("never nets one currency against another", async () => {
    mockedPrisma.invoice.findMany.mockResolvedValue([
      dbInvoice({ id: "invoice-gbp", currency: "gbp" }),
      dbInvoice({ id: "invoice-usd", currency: "usd" }),
    ]);
    mockedPrisma.providerReceipt.findMany.mockResolvedValue([
      dbReceipt({ id: "receipt-gbp", currency: "gbp", amount: 40 }),
      dbReceipt({ id: "receipt-usd", currency: "usd", amount: 10 }),
    ]);
    mockedSummaries.mockResolvedValue(
      balances({ "invoice-gbp": 100, "invoice-usd": 100 }),
    );

    const proposals = await ClientAccountService.proposeAllocation({
      organisationId: ORG,
      parentId: PARENT,
    });

    expect(proposals.map((proposal) => proposal.currency)).toEqual([
      "gbp",
      "usd",
    ]);
    expect(proposals[0].lines).toEqual([
      { receiptId: "receipt-gbp", invoiceId: "invoice-gbp", amount: 40 },
    ]);
    expect(proposals[1].lines).toEqual([
      { receiptId: "receipt-usd", invoiceId: "invoice-usd", amount: 10 },
    ]);
  });

  /*
   * The allocation call refuses a capture held in a merchant account that is
   * not this organisation's, so the preview must not offer to spend it.
   */
  it("leaves out a capture held in another merchant account", async () => {
    mockedPrisma.invoice.findMany.mockResolvedValue([dbInvoice({})]);
    mockedPrisma.providerReceipt.findMany.mockResolvedValue([
      dbReceipt({ merchantAccountRef: "acct_somebody_else" }),
    ]);
    mockedSummaries.mockResolvedValue(balances({ "invoice-1": 100 }));

    expect(
      await ClientAccountService.proposeAllocation({
        organisationId: ORG,
        parentId: PARENT,
      }),
    ).toEqual([]);
  });

  it("spends a platform-account capture, which belongs to no one merchant", async () => {
    mockedPrisma.invoice.findMany.mockResolvedValue([dbInvoice({})]);
    mockedPrisma.providerReceipt.findMany.mockResolvedValue([
      dbReceipt({ merchantAccountRef: "PLATFORM" }),
    ]);
    mockedSummaries.mockResolvedValue(balances({ "invoice-1": 100 }));

    const [proposal] = await ClientAccountService.proposeAllocation({
      organisationId: ORG,
      parentId: PARENT,
    });

    expect(proposal.proposedAmount).toBe(100);
  });

  it("does not offer money that has been given back", async () => {
    mockedPrisma.invoice.findMany.mockResolvedValue([dbInvoice({})]);
    mockedPrisma.providerReceipt.findMany.mockResolvedValue([
      dbReceipt({ amount: 150, refundedAmount: 150 }),
    ]);
    mockedSummaries.mockResolvedValue(balances({ "invoice-1": 100 }));

    expect(
      await ClientAccountService.proposeAllocation({
        organisationId: ORG,
        parentId: PARENT,
      }),
    ).toEqual([]);
  });

  it("keeps a cancelled invoice out of the debts it plans against", async () => {
    mockedPrisma.invoice.findMany.mockResolvedValue([
      dbInvoice({ id: "invoice-cancelled", status: "CANCELLED" }),
    ]);
    mockedPrisma.providerReceipt.findMany.mockResolvedValue([dbReceipt({})]);
    mockedSummaries.mockResolvedValue(new Map());

    const [proposal] = await ClientAccountService.proposeAllocation({
      organisationId: ORG,
      parentId: PARENT,
    });

    expect(mockedSummaries).toHaveBeenCalledWith([]);
    expect(proposal).toMatchObject({
      proposedAmount: 0,
      residualCredit: 150,
      outstandingBefore: 0,
      lines: [],
    });
  });

  it("does not plan a pairing the journal has already recorded", async () => {
    mockedPrisma.invoice.findMany.mockResolvedValue([dbInvoice({})]);
    mockedPrisma.providerReceipt.findMany.mockResolvedValue([dbReceipt({})]);
    mockedSummaries.mockResolvedValue(balances({ "invoice-1": 100 }));
    mockedPrisma.providerReceiptAllocation.findMany.mockResolvedValue([
      { receiptId: "receipt-1", invoiceId: "invoice-1" },
    ]);

    const [proposal] = await ClientAccountService.proposeAllocation({
      organisationId: ORG,
      parentId: PARENT,
    });

    expect(proposal.lines).toEqual([]);
    expect(proposal.residualCredit).toBe(150);
  });

  /*
   * A `Parent` is global, so the client id alone is not a tenancy boundary.
   * Both reads carry the organisation, and a client this organisation has
   * never invoiced is answered without reading any money at all.
   */
  it("reads no captures for a client this organisation has not invoiced", async () => {
    mockedPrisma.invoice.findMany.mockResolvedValue([]);

    expect(
      await ClientAccountService.proposeAllocation({
        organisationId: ORG,
        parentId: PARENT,
      }),
    ).toEqual([]);
    expect(mockedPrisma.providerReceipt.findMany).not.toHaveBeenCalled();
  });

  it("scopes both reads to the organisation", async () => {
    mockedPrisma.invoice.findMany.mockResolvedValue([dbInvoice({})]);
    mockedPrisma.providerReceipt.findMany.mockResolvedValue([dbReceipt({})]);
    mockedSummaries.mockResolvedValue(balances({ "invoice-1": 100 }));

    await ClientAccountService.proposeAllocation({
      organisationId: ORG,
      parentId: PARENT,
    });

    expect(mockedPrisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organisationId: ORG, parentId: PARENT },
      }),
    );
    expect(mockedPrisma.providerReceipt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organisationId: ORG,
          invoiceId: { in: ["invoice-1"] },
        },
      }),
    );
  });

  it("writes nothing", async () => {
    mockedPrisma.invoice.findMany.mockResolvedValue([dbInvoice({})]);
    mockedPrisma.providerReceipt.findMany.mockResolvedValue([dbReceipt({})]);
    mockedSummaries.mockResolvedValue(balances({ "invoice-1": 100 }));

    await ClientAccountService.proposeAllocation({
      organisationId: ORG,
      parentId: PARENT,
    });

    expect(mockedPrisma.invoice.update).not.toHaveBeenCalled();
    expect(mockedPrisma.providerReceipt.update).not.toHaveBeenCalled();
    expect(mockedPrisma.providerReceipt.updateMany).not.toHaveBeenCalled();
    expect(
      mockedPrisma.providerReceiptAllocation.create,
    ).not.toHaveBeenCalled();
  });
});
/*
 * The real allocation call is spied on rather than the module mocked. The
 * service under test also imports `allocatableResidual` and the closed-status
 * set from it, and replacing the module would replace those too - the proposal
 * suite above would then be testing the mock's arithmetic.
 */
const applied = (lines: { invoiceId: string; amount: number }[]) =>
  ({
    outcome: "APPLIED",
    receipt: {},
    remainingAmount: 0,
    allocations: lines.map((line) => ({ ...line, paymentId: "pay-1" })),
  }) as unknown as AllocateResult;

const plan = (over: Partial<Record<string, unknown>> = {}) => ({
  receiptId: "receipt-1",
  expectedVersion: 3,
  allocations: [{ invoiceId: "invoice-1", amount: 40 }],
  ...over,
});

const applyPlan = (
  receipts: ReturnType<typeof plan>[],
  over: Partial<Record<string, unknown>> = {},
) =>
  ClientAccountService.applyAllocation({
    organisationId: ORG,
    parentId: PARENT,
    actorId: "actor-1",
    idempotencyKey: "key-1",
    receipts,
    ...over,
  });

describe("ClientAccountService.applyAllocation", () => {
  let allocate: jest.SpyInstance;

  beforeEach(() => {
    allocate = jest
      .spyOn(ProviderReceiptService, "allocate")
      .mockResolvedValue(applied([{ invoiceId: "invoice-1", amount: 40 }]));
    mockedPrisma.invoice.findMany.mockResolvedValue([
      { id: "invoice-1" },
      { id: "invoice-2" },
    ]);
    mockedPrisma.providerReceipt.findMany.mockResolvedValue([
      { id: "receipt-1" },
      { id: "receipt-2" },
    ]);
  });

  afterEach(() => {
    allocate.mockRestore();
  });

  it("refuses an invoice that is not this client's and writes nothing", async () => {
    const result = await applyPlan([
      plan({ allocations: [{ invoiceId: "someone-else", amount: 40 }] }),
    ]);

    expect(result).toEqual({
      outcome: "INVOICE_NOT_THIS_CLIENT",
      invoiceId: "someone-else",
    });
    expect(allocate).not.toHaveBeenCalled();
  });

  it("refuses a capture that is not this client's and writes nothing", async () => {
    mockedPrisma.providerReceipt.findMany.mockResolvedValue([]);

    const result = await applyPlan([plan({ receiptId: "receipt-1" })]);

    expect(result).toEqual({
      outcome: "RECEIPT_NOT_THIS_CLIENT",
      receiptId: "receipt-1",
    });
    expect(allocate).not.toHaveBeenCalled();
  });

  it("scopes the capture lookup to this client's own invoices", async () => {
    await applyPlan([plan()]);

    expect(mockedPrisma.providerReceipt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organisationId: ORG,
          invoiceId: { in: ["invoice-1", "invoice-2"] },
        }),
      }),
    );
  });

  it("applies the captures in the order the plan gave them", async () => {
    await applyPlan([
      plan({ receiptId: "receipt-1" }),
      plan({ receiptId: "receipt-2" }),
    ]);

    expect(allocate.mock.calls.map((call) => call[0].receiptId)).toEqual([
      "receipt-1",
      "receipt-2",
    ]);
  });

  it("sends each capture its own expectedVersion", async () => {
    await applyPlan([
      plan({ receiptId: "receipt-1", expectedVersion: 3 }),
      plan({ receiptId: "receipt-2", expectedVersion: 9 }),
    ]);

    expect(allocate.mock.calls.map((call) => call[0].expectedVersion)).toEqual([
      3, 9,
    ]);
  });

  it("carries one idempotency key across the whole plan", async () => {
    await applyPlan(
      [plan({ receiptId: "receipt-1" }), plan({ receiptId: "receipt-2" })],
      { idempotencyKey: "one-decision" },
    );

    expect(allocate.mock.calls.map((call) => call[0].idempotencyKey)).toEqual([
      "one-decision",
      "one-decision",
    ]);
  });

  it("takes the actor from the caller and never from the plan", async () => {
    await applyPlan([plan()], { actorId: "nurse-7" });

    expect(allocate).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: "nurse-7", organisationId: ORG }),
    );
  });

  it("stops at the first refusal and names what it did not try", async () => {
    mockedPrisma.providerReceipt.findMany.mockResolvedValue([
      { id: "receipt-1" },
      { id: "receipt-2" },
      { id: "receipt-3" },
    ]);
    allocate
      .mockResolvedValueOnce(applied([{ invoiceId: "invoice-1", amount: 40 }]))
      .mockResolvedValueOnce({
        outcome: "VERSION_CONFLICT",
        version: 7,
      } as AllocateResult);

    const result = await applyPlan([
      plan({ receiptId: "receipt-1" }),
      plan({ receiptId: "receipt-2" }),
      plan({ receiptId: "receipt-3" }),
    ]);

    expect(allocate).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      outcome: "STOPPED",
      appliedAmount: 40,
      steps: [
        {
          receiptId: "receipt-1",
          result: expect.objectContaining({ outcome: "APPLIED" }),
        },
        {
          receiptId: "receipt-2",
          result: { outcome: "VERSION_CONFLICT", version: 7 },
        },
      ],
      notAttempted: ["receipt-3"],
    });
  });

  it("sums what was applied and not what was asked for", async () => {
    allocate.mockResolvedValue(
      applied([{ invoiceId: "invoice-1", amount: 10 }]),
    );

    const result = await applyPlan([
      plan({ allocations: [{ invoiceId: "invoice-1", amount: 40 }] }),
    ]);

    expect(result).toEqual(
      expect.objectContaining({ outcome: "APPLIED", appliedAmount: 10 }),
    );
  });

  it("counts a replayed capture as applied and carries on", async () => {
    allocate
      .mockResolvedValueOnce({
        outcome: "REPLAYED",
        receipt: {},
        remainingAmount: 0,
        allocations: [
          { invoiceId: "invoice-1", amount: 25, paymentId: "pay-0" },
        ],
      } as unknown as AllocateResult)
      .mockResolvedValueOnce(applied([{ invoiceId: "invoice-2", amount: 15 }]));

    const result = await applyPlan([
      plan({ receiptId: "receipt-1" }),
      plan({ receiptId: "receipt-2" }),
    ]);

    expect(allocate).toHaveBeenCalledTimes(2);
    expect(result).toEqual(
      expect.objectContaining({ outcome: "APPLIED", appliedAmount: 40 }),
    );
  });
});
