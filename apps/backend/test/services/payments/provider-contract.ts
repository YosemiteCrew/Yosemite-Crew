import {
  PaymentProviderError,
  RefundExceedsCaptureError,
  UnknownPaymentError,
  WebhookVerificationError,
} from "src/services/payments";
import type {
  NormalizedPaymentEvent,
  PaymentProviderPort,
} from "src/services/payments";

/**
 * A harness binds the provider-agnostic contract to one implementation. Every
 * provider (the fake, and later the Stripe and Adyen adapters) supplies one of
 * these, so they all prove identical behaviour against the same assertions.
 */
export interface ProviderContractHarness {
  providerLabel: string;
  makeGateway(): PaymentProviderPort;
  makeValidWebhook(gateway: PaymentProviderPort): {
    rawBody: Buffer;
    headers: Record<string, string | string[] | undefined>;
    expected: NormalizedPaymentEvent;
  };
  makeTamperedWebhook(gateway: PaymentProviderPort): {
    rawBody: Buffer;
    headers: Record<string, string | string[] | undefined>;
  };
}

const usd = (minorAmount: number) => ({ minorAmount, currency: "USD" });

const PAYMENT_STATUSES = [
  "REQUIRES_ACTION",
  "PROCESSING",
  "SUCCEEDED",
  "FAILED",
  "CANCELED",
];
const REFUND_STATUSES = ["PENDING", "SUCCEEDED", "FAILED"];
const ONBOARDING_STATES = ["NOT_STARTED", "IN_PROGRESS", "READY", "DISABLED"];

export function runPaymentProviderContract(
  harness: ProviderContractHarness,
): void {
  describe(`PaymentProviderPort contract: ${harness.providerLabel}`, () => {
    let gateway: PaymentProviderPort;

    beforeEach(() => {
      gateway = harness.makeGateway();
    });

    it("exposes a provider id and a complete capabilities descriptor", () => {
      expect(["STRIPE", "ADYEN", "MANUAL"]).toContain(gateway.provider);
      const capabilities = gateway.capabilities;
      for (const key of [
        "hostedCheckout",
        "paymentIntent",
        "automaticTax",
        "hostedReceipts",
        "asyncRefunds",
      ] as const) {
        expect(typeof capabilities[key]).toBe("boolean");
      }
    });

    it("creates a connected account idempotently per org", async () => {
      const first = await gateway.createOrGetConnectedAccount("org_1");
      const again = await gateway.createOrGetConnectedAccount("org_1");
      expect(first.accountRef).toBeTruthy();
      expect(again.accountRef).toBe(first.accountRef);

      const other = await gateway.createOrGetConnectedAccount("org_2");
      expect(other.accountRef).not.toBe(first.accountRef);
    });

    it("returns an onboarding link", async () => {
      const link = await gateway.createOnboardingLink("org_1");
      expect(Boolean(link.url) || Boolean(link.clientSecret)).toBe(true);
    });

    it("reports well-formed account readiness", async () => {
      const status = await gateway.getAccountStatus("org_1");
      expect(ONBOARDING_STATES).toContain(status.onboardingState);
      expect(typeof status.chargesEnabled).toBe("boolean");
      expect(typeof status.payoutsEnabled).toBe("boolean");
    });

    it("creates a checkout session and rejects an invalid amount", async () => {
      const session = await gateway.createCheckoutSession({
        orgId: "org_1",
        invoiceRef: "inv_1",
        amount: usd(1999),
        successUrl: "https://app.test/ok",
        cancelUrl: "https://app.test/cancel",
        idempotencyKey: "cs-1",
      });
      expect(session.providerRef).toBeTruthy();

      await expect(
        gateway.createCheckoutSession({
          orgId: "org_1",
          invoiceRef: "inv_2",
          amount: usd(0),
          successUrl: "https://app.test/ok",
          cancelUrl: "https://app.test/cancel",
          idempotencyKey: "cs-2",
        }),
      ).rejects.toBeInstanceOf(PaymentProviderError);
    });

    it("rejects an invalid currency code", async () => {
      await expect(
        gateway.createPayment({
          orgId: "org_1",
          invoiceRef: "inv_1",
          amount: { minorAmount: 1000, currency: "US" },
          idempotencyKey: "pi-bad-ccy",
        }),
      ).rejects.toBeInstanceOf(PaymentProviderError);
    });

    it("creates payments idempotently with a valid status", async () => {
      const first = await gateway.createPayment({
        orgId: "org_1",
        invoiceRef: "inv_1",
        amount: usd(1999),
        idempotencyKey: "pi-1",
      });
      expect(PAYMENT_STATUSES).toContain(first.status);

      const repeat = await gateway.createPayment({
        orgId: "org_1",
        invoiceRef: "inv_1",
        amount: usd(1999),
        idempotencyKey: "pi-1",
      });
      expect(repeat.providerPaymentRef).toBe(first.providerPaymentRef);

      const distinct = await gateway.createPayment({
        orgId: "org_1",
        invoiceRef: "inv_1",
        amount: usd(1999),
        idempotencyKey: "pi-2",
      });
      expect(distinct.providerPaymentRef).not.toBe(first.providerPaymentRef);
    });

    it("refunds up to the captured amount, idempotently, and rejects over-refunds", async () => {
      const payment = await gateway.createPayment({
        orgId: "org_1",
        invoiceRef: "inv_1",
        amount: usd(1000),
        idempotencyKey: "pi-1",
      });

      const refund = await gateway.refund({
        orgId: "org_1",
        providerPaymentRef: payment.providerPaymentRef,
        amount: usd(400),
        idempotencyKey: "re-1",
      });
      expect(refund.providerRefundRef).toBeTruthy();
      expect(REFUND_STATUSES).toContain(refund.status);

      const repeat = await gateway.refund({
        orgId: "org_1",
        providerPaymentRef: payment.providerPaymentRef,
        amount: usd(400),
        idempotencyKey: "re-1",
      });
      expect(repeat.providerRefundRef).toBe(refund.providerRefundRef);

      // 400 already refunded; 700 more would exceed the 1000 captured.
      await expect(
        gateway.refund({
          orgId: "org_1",
          providerPaymentRef: payment.providerPaymentRef,
          amount: usd(700),
          idempotencyKey: "re-2",
        }),
      ).rejects.toBeInstanceOf(RefundExceedsCaptureError);
    });

    it("rejects refunds for an unknown payment", async () => {
      await expect(
        gateway.refund({
          orgId: "org_1",
          providerPaymentRef: "does_not_exist",
          amount: usd(100),
          idempotencyKey: "re-x",
        }),
      ).rejects.toBeInstanceOf(UnknownPaymentError);
    });

    it("verifies and normalizes a valid webhook", () => {
      const { rawBody, headers, expected } = harness.makeValidWebhook(gateway);
      const events = gateway.verifyAndNormalizeWebhook(rawBody, headers);
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].providerEventRef).toBe(expected.providerEventRef);
      expect(events[0].type).toBe(expected.type);
    });

    it("rejects a tampered webhook", () => {
      const { rawBody, headers } = harness.makeTamperedWebhook(gateway);
      expect(() => gateway.verifyAndNormalizeWebhook(rawBody, headers)).toThrow(
        WebhookVerificationError,
      );
    });
  });
}
