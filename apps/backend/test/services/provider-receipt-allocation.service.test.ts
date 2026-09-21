import {
  ProviderReceiptService,
  allocatableResidual,
  allocatedReceiptStatus,
} from "../../src/services/finance/provider-receipt";
import { prisma } from "src/config/prisma";
import {
  FinancePaymentService,
  getInvoiceFinancialSummaries,
} from "src/services/finance/payment";
import logger from "src/utils/logger";

jest.mock("src/config/prisma", () => ({
  prisma: {
    providerReceipt: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    providerReceiptAllocation: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    invoice: { findMany: jest.fn() },
    payment: { findFirst: jest.fn() },
    organization: { findUnique: jest.fn(), count: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock("src/services/finance/payment", () => ({
  FinancePaymentService: { recordInvoicePayment: jest.fn() },
  getInvoiceFinancialSummaries: jest.fn(),
}));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const mockedPrisma = prisma as unknown as {
  providerReceipt: {
    findUnique: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  providerReceiptAllocation: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  invoice: { findMany: jest.Mock };
  payment: { findFirst: jest.Mock };
  organization: { findUnique: jest.Mock; count: jest.Mock };
  $transaction: jest.Mock;
};
const mockedPayments = FinancePaymentService as unknown as {
  recordInvoicePayment: jest.Mock;
};
const mockedSummaries = getInvoiceFinancialSummaries as unknown as jest.Mock;
const mockedLogger = logger as unknown as { warn: jest.Mock; info: jest.Mock };

const RECEIPT_ID = "11111111-1111-4111-8111-111111111111";
const INVOICE_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_INVOICE_ID = "33333333-3333-4333-8333-333333333333";

const receipt = (overrides: Record<string, unknown> = {}) => ({
  id: RECEIPT_ID,
  provider: "STRIPE" as const,
  merchantAccountRef: "acct_org_a",
  paymentRef: "pi_captured",
  organisationId: "org-a",
  amount: 100,
  currency: "gbp",
  capturedAt: new Date("2026-09-18T10:00:00.000Z"),
  status: "UNALLOCATED" as const,
  refundedAmount: 0,
  allocatedAmount: 0,
  version: 3,
  ...overrides,
});

/** The projection `describeAllocation` reads back once the money has moved. */
const readback = (overrides: Record<string, unknown> = {}) => ({
  ...receipt(overrides),
  invoiceId: null,
  appointmentId: null,
  reason: null,
  createdAt: new Date("2026-09-18T10:00:01.000Z"),
  ...overrides,
});

const request = (overrides: Record<string, unknown> = {}) => ({
  organisationId: "org-a",
  receiptId: RECEIPT_ID,
  expectedVersion: 3,
  idempotencyKey: "key-1",
  actorId: "actor-1",
  allocations: [{ invoiceId: INVOICE_ID, amount: 100 }],
  ...overrides,
});

/** An invoice that passes every eligibility gate. */
const eligibleInvoice = (overrides: Record<string, unknown> = {}) => ({
  id: INVOICE_ID,
  currency: "gbp",
  status: "PENDING",
  totalAmount: 100,
  depositCollectedAmount: 0,
  ...overrides,
});

const financialSummaries = (
  ...entries: Array<
    [string, { paid: number; credited: number; balance: number }]
  >
) => new Map(entries);

/**
 * Run the transaction callback against a client whose writes are recorded.
 *
 * `reserved` is what the compare-and-set reports: 1 means it won, 0 means the
 * receipt moved under it.
 */
const runTransaction = (reserved = 1) => {
  const tx = {
    providerReceipt: {
      updateMany: jest.fn().mockResolvedValue({ count: reserved }),
    },
    providerReceiptAllocation: {
      create: jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({
            id: `alloc-${String(data.invoiceId)}`,
            invoiceId: data.invoiceId,
            amount: data.amount,
          }),
        ),
    },
  };
  mockedPrisma.$transaction.mockImplementation(
    (fn: (client: typeof tx) => unknown) => Promise.resolve(fn(tx)),
  );
  return tx;
};

beforeEach(() => {
  jest.resetAllMocks();
});

describe("allocatableResidual", () => {
  it("subtracts what was given back and what was already applied", () => {
    // Two different guards, and the oracle in #3170 needs both terms: money
    // already applied must not be applied twice, and money already refunded
    // was never available to apply at all.
    expect(
      allocatableResidual({
        amount: 100,
        refundedAmount: 25,
        allocatedAmount: 30,
      }),
    ).toBe(45);
  });

  it("floors at zero rather than reporting a negative residual", () => {
    // An over-refunded capture must read "nothing left", not "minus ten left" -
    // a negative would pass the `requested > residual` comparison for any
    // request at all.
    expect(
      allocatableResidual({
        amount: 100,
        refundedAmount: 80,
        allocatedAmount: 30,
      }),
    ).toBe(0);
  });
});

describe("allocatedReceiptStatus", () => {
  it("never overwrites a refunded state", () => {
    // What happened to the money and what has been applied are separate facts.
    // Folding the second over the first would erase a refund from the queue.
    expect(
      allocatedReceiptStatus({
        status: "PARTIALLY_REFUNDED",
        amount: 100,
        refundedAmount: 40,
        allocatedAmount: 60,
      }),
    ).toBe("PARTIALLY_REFUNDED");
  });

  it("is ALLOCATED once the residual is applied, not once the capture is", () => {
    // 60 applied out of 100 captured is fully allocated when 40 went back. The
    // alternative leaves an operator looking at a receipt asking them to place
    // money that no longer exists.
    expect(
      allocatedReceiptStatus({
        status: "UNALLOCATED",
        amount: 100,
        refundedAmount: 40,
        allocatedAmount: 60,
      }),
    ).toBe("ALLOCATED");
    expect(
      allocatedReceiptStatus({
        status: "UNALLOCATED",
        amount: 100,
        refundedAmount: 0,
        allocatedAmount: 60,
      }),
    ).toBe("UNALLOCATED");
  });
});

describe("ProviderReceiptService.allocate - who may allocate what", () => {
  it("answers a missing receipt and another tenant's receipt identically", async () => {
    // Distinguishing them turns this endpoint into a test for whether a given
    // receipt id is real in some other organisation.
    mockedPrisma.providerReceipt.findUnique.mockResolvedValueOnce(null);
    expect(await ProviderReceiptService.allocate(request())).toEqual({
      outcome: "NOT_FOUND",
    });

    mockedPrisma.providerReceipt.findUnique.mockResolvedValueOnce(
      receipt({ organisationId: "org-b" }),
    );
    expect(await ProviderReceiptService.allocate(request())).toEqual({
      outcome: "NOT_FOUND",
    });
  });

  it("tells an operator to attribute a capture sitting in their own account", async () => {
    // They can already see it - it is in their reconciliation queue by this
    // same arm - so "not found" would be both false and unactionable.
    mockedPrisma.providerReceipt.findUnique.mockResolvedValue(
      receipt({ organisationId: null }),
    );
    mockedPrisma.organization.findUnique.mockResolvedValue({
      stripeAccountId: "acct_org_a",
    });
    mockedPrisma.organization.count.mockResolvedValue(1);

    expect(await ProviderReceiptService.allocate(request())).toEqual({
      outcome: "NOT_ATTRIBUTED",
    });
  });

  it("hides an unattributed capture held in an account this organisation does not own", async () => {
    mockedPrisma.providerReceipt.findUnique.mockResolvedValue(
      receipt({ organisationId: null, merchantAccountRef: "acct_org_b" }),
    );
    mockedPrisma.organization.findUnique.mockResolvedValue({
      stripeAccountId: "acct_org_a",
    });
    mockedPrisma.organization.count.mockResolvedValue(1);

    expect(await ProviderReceiptService.allocate(request())).toEqual({
      outcome: "NOT_FOUND",
    });
  });

  it("refuses a capture whose money has all gone back", async () => {
    mockedPrisma.providerReceipt.findUnique.mockResolvedValue(
      receipt({ status: "REFUNDED", refundedAmount: 100 }),
    );
    mockedPrisma.providerReceiptAllocation.findMany.mockResolvedValue([]);

    expect(await ProviderReceiptService.allocate(request())).toEqual({
      outcome: "FULLY_REFUNDED",
    });
  });

  it("refuses to apply money held in another organisation's connected account", async () => {
    // Attribution says whose customer paid; the merchant account says where
    // the funds are. Applying across the two moves money on paper that cannot
    // move in fact.
    mockedPrisma.providerReceipt.findUnique.mockResolvedValue(
      receipt({ merchantAccountRef: "acct_somebody_else" }),
    );
    mockedPrisma.providerReceiptAllocation.findMany.mockResolvedValue([]);
    mockedPrisma.organization.findUnique.mockResolvedValue({
      stripeAccountId: "acct_org_a",
    });

    expect(await ProviderReceiptService.allocate(request())).toEqual({
      outcome: "ACCOUNT_MISMATCH",
    });
  });

  it("allows a platform capture, which carries no account claim to check", async () => {
    mockedPrisma.providerReceipt.findUnique.mockResolvedValueOnce(
      receipt({ merchantAccountRef: "PLATFORM" }),
    );
    mockedPrisma.providerReceiptAllocation.findMany.mockResolvedValue([]);
    mockedPrisma.invoice.findMany.mockResolvedValue([eligibleInvoice()]);
    mockedSummaries.mockResolvedValue(
      financialSummaries([INVOICE_ID, { paid: 0, credited: 0, balance: 100 }]),
    );
    runTransaction();
    mockedPrisma.payment.findFirst.mockResolvedValue(null);
    mockedPayments.recordInvoicePayment.mockResolvedValue({
      payment: { id: "pay-1" },
      appliedAmount: 100,
    });
    mockedPrisma.providerReceiptAllocation.update.mockResolvedValue({});
    mockedPrisma.providerReceipt.findUnique.mockResolvedValue(
      readback({
        merchantAccountRef: "PLATFORM",
        allocatedAmount: 100,
        status: "ALLOCATED",
      }),
    );

    const result = await ProviderReceiptService.allocate(request());

    expect(result.outcome).toBe("APPLIED");
    // The account check never reached the database, because there was no claim
    // in the receipt to check.
    expect(mockedPrisma.organization.findUnique).not.toHaveBeenCalled();
  });
});

describe("ProviderReceiptService.allocate - eligibility of each line", () => {
  const setUpReceipt = (overrides: Record<string, unknown> = {}) => {
    mockedPrisma.providerReceipt.findUnique.mockResolvedValueOnce(
      receipt(overrides),
    );
    mockedPrisma.providerReceiptAllocation.findMany.mockResolvedValue([]);
    mockedPrisma.organization.findUnique.mockResolvedValue({
      stripeAccountId: "acct_org_a",
    });
  };

  it("refuses more than the capture has left, counting refunds and prior allocations", async () => {
    setUpReceipt({ refundedAmount: 25, allocatedAmount: 30 });

    expect(await ProviderReceiptService.allocate(request())).toEqual({
      outcome: "EXCEEDS_RESIDUAL",
      residual: 45,
      requested: 100,
    });
    // Refused before any invoice was read, so a rejected request cannot have
    // touched an invoice.
    expect(mockedPrisma.invoice.findMany).not.toHaveBeenCalled();
  });

  it("scopes the invoice lookup to the receipt's organisation", async () => {
    setUpReceipt();
    mockedPrisma.invoice.findMany.mockResolvedValue([]);

    expect(await ProviderReceiptService.allocate(request())).toEqual({
      outcome: "INVOICE_NOT_ELIGIBLE",
      invoiceId: INVOICE_ID,
      reason: "INVOICE_NOT_FOUND",
    });
    expect(mockedPrisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: [INVOICE_ID] },
          organisationId: "org-a",
        },
      }),
    );
  });

  it("refuses an invoice in another currency", async () => {
    setUpReceipt();
    mockedPrisma.invoice.findMany.mockResolvedValue([
      eligibleInvoice({ currency: "usd" }),
    ]);

    expect(await ProviderReceiptService.allocate(request())).toEqual({
      outcome: "INVOICE_NOT_ELIGIBLE",
      invoiceId: INVOICE_ID,
      reason: "CURRENCY_MISMATCH",
    });
  });

  it("refuses a cancelled invoice even though it still shows a total", async () => {
    setUpReceipt();
    mockedPrisma.invoice.findMany.mockResolvedValue([
      eligibleInvoice({ status: "CANCELLED" }),
    ]);

    expect(await ProviderReceiptService.allocate(request())).toEqual({
      outcome: "INVOICE_NOT_ELIGIBLE",
      invoiceId: INVOICE_ID,
      reason: "INVOICE_CLOSED",
    });
    // The status decided it, so the balance was never consulted.
    expect(mockedSummaries).toHaveBeenCalledWith([]);
  });

  it("refuses an invoice that owes nothing", async () => {
    setUpReceipt();
    mockedPrisma.invoice.findMany.mockResolvedValue([eligibleInvoice()]);
    mockedSummaries.mockResolvedValue(
      financialSummaries([INVOICE_ID, { paid: 100, credited: 0, balance: 0 }]),
    );

    expect(await ProviderReceiptService.allocate(request())).toEqual({
      outcome: "INVOICE_NOT_ELIGIBLE",
      invoiceId: INVOICE_ID,
      reason: "NO_OUTSTANDING_BALANCE",
    });
  });

  it("refuses a line larger than the invoice's outstanding balance", async () => {
    setUpReceipt();
    mockedPrisma.invoice.findMany.mockResolvedValue([eligibleInvoice()]);
    mockedSummaries.mockResolvedValue(
      financialSummaries([INVOICE_ID, { paid: 60, credited: 0, balance: 40 }]),
    );

    expect(await ProviderReceiptService.allocate(request())).toEqual({
      outcome: "INVOICE_NOT_ELIGIBLE",
      invoiceId: INVOICE_ID,
      reason: "EXCEEDS_INVOICE_BALANCE",
    });
  });

  it("names the offending line when an earlier one was fine", async () => {
    setUpReceipt();
    mockedPrisma.invoice.findMany.mockResolvedValue([
      eligibleInvoice({ totalAmount: 60 }),
      eligibleInvoice({ id: OTHER_INVOICE_ID, currency: "usd" }),
    ]);
    mockedSummaries.mockResolvedValue(
      financialSummaries([INVOICE_ID, { paid: 0, credited: 0, balance: 60 }]),
    );

    expect(
      await ProviderReceiptService.allocate(
        request({
          allocations: [
            { invoiceId: INVOICE_ID, amount: 60 },
            { invoiceId: OTHER_INVOICE_ID, amount: 40 },
          ],
        }),
      ),
    ).toEqual({
      outcome: "INVOICE_NOT_ELIGIBLE",
      invoiceId: OTHER_INVOICE_ID,
      reason: "CURRENCY_MISMATCH",
    });
    expect(mockedPrisma.invoice.findMany).toHaveBeenCalledTimes(1);
    expect(mockedSummaries).toHaveBeenCalledTimes(1);
  });
});

describe("ProviderReceiptService.allocate - reserving and posting", () => {
  const setUpEligible = (overrides: Record<string, unknown> = {}) => {
    // `Once`, deliberately. The first read is the receipt the decision is taken
    // from and every later one is a readback of what the call did to it, so a
    // blanket mock would feed the decision its own outcome.
    mockedPrisma.providerReceipt.findUnique.mockResolvedValueOnce(
      receipt(overrides),
    );
    mockedPrisma.providerReceiptAllocation.findMany.mockResolvedValue([]);
    mockedPrisma.organization.findUnique.mockResolvedValue({
      stripeAccountId: "acct_org_a",
    });
    mockedPrisma.invoice.findMany.mockResolvedValue([eligibleInvoice()]);
    mockedSummaries.mockResolvedValue(
      financialSummaries([INVOICE_ID, { paid: 0, credited: 0, balance: 100 }]),
    );
    mockedPrisma.payment.findFirst.mockResolvedValue(null);
    mockedPrisma.providerReceiptAllocation.update.mockResolvedValue({});
  };

  it("reserves against every figure the decision was taken from, not the version alone", async () => {
    // A refund webhook increments `version` too. Matching the figures as well
    // is what keeps the reservation arithmetic conditional on the arithmetic
    // that produced it.
    setUpEligible({ allocatedAmount: 20, refundedAmount: 10 });
    const tx = runTransaction();
    mockedPayments.recordInvoicePayment.mockResolvedValue({
      payment: { id: "pay-1" },
      appliedAmount: 70,
    });
    mockedPrisma.providerReceipt.findUnique.mockResolvedValue(
      readback({
        allocatedAmount: 90,
        refundedAmount: 10,
        status: "ALLOCATED",
      }),
    );

    await ProviderReceiptService.allocate(
      request({ allocations: [{ invoiceId: INVOICE_ID, amount: 70 }] }),
    );

    expect(tx.providerReceipt.updateMany).toHaveBeenCalledWith({
      where: {
        id: RECEIPT_ID,
        version: 3,
        organisationId: "org-a",
        allocatedAmount: 20,
        refundedAmount: 10,
        status: "UNALLOCATED",
      },
      data: {
        allocatedAmount: { increment: 70 },
        status: "ALLOCATED",
        version: { increment: 1 },
      },
    });
  });

  it("records the decision and posts it, then reports the residual", async () => {
    setUpEligible();
    const tx = runTransaction();
    mockedPayments.recordInvoicePayment.mockResolvedValue({
      payment: { id: "pay-1" },
      appliedAmount: 60,
    });
    mockedPrisma.providerReceipt.findUnique.mockResolvedValue(
      readback({ allocatedAmount: 60, status: "UNALLOCATED" }),
    );

    const result = await ProviderReceiptService.allocate(
      request({ allocations: [{ invoiceId: INVOICE_ID, amount: 60 }] }),
    );

    expect(tx.providerReceiptAllocation.create).toHaveBeenCalledWith({
      data: {
        receiptId: RECEIPT_ID,
        invoiceId: INVOICE_ID,
        amount: 60,
        idempotencyKey: "key-1",
        actorId: "actor-1",
      },
      select: { id: true, invoiceId: true, amount: true },
    });
    expect(mockedPayments.recordInvoicePayment).toHaveBeenCalledWith(
      INVOICE_ID,
      {
        provider: "STRIPE",
        amount: 60,
        currency: "gbp",
        providerPaymentId: "pi_captured",
        receivedAt: new Date("2026-09-18T10:00:00.000Z"),
      },
    );
    expect(result).toEqual({
      outcome: "APPLIED",
      receipt: expect.objectContaining({ allocatedAmount: 60 }),
      remainingAmount: 40,
      allocations: [{ invoiceId: INVOICE_ID, amount: 60, paymentId: "pay-1" }],
    });
  });

  it("reports the stored version when the receipt moved under the decision", async () => {
    setUpEligible();
    runTransaction(0);
    mockedPrisma.providerReceipt.findUnique.mockResolvedValue({ version: 5 });

    expect(await ProviderReceiptService.allocate(request())).toEqual({
      outcome: "VERSION_CONFLICT",
      version: 5,
    });
    // Nothing moved: the transaction rolled the reservation back with it.
    expect(mockedPayments.recordInvoicePayment).not.toHaveBeenCalled();
  });

  it("calls a second decision on an invoice this capture already funded a conflict, not a retry", async () => {
    setUpEligible();
    const tx = {
      providerReceipt: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      providerReceiptAllocation: {
        create: jest.fn().mockRejectedValue(
          Object.assign(new Error("Unique constraint failed"), {
            code: "P2002",
          }),
        ),
      },
    };
    mockedPrisma.$transaction.mockImplementation(
      (fn: (client: typeof tx) => unknown) => Promise.resolve(fn(tx)),
    );
    mockedPrisma.providerReceiptAllocation.findFirst.mockResolvedValue({
      invoiceId: INVOICE_ID,
    });

    expect(await ProviderReceiptService.allocate(request())).toEqual({
      outcome: "INVOICE_NOT_ELIGIBLE",
      invoiceId: INVOICE_ID,
      reason: "ALREADY_ALLOCATED",
    });
    expect(mockedPayments.recordInvoicePayment).not.toHaveBeenCalled();
  });

  it("rethrows a failure that is neither a lost race nor a collision", async () => {
    // Reporting a database outage to an operator as their own stale read would
    // send them round a reload loop that cannot succeed.
    setUpEligible();
    mockedPrisma.$transaction.mockRejectedValue(new Error("connection reset"));

    await expect(ProviderReceiptService.allocate(request())).rejects.toThrow(
      "connection reset",
    );
  });

  it("does not post a second payment for a capture the invoice already carries", async () => {
    // The readback is what stops the webhook's posting and an operator's
    // allocation crediting one capture twice.
    setUpEligible();
    runTransaction();
    mockedPrisma.payment.findFirst.mockResolvedValue({
      id: "pay-webhook",
      amount: 100,
    });
    mockedPrisma.providerReceipt.findUnique.mockResolvedValue(
      readback({ allocatedAmount: 100, status: "ALLOCATED" }),
    );

    const result = await ProviderReceiptService.allocate(request());

    expect(mockedPayments.recordInvoicePayment).not.toHaveBeenCalled();
    expect(mockedPrisma.payment.findFirst).toHaveBeenCalledWith({
      where: {
        invoiceId: INVOICE_ID,
        providerPaymentId: "pi_captured",
        status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"] },
      },
      select: { id: true, amount: true },
    });
    expect(result).toEqual(
      expect.objectContaining({
        allocations: [
          { invoiceId: INVOICE_ID, amount: 100, paymentId: "pay-webhook" },
        ],
      }),
    );
  });

  it("returns to the residual whatever the invoice would not take", async () => {
    // The reservation is taken in full before any money moves, so a shortfall
    // has to be released afterwards or the capture reads as more applied than
    // it is - and the issue's oracle stops adding up.
    setUpEligible();
    runTransaction();
    mockedPayments.recordInvoicePayment.mockResolvedValue({
      payment: { id: "pay-1" },
      appliedAmount: 30,
    });
    mockedPrisma.providerReceipt.update.mockResolvedValue({
      status: "ALLOCATED",
      amount: 100,
      refundedAmount: 0,
      allocatedAmount: 30,
    });
    mockedPrisma.providerReceipt.findUnique.mockResolvedValue(
      readback({ allocatedAmount: 30, status: "UNALLOCATED" }),
    );

    const result = await ProviderReceiptService.allocate(request());

    expect(mockedPrisma.providerReceipt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: RECEIPT_ID },
        data: {
          allocatedAmount: { decrement: 70 },
          version: { increment: 1 },
        },
      }),
    );
    // The release is a decrement, so it cannot overwrite an allocation another
    // operator made while the money was posting.
    expect(mockedLogger.warn).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        allocations: [
          { invoiceId: INVOICE_ID, amount: 30, paymentId: "pay-1" },
        ],
      }),
    );
  });

  it("corrects the status when releasing a shortfall makes the receipt unallocated again", async () => {
    setUpEligible();
    runTransaction();
    mockedPayments.recordInvoicePayment.mockResolvedValue({
      payment: { id: "pay-1" },
      appliedAmount: 30,
    });
    // The decrement leaves the receipt no longer fully applied, but the
    // reservation had already written ALLOCATED.
    mockedPrisma.providerReceipt.update.mockResolvedValue({
      status: "ALLOCATED",
      amount: 100,
      refundedAmount: 0,
      allocatedAmount: 30,
    });
    mockedPrisma.providerReceipt.findUnique.mockResolvedValue(
      readback({ allocatedAmount: 30, status: "UNALLOCATED" }),
    );

    await ProviderReceiptService.allocate(request());

    expect(mockedPrisma.providerReceipt.update).toHaveBeenLastCalledWith({
      where: { id: RECEIPT_ID },
      data: { status: "UNALLOCATED", version: { increment: 1 } },
    });
  });
});

describe("ProviderReceiptService.allocate - retrying the same decision", () => {
  it("answers a retry with what happened, without re-validating anything", async () => {
    // Re-validating would reject the caller's own successful write: the
    // invoice it was applied to now owes less than the request asked for.
    mockedPrisma.providerReceipt.findUnique
      .mockResolvedValueOnce(
        receipt({ allocatedAmount: 100, status: "ALLOCATED" }),
      )
      .mockResolvedValue(
        readback({ allocatedAmount: 100, status: "ALLOCATED" }),
      );
    mockedPrisma.providerReceiptAllocation.findMany
      .mockResolvedValueOnce([
        {
          id: "alloc-1",
          invoiceId: INVOICE_ID,
          amount: 100,
          paymentId: "pay-1",
        },
      ])
      .mockResolvedValue([
        { invoiceId: INVOICE_ID, amount: 100, paymentId: "pay-1" },
      ]);

    const result = await ProviderReceiptService.allocate(request());

    expect(result).toEqual({
      outcome: "REPLAYED",
      receipt: expect.objectContaining({ status: "ALLOCATED" }),
      remainingAmount: 0,
      allocations: [{ invoiceId: INVOICE_ID, amount: 100, paymentId: "pay-1" }],
    });
    expect(mockedPrisma.invoice.findMany).not.toHaveBeenCalled();
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockedPayments.recordInvoicePayment).not.toHaveBeenCalled();
  });

  it("finishes a decision that was recorded but never posted", async () => {
    // The state a crash between the two leaves behind. Without this the money
    // is reserved on the receipt and absent from the invoice, and no later
    // call would ever place it.
    mockedPrisma.providerReceipt.findUnique
      .mockResolvedValueOnce(
        receipt({ allocatedAmount: 100, status: "ALLOCATED" }),
      )
      .mockResolvedValue(
        readback({ allocatedAmount: 100, status: "ALLOCATED" }),
      );
    mockedPrisma.providerReceiptAllocation.findMany
      .mockResolvedValueOnce([
        { id: "alloc-1", invoiceId: INVOICE_ID, amount: 100, paymentId: null },
      ])
      .mockResolvedValue([
        { invoiceId: INVOICE_ID, amount: 100, paymentId: "pay-late" },
      ]);
    mockedPrisma.payment.findFirst.mockResolvedValue(null);
    mockedPayments.recordInvoicePayment.mockResolvedValue({
      payment: { id: "pay-late" },
      appliedAmount: 100,
    });
    mockedPrisma.providerReceiptAllocation.update.mockResolvedValue({});

    const result = await ProviderReceiptService.allocate(request());

    expect(mockedPayments.recordInvoicePayment).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.providerReceiptAllocation.update).toHaveBeenCalledWith({
      where: { id: "alloc-1" },
      data: {
        amount: 100,
        paymentId: "pay-late",
        appliedAt: expect.any(Date),
      },
    });
    // No second reservation: the receipt's allocatedAmount already carries it.
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({ outcome: "REPLAYED", remainingAmount: 0 }),
    );
  });

  it("leaves a posted line alone while finishing an unposted one", async () => {
    mockedPrisma.providerReceipt.findUnique
      .mockResolvedValueOnce(
        receipt({ allocatedAmount: 100, status: "ALLOCATED" }),
      )
      .mockResolvedValue(
        readback({ allocatedAmount: 100, status: "ALLOCATED" }),
      );
    mockedPrisma.providerReceiptAllocation.findMany
      .mockResolvedValueOnce([
        {
          id: "alloc-1",
          invoiceId: INVOICE_ID,
          amount: 60,
          paymentId: "pay-1",
        },
        {
          id: "alloc-2",
          invoiceId: OTHER_INVOICE_ID,
          amount: 40,
          paymentId: null,
        },
      ])
      .mockResolvedValue([
        { invoiceId: INVOICE_ID, amount: 60, paymentId: "pay-1" },
        { invoiceId: OTHER_INVOICE_ID, amount: 40, paymentId: "pay-2" },
      ]);
    mockedPrisma.payment.findFirst.mockResolvedValue(null);
    mockedPayments.recordInvoicePayment.mockResolvedValue({
      payment: { id: "pay-2" },
      appliedAmount: 40,
    });
    mockedPrisma.providerReceiptAllocation.update.mockResolvedValue({});

    await ProviderReceiptService.allocate(request());

    expect(mockedPayments.recordInvoicePayment).toHaveBeenCalledTimes(1);
    expect(mockedPayments.recordInvoicePayment).toHaveBeenCalledWith(
      OTHER_INVOICE_ID,
      expect.objectContaining({ amount: 40 }),
    );
  });
});

describe("ProviderReceiptService.allocate - the edges of the recovery paths", () => {
  const setUpEligible = (overrides: Record<string, unknown> = {}) => {
    mockedPrisma.providerReceipt.findUnique.mockResolvedValueOnce(
      receipt(overrides),
    );
    mockedPrisma.providerReceiptAllocation.findMany.mockResolvedValue([]);
    mockedPrisma.organization.findUnique.mockResolvedValue({
      stripeAccountId: "acct_org_a",
    });
    mockedPrisma.invoice.findMany.mockResolvedValue([eligibleInvoice()]);
    mockedSummaries.mockResolvedValue(
      financialSummaries([INVOICE_ID, { paid: 0, credited: 0, balance: 100 }]),
    );
    mockedPrisma.payment.findFirst.mockResolvedValue(null);
    mockedPrisma.providerReceiptAllocation.update.mockResolvedValue({});
  };

  it("falls back to the version it read when the receipt cannot be re-read", async () => {
    // A conflict answered with no version at all would leave the client with
    // nothing to retry from, which is worse than the stale number it sent.
    setUpEligible();
    runTransaction(0);
    mockedPrisma.providerReceipt.findUnique.mockResolvedValue(null);

    expect(await ProviderReceiptService.allocate(request())).toEqual({
      outcome: "VERSION_CONFLICT",
      version: 3,
    });
  });

  it("still reports a collision when the clashing row cannot be identified", async () => {
    setUpEligible();
    const tx = {
      providerReceipt: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      providerReceiptAllocation: {
        create: jest.fn().mockRejectedValue(
          Object.assign(new Error("Unique constraint failed"), {
            code: "P2002",
          }),
        ),
      },
    };
    mockedPrisma.$transaction.mockImplementation(
      (fn: (client: typeof tx) => unknown) => Promise.resolve(fn(tx)),
    );
    mockedPrisma.providerReceiptAllocation.findFirst.mockResolvedValue(null);

    expect(await ProviderReceiptService.allocate(request())).toEqual({
      outcome: "INVOICE_NOT_ELIGIBLE",
      invoiceId: "",
      reason: "ALREADY_ALLOCATED",
    });
  });

  it("treats an invoice with no recorded deposit as having collected nothing", async () => {
    setUpEligible();
    mockedPrisma.invoice.findMany.mockResolvedValue([
      eligibleInvoice({ depositCollectedAmount: null }),
    ]);
    runTransaction();
    mockedPayments.recordInvoicePayment.mockResolvedValue({
      payment: { id: "pay-1" },
      appliedAmount: 100,
    });
    mockedPrisma.providerReceipt.findUnique.mockResolvedValue(
      readback({ allocatedAmount: 100, status: "ALLOCATED" }),
    );

    await ProviderReceiptService.allocate(request());

    expect(mockedSummaries).toHaveBeenCalledWith([
      eligibleInvoice({ depositCollectedAmount: null }),
    ]);
  });

  it("marks nothing applied when the invoice closed between the check and the post", async () => {
    // `recordInvoicePayment` answers a covered invoice with no payment at all.
    // Recording an `appliedAt` on that would claim money moved when none did.
    setUpEligible();
    runTransaction();
    mockedPayments.recordInvoicePayment.mockResolvedValue({
      payment: null,
      appliedAmount: 0,
      replayed: true,
    });
    mockedPrisma.providerReceipt.update.mockResolvedValue({
      status: "ALLOCATED",
      amount: 100,
      refundedAmount: 0,
      allocatedAmount: 0,
    });
    mockedPrisma.providerReceipt.findUnique.mockResolvedValue(
      readback({ allocatedAmount: 0, status: "UNALLOCATED" }),
    );

    const result = await ProviderReceiptService.allocate(request());

    expect(mockedPrisma.providerReceiptAllocation.update).toHaveBeenCalledWith({
      where: { id: `alloc-${INVOICE_ID}` },
      data: { amount: 0, paymentId: null, appliedAt: null },
    });
    // The whole reservation goes back, so the capture is still fully
    // allocatable rather than showing as spent.
    expect(mockedPrisma.providerReceipt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          allocatedAmount: { decrement: 100 },
          version: { increment: 1 },
        },
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({ outcome: "APPLIED", remainingAmount: 100 }),
    );
  });

  it("answers NOT_FOUND when the receipt cannot be read back after posting", async () => {
    setUpEligible();
    runTransaction();
    mockedPayments.recordInvoicePayment.mockResolvedValue({
      payment: { id: "pay-1" },
      appliedAmount: 100,
    });
    mockedPrisma.providerReceipt.findUnique.mockResolvedValue(null);

    expect(await ProviderReceiptService.allocate(request())).toEqual({
      outcome: "NOT_FOUND",
    });
  });
});
