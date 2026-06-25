/**
 * Provider-agnostic payment types shared by the payment-gateway port, the
 * registry, and every provider adapter. These are the normalized shapes the rest
 * of finance speaks; adapters translate provider-specific payloads to and from
 * them. Money is always carried in integer minor units (see MoneyAmount).
 *
 * Settlement model: the clinic (connected account) is the merchant of record on
 * every provider and the platform takes no fee, so there is no fee or split field
 * anywhere in these types. See docs/guide/payment-gateway-multi-provider-plan.md.
 */

export type ProviderId = "STRIPE" | "ADYEN" | "MANUAL";

export type PaymentAttemptStatus =
  | "REQUIRES_ACTION"
  | "PROCESSING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELED";

export type RefundStatus = "PENDING" | "SUCCEEDED" | "FAILED";

export type AccountOnboardingState =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "READY"
  | "DISABLED";

export interface ProviderCapabilities {
  /** Supports a hosted checkout page the payer is redirected to. */
  hostedCheckout: boolean;
  /** Supports a payment-intent style flow with a client secret. */
  paymentIntent: boolean;
  /** Provider computes and collects tax on the charge. */
  automaticTax: boolean;
  /** Provider issues its own receipts to the payer. */
  hostedReceipts: boolean;
  /** Refunds and captures are confirmed asynchronously via webhook. */
  asyncRefunds: boolean;
}

export interface AccountReadiness {
  accountRef: string | null;
  onboardingState: AccountOnboardingState;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  disabledReason: string | null;
}

/** An amount in the smallest unit of a currency (cents, yen, fils). */
export interface MoneyAmount {
  /** Integer minor units. Build with the packages/lib money helper. */
  minorAmount: number;
  /** ISO 4217 currency code. */
  currency: string;
}

export interface NormalizedCheckoutInput {
  orgId: string;
  invoiceRef: string;
  amount: MoneyAmount;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
  metadata?: Record<string, string>;
}

export interface NormalizedPaymentInput {
  orgId: string;
  invoiceRef: string;
  amount: MoneyAmount;
  idempotencyKey: string;
  metadata?: Record<string, string>;
}

export interface NormalizedRefundInput {
  orgId: string;
  providerPaymentRef: string;
  /** Refund amount in minor units; equal to the captured amount for a full refund. */
  amount: MoneyAmount;
  idempotencyKey: string;
  reason?: string;
}

export type NormalizedPaymentEventType =
  | "PAYMENT_SUCCEEDED"
  | "PAYMENT_FAILED"
  | "REFUND_SUCCEEDED"
  | "REFUND_FAILED"
  | "ACCOUNT_UPDATED";

export interface NormalizedPaymentEvent {
  /** Stable provider event id, used for webhook de-duplication. */
  providerEventRef: string;
  type: NormalizedPaymentEventType;
  invoiceRef?: string;
  providerPaymentRef?: string;
  providerRefundRef?: string;
  accountRef?: string;
  amount?: MoneyAmount;
  failureCode?: string;
  failureMessage?: string;
}

export interface CheckoutSessionResult {
  providerRef: string;
  redirectUrl?: string;
  clientToken?: string;
}

export interface CreatePaymentResult {
  providerPaymentRef: string;
  clientSecret?: string;
  status: PaymentAttemptStatus;
}

export interface RefundResult {
  providerRefundRef: string;
  status: RefundStatus;
}
