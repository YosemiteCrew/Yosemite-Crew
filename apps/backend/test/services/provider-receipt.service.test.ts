import {
  PLATFORM_MERCHANT_ACCOUNT_REF,
  ProviderReceiptService,
  initialReceiptStatus,
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

  it("reports the stored state when a concurrent delivery won the attribution", async () => {
    // count 0 means the row left UNATTRIBUTED between the read and the write.
    // Reporting the status we intended would be reporting a state that is not
    // stored.
    mockedPrisma.providerReceipt.create.mockRejectedValue(uniqueViolation());
    mockedPrisma.providerReceipt.findUnique.mockResolvedValue({
      id: "receipt-1",
      status: "UNATTRIBUTED",
    });
    mockedPrisma.providerReceipt.updateMany.mockResolvedValue({ count: 0 });

    const result = await ProviderReceiptService.journalCapture(
      capture({ organisationId: "org-1" }),
    );

    expect(result?.status).toBe("UNATTRIBUTED");
  });
});
