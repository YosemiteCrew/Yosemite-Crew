import { createHmac, timingSafeEqual } from "node:crypto";

import {
  PaymentProviderError,
  RefundExceedsCaptureError,
  UnknownPaymentError,
  WebhookVerificationError,
} from "./errors";
import type { PaymentProviderPort } from "./port";
import type {
  AccountReadiness,
  CheckoutSessionResult,
  CreatePaymentResult,
  MoneyAmount,
  NormalizedCheckoutInput,
  NormalizedPaymentEvent,
  NormalizedPaymentInput,
  NormalizedRefundInput,
  ProviderCapabilities,
  ProviderId,
  RefundResult,
} from "./types";

const SIGNATURE_HEADER = "x-fake-signature";

interface FakePaymentRecord {
  providerPaymentRef: string;
  orgId: string;
  invoiceRef: string;
  captured: number;
  refunded: number;
  currency: string;
  status: CreatePaymentResult["status"];
}

function assertValidAmount(amount: MoneyAmount): void {
  if (!Number.isInteger(amount.minorAmount) || amount.minorAmount <= 0) {
    throw new PaymentProviderError(
      `Amount must be a positive integer in minor units, received ${JSON.stringify(amount.minorAmount)}`,
      "INVALID_AMOUNT",
    );
  }
  if (!/^[A-Za-z]{3}$/.test(amount.currency)) {
    throw new PaymentProviderError(
      `Invalid currency code: ${JSON.stringify(amount.currency)}`,
      "INVALID_CURRENCY",
    );
  }
}

/** Run a synchronous body on the microtask queue; a thrown error becomes a rejection. */
function settle<T>(body: () => T): Promise<T> {
  return Promise.resolve().then(body);
}

/**
 * Deterministic in-memory payment provider. It is the executable reference for the
 * PaymentProviderPort contract: it models connected accounts, idempotent payments
 * and refunds, refund-over-capture protection, and HMAC-verified webhooks, with no
 * network calls. Real adapters (Stripe, CareCredit, Scratchpay) must pass the same contract suite.
 */
export class FakeGateway implements PaymentProviderPort {
  readonly provider: ProviderId;
  readonly capabilities: ProviderCapabilities = {
    hostedCheckout: true,
    paymentIntent: true,
    automaticTax: false,
    hostedReceipts: false,
    asyncRefunds: false,
  };

  private readonly secret: string;
  private seq = 0;
  private readonly accounts = new Map<string, AccountReadiness>();
  private readonly payments = new Map<string, FakePaymentRecord>();
  private readonly idempotency = new Map<string, unknown>();

  constructor(options: { provider?: ProviderId; webhookSecret?: string } = {}) {
    this.provider = options.provider ?? "MANUAL";
    this.secret = options.webhookSecret ?? "fake-webhook-secret";
  }

  private nextId(prefix: string): string {
    this.seq += 1;
    return `fake_${prefix}_${this.seq}`;
  }

  private remember<T>(key: string, produce: () => T): T {
    if (this.idempotency.has(key)) {
      return this.idempotency.get(key) as T;
    }
    const value = produce();
    this.idempotency.set(key, value);
    return value;
  }

  private ensureAccount(orgId: string): AccountReadiness {
    let account = this.accounts.get(orgId);
    if (!account) {
      account = {
        accountRef: this.nextId("acct"),
        onboardingState: "NOT_STARTED",
        chargesEnabled: false,
        payoutsEnabled: false,
        disabledReason: null,
      };
      this.accounts.set(orgId, account);
    }
    return account;
  }

  createOrGetConnectedAccount(orgId: string): Promise<{ accountRef: string }> {
    return settle(() => ({
      accountRef: this.ensureAccount(orgId).accountRef as string,
    }));
  }

  createOnboardingLink(
    orgId: string,
  ): Promise<{ url?: string; clientSecret?: string }> {
    return settle(() => {
      const account = this.ensureAccount(orgId);
      account.onboardingState = "IN_PROGRESS";
      return { url: `https://fake-gateway.test/onboard/${account.accountRef}` };
    });
  }

  getAccountStatus(orgId: string): Promise<AccountReadiness> {
    return settle(() => {
      const account = this.accounts.get(orgId);
      if (!account) {
        return {
          accountRef: null,
          onboardingState: "NOT_STARTED",
          chargesEnabled: false,
          payoutsEnabled: false,
          disabledReason: null,
        };
      }
      return { ...account };
    });
  }

  createCheckoutSession(
    input: NormalizedCheckoutInput,
  ): Promise<CheckoutSessionResult> {
    return settle(() => {
      assertValidAmount(input.amount);
      return this.remember(input.idempotencyKey, () => {
        const providerRef = this.nextId("cs");
        this.payments.set(providerRef, {
          providerPaymentRef: providerRef,
          orgId: input.orgId,
          invoiceRef: input.invoiceRef,
          captured: input.amount.minorAmount,
          refunded: 0,
          currency: input.amount.currency,
          status: "PROCESSING",
        });
        return {
          providerRef,
          redirectUrl: `https://fake-gateway.test/checkout/${providerRef}`,
        };
      });
    });
  }

  createPayment(input: NormalizedPaymentInput): Promise<CreatePaymentResult> {
    return settle(() => {
      assertValidAmount(input.amount);
      return this.remember(input.idempotencyKey, () => {
        const providerPaymentRef = this.nextId("pi");
        this.payments.set(providerPaymentRef, {
          providerPaymentRef,
          orgId: input.orgId,
          invoiceRef: input.invoiceRef,
          captured: input.amount.minorAmount,
          refunded: 0,
          currency: input.amount.currency,
          status: "SUCCEEDED",
        });
        return { providerPaymentRef, status: "SUCCEEDED" as const };
      });
    });
  }

  refund(input: NormalizedRefundInput): Promise<RefundResult> {
    return settle(() => {
      assertValidAmount(input.amount);
      const cached = this.idempotency.get(input.idempotencyKey);
      if (cached) {
        return cached as RefundResult;
      }
      const payment = this.payments.get(input.providerPaymentRef);
      if (!payment) {
        throw new UnknownPaymentError(input.providerPaymentRef);
      }
      if (input.amount.minorAmount + payment.refunded > payment.captured) {
        throw new RefundExceedsCaptureError();
      }
      payment.refunded += input.amount.minorAmount;
      const result: RefundResult = {
        providerRefundRef: this.nextId("re"),
        status: "SUCCEEDED",
      };
      this.idempotency.set(input.idempotencyKey, result);
      return result;
    });
  }

  verifyAndNormalizeWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): NormalizedPaymentEvent[] {
    const provided = headers[SIGNATURE_HEADER];
    if (typeof provided !== "string") {
      throw new WebhookVerificationError(
        "Missing or malformed signature header",
      );
    }
    const providedBuf = Buffer.from(provided);
    const expectedBuf = Buffer.from(this.sign(rawBody));
    if (
      providedBuf.length !== expectedBuf.length ||
      !timingSafeEqual(providedBuf, expectedBuf)
    ) {
      throw new WebhookVerificationError();
    }
    const parsed = JSON.parse(rawBody.toString("utf8")) as
      | NormalizedPaymentEvent
      | NormalizedPaymentEvent[];
    return Array.isArray(parsed) ? parsed : [parsed];
  }

  private sign(rawBody: Buffer): string {
    return createHmac("sha256", this.secret).update(rawBody).digest("hex");
  }

  // Test helpers (not part of the port). Real adapters back these with recorded fixtures.

  /** Build a validly signed webhook payload for the given normalized events. */
  buildSignedWebhook(
    events: NormalizedPaymentEvent | NormalizedPaymentEvent[],
  ): {
    rawBody: Buffer;
    headers: Record<string, string>;
  } {
    const rawBody = Buffer.from(JSON.stringify(events), "utf8");
    return { rawBody, headers: { [SIGNATURE_HEADER]: this.sign(rawBody) } };
  }

  /** Mark an organisation's account ready to accept payments. */
  markAccountReady(orgId: string): void {
    const account = this.ensureAccount(orgId);
    account.onboardingState = "READY";
    account.chargesEnabled = true;
    account.payoutsEnabled = true;
    account.disabledReason = null;
  }
}
