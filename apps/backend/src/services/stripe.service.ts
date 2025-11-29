// src/services/stripe.service.ts
import Stripe from "stripe";
import { InvoiceService } from "./invoice.service";
import logger from "../utils/logger";
import InvoiceModel from "src/models/invoice";
import OrganizationModel from "src/models/organization";

let stripeClient: Stripe | null = null;

const getStripeClient = () => {
  if (stripeClient) return stripeClient;

  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  stripeClient = new Stripe(apiKey, { apiVersion: "2025-11-17.clover" });
  return stripeClient;
};

function toStripeAmount(amount: number): number {
  return Math.round(amount * 100); // Convert ₹100 → 10000 paise
}

export const StripeService = {
  async createOrGetConnectedAccount(organisationId: string) {
    const stripe = getStripeClient();

    const org = await OrganizationModel.findById(organisationId);
    if (!org) throw new Error("Organisation not found");

    if (org.stripeAccountId) return { accountId: org.stripeAccountId };

    // Create Connect account
    const account = await stripe.accounts.create({});

    org.stripeAccountId = account.id;
    await org.save();

    return {
      accountId: account.id,
    };
  },

  async getAccountStatus(organisationId: string) {
    const stripe = getStripeClient();

    const org = await OrganizationModel.findById(organisationId);
    if (!org || !org.stripeAccountId)
      throw new Error("Organisation does not have a Stripe account");

    const account = await stripe.accounts.retrieve(org.stripeAccountId);

    return {
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      requirements: account.requirements,
    };
  },

  async createOnboardingLink(organisationId: string) {
    const stripe = getStripeClient();

    const org = await OrganizationModel.findById(organisationId);
    if (!org || !org.stripeAccountId)
      throw new Error("Organisation does not have a Stripe account");

    const accountSession = await stripe.accountSessions.create({
      account: org.stripeAccountId,
      components: {
        account_onboarding: { enabled: true },
      },
    });

    return {
      client_secret: accountSession.client_secret,
    };
  },

  async createPaymentIntentForInvoice(invoiceId: string) {
    const stripe = getStripeClient();

    // Load invoice
    const invoice = await InvoiceModel.findById(invoiceId);
    if (!invoice) throw new Error("Invoice not found");

    const organisation = await OrganizationModel.findById(
      invoice.organisationId,
    );
    if (!organisation) throw new Error("Organisation not found");

    if (invoice.status !== "AWAITING_PAYMENT" && invoice.status !== "PENDING") {
      throw new Error("Invoice is not payable");
    }

    if (!organisation?.stripeAccountId)
      throw new Error("Organisation does not have a Stripe connected account");

    // Calculate amount
    const amountToPay = invoice.totalAmount;
    const stripeAmount = toStripeAmount(amountToPay);

    // Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: stripeAmount,
      currency: invoice.currency || "usd",
      metadata: {
        invoiceId,
        organisationId: invoice.organisationId ?? "",
        parentId: invoice.parentId ?? "",
        companionId: invoice.companionId ?? "",
      },
      description: `Payment for Invoice ${invoiceId}`,
      transfer_data: {
        destination: organisation.stripeAccountId,
      },
    });

    // Save into invoice
    await InvoiceService.attachStripeDetails(invoiceId, {
      stripePaymentIntentId: paymentIntent.id,
      status: "AWAITING_PAYMENT",
    });

    return {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      amount: amountToPay,
      currency: invoice.currency || "usd",
    };
  },

  async refundPaymentIntent(paymentIntentId: string) {
    const stripe = getStripeClient();

    const invoice = await InvoiceModel.findOne({
      stripePaymentIntentId: paymentIntentId,
    });
    if (!invoice) throw new Error("Invoice not found");

    const org = await OrganizationModel.findById(invoice.organisationId);
    if (!org || !org.stripeAccountId)
      throw new Error("Organisation does not have a Stripe connected account");

    const refund = await stripe.refunds.create(
      { payment_intent: paymentIntentId },
      { stripeAccount: org.stripeAccountId },
    );

    const invoiceId = invoice._id?.toString?.() ?? String(invoice.id);
    await InvoiceService.markRefunded(invoiceId);

    return {
      refundId: refund.id,
      status: refund.status,
      amountRefunded: refund.amount / 100,
    };
  },

  // Verify & Decode Stripe Webhook Event
  verifyWebhook(body: Buffer, signature: string | string[] | undefined) {
    const stripe = getStripeClient();

    if (!signature) {
      throw new Error("Missing Stripe signature header");
    }

    if (Array.isArray(signature)) {
      throw new Error("Invalid Stripe signature header format");
    }

    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
    }

    return stripe.webhooks.constructEvent(body, signature, secret);
  },

  // Handle Stripe Webhook Event
  async handleWebhookEvent(event: Stripe.Event) {
    logger.info("Stripe Webhook received:", event.type);

    switch (event.type) {
      case "payment_intent.succeeded":
        await this._handlePaymentSucceeded(event.data.object);
        break;

      case "payment_intent.payment_failed":
        await this._handlePaymentFailed(event.data.object);
        break;

      case "charge.refunded":
        await this._handleRefund(event.data.object);
        break;

      default:
        logger.info(`Unhandled Stripe event: ${event.type}`);
        break;
    }
  },

  // Payment success handler
  async _handlePaymentSucceeded(pi: Stripe.PaymentIntent) {
    const invoiceId = pi.metadata?.invoiceId;
    if (!invoiceId) {
      logger.error("payment_intent.succeeded missing invoiceId metadata");
      return;
    }

    const invoice = await InvoiceModel.findById(invoiceId);
    if (!invoice) {
      logger.error(`Invoice not found for id ${invoiceId}`);
      return;
    }

    // Prevent double-processing
    if (invoice.status === "PAID") {
      logger.info(`Invoice ${invoiceId} already marked paid.`);
      return;
    }

    // Update Invoice
    await InvoiceService.markPaid(invoiceId);

    // Update appointment (optional: only if tied to invoice)
    // if (invoice.appointmentId) {
    //   await AppointmentService.
    // }

    logger.info(`Invoice ${invoiceId} marked PAID`);
  },

  //Payment Failed Handler
  async _handlePaymentFailed(pi: Stripe.PaymentIntent) {
    const invoiceId = pi.metadata?.invoiceId;
    if (!invoiceId) return;

    await InvoiceService.markFailed(invoiceId);

    logger.warn(`Invoice ${invoiceId} marked FAILED`);
  },

  //Refund Handler
  async _handleRefund(charge: Stripe.Charge) {
    const invoiceId = charge.metadata?.invoiceId;
    if (!invoiceId) {
      logger.error("charge.refunded missing invoiceId metadata");
      return;
    }

    await InvoiceService.markRefunded(invoiceId);

    logger.warn(`Invoice ${invoiceId} marked REFUNDED`);
  },
};
