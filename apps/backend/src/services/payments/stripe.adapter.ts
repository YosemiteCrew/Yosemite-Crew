import Stripe from "stripe";

import { prisma } from "src/config/prisma";
import { getCurrencyExponent } from "@yosemite-crew/lib";
import type {
  AccountReadiness,
  CheckoutSessionResult,
  CreatePaymentResult,
  NormalizedCheckoutInput,
  NormalizedPaymentEvent,
  NormalizedPaymentInput,
  NormalizedRefundInput,
  ProviderCapabilities,
  ProviderId,
  RefundResult,
} from "./types";
import type { PaymentProviderPort } from "./port";
import {
  PaymentProviderError,
  RefundExceedsCaptureError,
  UnknownPaymentError,
  WebhookVerificationError,
} from "./errors";

const API_VERSION = "2026-01-28.clover" as const;

function validateCurrency(currency: string): void {
  try {
    getCurrencyExponent(currency);
  } catch {
    throw new PaymentProviderError(
      `Invalid currency code: ${JSON.stringify(currency)}`,
      "INVALID_CURRENCY",
    );
  }
}

function mapPaymentStatus(status: string): CreatePaymentResult["status"] {
  switch (status) {
    case "succeeded":
      return "SUCCEEDED";
    case "canceled":
      return "CANCELED";
    case "processing":
      return "PROCESSING";
    default:
      return "REQUIRES_ACTION";
  }
}

function mapRefundStatus(
  status: string | null | undefined,
): RefundResult["status"] {
  if (status === "succeeded") return "SUCCEEDED";
  if (status === "failed") return "FAILED";
  return "PENDING";
}

function isStripeError(
  err: unknown,
): err is { code?: string; type?: string; message: string } {
  return (
    typeof err === "object" && err !== null && ("type" in err || "code" in err)
  );
}

function mapStripeRefundError(err: unknown, paymentRef: string): never {
  if (isStripeError(err)) {
    if (err.code === "resource_missing")
      throw new UnknownPaymentError(paymentRef);
    if (
      err.code === "amount_too_large" ||
      err.code === "charge_already_refunded"
    ) {
      throw new RefundExceedsCaptureError();
    }
    throw new PaymentProviderError(
      (err as Error).message ?? "Stripe error",
      err.code ?? "STRIPE_ERROR",
    );
  }
  throw new PaymentProviderError("Unexpected error from Stripe", "UNKNOWN");
}

function normalizeStripeEvent(
  event: Stripe.Event,
): NormalizedPaymentEvent | null {
  const base = { providerEventRef: event.id };
  switch (event.type) {
    case "payment_intent.succeeded": {
      const pi = event.data.object;
      return {
        ...base,
        type: "PAYMENT_SUCCEEDED",
        providerPaymentRef: pi.id,
        invoiceRef: pi.metadata?.invoiceRef,
        amount: pi.amount_received
          ? { minorAmount: pi.amount_received, currency: pi.currency }
          : undefined,
      };
    }
    case "payment_intent.payment_failed": {
      const pi = event.data.object;
      return {
        ...base,
        type: "PAYMENT_FAILED",
        providerPaymentRef: pi.id,
        invoiceRef: pi.metadata?.invoiceRef,
        failureCode: pi.last_payment_error?.code ?? undefined,
        failureMessage: pi.last_payment_error?.message ?? undefined,
      };
    }
    case "charge.refunded": {
      const charge = event.data.object;
      return {
        ...base,
        type: "REFUND_SUCCEEDED",
        providerPaymentRef:
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : undefined,
        providerRefundRef: charge.refunds?.data?.[0]?.id,
        invoiceRef: charge.metadata?.invoiceRef,
        amount: {
          minorAmount: charge.amount_refunded,
          currency: charge.currency,
        },
      };
    }
    case "account.updated": {
      const account = event.data.object;
      return {
        ...base,
        type: "ACCOUNT_UPDATED",
        accountRef: account.id,
      };
    }
    default:
      return null;
  }
}

/**
 * Stripe Standard Connect adapter implementing PaymentProviderPort on the direct-charge model.
 *
 * Every payment and refund uses `stripeAccount: <clinic stripeAccountId>` so the charge is
 * created in the clinic's account (the clinic is the merchant of record and bears fees, disputes,
 * and negative-balance liability). The platform has zero regulatory exposure.
 *
 * Inject a mocked Stripe client via the constructor in tests; call StripeProviderAdapter.fromEnv()
 * in production.
 */
export class StripeProviderAdapter implements PaymentProviderPort {
  readonly provider: ProviderId = "STRIPE";
  readonly capabilities: ProviderCapabilities = {
    hostedCheckout: true,
    paymentIntent: true,
    automaticTax: true,
    hostedReceipts: true,
    asyncRefunds: false,
  };

  constructor(
    private readonly stripe: Stripe,
    private readonly webhookSecret: string,
  ) {}

  static fromEnv(): StripeProviderAdapter {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) throw new Error("STRIPE_SECRET_KEY is not configured");
    return new StripeProviderAdapter(
      new Stripe(apiKey, { apiVersion: API_VERSION }),
      process.env.STRIPE_WEBHOOK_SECRET ?? "",
    );
  }

  async createOrGetConnectedAccount(
    orgId: string,
  ): Promise<{ accountRef: string }> {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { stripeAccountId: true },
    });
    if (org?.stripeAccountId) return { accountRef: org.stripeAccountId };

    const account = await this.stripe.accounts.create({ type: "standard" });

    await Promise.all([
      prisma.organization.update({
        where: { id: orgId },
        data: { stripeAccountId: account.id },
      }),
      prisma.organizationBilling.upsert({
        where: { orgId },
        create: { orgId, connectAccountId: account.id },
        update: { connectAccountId: account.id },
      }),
    ]);

    return { accountRef: account.id };
  }

  async createOnboardingLink(
    orgId: string,
  ): Promise<{ url?: string; clientSecret?: string }> {
    const { accountRef } = await this.createOrGetConnectedAccount(orgId);
    const session = await this.stripe.accountSessions.create({
      account: accountRef,
      components: { account_onboarding: { enabled: true } },
    });
    return { clientSecret: session.client_secret };
  }

  async getAccountStatus(orgId: string): Promise<AccountReadiness> {
    const [org, orgBilling] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: orgId },
        select: { stripeAccountId: true },
      }),
      prisma.organizationBilling.findUnique({
        where: { orgId },
        select: {
          connectAccountId: true,
          canAcceptPayments: true,
          connectChargesEnabled: true,
          connectPayoutsEnabled: true,
          connectDisabledReason: true,
        },
      }),
    ]);

    const accountRef =
      org?.stripeAccountId ?? orgBilling?.connectAccountId ?? null;

    let onboardingState: AccountReadiness["onboardingState"];
    if (!accountRef) {
      onboardingState = "NOT_STARTED";
    } else if (orgBilling?.connectDisabledReason) {
      onboardingState = "DISABLED";
    } else if (orgBilling?.canAcceptPayments) {
      onboardingState = "READY";
    } else {
      onboardingState = "IN_PROGRESS";
    }

    return {
      accountRef,
      onboardingState,
      chargesEnabled: orgBilling?.connectChargesEnabled ?? false,
      payoutsEnabled: orgBilling?.connectPayoutsEnabled ?? false,
      disabledReason: orgBilling?.connectDisabledReason ?? null,
    };
  }

  async createCheckoutSession(
    input: NormalizedCheckoutInput,
  ): Promise<CheckoutSessionResult> {
    if (
      !Number.isInteger(input.amount.minorAmount) ||
      input.amount.minorAmount <= 0
    ) {
      throw new PaymentProviderError(
        `Amount must be a positive integer in minor units, received ${JSON.stringify(input.amount.minorAmount)}`,
        "INVALID_AMOUNT",
      );
    }
    validateCurrency(input.amount.currency);

    const accountRef = await this.resolveAccountRef(input.orgId);
    const session = await this.stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: input.amount.currency.toLowerCase(),
              unit_amount: input.amount.minorAmount,
              product_data: { name: `Invoice ${input.invoiceRef}` },
            },
            quantity: 1,
          },
        ],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata: {
          invoiceRef: input.invoiceRef,
          orgId: input.orgId,
          ...(input.metadata ?? {}),
        },
      },
      { stripeAccount: accountRef, idempotencyKey: input.idempotencyKey },
    );

    return {
      providerRef: session.id,
      redirectUrl: session.url ?? undefined,
    };
  }

  async createPayment(
    input: NormalizedPaymentInput,
  ): Promise<CreatePaymentResult> {
    validateCurrency(input.amount.currency);

    const accountRef = await this.resolveAccountRef(input.orgId);
    const intent = await this.stripe.paymentIntents.create(
      {
        amount: input.amount.minorAmount,
        currency: input.amount.currency.toLowerCase(),
        metadata: {
          invoiceRef: input.invoiceRef,
          orgId: input.orgId,
          ...(input.metadata ?? {}),
        },
      },
      { stripeAccount: accountRef, idempotencyKey: input.idempotencyKey },
    );

    return {
      providerPaymentRef: intent.id,
      clientSecret: intent.client_secret ?? undefined,
      status: mapPaymentStatus(intent.status),
    };
  }

  async refund(input: NormalizedRefundInput): Promise<RefundResult> {
    if (
      !Number.isInteger(input.amount.minorAmount) ||
      input.amount.minorAmount <= 0
    ) {
      throw new PaymentProviderError(
        `Amount must be a positive integer in minor units, received ${JSON.stringify(input.amount.minorAmount)}`,
        "INVALID_AMOUNT",
      );
    }

    const accountRef = await this.resolveAccountRef(input.orgId);
    try {
      const refund = await this.stripe.refunds.create(
        {
          payment_intent: input.providerPaymentRef,
          amount: input.amount.minorAmount,
        },
        { stripeAccount: accountRef, idempotencyKey: input.idempotencyKey },
      );
      return {
        providerRefundRef: refund.id,
        status: mapRefundStatus(refund.status),
      };
    } catch (err) {
      mapStripeRefundError(err, input.providerPaymentRef);
    }
  }

  verifyAndNormalizeWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): NormalizedPaymentEvent[] {
    const sig = headers["stripe-signature"];
    if (!sig)
      throw new WebhookVerificationError("Missing stripe-signature header");

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        Array.isArray(sig) ? sig[0] : sig,
        this.webhookSecret,
      );
    } catch {
      throw new WebhookVerificationError();
    }

    const normalized = normalizeStripeEvent(event);
    return normalized ? [normalized] : [];
  }

  private async resolveAccountRef(orgId: string): Promise<string> {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { stripeAccountId: true },
    });
    if (!org?.stripeAccountId) {
      throw new PaymentProviderError(
        `Organisation ${orgId} has no Stripe connected account`,
        "ACCOUNT_NOT_FOUND",
      );
    }
    return org.stripeAccountId;
  }
}
