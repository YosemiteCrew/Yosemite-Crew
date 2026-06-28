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

const toPlanTier = (value?: string | null): DeveloperPlanTier => {
  if (value === "pro") return "pro";
  if (value === "enterprise") return "enterprise";
  return "free";
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

export const DeveloperBillingService = {
  async getSubscription(organisationId: string) {
    if (!organisationId.trim()) {
      throw new DeveloperBillingServiceError("organisationId is required", 400);
    }
    const record = await prisma.developerSubscription.findUnique({
      where: { organisationId },
      select: {
        id: true,
        organisationId: true,
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
        organisationId,
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

  async getOrCreateCustomer(organisationId: string): Promise<string> {
    const existing = await prisma.developerSubscription.findUnique({
      where: { organisationId },
      select: { stripeCustomerId: true },
    });
    if (existing?.stripeCustomerId) return existing.stripeCustomerId;

    const stripe = getStripeClient();
    const customer = await stripe.customers.create({
      metadata: { organisationId, source: "developer_portal" },
    });

    await prisma.developerSubscription.upsert({
      where: { organisationId },
      create: { organisationId, stripeCustomerId: customer.id },
      update: { stripeCustomerId: customer.id },
    });

    return customer.id;
  },

  async createCheckoutSession(input: {
    organisationId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<string> {
    const { organisationId, successUrl, cancelUrl } = input;
    if (!organisationId.trim()) {
      throw new DeveloperBillingServiceError("organisationId is required", 400);
    }

    const customerId =
      await DeveloperBillingService.getOrCreateCustomer(organisationId);
    const priceId = resolveMeteredPriceId();
    const stripe = getStripeClient();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { organisationId, source: "developer_portal" },
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
    organisationId: string;
    returnUrl: string;
  }): Promise<string> {
    const { organisationId, returnUrl } = input;
    if (!organisationId.trim()) {
      throw new DeveloperBillingServiceError("organisationId is required", 400);
    }

    const record = await prisma.developerSubscription.findUnique({
      where: { organisationId },
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
  // Uses Stripe Billing Meters (v20+ API). Call after each authenticated API request or batch.
  async reportUsage(customerId: string, quantity: number): Promise<void> {
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
    });
  },

  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode !== "subscription") break;
        const orgId = session.metadata?.organisationId;
        if (!orgId) break;

        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : (session.subscription?.id ?? null);
        if (!subId) break;

        const stripe = getStripeClient();
        const sub = await stripe.subscriptions.retrieve(subId, {
          expand: ["items.data.price"],
        });

        const item = sub.items.data[0];
        const priceId = item?.price?.id ?? null;

        await prisma.developerSubscription.upsert({
          where: { organisationId: orgId },
          create: {
            organisationId: orgId,
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
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object;
        const record = await prisma.developerSubscription.findFirst({
          where: { stripeSubscriptionId: sub.id },
        });
        if (!record) break;

        const item = sub.items.data[0];

        await prisma.developerSubscription.update({
          where: { id: record.id },
          data: {
            status: toSubscriptionStatus(sub.status),
            stripePriceId: item?.price?.id ?? record.stripePriceId,
            stripeSubscriptionItemId:
              item?.id ?? record.stripeSubscriptionItemId,
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
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const record = await prisma.developerSubscription.findFirst({
          where: { stripeSubscriptionId: sub.id },
        });
        if (!record) break;

        await prisma.developerSubscription.update({
          where: { id: record.id },
          data: {
            plan: toPlanTier(null),
            status: "canceled",
            stripeSubscriptionId: null,
            stripeSubscriptionItemId: null,
            stripePriceId: null,
            cancelAtPeriodEnd: false,
            lastStripeEventId: event.id,
          },
        });
        break;
      }

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
