import {
  PLATFORM_MERCHANT_ACCOUNT_REF,
  ProviderReceiptService,
  initialReceiptStatus,
  refundedReceiptStatus,
} from "../../src/services/finance/provider-receipt";
import { prisma } from "src/config/prisma";
import logger from "src/utils/logger";

jest.mock("src/config/prisma", () => ({
  prisma: {
    providerReceipt: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const mockedPrisma = prisma as unknown as {
  providerReceipt: {
    create: jest.Mock;
    findUnique: jest.Mock;
    updateMany: jest.Mock;
  };
};
const mockedLogger = logger as unknown as {
  info: jest.Mock;
  error: jest.Mock;
  warn: jest.Mock;
};

const uniqueViolation = () =>
  Object.assign(new Error("Unique constraint failed"), { code: "P2002" });

const capture = (overrides: Record<string, unknown> = {}) => ({
  provider: "STRIPE" as const,
  merchantAccountRef: "acct_connected",
  paymentRef: "pi_captured",
  amount: 42.5,
  currency: "gbp",
  capturedAt: new Date("2026-09-18T10:00:00.000Z"),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("initialReceiptStatus", () => {
  it("separates attribution from allocation", () => {
    // Three distinct facts, and conflating any two of them is what makes a
    // reconciliation queue lie: money whose owner is unknown is not the same
    // as money whose owner is known and which has been applied to nothing.
    expect(initialReceiptStatus({})).toBe("UNATTRIBUTED");
    expect(initialReceiptStatus({ organisationId: "org-1" })).toBe(
      "UNALLOCATED",
    );
    expect(
      initialReceiptStatus({ organisationId: "org-1", invoiceId: "inv-1" }),
    ).toBe("ALLOCATED");
  });

  it("does not call a receipt allocated on an invoice it cannot attribute", () => {
    // An invoice with no organisation is not a state this journal should
    // invent an owner for, and ALLOCATED would assert one.
    expect(initialReceiptStatus({ invoiceId: "inv-1" })).toBe("UNATTRIBUTED");
  });
});

describe("ProviderReceiptService.journalCapture", () => {
  it("records a capture that has no invoice and no organisation", async () => {
    // The whole point: Payment and PaymentAttempt both require an invoiceId,
    // so before this the five webhook exits where the card is charged and no
    // invoice can be minted wrote a log line and nothing else.
    mockedPrisma.providerReceipt.create.mockResolvedValue({
      id: "receipt-1",
      status: "UNATTRIBUTED",
    });

    const result = await ProviderReceiptService.journalCapture(
      capture({ reason: "appointment no longer exists" }),
    );

    expect(result).toEqual({
      id: "receipt-1",
      status: "UNATTRIBUTED",
      created: true,
    });
    const [{ data }] = mockedPrisma.providerReceipt.create.mock.calls[0];
    expect(data).toMatchObject({
      provider: "STRIPE",
      merchantAccountRef: "acct_connected",
      paymentRef: "pi_captured",
      organisationId: null,
      invoiceId: null,
      amount: 42.5,
      currency: "gbp",
      status: "UNATTRIBUTED",
      reason: "appointment no longer exists",
    });
  });

  it("carries the organisation and invoice through when the caller knew them", async () => {
    mockedPrisma.providerReceipt.create.mockResolvedValue({
      id: "receipt-2",
      status: "ALLOCATED",
    });

    await ProviderReceiptService.journalCapture(
      capture({
        organisationId: "org-1",
        invoiceId: "inv-1",
        appointmentId: "appt-1",
      }),
    );

    const [{ data }] = mockedPrisma.providerReceipt.create.mock.calls[0];
    expect(data).toMatchObject({
      organisationId: "org-1",
      invoiceId: "inv-1",
      appointmentId: "appt-1",
      status: "ALLOCATED",
    });
  });

  it("uses the platform sentinel rather than a null merchant account", async () => {
    // NULLs stay distinct in a Postgres unique index, so a nullable merchant
    // account would let the same payment reference be journalled twice - the
    // one thing this table exists to prevent.
    mockedPrisma.providerReceipt.create.mockResolvedValue({
      id: "receipt-3",
      status: "UNATTRIBUTED",
    });

    await ProviderReceiptService.journalCapture(
      capture({ merchantAccountRef: null }),
    );

    const [{ data }] = mockedPrisma.providerReceipt.create.mock.calls[0];
    expect(data.merchantAccountRef).toBe(PLATFORM_MERCHANT_ACCOUNT_REF);
    expect(data.merchantAccountRef).not.toBeNull();
  });

  it("returns the row a previous delivery wrote instead of writing a second", async () => {
    // Stripe redelivers on any non-2xx and nothing upstream deduplicates by
    // event id, so the same reference arrives here more than once.
    mockedPrisma.providerReceipt.create.mockRejectedValue(uniqueViolation());
    mockedPrisma.providerReceipt.findUnique.mockResolvedValue({
      id: "receipt-existing",
      status: "UNALLOCATED",
    });

    const result = await ProviderReceiptService.journalCapture(capture());

    expect(result).toEqual({
      id: "receipt-existing",
      status: "UNALLOCATED",
      created: false,
    });
    expect(mockedPrisma.providerReceipt.create).toHaveBeenCalledTimes(1);
    const [{ where }] = mockedPrisma.providerReceipt.findUnique.mock.calls[0];
    expect(where).toEqual({
      provider_merchantAccountRef_paymentRef: {
        provider: "STRIPE",
        merchantAccountRef: "acct_connected",
        paymentRef: "pi_captured",
      },
    });
  });

  it("looks the replay up under the same sentinel it would have written", async () => {
    // The recovery read has to use the key the insert used. Defaulting on the
    // way in and not on the way back would miss the row and report a capture
    // as unjournalled while its row sits there.
    mockedPrisma.providerReceipt.create.mockRejectedValue(uniqueViolation());
    mockedPrisma.providerReceipt.findUnique.mockResolvedValue({
      id: "receipt-existing",
      status: "UNATTRIBUTED",
    });

    await ProviderReceiptService.journalCapture(
      capture({ merchantAccountRef: undefined }),
    );

    const [{ where }] = mockedPrisma.providerReceipt.findUnique.mock.calls[0];
    expect(
      where.provider_merchantAccountRef_paymentRef.merchantAccountRef,
    ).toBe(PLATFORM_MERCHANT_ACCOUNT_REF);
  });

  it("does not report a replay when the colliding row cannot be read back", async () => {
    // A unique violation whose row is then absent is not a redelivery - a
    // different constraint fired. Calling it "already journalled" would be a
    // silent loss of a captured payment.
    mockedPrisma.providerReceipt.create.mockRejectedValue(uniqueViolation());
    mockedPrisma.providerReceipt.findUnique.mockResolvedValue(null);

    const result = await ProviderReceiptService.journalCapture(capture());

    expect(result).toBeNull();
    expect(mockedLogger.error).toHaveBeenCalledTimes(1);
  });

  it("never throws a write failure back at the webhook", async () => {
    // The capture has already happened. Throwing would answer Stripe non-2xx
    // and buy an endless retry of an event that cannot succeed, which is
    // strictly worse than a logged failure.
    mockedPrisma.providerReceipt.create.mockRejectedValue(
      new Error("connection terminated"),
    );

    await expect(
      ProviderReceiptService.journalCapture(capture()),
    ).resolves.toBeNull();
    expect(mockedPrisma.providerReceipt.findUnique).not.toHaveBeenCalled();
    expect(mockedLogger.error).toHaveBeenCalledTimes(1);
  });

  it("omits rawProviderPayload rather than writing a null into a Json column", async () => {
    mockedPrisma.providerReceipt.create.mockResolvedValue({
      id: "receipt-4",
      status: "UNATTRIBUTED",
    });

    await ProviderReceiptService.journalCapture(capture());

    const [{ data }] = mockedPrisma.providerReceipt.create.mock.calls[0];
    expect("rawProviderPayload" in data).toBe(false);
  });
});

describe("attribution on a later delivery", () => {
  it("fills in an unattributed receipt once a caller knows the organisation", async () => {
    // The journal is written FIRST, before any lookup that could throw, so a
    // capture never depends on the rest of the handler succeeding. That is
    // only useful if a later call can say who it belonged to.
    mockedPrisma.providerReceipt.create.mockRejectedValue(uniqueViolation());
    mockedPrisma.providerReceipt.findUnique.mockResolvedValue({
      id: "receipt-1",
      status: "UNATTRIBUTED",
    });
    mockedPrisma.providerReceipt.updateMany.mockResolvedValue({ count: 1 });

    const result = await ProviderReceiptService.journalCapture(
      capture({
        organisationId: "org-1",
        invoiceId: "inv-1",
        reason: "settled against the booking invoice",
      }),
    );

    expect(result).toEqual({
      id: "receipt-1",
      status: "ALLOCATED",
      created: false,
    });
    const [{ where, data }] =
      mockedPrisma.providerReceipt.updateMany.mock.calls[0];
    // The status predicate is in the WHERE and not merely checked beforehand,
    // so two concurrent redeliveries cannot both pass it and both write.
    expect(where).toEqual({ id: "receipt-1", status: "UNATTRIBUTED" });
    expect(data).toMatchObject({
      organisationId: "org-1",
      invoiceId: "inv-1",
      status: "ALLOCATED",
      version: { increment: 1 },
    });
  });

  it("does not rewrite a receipt that has already left UNATTRIBUTED", async () => {
    // Identity is immutable and an operator may already have acted on it.
    mockedPrisma.providerReceipt.create.mockRejectedValue(uniqueViolation());
    mockedPrisma.providerReceipt.findUnique.mockResolvedValue({
      id: "receipt-1",
      status: "ALLOCATED",
    });

    const result = await ProviderReceiptService.journalCapture(
      capture({ organisationId: "org-2", invoiceId: "inv-2" }),
    );

    expect(result?.status).toBe("ALLOCATED");
    expect(mockedPrisma.providerReceipt.updateMany).not.toHaveBeenCalled();
  });

  it("does not attribute when the later delivery knows no more than the first", async () => {
    mockedPrisma.providerReceipt.create.mockRejectedValue(uniqueViolation());
    mockedPrisma.providerReceipt.findUnique.mockResolvedValue({
      id: "receipt-1",
      status: "UNATTRIBUTED",
    });

    const result = await ProviderReceiptService.journalCapture(capture());

    expect(result?.status).toBe("UNATTRIBUTED");
    expect(mockedPrisma.providerReceipt.updateMany).not.toHaveBeenCalled();
  });

  it("re-reads the row when a concurrent delivery won the attribution", async () => {
    // count 0 means the row left UNATTRIBUTED between the read and the write,
    // so NEITHER the status we intended nor the one we first read is the one
    // that is stored. The winner attributed and allocated it; reporting the
    // UNATTRIBUTED we happen to be holding would be just as wrong as reporting
    // the status we wanted.
    mockedPrisma.providerReceipt.create.mockRejectedValue(uniqueViolation());
    mockedPrisma.providerReceipt.findUnique
      .mockResolvedValueOnce({ id: "receipt-1", status: "UNATTRIBUTED" })
      .mockResolvedValueOnce({ status: "ALLOCATED" });
    mockedPrisma.providerReceipt.updateMany.mockResolvedValue({ count: 0 });

    const result = await ProviderReceiptService.journalCapture(
      capture({ organisationId: "org-1" }),
    );

    expect(result?.status).toBe("ALLOCATED");
    expect(mockedPrisma.providerReceipt.findUnique).toHaveBeenLastCalledWith({
      where: { id: "receipt-1" },
      select: { status: true },
    });
  });

  it("does not invent a status when the lost race leaves nothing to re-read", async () => {
    // A row that cannot be read back at all is a different failure from losing
    // the race, and it must not be answered with a guess: the last state this
    // delivery actually observed is the only thing it can honestly report.
    mockedPrisma.providerReceipt.create.mockRejectedValue(uniqueViolation());
    mockedPrisma.providerReceipt.findUnique
      .mockResolvedValueOnce({ id: "receipt-1", status: "UNATTRIBUTED" })
      .mockResolvedValueOnce(null);
    mockedPrisma.providerReceipt.updateMany.mockResolvedValue({ count: 0 });

    const result = await ProviderReceiptService.journalCapture(
      capture({ organisationId: "org-1" }),
    );

    expect(result?.status).toBe("UNATTRIBUTED");
  });
});

describe("refundedReceiptStatus", () => {
  it("keeps a residual visible until the whole capture has gone back", () => {
    // A partially refunded capture still has money to allocate, so folding it
    // into either neighbour would either hide work or invent it.
    expect(refundedReceiptStatus({ amount: 100, refundedAmount: 20 })).toBe(
      "PARTIALLY_REFUNDED",
    );
    expect(refundedReceiptStatus({ amount: 100, refundedAmount: 100 })).toBe(
      "REFUNDED",
    );
  });

  it("treats a refund larger than the capture as fully refunded", () => {
    // It should not happen, and if it does the receipt has nothing left to
    // reconcile. The excess is a discrepancy for a human, not a reason to keep
    // reporting a residual that is not there.
    expect(refundedReceiptStatus({ amount: 100, refundedAmount: 120 })).toBe(
      "REFUNDED",
    );
  });
});

describe("ProviderReceiptService.recordRefund", () => {
  const refund = (overrides: Record<string, unknown> = {}) => ({
    provider: "STRIPE" as const,
    merchantAccountRef: "acct_connected",
    paymentRef: "pi_captured",
    refundedAmount: 20,
    currency: "gbp",
    ...overrides,
  });

  const stored = (overrides: Record<string, unknown> = {}) => ({
    id: "receipt-1",
    amount: 100,
    currency: "gbp",
    status: "ALLOCATED",
    refundedAmount: 0,
    ...overrides,
  });

  it("reduces the receipt for the capture the refund names", async () => {
    mockedPrisma.providerReceipt.findUnique.mockResolvedValueOnce(stored());
    mockedPrisma.providerReceipt.updateMany.mockResolvedValueOnce({ count: 1 });

    const result = await ProviderReceiptService.recordRefund(refund());

    expect(result).toEqual({
      id: "receipt-1",
      status: "PARTIALLY_REFUNDED",
      refundedAmount: 20,
      applied: true,
    });
    expect(mockedPrisma.providerReceipt.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          provider_merchantAccountRef_paymentRef: {
            provider: "STRIPE",
            merchantAccountRef: "acct_connected",
            paymentRef: "pi_captured",
          },
        },
      }),
    );
  });

  it("looks for a platform capture under the sentinel, not under null", async () => {
    // The same reason the sentinel exists at all: a NULL merchant account
    // would not match the row the capture was written to.
    mockedPrisma.providerReceipt.findUnique.mockResolvedValueOnce(stored());
    mockedPrisma.providerReceipt.updateMany.mockResolvedValueOnce({ count: 1 });

    await ProviderReceiptService.recordRefund(
      refund({ merchantAccountRef: null }),
    );

    expect(
      mockedPrisma.providerReceipt.findUnique.mock.calls[0][0].where
        .provider_merchantAccountRef_paymentRef.merchantAccountRef,
    ).toBe(PLATFORM_MERCHANT_ACCOUNT_REF);
  });

  it("marks a capture refunded in full", async () => {
    mockedPrisma.providerReceipt.findUnique.mockResolvedValueOnce(stored());
    mockedPrisma.providerReceipt.updateMany.mockResolvedValueOnce({ count: 1 });

    const result = await ProviderReceiptService.recordRefund(
      refund({ refundedAmount: 100 }),
    );

    expect(result).toMatchObject({ status: "REFUNDED", refundedAmount: 100 });
  });

  it("writes only when the provider's total has gone up", async () => {
    /*
     * The predicate is the whole guarantee, and it is asserted directly
     * because a mocked count cannot distinguish it from a read-then-write: a
     * replayed event, a pair of partial refunds delivered out of order and two
     * concurrent deliveries all converge on the provider's stated total only
     * while the increase is in the WHERE.
     */
    mockedPrisma.providerReceipt.findUnique.mockResolvedValueOnce(stored());
    mockedPrisma.providerReceipt.updateMany.mockResolvedValueOnce({ count: 1 });

    await ProviderReceiptService.recordRefund(refund({ refundedAmount: 35 }));

    expect(mockedPrisma.providerReceipt.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "receipt-1", refundedAmount: { lt: 35 } },
      }),
    );
  });

  it("bumps the version so a later allocation can be made conditional on it", async () => {
    mockedPrisma.providerReceipt.findUnique.mockResolvedValueOnce(stored());
    mockedPrisma.providerReceipt.updateMany.mockResolvedValueOnce({ count: 1 });

    await ProviderReceiptService.recordRefund(refund());

    expect(
      mockedPrisma.providerReceipt.updateMany.mock.calls[0][0].data.version,
    ).toEqual({ increment: 1 });
  });

  it("reports the stored state when the refund was already covered", async () => {
    // A redelivery, an event that arrived behind a later one, or a concurrent
    // delivery that won. None is an error, and none makes the status this call
    // computed the stored one - so the answer comes from a fresh read.
    mockedPrisma.providerReceipt.findUnique
      .mockResolvedValueOnce(stored({ refundedAmount: 100 }))
      .mockResolvedValueOnce({ status: "REFUNDED", refundedAmount: 100 });
    mockedPrisma.providerReceipt.updateMany.mockResolvedValueOnce({ count: 0 });

    const result = await ProviderReceiptService.recordRefund(
      refund({ refundedAmount: 20 }),
    );

    expect(result).toEqual({
      id: "receipt-1",
      status: "REFUNDED",
      refundedAmount: 100,
      applied: false,
    });
    expect(mockedLogger.error).not.toHaveBeenCalled();
  });

  it("refuses a refund with no journalled capture to reverse", async () => {
    // Money left the account against a record this journal does not hold, so
    // it is loud rather than silent.
    mockedPrisma.providerReceipt.findUnique.mockResolvedValueOnce(null);

    const result = await ProviderReceiptService.recordRefund(refund());

    expect(result).toBeNull();
    expect(mockedPrisma.providerReceipt.updateMany).not.toHaveBeenCalled();
    expect(mockedLogger.error).toHaveBeenCalledWith(
      expect.stringContaining("no journalled capture to reverse"),
    );
  });

  it("refuses a refund in a different currency from its capture", async () => {
    // Two currencies do not compare, so this figure would mean nothing beside
    // the amount it is meant to reduce.
    mockedPrisma.providerReceipt.findUnique.mockResolvedValueOnce(
      stored({ currency: "usd" }),
    );

    const result = await ProviderReceiptService.recordRefund(refund());

    expect(result).toBeNull();
    expect(mockedPrisma.providerReceipt.updateMany).not.toHaveBeenCalled();
    expect(mockedLogger.error).toHaveBeenCalledWith(
      expect.stringContaining("different currency"),
    );
  });

  it("never throws a storage failure back at the webhook", async () => {
    // A non-2xx buys an endless provider retry of an event that cannot
    // succeed, and the refund has happened either way.
    mockedPrisma.providerReceipt.findUnique.mockRejectedValueOnce(
      new Error("database unavailable"),
    );

    await expect(
      ProviderReceiptService.recordRefund(refund()),
    ).resolves.toBeNull();
    expect(mockedLogger.error).toHaveBeenCalledWith(
      expect.stringContaining("Could not record refund of pi_captured"),
      expect.any(Error),
    );
  });
});
