// src/services/stripe.service.ts
import Stripe from "stripe";
import logger from "../utils/logger";

import InvoiceModel from "src/models/invoice";
import OrganizationModel from "src/models/organization";
import ServiceModel from "src/models/service";
import AppointmentModel from "src/models/appointment";
import { InvoiceService } from "./invoice.service";
import { NotificationTemplates } from "src/utils/notificationTemplates";
import { NotificationService } from "./notification.service";

import { OrgBilling } from "src/models/organization.billing";
import { OrgUsageCounters } from "src/models/organisation.usage.counter";
import UserOrganizationModel from "src/models/user-organization";

let stripeClient: Stripe | null = null;

const getStripeClient = () => {
  if (stripeClient) return stripeClient;

  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) throw new Error("STRIPE_SECRET_KEY is not configured");

  stripeClient = new Stripe(apiKey, { apiVersion: "2025-11-17.clover" });
  return stripeClient;
};

function toStripeAmount(amount: number): number {
  return Math.round(amount * 100);
}

// --- Billing helpers ---
async function ensureBillingDocs(orgId: string) {
  const [billing, usage] = await Promise.all([
    OrgBilling.findOneAndUpdate(
      { orgId },
      { $setOnInsert: { orgId } },
      { upsert: true, new: true },
    ),
    OrgUsageCounters.findOneAndUpdate(
      { orgId },
      { $setOnInsert: { orgId } },
      { upsert: true, new: true },
    ),
  ]);

  return { billing, usage };
}

async function computeBillableSeats(orgId: string): Promise<number> {
  // Every active user in this org is billable
  return UserOrganizationModel.countDocuments({
    organizationReference: orgId,
    active: true,
  });
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export const StripeService = {
  // ----------------------------
  // CONNECT (existing + improved)
  // ----------------------------
  async createOrGetConnectedAccount(organisationId: string) {
    const stripe = getStripeClient();

    const org = await OrganizationModel.findById(organisationId);
    if (!org) throw new Error("Organisation not found");

    if (org.stripeAccountId) return { accountId: org.stripeAccountId };

    // NOTE: For Standard accounts, onboarding flows differ (OAuth / account links are common).
    // Keep your existing approach if it works in your Connect settings.
    const account = await stripe.accounts.create({});

    org.stripeAccountId = account.id;
    await org.save();

    // Ensure OrgBilling doc exists and store connectAccountId
    await OrgBilling.findOneAndUpdate(
      { orgId: organisationId },
      {
        $set: { connectAccountId: account.id },
        $setOnInsert: { orgId: organisationId },
      },
      { upsert: true, new: true },
    );

    return { accountId: account.id };
  },

  async getAccountStatus(organisationId: string) {
    const org = await OrganizationModel.findById(organisationId);
    if (!org) {
      throw new Error("Organistaion not found");
    }

    const orgBilling = await OrgBilling.findOne({
      orgId: org._id,
    }).lean();

    const orgUsage = await OrgUsageCounters.findOne({
      orgId: org._id,
    }).lean();

    return {
      orgBilling: orgBilling,
      orgUsage: orgUsage,
    };
  },

  async createOnboardingLink(organisationId: string) {
    const stripe = getStripeClient();

    const org = await OrganizationModel.findById(organisationId);
    if (!org) throw new Error("No Organisation Found");

    const orgBilling = await OrgBilling.findOne({
      orgId: org._id,
    });

    if (!orgBilling?.connectAccountId)
      throw new Error("Organisation does not have a Stripe account");

    const accountSession = await stripe.accountSessions.create({
      account: orgBilling.connectAccountId,
      components: {
        account_onboarding: { enabled: true },
      },
    });

    return { client_secret: accountSession.client_secret };
  },

  // ----------------------------
  // SAAS SUBSCRIPTION (NEW)
  // ----------------------------

  async createBusinessCheckoutSession(
    orgId: string,
    interval: "month" | "year",
  ) {
    const stripe = getStripeClient();

    const org = await OrganizationModel.findById(orgId);
    if (!org) throw new Error("Organisation not found");

    const { billing } = await ensureBillingDocs(orgId);

    // Ensure connectAccountId mirrored into billing
    if (!billing.connectAccountId && org.stripeAccountId) {
      billing.connectAccountId = org.stripeAccountId;
      await billing.save();
    }

    // Gate upgrade on Connect readiness
    if (!billing.canAcceptPayments) {
      throw new Error(
        "Stripe account not ready. Complete onboarding/verification first.",
      );
    }

    const seats = await computeBillableSeats(orgId);
    if (seats < 1)
      throw new Error("No users found. Add at least 1 user to start Business.");

    // Update usage counters snapshot
    await OrgUsageCounters.updateOne(
      { orgId },
      { usersActiveCount: seats, usersBillableCount: seats },
    );

    const priceId =
      interval === "month"
        ? process.env.STRIPE_PRICE_BUSINESS_MONTH
        : process.env.STRIPE_PRICE_BUSINESS_YEAR;

    if (!priceId) throw new Error("Missing STRIPE_PRICE_BUSINESS_* env vars");

    // Create/reuse platform Customer
    if (!billing.stripeCustomerId) {
      const customer = await stripe.customers.create({
        name: org.name,
        metadata: {
          orgId: String(orgId),
          connectAccountId: String(billing.connectAccountId ?? ""),
        },
      });

      billing.stripeCustomerId = customer.id;
      await billing.save();
    }

    const successUrl = `${process.env.APP_URL}/organization`;
    const cancelUrl = `${process.env.APP_URL}/organization`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: billing.stripeCustomerId,
      line_items: [{ price: priceId, quantity: seats }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: {
          orgId: String(orgId),
          connectAccountId: String(billing.connectAccountId ?? ""),
        },
      },
      metadata: {
        orgId: String(orgId),
        interval,
        seats: String(seats),
      },
    });

    return { url: session.url };
  },

  async createCustomerPortalSession(orgId: string) {
    const stripe = getStripeClient();
    const { billing } = await ensureBillingDocs(orgId);

    if (!billing.stripeCustomerId) {
      throw new Error("No billing customer found. Upgrade to Business first.");
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: billing.stripeCustomerId,
      return_url: `${process.env.APP_URL}/organization`,
    });

    return { url: session.url };
  },

  async syncSubscriptionSeats(orgId: string) {
    const stripe = getStripeClient();
    const { billing } = await ensureBillingDocs(orgId);

    if (billing.plan !== "business")
      return { updated: false, reason: "not_business" };
    if (!billing.stripeSubscriptionItemId)
      return { updated: false, reason: "missing_item_id" };

    // Don’t sync if fully canceled/unpaid/suspended
    if (
      !["active", "trialing", "past_due"].includes(billing.subscriptionStatus)
    ) {
      return { updated: false, reason: "subscription_not_syncable" };
    }

    const newSeats = await computeBillableSeats(orgId);
    const oldSeats = billing.seatQuantity ?? 0;
    if (newSeats === oldSeats) return { updated: false, reason: "no_change" };

    const prorationBehavior =
      newSeats > oldSeats ? "create_prorations" : "none";

    await stripe.subscriptionItems.update(billing.stripeSubscriptionItemId, {
      quantity: newSeats,
      proration_behavior: prorationBehavior,
    });

    await OrgUsageCounters.updateOne(
      { orgId },
      { usersActiveCount: newSeats, usersBillableCount: newSeats },
    );

    billing.seatQuantity = newSeats;
    billing.seatQuantityUpdatedAt = new Date();
    await billing.save();

    return { updated: true, oldSeats, newSeats, prorationBehavior };
  },

  // ----------------------------
  // EXISTING PAYMENT INTENTS (keep)
  // ----------------------------

  async createPaymentIntentForAppointment(appointmentId: string) {
    const stripe = getStripeClient();

    const appointment = await AppointmentModel.findById(appointmentId);
    if (!appointment) throw new Error("Appointment not found");

    if (appointment.status !== "NO_PAYMENT")
      throw new Error("Appointment does not require payment");

    const service = await ServiceModel.findById(
      appointment.appointmentType?.id,
    );
    if (!service) throw new Error("Service not found");

    const organisation = await OrganizationModel.findById(
      appointment.organisationId,
    );
    if (!organisation?.stripeAccountId)
      throw new Error("Organisation has no Stripe account");

    const amount = toStripeAmount(service.cost);

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      metadata: {
        type: "APPOINTMENT_BOOKING",
        appointmentId,
        organisationId: appointment.organisationId,
        parentId: appointment.companion.parent.id,
        companionId: appointment.companion.id,
      },
      transfer_data: { destination: organisation.stripeAccountId },
    });

    await AppointmentModel.updateOne(
      { _id: appointmentId },
      { stripePaymentIntentId: paymentIntent.id },
    );

    return {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      amount: service.cost,
      currency: "usd",
    };
  },

  async createPaymentIntentForInvoice(invoiceId: string) {
    const stripe = getStripeClient();

    let invoice = await InvoiceModel.findById(invoiceId);
    if (!invoice) throw new Error("Invoice not found");

    if (!["AWAITING_PAYMENT", "PENDING"].includes(invoice.status)) {
      throw new Error("Invoice is not payable");
    }

    // 🔒 Switch payment path if coming from PAYMENT_LINK
    if (
      invoice.stripeCheckoutSessionId &&
      invoice.paymentCollectionMethod === "PAYMENT_LINK"
    ) {
      await InvoiceModel.updateOne(
        {
          _id: invoiceId,
          status: { $in: ["AWAITING_PAYMENT", "PENDING"] },
          paymentCollectionMethod: "PAYMENT_LINK",
          stripePaymentIntentId: { $in: [null, undefined] },
        },
        {
          $set: {
            paymentCollectionMethod: "PAYMENT_INTENT",
            stripeCheckoutSessionId: null,
            stripeCheckoutUrl: null,
          },
        },
      );

      // 🔁 re-fetch to avoid stale state
      invoice = await InvoiceModel.findById(invoiceId);
      if (!invoice) throw new Error("Invoice not found after switch");
    }

    // Prevent duplicate PI
    if (invoice.stripePaymentIntentId) {
      return this.retrievePaymentIntent(invoice.stripePaymentIntentId);
    }

    const organisation = await OrganizationModel.findById(
      invoice.organisationId,
    );
    if (!organisation?.stripeAccountId) {
      throw new Error("Organisation does not have a Stripe connected account");
    }

    const amountToPay = invoice.totalAmount;
    const stripeAmount = toStripeAmount(amountToPay);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: stripeAmount,
      currency: invoice.currency || "usd",
      metadata: {
        type: "INVOICE_PAYMENT",
        invoiceId,
        appointmentId: invoice.appointmentId || "",
        organisationId: invoice.organisationId ?? "",
        parentId: invoice.parentId ?? "",
        companionId: invoice.companionId ?? "",
      },
      description: `Payment for Invoice ${invoiceId}`,
      transfer_data: { destination: organisation.stripeAccountId },
    });

    await InvoiceService.attachStripeDetails(invoiceId, {
      stripePaymentIntentId: paymentIntent.id,
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_INTENT",
    });

    return {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      amount: amountToPay,
      currency: invoice.currency || "usd",
    };
  },

  async createCheckoutSessionForInvoice(invoiceId: string) {
    const stripe = getStripeClient();

    const invoice = await InvoiceModel.findById(invoiceId);
    if (!invoice) throw new Error("Invoice not found");

    // Guard: payable only
    if (!["AWAITING_PAYMENT", "PENDING"].includes(invoice.status)) {
      throw new Error("Invoice is not payable");
    }

    // Guard: don’t start two payment paths
    if (invoice.stripePaymentIntentId) {
      throw new Error("Invoice already has a PaymentIntent");
    }
    if (invoice.stripeCheckoutSessionId) {
      // optionally return existing url to re-send
      return { sessionId: invoice.stripeCheckoutSessionId, url: invoice.stripeCheckoutUrl };
    }

    const organisation = await OrganizationModel.findById(invoice.organisationId);
    if (!organisation?.stripeAccountId) throw new Error("Organisation not connected to Stripe");

    // Optional expiry (recommended): e.g. 24 hours
    const expiresAt = Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: invoice.items.map((item) => ({
        price_data: {
          currency: invoice.currency || "usd",
          product_data: {
            name: item.name,
            description: item.description ?? undefined,
          },
          unit_amount: Math.round(item.unitPrice * 100),
        },
        quantity: item.quantity,
      })),
      metadata: {
        type: "INVOICE_PAYMENT",
        invoiceId: invoice._id.toString(),
        appointmentId: invoice.appointmentId ?? "",
        organisationId: invoice.organisationId ?? "",
        parentId: invoice.parentId ?? "",
      },
      payment_intent_data: {
        metadata: {
          type: "INVOICE_PAYMENT",
          invoiceId: invoice._id.toString(),
          appointmentId: invoice.appointmentId ?? "",
          organisationId: invoice.organisationId ?? "",
          parentId: invoice.parentId ?? "",
        },
        transfer_data: { destination: organisation.stripeAccountId },
      },
      success_url: `${process.env.APP_URL}/payment-success?invoice=${invoice._id.toString()}`,
      cancel_url: `${process.env.APP_URL}/payment-cancelled?invoice=${invoice._id.toString()}`,
      expires_at: expiresAt,
    });

    await InvoiceModel.updateOne(
      { _id: invoiceId },
      {
        $set: {
          paymentCollectionMethod: "PAYMENT_LINK",
          stripeCheckoutSessionId: session.id,
          stripeCheckoutUrl: session.url,
          paymentDueAt: new Date(expiresAt * 1000),
        },
      },
    );

    return { sessionId: session.id, url: session.url };
  },

  async retrievePaymentIntent(paymentIntentId: string) {
    const stripe = getStripeClient();
    return stripe.paymentIntents.retrieve(paymentIntentId);
  },

  async refundPaymentIntent(paymentIntentId: string) {
    const stripe = getStripeClient();

    const invoice = await InvoiceModel.findOne({
      stripePaymentIntentId: paymentIntentId,
    });
    if (!invoice) throw new Error("Invoice not found");

    const paymentIntent = await stripe.paymentIntents.retrieve(
      paymentIntentId,
      {
        expand: ["latest_charge"],
      },
    );

    const charge = paymentIntent.latest_charge as Stripe.Charge;
    if (!charge) throw new Error("No charge found for PaymentIntent");

    const refund = await stripe.refunds.create({ charge: charge.id });
    await InvoiceService.markRefunded(invoice._id.toString());

    return {
      refundId: refund.id,
      status: refund.status,
      amountRefunded: refund.amount / 100,
    };
  },

  // ----------------------------
  // WEBHOOK VERIFICATION (existing)
  // ----------------------------
  verifyWebhook(body: Buffer, signature: string | string[] | undefined) {
    const stripe = getStripeClient();
    if (!signature) throw new Error("Missing Stripe signature header");
    if (Array.isArray(signature))
      throw new Error("Invalid Stripe signature header format");

    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured");

    return stripe.webhooks.constructEvent(body, signature, secret);
  },

  // ----------------------------
  // WEBHOOK HANDLER (UPGRADED)
  // ----------------------------
  async handleWebhookEvent(event: Stripe.Event) {
    logger.info("Stripe Webhook received:", event.type);

    switch (event.type) {
      // marketplace flows (existing)
      case "payment_intent.succeeded":
        await this._handlePaymentSucceeded(event.data.object);
        break;

      case "payment_intent.payment_failed":
        await this._handlePaymentFailed(event.data.object);
        break;

      case "charge.refunded":
        await this._handleRefund(event.data.object);
        break;

      // connect readiness
      case "account.updated":
        await this._handleAccountUpdated(event.data.object);
        break;

      // subscription lifecycle
      case "checkout.session.completed":
        await this._handleCheckoutCompleted(event.data.object);
        break;

      case "customer.subscription.updated":
        await this._handleSubscriptionUpdated(event.data.object);
        break;

      case "customer.subscription.deleted":
        await this._handleSubscriptionDeleted(event.data.object);
        break;

      case "invoice.paid":
        await this._handleInvoicePaid(event.data.object);
        break;

      case "invoice.payment_failed":
        await this._handleInvoicePaymentFailed(event.data.object);
        break;

      default:
        logger.info(`Unhandled Stripe event: ${event.type}`);
        break;
    }
  },

  // ----------------------------
  // WEBHOOK: CONNECT
  // ----------------------------
  async _handleAccountUpdated(account: Stripe.Account) {
    const canAccept =
      account.charges_enabled === true && account.payouts_enabled === true;

    await OrgBilling.updateOne(
      { connectAccountId: account.id },
      {
        connectChargesEnabled: account.charges_enabled,
        connectPayoutsEnabled: account.payouts_enabled,
        canAcceptPayments: canAccept,
        connectDisabledReason: account.requirements?.disabled_reason ?? null,
        connectRequirements: {
          currentlyDue: account.requirements?.currently_due ?? [],
          eventuallyDue: account.requirements?.eventually_due ?? [],
          pastDue: account.requirements?.past_due ?? [],
          pendingVerification: account.requirements?.pending_verification ?? [],
          errors: account.requirements?.errors ?? [],
        },
      },
    );
  },

  // ----------------------------
  // WEBHOOK: SUBSCRIPTIONS
  // ----------------------------
  async _handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    if (session.mode === "subscription") {
      return this._handleSubscriptionCheckout(session);
    } else if (session.mode === "payment") {
      return this._handleInvoiceCheckout(session);
    }

  },

  async _handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const item = subscription.items.data[0];

    await OrgBilling.updateOne(
      { stripeSubscriptionId: subscription.id },
      {
        subscriptionStatus: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        canceledAt: subscription.canceled_at
          ? new Date(subscription.canceled_at * 1000)
          : null,

        seatQuantity: item?.quantity ?? 0,

        currentPeriodStart: new Date(item.current_period_start * 1000),
        currentPeriodEnd: new Date(item.current_period_end * 1000),
      },
    );
  },

  async _handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    await OrgBilling.updateOne(
      { stripeSubscriptionId: subscription.id },
      {
        plan: "free",
        accessState: "free",
        downgradedAt: new Date(),

        subscriptionStatus: "canceled",
        billingInterval: undefined,

        stripeSubscriptionItemId: null,
        stripePriceId: null,

        cancelAtPeriodEnd: false,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        gracePeriodEndsAt: null,
      },
    );
  },

  async _handleInvoicePaid(invoice: Stripe.Invoice) {
    const subscriptionId = invoice.lines.data[0].subscription;
    if (!subscriptionId) return;

    await OrgBilling.updateOne(
      { stripeSubscriptionId: subscriptionId },
      {
        lastInvoiceId: invoice.id,
        lastPaymentStatus: "paid",
        lastPaymentAt: new Date(),
        accessState: "active",
        gracePeriodEndsAt: null,
      },
    );
  },

  async _handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
    const subscriptionId = invoice.lines.data[0].subscription;
    if (!subscriptionId) return;

    const graceEnd = addDays(new Date(), 7);

    await OrgBilling.updateOne(
      { stripeSubscriptionId: subscriptionId },
      {
        lastInvoiceId: invoice.id,
        lastPaymentStatus: "failed",
        accessState: "past_due",
        gracePeriodEndsAt: graceEnd,
      },
    );
  },

  // ----------------------------
  // EXISTING HANDLERS (keep)
  // ----------------------------
  async _handlePaymentSucceeded(pi: Stripe.PaymentIntent) {
    const type = pi.metadata?.type;
    if (!type) {
      logger.error("payment_intent.succeeded missing metadata.type");
      return;
    }
    if (type === "INVOICE_PAYMENT") return this._handleInvoicePayment(pi);
    if (type === "APPOINTMENT_BOOKING")
      return this._handleAppointmentBookingPayment(pi);
    logger.error("Unknown payment type in metadata");
  },

  async _handleAppointmentBookingPayment(pi: Stripe.PaymentIntent) {
    // (your existing code unchanged)
    const appointmentId = pi.metadata?.appointmentId;
    if (!appointmentId) return;

    const appointment = await AppointmentModel.findById(appointmentId);
    if (!appointment) return;

    const existingInvoice = await InvoiceModel.findOne({
      appointmentId,
      status: "PAID",
    });
    if (existingInvoice) return;

    const chargeId = pi.latest_charge as string;
    const charge = await getStripeClient().charges.retrieve(chargeId);

    const service = await ServiceModel.findById(
      appointment.appointmentType?.id,
    );
    if (!service) return;

    const invoice = await InvoiceModel.create({
      appointmentId,
      organisationId: appointment.organisationId,
      parentId: appointment.companion.parent.id,
      companionId: appointment.companion.id,
      currency: pi.currency,

      status: "PAID",
      items: [
        {
          name: service.name,
          description: service.description,
          quantity: 1,
          unitPrice: service.cost,
          total: service.cost,
        },
      ],
      subtotal: service.cost,
      discountTotal: 0,
      taxTotal: 0,
      totalAmount: service.cost,

      stripePaymentIntentId: pi.id,
      stripeChargeId: charge.id,
      stripeReceiptUrl: charge.receipt_url,
    });

    await AppointmentModel.updateOne(
      { _id: appointmentId },
      {
        status: "REQUESTED",
        invoiceId: invoice._id,
        stripePaymentIntentId: pi.id,
        stripeChargeId: charge.id,
        updatedAt: new Date(),
        expiresAt: undefined,
      },
    );

    logger.info(
      `Appointment ${appointmentId} booking PAID. Invoice ${invoice.id} created`,
    );
  },

  async _handleInvoicePayment(pi: Stripe.PaymentIntent) {
    const invoiceId = pi.metadata?.invoiceId;
    if (!invoiceId) return;

    const invoice = await InvoiceModel.findById(invoiceId);
    if (!invoice) return;

    if (invoice.status === "PAID") return;

    // 🔒 Accept PI ONLY if invoice expects IN_APP
    if (invoice.paymentCollectionMethod !== "PAYMENT_INTENT") {
      await this._refundByPaymentIntentId(pi.id);
      return;
    }

    const chargeId = pi.latest_charge as string;
    const charge = await getStripeClient().charges.retrieve(chargeId);

    invoice.status = "PAID";
    invoice.stripePaymentIntentId = pi.id;
    invoice.stripeChargeId = charge.id;
    invoice.stripeReceiptUrl = charge.receipt_url!;
    invoice.updatedAt = new Date();
    await invoice.save();

    logger.info(`Invoice ${invoiceId} marked PAID`);
  },

  async _handlePaymentFailed(pi: Stripe.PaymentIntent) {
    const appointmentId = pi.metadata?.appointmentId;
    if (!appointmentId) return;

    const invoice = await InvoiceModel.findOne({ appointmentId });
    if (!invoice) return;

    await InvoiceModel.updateOne({ _id: invoice._id }, { status: "FAILED" });
    logger.warn(`Invoice ${invoice.id} marked FAILED`);
  },

  async _handleRefund(charge: Stripe.Charge) {
    const appointmentId = charge.metadata?.appointmentId;
    if (!appointmentId) return;

    const invoice = await InvoiceModel.findOne({ appointmentId });
    if (!invoice) return;

    await InvoiceModel.updateOne({ _id: invoice._id }, { status: "REFUNDED" });

    const notificationPayload = NotificationTemplates.Payment.REFUND_ISSUED(
      charge.amount / 100,
      charge.currency,
    );
    const parentId = invoice.parentId;
    await NotificationService.sendToUser(parentId!, notificationPayload);

    logger.warn(`Invoice ${invoice.id} marked REFUNDED`);
  },

  async _handleSubscriptionCheckout(session: Stripe.Checkout.Session) {
    const stripe = getStripeClient();

    const customerId = session.customer as string;
    const subscriptionId = session.subscription as string;
    if (!customerId || !subscriptionId) return;

    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["items.data.price"],
    });

    const item = subscription.items.data[0];
    const price = item.price;

    const productId =
      typeof price.product === "string" ? price.product : price.product?.id;

    await OrgBilling.updateOne(
      { stripeCustomerId: customerId },
      {
        plan: "business",
        accessState: "active",
        upgradedAt: new Date(),

        stripeSubscriptionId: subscription.id,
        stripeSubscriptionItemId: item.id,
        stripePriceId: price.id,
        stripeProductId: productId ?? null,
        billingInterval: price.recurring?.interval,
        joinedAt: new Date(),
        subscriptionStatus: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,

        seatQuantity: item.quantity ?? 0,
        seatQuantityUpdatedAt: new Date(),

        currentPeriodStart: new Date(item.current_period_start * 1000),
        currentPeriodEnd: new Date(item.current_period_end * 1000),

        stripeLivemode: session.livemode ?? false,
        gracePeriodEndsAt: null,
      },
    );
  },

  async _handleInvoiceCheckout(session: Stripe.Checkout.Session) {
    const invoiceId = session.metadata?.invoiceId;
    if (!invoiceId) return;

    const invoice = await InvoiceModel.findById(invoiceId);
    if (!invoice) return;

    // Idempotency
    if (invoice.status === "PAID") return;

    // ✅ Accept ONLY if invoice expects PAYMENT_LINK
    if (invoice.paymentCollectionMethod !== "PAYMENT_LINK") {
      // Late or invalid payment → refund
      const piId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : null;

      if (piId) {
        await this._refundByPaymentIntentId(piId);
      }
      return;
    }

    // Ensure session matches what we issued
    if (
      invoice.stripeCheckoutSessionId &&
      invoice.stripeCheckoutSessionId !== session.id
    ) {
      const piId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : null;

      if (piId) {
        await this._refundByPaymentIntentId(piId);
      }
      return;
    }

    // ✅ Mark invoice PAID
    await InvoiceModel.updateOne(
      { _id: invoiceId, status: { $ne: "PAID" } },
      {
        $set: {
          status: "PAID",
          paidAt: new Date(),
          updatedAt: new Date(),
        },
      },
    );

    // Optional: update appointment state
    if (invoice.appointmentId) {
      await AppointmentModel.updateOne(
        { _id: invoice.appointmentId },
        { $set: { updatedAt: new Date() } },
      );
    }

    // Optional: notify parent
    if (invoice.parentId) {
      await NotificationService.sendToUser(
        invoice.parentId,
        NotificationTemplates.Payment.PAYMENT_SUCCESS(
          invoice.totalAmount,
          invoice.currency,
        ),
      );
    }
  },

  async _refundByPaymentIntentId(paymentIntentId: string) {
    const stripe = getStripeClient();

    try {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ["latest_charge"],
      });

      const charge = pi.latest_charge as Stripe.Charge | null;
      if (!charge?.id) return;

      await stripe.refunds.create({ charge: charge.id });
    } catch (err) {
      logger.error("Failed to auto-refund payment intent", paymentIntentId, err);
    }
  },
};
