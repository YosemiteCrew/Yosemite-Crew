import { PaymentWebhookService } from "src/services/payments/webhook.service";
import { PaymentProviderRegistry } from "src/services/payments/registry";
import {
  WebhookVerificationError,
  UnknownProviderError,
} from "src/services/payments/errors";
import type { PaymentProviderPort } from "src/services/payments/port";
import type { NormalizedPaymentEvent } from "src/services/payments/types";
import { prisma } from "src/config/prisma";

// ---------------------------------------------------------------------------
// Prisma mock
// ---------------------------------------------------------------------------

const mockCreate = jest.fn();
const mockPaymentAttemptFindFirst = jest.fn();
const mockPaymentAttemptUpdate = jest.fn();
const mockPaymentAttemptUpdateMany = jest.fn();
const mockPaymentUpsert = jest.fn();
const mockRefundUpdateMany = jest.fn();
const mockOrgBillingFindFirst = jest.fn();
const mockOrgBillingUpdateMany = jest.fn();

jest.mock("src/config/prisma", () => ({
  prisma: {
    processedWebhookEvent: { create: (...a: unknown[]) => mockCreate(...a) },
    paymentAttempt: {
      findFirst: (...a: unknown[]) => mockPaymentAttemptFindFirst(...a),
      update: (...a: unknown[]) => mockPaymentAttemptUpdate(...a),
      updateMany: (...a: unknown[]) => mockPaymentAttemptUpdateMany(...a),
    },
    payment: { upsert: (...a: unknown[]) => mockPaymentUpsert(...a) },
    refund: { updateMany: (...a: unknown[]) => mockRefundUpdateMany(...a) },
    organizationBilling: {
      findFirst: (...a: unknown[]) => mockOrgBillingFindFirst(...a),
      updateMany: (...a: unknown[]) => mockOrgBillingUpdateMany(...a),
    },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
  },
}));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const rawBody = Buffer.from("{}");
const headers = { "stripe-signature": "sig_test" };

function buildAdapter(
  events: NormalizedPaymentEvent[],
  throws?: unknown,
): PaymentProviderPort {
  return {
    provider: "STRIPE",
    capabilities: {} as never,
    verifyAndNormalizeWebhook: jest.fn(() => {
      if (throws) throw throws;
      return events;
    }),
    getAccountStatus: jest.fn().mockResolvedValue({
      accountRef: "acct_123",
      onboardingState: "READY",
      chargesEnabled: true,
      payoutsEnabled: true,
      disabledReason: null,
    }),
    createOrGetConnectedAccount: jest.fn(),
    createOnboardingLink: jest.fn(),
    createCheckoutSession: jest.fn(),
    createPayment: jest.fn(),
    refund: jest.fn(),
  };
}

function buildService(adapter: PaymentProviderPort) {
  const registry = new PaymentProviderRegistry();
  registry.register(adapter);
  return new PaymentWebhookService(registry);
}

const baseEvent: NormalizedPaymentEvent = {
  providerEventRef: "evt_001",
  type: "PAYMENT_SUCCEEDED",
};

beforeEach(() => {
  jest.clearAllMocks();
  // Default: create succeeds (new event)
  mockCreate.mockResolvedValue({});
  (prisma.$transaction as jest.Mock).mockImplementation((ops: unknown[]) =>
    Promise.all(ops),
  );
});

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

describe("deduplication", () => {
  it("processes a new event and returns dispatched=1", async () => {
    mockCreate.mockResolvedValue({});
    mockPaymentAttemptFindFirst.mockResolvedValue(null);
    const svc = buildService(buildAdapter([baseEvent]));
    const count = await svc.handle("STRIPE", rawBody, headers);
    expect(count).toBe(1);
  });

  it("skips a duplicate event and returns dispatched=0", async () => {
    mockCreate.mockRejectedValue({ code: "P2002" });
    const svc = buildService(buildAdapter([baseEvent]));
    const count = await svc.handle("STRIPE", rawBody, headers);
    expect(count).toBe(0);
    expect(mockPaymentAttemptFindFirst).not.toHaveBeenCalled();
  });

  it("processes two events, deduplicates the second", async () => {
    const events: NormalizedPaymentEvent[] = [
      { providerEventRef: "evt_A", type: "PAYMENT_SUCCEEDED" },
      { providerEventRef: "evt_B", type: "PAYMENT_FAILED" },
    ];
    mockCreate
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce({ code: "P2002" });
    mockPaymentAttemptFindFirst.mockResolvedValue(null);

    const svc = buildService(buildAdapter(events));
    const count = await svc.handle("STRIPE", rawBody, headers);
    expect(count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Verification error
// ---------------------------------------------------------------------------

describe("webhook verification", () => {
  it("propagates WebhookVerificationError", async () => {
    const adapter = buildAdapter([], new WebhookVerificationError());
    const svc = buildService(adapter);
    await expect(svc.handle("STRIPE", rawBody, headers)).rejects.toBeInstanceOf(
      WebhookVerificationError,
    );
  });

  it("throws UnknownProviderError for unregistered provider", async () => {
    const registry = new PaymentProviderRegistry();
    const svc = new PaymentWebhookService(registry);
    await expect(
      svc.handle("CARECREDIT", rawBody, headers),
    ).rejects.toBeInstanceOf(UnknownProviderError);
  });
});

// ---------------------------------------------------------------------------
// PAYMENT_SUCCEEDED dispatch
// ---------------------------------------------------------------------------

describe("PAYMENT_SUCCEEDED", () => {
  const event: NormalizedPaymentEvent = {
    providerEventRef: "evt_pay_ok",
    type: "PAYMENT_SUCCEEDED",
    providerPaymentRef: "pi_abc",
    amount: { minorAmount: 5000, currency: "usd" },
  };

  it("updates attempt + upserts Payment", async () => {
    const attempt = {
      id: "att_1",
      invoiceId: "inv_1",
      provider: "STRIPE",
      amountRequested: 5000,
      currency: "usd",
    };
    mockPaymentAttemptFindFirst.mockResolvedValue(attempt);

    const svc = buildService(buildAdapter([event]));
    await svc.handle("STRIPE", rawBody, headers);

    expect(mockPaymentAttemptUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "att_1" },
        data: expect.objectContaining({ status: "SUCCEEDED" }),
      }),
    );
    expect(mockPaymentUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { paymentAttemptId: "att_1" },
        update: expect.objectContaining({ status: "SUCCEEDED" }),
      }),
    );
  });

  it("skips update when no matching attempt found", async () => {
    mockPaymentAttemptFindFirst.mockResolvedValue(null);
    const svc = buildService(buildAdapter([event]));
    await svc.handle("STRIPE", rawBody, headers);
    expect(mockPaymentAttemptUpdate).not.toHaveBeenCalled();
  });

  it("uses attempt amounts as fallback when event carries no amount", async () => {
    const event: NormalizedPaymentEvent = {
      providerEventRef: "evt_pay_no_amt",
      type: "PAYMENT_SUCCEEDED",
      providerPaymentRef: "pi_fallback",
    };
    const attempt = {
      id: "att_2",
      invoiceId: "inv_2",
      provider: "STRIPE",
      amountRequested: 3000,
      currency: "gbp",
    };
    mockPaymentAttemptFindFirst.mockResolvedValue(attempt);
    const svc = buildService(buildAdapter([event]));
    await svc.handle("STRIPE", rawBody, headers);

    expect(mockPaymentAttemptUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amountCaptured: 3000 }),
      }),
    );
    expect(mockPaymentUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ amount: 3000, currency: "gbp" }),
      }),
    );
  });

  it("skips dispatch when providerPaymentRef is missing", async () => {
    const noRef: NormalizedPaymentEvent = {
      providerEventRef: "evt_no_ref",
      type: "PAYMENT_SUCCEEDED",
    };
    const svc = buildService(buildAdapter([noRef]));
    await svc.handle("STRIPE", rawBody, headers);
    expect(mockPaymentAttemptFindFirst).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// PAYMENT_FAILED dispatch
// ---------------------------------------------------------------------------

describe("PAYMENT_FAILED", () => {
  it("marks attempt as FAILED with failure details", async () => {
    const event: NormalizedPaymentEvent = {
      providerEventRef: "evt_pay_fail",
      type: "PAYMENT_FAILED",
      providerPaymentRef: "pi_xyz",
      failureCode: "card_declined",
      failureMessage: "Your card was declined.",
    };
    const svc = buildService(buildAdapter([event]));
    await svc.handle("STRIPE", rawBody, headers);

    expect(mockPaymentAttemptUpdateMany).toHaveBeenCalledWith({
      where: { providerPaymentIntentId: "pi_xyz" },
      data: {
        status: "FAILED",
        failureCode: "card_declined",
        failureMessage: "Your card was declined.",
      },
    });
  });

  it("skips when providerPaymentRef is missing", async () => {
    const event: NormalizedPaymentEvent = {
      providerEventRef: "evt_fail_no_ref",
      type: "PAYMENT_FAILED",
    };
    const svc = buildService(buildAdapter([event]));
    await svc.handle("STRIPE", rawBody, headers);
    expect(mockPaymentAttemptUpdateMany).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// REFUND_SUCCEEDED / REFUND_FAILED dispatch
// ---------------------------------------------------------------------------

describe("REFUND_SUCCEEDED", () => {
  it("marks refund as SUCCEEDED", async () => {
    const event: NormalizedPaymentEvent = {
      providerEventRef: "evt_ref_ok",
      type: "REFUND_SUCCEEDED",
      providerRefundRef: "re_001",
    };
    const svc = buildService(buildAdapter([event]));
    await svc.handle("STRIPE", rawBody, headers);
    expect(mockRefundUpdateMany).toHaveBeenCalledWith({
      where: { providerRefundId: "re_001" },
      data: { status: "SUCCEEDED" },
    });
  });

  it("skips when providerRefundRef is missing", async () => {
    const event: NormalizedPaymentEvent = {
      providerEventRef: "evt_ref_no_ref",
      type: "REFUND_SUCCEEDED",
    };
    const svc = buildService(buildAdapter([event]));
    await svc.handle("STRIPE", rawBody, headers);
    expect(mockRefundUpdateMany).not.toHaveBeenCalled();
  });
});

describe("REFUND_FAILED", () => {
  it("marks refund as FAILED", async () => {
    const event: NormalizedPaymentEvent = {
      providerEventRef: "evt_ref_fail",
      type: "REFUND_FAILED",
      providerRefundRef: "re_002",
    };
    const svc = buildService(buildAdapter([event]));
    await svc.handle("STRIPE", rawBody, headers);
    expect(mockRefundUpdateMany).toHaveBeenCalledWith({
      where: { providerRefundId: "re_002" },
      data: { status: "FAILED" },
    });
  });

  it("skips when providerRefundRef is missing", async () => {
    const event: NormalizedPaymentEvent = {
      providerEventRef: "evt_ref_fail_no_ref",
      type: "REFUND_FAILED",
    };
    const svc = buildService(buildAdapter([event]));
    await svc.handle("STRIPE", rawBody, headers);
    expect(mockRefundUpdateMany).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// ACCOUNT_UPDATED dispatch
// ---------------------------------------------------------------------------

describe("ACCOUNT_UPDATED", () => {
  it("refreshes account status from adapter", async () => {
    const event: NormalizedPaymentEvent = {
      providerEventRef: "evt_acct_upd",
      type: "ACCOUNT_UPDATED",
      accountRef: "acct_123",
    };
    mockOrgBillingFindFirst.mockResolvedValue({ orgId: "org_1" });

    const adapter = buildAdapter([event]);
    const svc = buildService(adapter);
    await svc.handle("STRIPE", rawBody, headers);

    expect(adapter.getAccountStatus).toHaveBeenCalledWith("org_1");
    expect(mockOrgBillingUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { connectAccountId: "acct_123" },
        data: expect.objectContaining({
          canAcceptPayments: true,
          connectChargesEnabled: true,
          connectPayoutsEnabled: true,
        }),
      }),
    );
  });

  it("skips when no billing record matches accountRef", async () => {
    const event: NormalizedPaymentEvent = {
      providerEventRef: "evt_acct_miss",
      type: "ACCOUNT_UPDATED",
      accountRef: "acct_unknown",
    };
    mockOrgBillingFindFirst.mockResolvedValue(null);

    const svc = buildService(buildAdapter([event]));
    await svc.handle("STRIPE", rawBody, headers);
    expect(mockOrgBillingUpdateMany).not.toHaveBeenCalled();
  });

  it("skips when accountRef is missing", async () => {
    const event: NormalizedPaymentEvent = {
      providerEventRef: "evt_acct_no_ref",
      type: "ACCOUNT_UPDATED",
    };
    const svc = buildService(buildAdapter([event]));
    await svc.handle("STRIPE", rawBody, headers);
    expect(mockOrgBillingFindFirst).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Dispatch error isolation
// ---------------------------------------------------------------------------

describe("dispatch error isolation", () => {
  it("does not throw when dispatch fails; other events still process", async () => {
    const events: NormalizedPaymentEvent[] = [
      {
        providerEventRef: "evt_bad",
        type: "PAYMENT_SUCCEEDED",
        providerPaymentRef: "pi_bad",
      },
      {
        providerEventRef: "evt_good",
        type: "PAYMENT_FAILED",
        providerPaymentRef: "pi_good",
      },
    ];
    // Both new
    mockCreate.mockResolvedValue({});
    // First attempt lookup throws
    mockPaymentAttemptFindFirst.mockRejectedValueOnce(new Error("db error"));

    const svc = buildService(buildAdapter(events));
    const count = await svc.handle("STRIPE", rawBody, headers);
    // Both dispatched (errors are caught internally)
    expect(count).toBe(2);
    expect(mockPaymentAttemptUpdateMany).toHaveBeenCalledTimes(1);
  });
});
