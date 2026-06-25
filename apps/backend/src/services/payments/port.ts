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

/**
 * The capability surface the rest of finance needs from a payment provider.
 * Every provider (Stripe, Adyen, an in-memory fake) implements this identically,
 * so callers resolve an adapter from the registry and never branch on the
 * provider. A single contract test suite runs against every implementation.
 *
 * Charges are created in the clinic's account context (the clinic is the merchant
 * of record); the gateway owns minor-unit conversion and idempotency-key handling.
 */
export interface PaymentProviderPort {
  readonly provider: ProviderId;
  readonly capabilities: ProviderCapabilities;

  // Onboarding and account lifecycle.
  createOrGetConnectedAccount(orgId: string): Promise<{ accountRef: string }>;
  createOnboardingLink(
    orgId: string,
  ): Promise<{ url?: string; clientSecret?: string }>;
  getAccountStatus(orgId: string): Promise<AccountReadiness>;

  // Payment lifecycle.
  createCheckoutSession(
    input: NormalizedCheckoutInput,
  ): Promise<CheckoutSessionResult>;
  createPayment(input: NormalizedPaymentInput): Promise<CreatePaymentResult>;
  refund(input: NormalizedRefundInput): Promise<RefundResult>;

  /**
   * Verify the webhook signature and normalize the (possibly batched) payload into
   * provider-neutral events. Throws WebhookVerificationError on an invalid signature.
   */
  verifyAndNormalizeWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): NormalizedPaymentEvent[];
}
