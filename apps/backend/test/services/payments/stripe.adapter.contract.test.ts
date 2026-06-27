import Stripe from "stripe";

import { StripeProviderAdapter } from "src/services/payments/stripe.adapter";
import {
  RefundExceedsCaptureError,
  UnknownPaymentError,
} from "src/services/payments";
import type { PaymentProviderPort } from "src/services/payments";
import {
  runPaymentProviderContract,
  type ProviderContractHarness,
} from "./provider-contract";

// ---------------------------------------------------------------------------
// Prisma mock
// ---------------------------------------------------------------------------

const mockOrgFindUnique = jest.fn();
const mockOrgUpdate = jest.fn();
const mockOrgBillingFindUnique = jest.fn();
const mockOrgBillingUpsert = jest.fn();

jest.mock("src/config/prisma", () => ({
  prisma: {
    organization: {
      findUnique: (...args: unknown[]) => mockOrgFindUnique(...args),
      update: (...args: unknown[]) => mockOrgUpdate(...args),
    },
    organizationBilling: {
      findUnique: (...args: unknown[]) => mockOrgBillingFindUnique(...args),
      upsert: (...args: unknown[]) => mockOrgBillingUpsert(...args),
    },
  },
}));

// ---------------------------------------------------------------------------
// Stripe mock
// ---------------------------------------------------------------------------

const mockAccountsCreate = jest.fn();
const mockAccountSessionsCreate = jest.fn();
const mockCheckoutSessionsCreate = jest.fn();
const mockPaymentIntentsCreate = jest.fn();
const mockRefundsCreate = jest.fn();
const mockWebhooksConstructEvent = jest.fn();

function buildMockStripe(): Stripe {
  return {
    accounts: { create: mockAccountsCreate },
    accountSessions: { create: mockAccountSessionsCreate },
    checkout: { sessions: { create: mockCheckoutSessionsCreate } },
    paymentIntents: { create: mockPaymentIntentsCreate },
    refunds: { create: mockRefundsCreate },
    webhooks: { constructEvent: mockWebhooksConstructEvent },
  } as unknown as Stripe;
}

// ---------------------------------------------------------------------------
// Per-gateway state (reset by makeGateway before each test)
// ---------------------------------------------------------------------------

const TEST_WEBHOOK_SECRET = "whsec_test_secret_xxx";
const VALID_SIG = "t=123,v1=valid_sig_value";
const TAMPERED_SIG = "t=123,v1=tampered_value";

// Pre-seeded accounts so resolveAccountRef works without calling createOrGetConnectedAccount first
const SEED_ACCOUNTS: Record<string, string> = {
  org_1: "acct_seed_org1",
  org_2: "acct_seed_org2",
};

const VALID_WEBHOOK_EVENT = {
  id: "evt_contract_001",
  type: "payment_intent.succeeded",
  data: {
    object: {
      id: "pi_contract_001",
      amount_received: 1999,
      currency: "usd",
      metadata: { invoiceRef: "inv_1" },
      last_payment_error: null,
    },
  },
};

let orgAccounts: Map<string, string>;
let piAmounts: Map<string, number>;
let piRefunded: Map<string, number>;
let piByKey: Map<string, { id: string; client_secret: string; status: string }>;
let reByKey: Map<string, { id: string; status: string }>;
let seq: number;

function resetState(): void {
  orgAccounts = new Map(Object.entries(SEED_ACCOUNTS));
  piAmounts = new Map();
  piRefunded = new Map();
  piByKey = new Map();
  reByKey = new Map();
  seq = 0;
}

function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}_mock_${seq}`;
}

function setupMocks(): void {
  jest.clearAllMocks();

  // Organisation DB mocks (stateful)
  mockOrgFindUnique.mockImplementation(
    ({ where: { id } }: { where: { id: string } }) => {
      const acctId = orgAccounts.get(id);
      return Promise.resolve(acctId ? { stripeAccountId: acctId } : null);
    },
  );
  mockOrgUpdate.mockImplementation(
    ({
      where: { id },
      data: { stripeAccountId },
    }: {
      where: { id: string };
      data: { stripeAccountId: string };
    }) => {
      orgAccounts.set(id, stripeAccountId);
      return Promise.resolve({ id, stripeAccountId });
    },
  );
  mockOrgBillingFindUnique.mockImplementation(
    ({ where: { orgId } }: { where: { orgId: string } }) => {
      const acctId = orgAccounts.get(orgId);
      return Promise.resolve(
        acctId
          ? {
              connectAccountId: acctId,
              canAcceptPayments: false,
              connectChargesEnabled: false,
              connectPayoutsEnabled: false,
              connectDisabledReason: null,
            }
          : null,
      );
    },
  );
  mockOrgBillingUpsert.mockImplementation(
    ({
      where: { orgId },
      create,
    }: {
      where: { orgId: string };
      create: { connectAccountId: string };
    }) => {
      orgAccounts.set(orgId, create.connectAccountId);
      return Promise.resolve(create);
    },
  );

  // Stripe API mocks (stateful for idempotency and over-refund)
  mockAccountsCreate.mockImplementation(() =>
    Promise.resolve({ id: nextId("acct") }),
  );
  mockAccountSessionsCreate.mockImplementation(() =>
    Promise.resolve({ client_secret: nextId("acas") }),
  );
  mockCheckoutSessionsCreate.mockImplementation(() => {
    const id = nextId("cs");
    return Promise.resolve({
      id,
      url: `https://checkout.stripe.com/pay/${id}`,
    });
  });

  mockPaymentIntentsCreate.mockImplementation(
    (
      params: { amount: number; currency: string },
      opts?: { idempotencyKey?: string },
    ) => {
      const key = opts?.idempotencyKey;
      if (key && piByKey.has(key)) return Promise.resolve(piByKey.get(key));
      const pi = {
        id: nextId("pi"),
        client_secret: nextId("pi_secret"),
        status: "succeeded",
        amount: params.amount,
      };
      if (key) piByKey.set(key, pi);
      piAmounts.set(pi.id, params.amount);
      return Promise.resolve(pi);
    },
  );

  mockRefundsCreate.mockImplementation(
    (
      params: { payment_intent: string; amount: number },
      opts?: { idempotencyKey?: string },
    ) => {
      const key = opts?.idempotencyKey;
      if (key && reByKey.has(key)) return Promise.resolve(reByKey.get(key));

      const captured = piAmounts.get(params.payment_intent);
      if (captured === undefined) {
        const err = Object.assign(
          new Error(`No such payment_intent: '${params.payment_intent}'`),
          { code: "resource_missing", type: "StripeInvalidRequestError" },
        );
        return Promise.reject(err);
      }

      const alreadyRefunded = piRefunded.get(params.payment_intent) ?? 0;
      const refundAmount = params.amount ?? captured;
      if (alreadyRefunded + refundAmount > captured) {
        const err = Object.assign(
          new Error("Amount (in cents) is greater than the captured amount"),
          { code: "amount_too_large", type: "StripeInvalidRequestError" },
        );
        return Promise.reject(err);
      }

      piRefunded.set(params.payment_intent, alreadyRefunded + refundAmount);
      const re = { id: nextId("re"), status: "succeeded" };
      if (key) reByKey.set(key, re);
      return Promise.resolve(re);
    },
  );

  mockWebhooksConstructEvent.mockImplementation(
    (_rawBody: Buffer, sig: string) => {
      if (sig === VALID_SIG) return VALID_WEBHOOK_EVENT;
      const err = Object.assign(
        new Error("No signatures found matching the expected signature"),
        { type: "StripeSignatureVerificationError" },
      );
      throw err;
    },
  );
}

// ---------------------------------------------------------------------------
// Contract harness
// ---------------------------------------------------------------------------

const stripeHarness: ProviderContractHarness = {
  providerLabel: "stripe-adapter",

  makeGateway(): PaymentProviderPort {
    resetState();
    setupMocks();
    return new StripeProviderAdapter(buildMockStripe(), TEST_WEBHOOK_SECRET);
  },

  makeValidWebhook(_gateway) {
    const rawBody = Buffer.from(JSON.stringify(VALID_WEBHOOK_EVENT), "utf8");
    return {
      rawBody,
      headers: { "stripe-signature": VALID_SIG },
      expected: {
        providerEventRef: VALID_WEBHOOK_EVENT.id,
        type: "PAYMENT_SUCCEEDED",
      },
    };
  },

  makeTamperedWebhook(_gateway) {
    const rawBody = Buffer.from(JSON.stringify(VALID_WEBHOOK_EVENT), "utf8");
    return {
      rawBody,
      headers: { "stripe-signature": TAMPERED_SIG },
    };
  },
};

// Run the provider-agnostic contract suite against the Stripe adapter
runPaymentProviderContract(stripeHarness);

// ---------------------------------------------------------------------------
// Stripe-specific assertions (direct-charge model)
// ---------------------------------------------------------------------------

describe("StripeProviderAdapter - direct-charge specifics", () => {
  let gateway: StripeProviderAdapter;

  beforeEach(() => {
    resetState();
    setupMocks();
    gateway = new StripeProviderAdapter(buildMockStripe(), TEST_WEBHOOK_SECRET);
  });

  it("creates a Standard Connect account for a new org and saves to DB", async () => {
    // "org_new" is not in the seed map
    mockOrgFindUnique.mockResolvedValueOnce(null);
    mockAccountsCreate.mockResolvedValueOnce({ id: "acct_fresh" });

    const result = await gateway.createOrGetConnectedAccount("org_new");

    expect(result.accountRef).toBe("acct_fresh");
    expect(mockAccountsCreate).toHaveBeenCalledWith({ type: "standard" });
    expect(mockOrgUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "org_new" },
        data: { stripeAccountId: "acct_fresh" },
      }),
    );
    expect(mockOrgBillingUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orgId: "org_new" },
        update: { connectAccountId: "acct_fresh" },
      }),
    );
  });

  it("passes stripeAccount option on checkout sessions (direct charge)", async () => {
    await gateway.createCheckoutSession({
      orgId: "org_1",
      invoiceRef: "inv_1",
      amount: { minorAmount: 4999, currency: "USD" },
      successUrl: "https://app.test/ok",
      cancelUrl: "https://app.test/cancel",
      idempotencyKey: "cs-direct-1",
    });

    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "payment" }),
      expect.objectContaining({ stripeAccount: SEED_ACCOUNTS.org_1 }),
    );
  });

  it("passes stripeAccount option on payment intents (direct charge)", async () => {
    await gateway.createPayment({
      orgId: "org_1",
      invoiceRef: "inv_1",
      amount: { minorAmount: 2500, currency: "USD" },
      idempotencyKey: "pi-direct-1",
    });

    expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 2500, currency: "usd" }),
      expect.objectContaining({ stripeAccount: SEED_ACCOUNTS.org_1 }),
    );
  });

  it("passes stripeAccount option on refunds (direct charge from clinic balance)", async () => {
    const payment = await gateway.createPayment({
      orgId: "org_1",
      invoiceRef: "inv_1",
      amount: { minorAmount: 2500, currency: "USD" },
      idempotencyKey: "pi-for-refund",
    });

    await gateway.refund({
      orgId: "org_1",
      providerPaymentRef: payment.providerPaymentRef,
      amount: { minorAmount: 500, currency: "USD" },
      idempotencyKey: "re-direct-1",
    });

    expect(mockRefundsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: payment.providerPaymentRef }),
      expect.objectContaining({ stripeAccount: SEED_ACCOUNTS.org_1 }),
    );
  });

  it("normalizes payment_intent.payment_failed to PAYMENT_FAILED", () => {
    const rawEvent = {
      id: "evt_fail_001",
      type: "payment_intent.payment_failed",
      data: {
        object: {
          id: "pi_fail_001",
          metadata: { invoiceRef: "inv_2" },
          last_payment_error: {
            code: "card_declined",
            message: "Your card was declined.",
          },
        },
      },
    };
    mockWebhooksConstructEvent.mockReturnValueOnce(rawEvent);

    const rawBody = Buffer.from(JSON.stringify(rawEvent));
    const events = gateway.verifyAndNormalizeWebhook(rawBody, {
      "stripe-signature": VALID_SIG,
    });

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("PAYMENT_FAILED");
    expect(events[0].failureCode).toBe("card_declined");
    expect(events[0].invoiceRef).toBe("inv_2");
  });

  it("normalizes account.updated to ACCOUNT_UPDATED", () => {
    const rawEvent = {
      id: "evt_acct_001",
      type: "account.updated",
      data: { object: { id: "acct_seed_org1" } },
    };
    mockWebhooksConstructEvent.mockReturnValueOnce(rawEvent);

    const rawBody = Buffer.from(JSON.stringify(rawEvent));
    const events = gateway.verifyAndNormalizeWebhook(rawBody, {
      "stripe-signature": VALID_SIG,
    });

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("ACCOUNT_UPDATED");
    expect(events[0].accountRef).toBe("acct_seed_org1");
  });

  it("returns empty array for unhandled webhook event types", () => {
    const rawEvent = {
      id: "evt_unknown_001",
      type: "customer.created",
      data: { object: {} },
    };
    mockWebhooksConstructEvent.mockReturnValueOnce(rawEvent);

    const events = gateway.verifyAndNormalizeWebhook(
      Buffer.from(JSON.stringify(rawEvent)),
      {
        "stripe-signature": VALID_SIG,
      },
    );

    expect(events).toHaveLength(0);
  });

  it("throws WebhookVerificationError when stripe-signature header is missing", () => {
    expect(() =>
      gateway.verifyAndNormalizeWebhook(Buffer.from("{}"), {}),
    ).toThrow("Missing stripe-signature header");
  });

  it("maps Stripe resource_missing to UnknownPaymentError", async () => {
    await expect(
      gateway.refund({
        orgId: "org_1",
        providerPaymentRef: "pi_does_not_exist",
        amount: { minorAmount: 100, currency: "USD" },
        idempotencyKey: "re-missing",
      }),
    ).rejects.toBeInstanceOf(UnknownPaymentError);
  });

  it("maps Stripe amount_too_large to RefundExceedsCaptureError", async () => {
    const payment = await gateway.createPayment({
      orgId: "org_1",
      invoiceRef: "inv_x",
      amount: { minorAmount: 500, currency: "USD" },
      idempotencyKey: "pi-over-refund",
    });

    // over-refund: 600 > 500
    await expect(
      gateway.refund({
        orgId: "org_1",
        providerPaymentRef: payment.providerPaymentRef,
        amount: { minorAmount: 600, currency: "USD" },
        idempotencyKey: "re-over",
      }),
    ).rejects.toBeInstanceOf(RefundExceedsCaptureError);
  });

  it("throws ACCOUNT_NOT_FOUND when org has no stripeAccountId", async () => {
    mockOrgFindUnique.mockResolvedValue(null);

    await expect(
      gateway.createPayment({
        orgId: "org_no_account",
        invoiceRef: "inv_1",
        amount: { minorAmount: 1000, currency: "USD" },
        idempotencyKey: "pi-no-acct",
      }),
    ).rejects.toMatchObject({ code: "ACCOUNT_NOT_FOUND" });
  });
});
