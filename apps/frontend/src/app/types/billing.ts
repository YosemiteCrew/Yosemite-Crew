export type BillingCounter = {
  orgId: string;
  appointmentsUsed?: number;
  toolsUsed?: number;
  usersActiveCount?: number;
  usersBillableCount?: number;
  freeAppointmentsLimit?: number;
  freeToolsLimit?: number;
  freeUsersLimit?: number;
  freeLimitReachedAt?: Date | null;
};

export type BillingSubscriptionPlan = "free" | "business";
export type BillingSubscriptionInterval = "month" | "year";
export type BillingSubscriptionStatus =
  | "none"
  | "trialing"
  | "active"
  | "past_due"
  | "unpaid"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "paused";
export type BillingSubscriptionLastPaymentStatus = "paid" | "failed" | "open";
export type BillingSubscriptionAccessState =
  | "free"
  | "active"
  | "past_due"
  | "suspended";

export type BillingSubscription = {
  orgId: string;
  connectAccountId?: string | null;
  canAcceptPayments?: boolean;
  connectChargesEnabled?: boolean;
  connectPayoutsEnabled?: boolean;
  connectDisabledReason?: string | null;
  connectRequirements?: {
    currentlyDue?: string[];
    eventuallyDue?: string[];
    pastDue?: string[];
    pendingVerification?: string[];
    errors?: unknown[];
  };
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeSubscriptionItemId?: string | null;
  stripePriceId?: string | null;
  stripeProductId?: string | null;
  stripeLivemode?: boolean;
  plan?: BillingSubscriptionPlan;
  billingInterval?: BillingSubscriptionInterval;
  currency?: string;
  seatQuantity?: number;
  seatQuantityUpdatedAt?: Date | null;
  subscriptionStatus?: BillingSubscriptionStatus;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: Date | null;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  nextInvoiceAt?: Date | null;
  lastInvoiceId?: string | null;
  lastPaymentStatus?: BillingSubscriptionLastPaymentStatus | null;
  lastPaymentAt?: Date | null;
  joinedAt?: Date;
  upgradedAt?: Date | null;
  downgradedAt?: Date | null;
  accessState?: BillingSubscriptionAccessState;
  gracePeriodEndsAt?: Date | null;
  version?: number;
  lastStripeEventId?: string | null;
};
