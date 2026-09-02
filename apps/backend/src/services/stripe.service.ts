// src/services/stripe.service.ts
import Stripe from "stripe";

type WebhookSignature = string | string[] | undefined;
import logger from "../utils/logger";

import { InvoiceService } from "./invoice.service";
import {
  FinancePaymentService,
  assertInvoiceInScope,
  resolveStripeConnectedAccountId,
  type InvoiceAccessScope,
} from "./finance/payment";
import { FinanceSubscriptionService } from "./finance/subscription";
import { NotificationTemplates } from "src/utils/notificationTemplates";
import { NotificationService } from "./notification.service";

import { prisma } from "src/config/prisma";
import { getOrgBillingCurrency } from "src/utils/billing";
import { recomputeOrganizationVerification } from "./organization-verification.service";
import { Prisma } from "@prisma/client";

let stripeClient: Stripe | null = null;

const extractAppointmentTypeId = (
  value: Prisma.JsonValue | null,
): string | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const candidate = (value as Record<string, unknown>).id;
  return typeof candidate === "string" ? candidate : undefined;
};

const extractCompanionRefs = (
  value: Prisma.JsonValue,
): { patientId?: string; parentId?: string } => {
  if (!value || typeof value !== "object") return {};
  const companion = value as Record<string, unknown>;
  const patientId = typeof companion.id === "string" ? companion.id : undefined;
  const parent = companion.parent as Record<string, unknown> | undefined;
  const parentId =
    parent && typeof parent.id === "string" ? parent.id : undefined;
  return { patientId, parentId };
};

const extractAppointmentPatientRefs = (appointment: {
  patient?: Prisma.JsonValue | null;
  companion?: Prisma.JsonValue | null;
}) =>
  extractCompanionRefs(appointment.patient ?? appointment.companion ?? null);

const getStripeClient = () => {
  if (stripeClient) return stripeClient;

  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) throw new Error("STRIPE_SECRET_KEY is not configured");

  stripeClient = new Stripe(apiKey, { apiVersion: "2026-01-28.clover" });
  return stripeClient;
};

function toStripeAmount(amount: number): number {
  return Math.round(amount * 100);
}

// Settlement must use what Stripe actually captured, never the invoice total.
const resolveCapturedAmount = (
  pi: Stripe.PaymentIntent,
  charge: Stripe.Charge | null,
): number | null => {
  const capturedMinorUnits =
    charge?.amount_captured ?? charge?.amount ?? pi.amount_received ?? null;

  if (typeof capturedMinorUnits !== "number" || capturedMinorUnits <= 0) {
    return null;
  }

  return capturedMinorUnits / 100;
};

const isUniqueConstraintViolation = (error: unknown): boolean =>
  !!error &&
  typeof error === "object" &&
  "code" in error &&
  (error as { code?: string }).code === "P2002";

// latest_charge is typed string | Charge | null. It is an id when the intent was
// not expanded and the Charge itself when it was, so the blind `as string` cast
// this path used to carry would have handed an object to charges.retrieve. An
// already-expanded charge needs no round trip; only an id does.
const retrieveBookingCharge = async (
  pi: Stripe.PaymentIntent,
  connectedAccountId?: string,
): Promise<Stripe.Charge | null> => {
  if (typeof pi.latest_charge !== "string") {
    return pi.latest_charge ?? null;
  }

  return getStripeClient().charges.retrieve(pi.latest_charge, {
    ...(connectedAccountId ? { stripeAccount: connectedAccountId } : {}),
  });
};

/** The invoice already bound to this intent, if this delivery is a replay. */
const findInvoiceBoundToIntent = (intentId: string) =>
  prisma.invoice.findUnique({
    where: { providerPaymentIntentId: intentId },
    select: { id: true },
  });

/**
 * Claim an appointment's open invoice by stamping the intent on it.
 *
 * Stamping is the point, not settling. Without it a later redelivery finds
 * nothing bound and nothing open, and mints a second invoice - the failure that
 * looks safe because the happy path is unchanged.
 */
const claimOpenBookingInvoice = async (
  appointmentId: string,
  intentId: string,
): Promise<string | null> => {
  const claimed = await prisma.invoice.updateMany({
    where: {
      appointmentId,
      status: { in: ["AWAITING_PAYMENT", "PENDING"] },
      providerPaymentIntentId: null,
    },
    data: { providerPaymentIntentId: intentId },
  });
  if (claimed.count === 0) return null;

  const invoice = await findInvoiceBoundToIntent(intentId);
  return invoice?.id ?? null;
};

/**
 * Mint the booking invoice, or absorb the unique violation that says we should
 * not have. Returns null when there is nothing left to settle.
 */
const mintBookingInvoice = async (params: {
  appointmentId: string;
  organisationId: string | null;
  parentId?: string | null;
  patientId?: string | null;
  service: { name: string; description: string | null; cost: number };
  pi: Stripe.PaymentIntent;
}): Promise<string | null> => {
  const { appointmentId, organisationId, parentId, patientId, service, pi } =
    params;

  try {
    const created = await prisma.invoice.create({
      data: {
        appointmentId,
        organisationId,
        parentId: parentId ?? undefined,
        patientId: patientId ?? undefined,
        currency: pi.currency ?? "usd",
        status: "PAID",
        providerPaymentIntentId: pi.id,
        items: [
          {
            name: service.name,
            description: service.description ?? undefined,
            quantity: 1,
            unitPrice: service.cost,
            total: service.cost,
          },
        ],
        subtotal: service.cost,
        discountTotal: 0,
        taxTotal: 0,
        totalAmount: service.cost,
      },
      select: { id: true },
    });
    return created.id;
  } catch (error) {
    if (!isUniqueConstraintViolation(error)) throw error;

    // Two shapes reach here and they need different answers.
    //
    // A racer that lost on providerPaymentIntentId: the winner committed before
    // Postgres raised, so this read cannot miss it. The winner settles.
    const winner = await findInvoiceBoundToIntent(pi.id);
    if (winner) {
      logger.info(
        `Appointment ${appointmentId} booking lost the race for ${pi.id}; invoice ${winner.id} won`,
      );
      return null;
    }

    // Or a collision on the appointment key, which still exists: a SECOND
    // legitimate intent for an appointment that already has an invoice. Log it
    // and stop, because throwing answers non-2xx and buys an endless Stripe
    // retry of an event that cannot succeed while that index stands.
    logger.error(
      `Appointment ${appointmentId} already carries an invoice, so intent ${pi.id} could not be recorded. Payment captured with no invoice of its own.`,
      error,
    );
    return null;
  }
};

const settleAppointmentBookingInvoice = async (params: {
  invoiceId: string;
  appointmentId: string;
  pi: Stripe.PaymentIntent;
  connectedAccountId?: string;
  origin: string;
}) => {
  const { invoiceId, appointmentId, pi, connectedAccountId, origin } = params;

  const charge = await retrieveBookingCharge(pi, connectedAccountId);
  if (!charge) {
    logger.error(
      `Appointment ${appointmentId} booking intent ${pi.id} carries no charge; invoice ${invoiceId} ${origin} but not settled.`,
    );
    return;
  }

  await FinancePaymentService.handleInvoicePaymentIntentSucceeded({
    invoiceId,
    paymentIntentId: pi.id,
    chargeId: charge.id,
    receiptUrl: charge.receipt_url ?? null,
    currency: pi.currency ?? null,
    amount: resolveCapturedAmount(pi, charge),
    connectedAccountId: connectedAccountId ?? null,
    allowUnboundAttempt: true,
    rawProviderPayload: {
      paymentIntentId: pi.id,
      chargeId: charge.id,
      source: "stripe._handleAppointmentBookingPayment",
    },
  });

  await prisma.appointment.updateMany({
    where: { id: appointmentId },
    data: {
      status: "REQUESTED",
      updatedAt: new Date(),
      expiresAt: null,
    },
  });

  logger.info(
    `Appointment ${appointmentId} booking PAID. Invoice ${invoiceId} ${origin}`,
  );
};

export const StripeService = {
  // ----------------------------
  // CONNECT (existing + improved)
  // ----------------------------
  async createOrGetConnectedAccount(organisationId: string) {
    const stripe = getStripeClient();

    const org = await prisma.organization.findUnique({
      where: { id: organisationId },
    });
    if (!org) throw new Error("Organisation not found");

    if (org.stripeAccountId) return { accountId: org.stripeAccountId };

    const account = await stripe.accounts.create({});

    await prisma.organization.update({
      where: { id: organisationId },
      data: { stripeAccountId: account.id },
    });

    await prisma.organizationBilling.upsert({
      where: { orgId: organisationId },
      create: { orgId: organisationId, connectAccountId: account.id },
      update: { connectAccountId: account.id },
    });

    return { accountId: account.id };
  },

  async getAccountStatus(organisationId: string) {
    const org = await prisma.organization.findUnique({
      where: { id: organisationId },
      select: { id: true },
    });
    if (!org) {
      throw new Error("Organistaion not found");
    }

    const [orgBilling, orgUsage] = await Promise.all([
      prisma.organizationBilling.findUnique({
        where: { orgId: org.id },
      }),
      prisma.organizationUsageCounter.findUnique({
        where: { orgId: org.id },
      }),
    ]);

    return {
      orgBilling: orgBilling,
      orgUsage: orgUsage,
    };
  },

  async createOnboardingLink(organisationId: string) {
    const stripe = getStripeClient();
    const orgBilling = await prisma.organizationBilling.findUnique({
      where: { orgId: organisationId },
    });

    if (!orgBilling?.connectAccountId)
      throw new Error("Organisation does not have a Stripe account");

    const accountSession = await stripe.accountSessions.create({
      account: orgBilling.connectAccountId,
      components: {
        account_onboarding: { enabled: true },
        tax_settings: {
          enabled: true,
          features: {},
        },
        tax_registrations: {
          enabled: true,
        },
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
    const checkoutContext =
      await FinanceSubscriptionService.prepareBusinessCheckoutSession(
        orgId,
        interval,
      );

    if (!checkoutContext.canAcceptPayments) {
      throw new Error(
        "Organisation cannot accept payments yet. Complete Stripe onboarding first.",
      );
    }

    if (!checkoutContext.externalCustomerId) {
      const customer = await stripe.customers.create({
        name: checkoutContext.orgName,
        metadata: {
          orgId: String(orgId),
          connectAccountId: String(checkoutContext.connectAccountId ?? ""),
        },
      });

      await FinanceSubscriptionService.recordBusinessCheckoutCustomer({
        orgId,
        externalCustomerId: customer.id,
      });
      checkoutContext.externalCustomerId = customer.id;
    }

    const successUrl = `${process.env.APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${process.env.APP_URL}/organization`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: checkoutContext.externalCustomerId ?? undefined,
      line_items: [
        {
          price: checkoutContext.priceId,
          quantity: checkoutContext.seats,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: {
          orgId: String(orgId),
          connectAccountId: String(checkoutContext.connectAccountId ?? ""),
        },
      },
      tax_id_collection: {
        enabled: true,
      },
      automatic_tax: {
        enabled: true,
      },
      billing_address_collection: "auto",
      metadata: {
        orgId: String(orgId),
        interval,
        seats: String(checkoutContext.seats),
      },
      customer_update: {
        name: "auto",
        address: "auto",
      },
    });

    return { url: session.url };
  },

  async createCustomerPortalSession(orgId: string) {
    const stripe = getStripeClient();
    const billing =
      await FinanceSubscriptionService.resolveBillingCustomerId(orgId);

    if (!billing.externalCustomerId) {
      throw new Error("No billing customer found. Upgrade to Business first.");
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: billing.externalCustomerId,
      return_url: `${process.env.APP_URL}/organization`,
    });

    return { url: session.url };
  },

  async syncSubscriptionSeats(orgId: string) {
    const stripe = getStripeClient();
    const plan =
      await FinanceSubscriptionService.resolveSubscriptionSeatSyncPlan(orgId);
    if (!plan) {
      return { updated: false, reason: "no_change" };
    }

    await stripe.subscriptionItems.update(plan.subscriptionItemId, {
      quantity: plan.newSeats,
      proration_behavior: plan.prorationBehavior,
    });

    await FinanceSubscriptionService.recordSeatUsage({
      orgId,
      seats: plan.newSeats,
    });

    return {
      updated: true,
      oldSeats: plan.oldSeats,
      newSeats: plan.newSeats,
      prorationBehavior: plan.prorationBehavior,
    };
  },

  // ----------------------------
  // EXISTING PAYMENT INTENTS (keep)
  // ----------------------------

  async createPaymentIntentForAppointment(appointmentId: string) {
    const stripe = getStripeClient();
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        status: true,
        organisationId: true,
        appointmentType: true,
        patient: true,
      },
    });
    if (!appointment) throw new Error("Appointment not found");

    if (!["REQUESTED", "UPCOMING"].includes(appointment.status)) {
      throw new Error("Appointment does not allow payment");
    }

    const serviceId = extractAppointmentTypeId(appointment.appointmentType);
    if (!serviceId) throw new Error("Service not found");

    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });
    if (!service) throw new Error("Service not found");

    const organisation = await prisma.organization.findUnique({
      where: { id: appointment.organisationId },
      select: { stripeAccountId: true },
    });
    if (!organisation?.stripeAccountId)
      throw new Error("Organisation has no Stripe account");

    const amount = toStripeAmount(service.cost);
    const currency = await getOrgBillingCurrency(appointment.organisationId);

    const { parentId, patientId } = extractAppointmentPatientRefs(appointment);
    const companionId = patientId ?? "";

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount,
        currency,
        metadata: {
          type: "APPOINTMENT_BOOKING",
          appointmentId,
          organisationId: appointment.organisationId,
          parentId: parentId ?? "",
          patientId: companionId,
          companionId,
        },
      },
      {
        stripeAccount: organisation.stripeAccountId,
      },
    );

    return {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      amount: service.cost,
      currency,
    };
  },

  async createPaymentIntentForInvoice(
    invoiceId: string,
    scope: InvoiceAccessScope,
  ) {
    return FinancePaymentService.createPaymentIntentForInvoice(
      invoiceId,
      scope,
    );
  },

  async createCheckoutSessionForInvoice(invoiceId: string) {
    return FinancePaymentService.createCheckoutSessionForInvoice(invoiceId);
  },

  async retrievePaymentIntent(
    paymentIntentId: string,
    scope: InvoiceAccessScope,
  ) {
    const attempt = await prisma.paymentAttempt.findFirst({
      where: { providerPaymentIntentId: paymentIntentId },
      orderBy: { createdAt: "desc" },
      select: {
        invoice: {
          select: { id: true, organisationId: true, parentId: true },
        },
      },
    });

    if (!attempt?.invoice) {
      throw new Error("Payment intent not found");
    }

    assertInvoiceInScope(attempt.invoice, scope);

    const connectedAccountId = await resolveStripeConnectedAccountId({
      invoiceId: attempt.invoice.id,
      paymentIntentId,
    });

    const stripe = getStripeClient();
    return stripe.paymentIntents.retrieve(
      paymentIntentId,
      {},
      connectedAccountId ? { stripeAccount: connectedAccountId } : {},
    );
  },

  async retrieveCheckoutSession(sessionId: string) {
    const connectedAccountId = await resolveStripeConnectedAccountId({
      checkoutSessionId: sessionId,
    });

    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(
      sessionId,
      {},
      connectedAccountId ? { stripeAccount: connectedAccountId } : {},
    );

    // Unauthenticated success/cancel pages read this, so only the two fields
    // they render are projected out - never the session object itself.
    return {
      status: session.payment_status,
      total: session.amount_total ? session.amount_total / 100 : 0,
    };
  },

  async refundPaymentIntent(paymentIntentId: string) {
    const invoice = await prisma.paymentAttempt.findFirst({
      where: { providerPaymentIntentId: paymentIntentId },
      select: { invoiceId: true },
    });
    if (!invoice) throw new Error("Invoice not found");

    const result = await FinancePaymentService.refundInvoicePayment(
      invoice.invoiceId,
    );
    await InvoiceService.markRefunded(invoice.invoiceId);

    return {
      refundId: result.refund.refundId,
      status: result.refund.status,
      amountRefunded: result.refund.amountRefunded,
    };
  },

  // ----------------------------
  // WEBHOOK VERIFICATION
  // ----------------------------
  verifyWebhook(body: Buffer, signature: WebhookSignature) {
    return this.verifyWebhookWithSecret(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  },

  verifyConnectWebhook(body: Buffer, signature: WebhookSignature) {
    return this.verifyWebhookWithSecret(
      body,
      signature,
      process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
    );
  },

  verifyWebhookWithSecret(
    body: Buffer,
    signature: string | string[] | undefined,
    secret: string | undefined,
  ) {
    const stripe = getStripeClient();
    if (!signature) throw new Error("Missing Stripe signature header");
    if (Array.isArray(signature))
      throw new Error("Invalid Stripe signature header format");

    if (!secret) throw new Error("Stripe webhook secret is not configured");

    return stripe.webhooks.constructEvent(body, signature, secret);
  },

  // ----------------------------
  // WEBHOOK HANDLER (UPGRADED)
  // ----------------------------
  async handleWebhookEvent(event: Stripe.Event) {
    logger.info("Stripe Webhook received:", event.type);
    const connectedAccountId =
      typeof event.account === "string" ? event.account : undefined;

    switch (event.type) {
      // marketplace flows (existing)
      case "payment_intent.succeeded":
        await this._handlePaymentSucceeded(
          event.data.object,
          connectedAccountId,
        );
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

      // Subscription lifecycle, plus invoice checkout.
      //
      // `async_payment_succeeded` is handled alongside `completed` because
      // delayed payment methods (bank debits, bank transfers) finish the session
      // before the funds settle and report the outcome on that later event.
      // Without it, a genuinely-paid invoice using one of those methods would
      // never settle now that `_handleInvoiceCheckout` refuses to act on a
      // session whose payment_status is not yet `paid`.
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await this._handleCheckoutCompleted(
          event.data.object,
          connectedAccountId,
        );
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

    await prisma.organizationBilling.updateMany({
      where: { connectAccountId: account.id },
      data: {
        currency: account.default_currency ?? undefined,
        connectChargesEnabled: account.charges_enabled ?? false,
        connectPayoutsEnabled: account.payouts_enabled ?? false,
        canAcceptPayments: canAccept,
        connectDisabledReason:
          account.requirements?.disabled_reason ?? undefined,
        connectRequirements: {
          currentlyDue: account.requirements?.currently_due ?? [],
          eventuallyDue: account.requirements?.eventually_due ?? [],
          pastDue: account.requirements?.past_due ?? [],
          pendingVerification: account.requirements?.pending_verification ?? [],
          errors: account.requirements?.errors ?? [],
        } as unknown as Prisma.InputJsonValue,
      },
    });

    // Connect status affects verification: recompute isVerified for every org
    // on this account (honours a manual override inside the helper).
    const affected = await prisma.organizationBilling.findMany({
      where: { connectAccountId: account.id },
      select: { orgId: true },
    });
    for (const { orgId } of affected) {
      await recomputeOrganizationVerification(orgId);
    }
  },

  // ----------------------------
  // WEBHOOK: SUBSCRIPTIONS
  // ----------------------------
  async _handleCheckoutCompleted(
    session: Stripe.Checkout.Session,
    connectedAccountId?: string,
  ) {
    if (session.mode === "subscription") {
      return this._handleSubscriptionCheckout(session);
    } else if (session.mode === "payment") {
      return this._handleInvoiceCheckout(session, connectedAccountId);
    }
  },

  async _handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    await FinanceSubscriptionService.recordStripeSubscriptionUpdated(
      subscription,
    );
  },

  async _handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    await FinanceSubscriptionService.recordSubscriptionDeleted(subscription.id);
  },

  async _handleInvoicePaid(invoice: Stripe.Invoice) {
    const subscriptionValue = invoice.lines.data[0]?.subscription;
    const subscriptionId =
      typeof subscriptionValue === "string"
        ? subscriptionValue
        : subscriptionValue?.id;
    if (!subscriptionId) return;

    await FinanceSubscriptionService.recordSubscriptionInvoicePaid({
      subscriptionId,
      invoiceId: invoice.id ?? null,
    });
  },

  async _handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
    const subscriptionValue = invoice.lines.data[0]?.subscription;
    const subscriptionId =
      typeof subscriptionValue === "string"
        ? subscriptionValue
        : subscriptionValue?.id;
    if (!subscriptionId) return;

    await FinanceSubscriptionService.recordSubscriptionInvoiceFailed({
      subscriptionId,
      invoiceId: invoice.id ?? null,
    });
  },

  // ----------------------------
  // EXISTING HANDLERS (keep)
  // ----------------------------
  async _handlePaymentSucceeded(
    pi: Stripe.PaymentIntent,
    connectedAccountId?: string,
  ) {
    const type = pi.metadata?.type;
    if (!type) {
      logger.error("payment_intent.succeeded missing metadata.type");
      return;
    }
    if (type === "INVOICE_PAYMENT")
      return this._handleInvoicePayment(pi, connectedAccountId);
    if (type === "APPOINTMENT_BOOKING")
      return this._handleAppointmentBookingPayment(pi, connectedAccountId);
    logger.error("Unknown payment type in metadata");
  },

  async _handleAppointmentBookingPayment(
    pi: Stripe.PaymentIntent,
    connectedAccountId?: string,
  ) {
    const appointmentId = pi.metadata?.appointmentId;
    if (!appointmentId) return;

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        appointmentType: true,
        organisationId: true,
        patient: true,
      },
    });
    if (!appointment) {
      // The charge succeeded. Every other exit from this handler logs; these
      // used to be the only silent ones, so a captured payment could vanish
      // without a trace anywhere.
      logger.error(
        `Booking payment ${pi.id} succeeded for appointment ${appointmentId}, which no longer exists; no invoice can be minted`,
      );
      return;
    }

    // Replay check, and the reason this handler is safe at all. Stripe redelivers
    // on any non-2xx and nothing upstream deduplicates by event id, so the same
    // intent can arrive here more than once, including concurrently. An invoice
    // already bound to THIS intent means the work was done.
    const bound = await findInvoiceBoundToIntent(pi.id);
    if (bound) {
      logger.info(
        `Appointment ${appointmentId} booking replay for ${pi.id}; invoice ${bound.id} already bound`,
      );
      return;
    }

    const claimedInvoiceId = await claimOpenBookingInvoice(
      appointmentId,
      pi.id,
    );
    if (claimedInvoiceId) {
      await settleAppointmentBookingInvoice({
        invoiceId: claimedInvoiceId,
        appointmentId,
        pi,
        connectedAccountId,
        origin: "claimed",
      });
      return;
    }

    const serviceId = extractAppointmentTypeId(appointment.appointmentType);
    if (!serviceId) {
      logger.error(
        `Booking payment ${pi.id} succeeded for appointment ${appointmentId}, whose appointmentType carries no service id; no invoice minted`,
      );
      return;
    }

    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });
    if (!service) {
      // Reachable: deleting a speciality hard-deletes its services, and a
      // payment can be in flight across that (3DS, a resumed checkout, a
      // delayed payment method). The card is charged either way.
      logger.error(
        `Booking payment ${pi.id} succeeded for appointment ${appointmentId}, but service ${serviceId} no longer exists; no invoice minted`,
      );
      return;
    }

    const { parentId, patientId } = extractAppointmentPatientRefs(appointment);

    const mintedInvoiceId = await mintBookingInvoice({
      appointmentId,
      organisationId: appointment.organisationId,
      parentId,
      patientId,
      service,
      pi,
    });
    if (!mintedInvoiceId) return;

    await settleAppointmentBookingInvoice({
      invoiceId: mintedInvoiceId,
      appointmentId,
      pi,
      connectedAccountId,
      origin: "created",
    });
  },

  async _handleInvoicePayment(
    pi: Stripe.PaymentIntent,
    connectedAccountId?: string,
  ) {
    const invoiceId = pi.metadata?.invoiceId;
    if (!invoiceId) return;

    const chargeId =
      typeof pi.latest_charge === "string" ? pi.latest_charge : null;
    const charge = chargeId
      ? await getStripeClient().charges.retrieve(chargeId, {
          ...(connectedAccountId ? { stripeAccount: connectedAccountId } : {}),
        })
      : null;

    const result =
      await FinancePaymentService.handleInvoicePaymentIntentSucceeded({
        invoiceId,
        paymentIntentId: pi.id,
        chargeId,
        receiptUrl: charge?.receipt_url ?? null,
        currency: pi.currency ?? null,
        amount: resolveCapturedAmount(pi, charge),
        connectedAccountId: connectedAccountId ?? null,
        rawProviderPayload: {
          paymentIntentId: pi.id,
          invoiceId,
          metadata: pi.metadata,
        },
      });

    if (result.action === "REFUNDED") {
      logger.warn(`Invoice ${invoiceId} refunded from payment-intent webhook`);
      return;
    }

    if (result.action === "ACCOUNT_MISMATCH") {
      logger.error(
        `Invoice ${invoiceId} payment rejected: event account does not match the invoice organisation`,
      );
      return;
    }

    if (result.action === "MISSING_AMOUNT") {
      logger.error(
        `Invoice ${invoiceId} payment rejected: no captured amount reported`,
      );
      return;
    }

    if (result.action === "NO_INVOICE") {
      // The charge is captured and no invoice was found to mark PAID, so the
      // books show it outstanding. ALREADY_PAID and IGNORED below are genuine
      // replays; this is not one.
      logger.error(
        `Payment intent ${pi.id} succeeded but matched no invoice (metadata invoiceId: ${invoiceId ?? "none"}); the charge is captured and nothing was marked paid`,
      );
      return;
    }

    if (result.action === "IGNORED") {
      return;
    }

    if (result.action === "PAID") {
      logger.info(`Invoice ${invoiceId} marked PAID`);
    }
  },

  async _handlePaymentFailed(pi: Stripe.PaymentIntent) {
    const appointmentId = pi.metadata?.appointmentId;
    const invoiceId = pi.metadata?.invoiceId;
    const result = await FinancePaymentService.handleInvoicePaymentFailed({
      invoiceId,
      appointmentId,
      paymentIntentId: pi.id,
    });
    if (result.action === "FAILED") {
      logger.warn(`Invoice ${result.invoice.id} marked FAILED`);
    }
  },

  async _handleRefund(charge: Stripe.Charge) {
    const invoiceId = charge.metadata?.invoiceId;
    const result = await FinancePaymentService.markInvoiceRefundedFromWebhook({
      invoiceId,
      paymentIntentId:
        typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : null,
      chargeId: charge.id,
      amount: charge.amount / 100,
      currency: charge.currency,
      reason: charge.refunded ? "Refunded via Stripe" : undefined,
    });

    if (result.action === "NO_INVOICE") {
      // The customer has their money back and no invoice moved to REFUNDED, so
      // the books still show it PAID. ALREADY_REFUNDED below is a genuine
      // replay and stays quiet; this one needs a human.
      logger.error(
        `Refund on charge ${charge.id} (intent ${typeof charge.payment_intent === "string" ? charge.payment_intent : "unknown"}) matched no invoice; the invoice it belongs to is still marked paid`,
      );
      return;
    }

    if (result.action !== "REFUNDED" || !result.invoice.parentId) {
      return;
    }

    const notificationPayload = NotificationTemplates.Payment.REFUND_ISSUED(
      charge.amount / 100,
      charge.currency,
    );
    await NotificationService.sendToUser(
      result.invoice.parentId,
      notificationPayload,
    );

    logger.warn(`Invoice ${result.invoice.id} marked REFUNDED`);
  },

  async _handleSubscriptionCheckout(session: Stripe.Checkout.Session) {
    const stripe = getStripeClient();

    const customerId = session.customer as string;
    const subscriptionId = session.subscription as string;
    if (!customerId || !subscriptionId) return;

    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["items.data.price"],
    });

    await FinanceSubscriptionService.recordStripeSubscriptionCheckoutCompleted({
      customerId,
      session,
      subscription,
    });
  },

  async _handleInvoiceCheckout(
    session: Stripe.Checkout.Session,
    connectedAccountId?: string,
  ) {
    const invoiceId = session.metadata?.invoiceId;
    if (!invoiceId) return;

    // `checkout.session.completed` fires when the CHECKOUT finished, not when the
    // money arrived: a delayed payment method leaves `payment_status` as
    // `unpaid` and settles (or fails) asynchronously afterwards. Recording
    // payment on the completion event alone marked such invoices paid before any
    // funds existed. `no_payment_required` is a genuinely settled zero-total
    // session and still counts.
    if (
      session.payment_status !== "paid" &&
      session.payment_status !== "no_payment_required"
    ) {
      logger.info(
        `Ignoring checkout session ${session.id} for invoice ${invoiceId}: payment_status=${session.payment_status}. Awaiting async settlement.`,
      );
      return;
    }

    const result =
      await FinancePaymentService.handleInvoiceCheckoutSessionCompleted({
        invoiceId,
        sessionId: session.id,
        connectedAccountId: connectedAccountId ?? null,
        paymentIntentId:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : null,
        currency: session.currency ?? null,
        amountSubtotal: session.amount_subtotal
          ? session.amount_subtotal / 100
          : null,
        amountTotal: session.amount_total ? session.amount_total / 100 : null,
        amountTax: session.total_details?.amount_tax
          ? session.total_details.amount_tax / 100
          : null,
        automaticTaxStatus: session.automatic_tax?.status ?? null,
        rawProviderPayload: {
          sessionId: session.id,
          invoiceId,
          amountSubtotal: session.amount_subtotal ?? null,
          amountTotal: session.amount_total ?? null,
          amountTax: session.total_details?.amount_tax ?? null,
          automaticTaxStatus: session.automatic_tax?.status ?? null,
        },
      });

    if (result.action === "REFUNDED") {
      return;
    }

    if (result.action !== "PAID" || !result.invoice.parentId) {
      return;
    }

    // A replay settles nothing new. Stripe redelivers whenever it does not get a
    // 2xx, including when the response was simply lost, so without this the pet
    // parent is told again that the same payment succeeded.
    if (result.replayed) {
      return;
    }

    await NotificationService.sendToUser(
      result.invoice.parentId,
      NotificationTemplates.Payment.PAYMENT_SUCCESS(
        result.invoice.totalAmount,
        result.invoice.currency,
      ),
    );
  },

  async _refundByPaymentIntentId(paymentIntentId: string) {
    try {
      await FinancePaymentService.refundPaymentIntent(paymentIntentId);
    } catch (err) {
      logger.error(
        "Failed to auto-refund payment intent",
        paymentIntentId,
        err,
      );
    }
  },
};
