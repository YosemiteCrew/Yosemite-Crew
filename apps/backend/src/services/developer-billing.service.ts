import Stripe from "stripe";
import logger from "../utils/logger";
import { prisma } from "src/config/prisma";
import { DeveloperPlanTier, DeveloperSubscriptionStatus } from "@prisma/client";

export class DeveloperBillingServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "DeveloperBillingServiceError";
  }
}

let stripeClient: Stripe | null = null;

const getStripeClient = (): Stripe => {
  if (stripeClient) return stripeClient;
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) throw new Error("STRIPE_SECRET_KEY is not configured");
  stripeClient = new Stripe(apiKey, { apiVersion: "2026-01-28.clover" });
  return stripeClient;
};

const toSubscriptionStatus = (
  value?: string | null,
): DeveloperSubscriptionStatus => {
  if (value === "trialing") return "trialing";
  if (value === "past_due") return "past_due";
  if (value === "canceled") return "canceled";
  if (value === "incomplete") return "incomplete";
  return "active";
};

const resolveMeteredPriceId = (): string => {
  const id = process.env.STRIPE_DEV_METERED_PRICE_ID;
  if (!id) {
    throw new DeveloperBillingServiceError(
      "STRIPE_DEV_METERED_PRICE_ID is not configured",
      500,
    );
  }
  return id;
};

async function handleCheckoutCompleted(
  event: Stripe.Event,
  session: Stripe.Checkout.Session,
): Promise<void> {
  if (session.mode !== "subscription") return;
  /*
   * Read `ownerUserId` only, with no fall back to `organisationId`.
   *
   * A checkout session created before this re-key carries
   * `metadata.organisationId`, and that value is an Organization id. Reading it
   * into `ownerUserId` would write a row keyed on a tenant id in a column that
   * means "a person", permanently invisible to the developer who actually paid.
   * Ignoring such a session is the correct outcome, and no such session exists:
   * both databases held zero subscriptions with a live Stripe id when this
   * shipped.
   */
  const ownerId = session.metadata?.ownerUserId;
  if (!ownerId) {
    // Silence would strand a developer who is being charged with no row to
    // manage the subscription from, so say so loudly enough to act on. Both
    // databases held zero subscriptions when this shipped, so this is a
    // tripwire rather than an expected path.
    if (session.metadata?.organisationId) {
      logger.error(
        "Ignored a checkout session that predates the developer re-key: it carries organisationId and no ownerUserId, so the subscription it completes has no owner to record",
        { eventId: event.id, sessionId: session.id },
      );
    }
    return;
  }

  const subId =
    typeof session.subscription === "string"
      ? session.subscription
      : (session.subscription?.id ?? null);
  if (!subId) return;

  const stripe = getStripeClient();
  const sub = await stripe.subscriptions.retrieve(subId, {
    expand: ["items.data.price"],
  });

  const item = sub.items.data[0];
  const priceId = item?.price?.id ?? null;

  await prisma.developerSubscription.upsert({
    where: { ownerUserId: ownerId },
    create: {
      ownerUserId: ownerId,
      stripeCustomerId:
        typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      stripeSubscriptionId: sub.id,
      stripeSubscriptionItemId: item?.id ?? null,
      stripePriceId: priceId,
      plan: "pro",
      status: toSubscriptionStatus(sub.status),
      currentPeriodStart: item?.current_period_start
        ? new Date(item.current_period_start * 1000)
        : null,
      currentPeriodEnd: item?.current_period_end
        ? new Date(item.current_period_end * 1000)
        : null,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      lastStripeEventId: event.id,
    },
    update: {
      stripeSubscriptionId: sub.id,
      stripeSubscriptionItemId: item?.id ?? null,
      stripePriceId: priceId,
      plan: "pro",
      status: toSubscriptionStatus(sub.status),
      currentPeriodStart: item?.current_period_start
        ? new Date(item.current_period_start * 1000)
        : null,
      currentPeriodEnd: item?.current_period_end
        ? new Date(item.current_period_end * 1000)
        : null,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      lastStripeEventId: event.id,
    },
  });
}

async function handleSubscriptionUpdated(
  event: Stripe.Event,
  sub: Stripe.Subscription,
): Promise<void> {
  const record = await prisma.developerSubscription.findFirst({
    where: { stripeSubscriptionId: sub.id },
  });
  if (!record) return;

  const item = sub.items.data[0];

  await prisma.developerSubscription.update({
    where: { id: record.id },
    data: {
      status: toSubscriptionStatus(sub.status),
      stripePriceId: item?.price?.id ?? record.stripePriceId,
      stripeSubscriptionItemId: item?.id ?? record.stripeSubscriptionItemId,
      currentPeriodStart: item?.current_period_start
        ? new Date(item.current_period_start * 1000)
        : null,
      currentPeriodEnd: item?.current_period_end
        ? new Date(item.current_period_end * 1000)
        : null,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      lastStripeEventId: event.id,
    },
  });
}

async function handleSubscriptionDeleted(
  event: Stripe.Event,
  sub: Stripe.Subscription,
): Promise<void> {
  const record = await prisma.developerSubscription.findFirst({
    where: { stripeSubscriptionId: sub.id },
  });
  if (!record) return;

  await prisma.developerSubscription.update({
    where: { id: record.id },
    data: {
      plan: "free",
      status: "canceled",
      stripeSubscriptionId: null,
      stripeSubscriptionItemId: null,
      stripePriceId: null,
      cancelAtPeriodEnd: false,
      lastStripeEventId: event.id,
    },
  });
}

export const DeveloperBillingService = {
  async getSubscription(ownerUserId: string) {
    if (!ownerUserId.trim()) {
      throw new DeveloperBillingServiceError("ownerUserId is required", 400);
    }
    const record = await prisma.developerSubscription.findUnique({
      where: { ownerUserId },
      select: {
        id: true,
        ownerUserId: true,
        plan: true,
        status: true,
        stripeSubscriptionItemId: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return (
      record ?? {
        id: null,
        ownerUserId,
        plan: "free" as DeveloperPlanTier,
        status: "active" as DeveloperSubscriptionStatus,
        stripeSubscriptionItemId: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        createdAt: null,
        updatedAt: null,
      }
    );
  },

  /**
   * Cancel and forget a developer's own subscription.
   *
   * Called when the account itself goes away. Before the re-key the row hung
   * off an organisation, so deleting a person left it alone; now it is theirs,
   * and deleting them without this would sign them out while Stripe kept
   * renewing and charging the card behind it.
   *
   * Cancels immediately rather than at period end - the account is gone, so
   * there is nobody left to use the remaining days - and deletes the row either
   * way. A Stripe failure is logged and swallowed: the caller is mid-deletion
   * and must not be left half-finished, and a stranded Stripe subscription is
   * recoverable from the dashboard while a half-deleted account is not.
   */
  async cancelForOwner(ownerUserId: string): Promise<void> {
    if (!ownerUserId.trim()) return;

    const record = await prisma.developerSubscription.findUnique({
      where: { ownerUserId },
      select: { stripeSubscriptionId: true },
    });
    if (!record) return;

    if (record.stripeSubscriptionId) {
      try {
        await getStripeClient().subscriptions.cancel(
          record.stripeSubscriptionId,
        );
      } catch (err) {
        logger.error(
          "Failed to cancel a developer subscription during account deletion; cancel it in Stripe by hand",
          { stripeSubscriptionId: record.stripeSubscriptionId, err },
        );
      }
    }

    await prisma.developerSubscription.deleteMany({ where: { ownerUserId } });
  },

  async getOrCreateCustomer(ownerUserId: string): Promise<string> {
    const existing = await prisma.developerSubscription.findUnique({
      where: { ownerUserId },
      select: { stripeCustomerId: true },
    });
    if (existing?.stripeCustomerId) return existing.stripeCustomerId;

    const stripe = getStripeClient();
    const customer = await stripe.customers.create({
      metadata: { ownerUserId, source: "developer_portal" },
    });

    await prisma.developerSubscription.upsert({
      where: { ownerUserId },
      create: { ownerUserId, stripeCustomerId: customer.id },
      update: { stripeCustomerId: customer.id },
    });

    return customer.id;
  },

  async createCheckoutSession(input: {
    ownerUserId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<string> {
    const { ownerUserId, successUrl, cancelUrl } = input;
    if (!ownerUserId.trim()) {
      throw new DeveloperBillingServiceError("ownerUserId is required", 400);
    }

    const customerId =
      await DeveloperBillingService.getOrCreateCustomer(ownerUserId);
    const priceId = resolveMeteredPriceId();
    const stripe = getStripeClient();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { ownerUserId, source: "developer_portal" },
    });

    if (!session.url) {
      throw new DeveloperBillingServiceError(
        "Failed to create checkout session",
        500,
      );
    }
    return session.url;
  },

  async createPortalSession(input: {
    ownerUserId: string;
    returnUrl: string;
  }): Promise<string> {
    const { ownerUserId, returnUrl } = input;
    if (!ownerUserId.trim()) {
      throw new DeveloperBillingServiceError("ownerUserId is required", 400);
    }

    const record = await prisma.developerSubscription.findUnique({
      where: { ownerUserId },
      select: { stripeCustomerId: true },
    });

    if (!record?.stripeCustomerId) {
      throw new DeveloperBillingServiceError(
        "No billing account found — upgrade to Pro first",
        404,
      );
    }

    const stripe = getStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: record.stripeCustomerId,
      return_url: returnUrl,
    });

    return session.url;
  },

  // Reports metered API usage to Stripe so it is invoiced at end of period.
  // Uses Stripe Billing Meters (v20+ API). Call after each authenticated API request.
  //
  // `quantity` is the number of calls THIS event accounts for - a delta, never a
  // running total. A billing meter aggregates the events it receives (the default
  // and the one this integration assumes is `sum`), so posting the cumulative
  // period count on every call bills the Nth call N times over: 1,000 real calls
  // would invoice as 1+2+...+1000 = 500,500.
  //
  // `identifier` makes the post idempotent. Stripe enforces uniqueness on it over
  // a rolling window of at least 24 hours, so a retry of the same logical call -
  // ours or the SDK's - is discarded instead of double-counted. Omitting it lets
  // Stripe generate one, which gives up that protection.
  async reportUsage(
    customerId: string,
    quantity: number,
    identifier?: string,
  ): Promise<void> {
    if (!customerId || quantity <= 0) return;
    const eventName = process.env.STRIPE_DEV_METER_EVENT_NAME;
    if (!eventName) return;
    const stripe = getStripeClient();
    await stripe.billing.meterEvents.create({
      event_name: eventName,
      payload: {
        stripe_customer_id: customerId,
        value: String(quantity),
      },
      ...(identifier ? { identifier } : {}),
    });
  },

  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event, event.data.object);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event, event.data.object);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event, event.data.object);
        break;
      default:
        logger.info("Unhandled developer billing webhook event", {
          type: event.type,
        });
    }
  },

  verifyWebhook(body: Buffer, signature: string): Stripe.Event {
    const secret = process.env.STRIPE_DEV_WEBHOOK_SECRET;
    if (!secret) throw new Error("STRIPE_DEV_WEBHOOK_SECRET is not configured");
    const stripe = getStripeClient();
    return stripe.webhooks.constructEvent(body, signature, secret);
  },
};
