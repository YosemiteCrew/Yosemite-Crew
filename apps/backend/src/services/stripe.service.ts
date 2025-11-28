// src/services/stripe.service.ts
import Stripe from "stripe";
import { InvoiceService } from "./invoice.service";
import logger from "../utils/logger";
import InvoiceModel from "src/models/invoice";

// =============== Stripe Client ===============
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// =============== Helpers ===============
function toStripeAmount(amount: number): number {
  return Math.round(amount * 100); // Convert ₹100 → 10000 paise
}

// ============================================================================
//                           STRIPE SERVICE
// ============================================================================
export const StripeService = {
  /**
   * 1️⃣ Create Payment Intent for an Invoice
   */
  async createPaymentIntentForInvoice(invoiceId: string) {
    // Load invoice
    const invoice = await InvoiceModel.findById(invoiceId);
    if (!invoice) throw new Error("Invoice not found");

    if (invoice.status !== "AWAITING_PAYMENT" && invoice.status !== "PENDING") {
      throw new Error("Invoice is not payable");
    }

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
    if (!paymentIntentId) {
      throw new Error("paymentIntentId is required");
    }

    try {
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
      });

      return {
        refundId: refund.id,
        status: refund.status,
        amountRefunded: refund.amount / 100,
      };
    } catch (err: unknown) {
      logger.error("Stripe refund error:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      throw new Error(`Refund failed: ${message}`);
    }
  },

  /**
   * 2️⃣ Verify & Decode Stripe Webhook Event
   */
  verifyWebhook(body: Buffer, signature: string | string[]) {
    return stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  },

  /**
   * 3️⃣ Handle Stripe Webhook Event
   */
  async handleWebhookEvent(event: Stripe.Event) {
    logger.info("Stripe Webhook received:", event.type);

    switch (event.type) {
      case "payment_intent.succeeded":
        await this._handlePaymentSucceeded(
          event.data.object,
        );
        break;

      case "payment_intent.payment_failed":
        await this._handlePaymentFailed(
          event.data.object,
        );
        break;

      case "charge.refunded":
        await this._handleRefund(event.data.object);
        break;

      default:
        logger.info(`Unhandled Stripe event: ${event.type}`);
        break;
    }
  },

  // ============================================================================
  //                               HANDLERS
  // ============================================================================

  /**
   * ✔️ Payment Success Handler
   */
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

  /**
   * ❌ Payment Failed Handler
   */
  async _handlePaymentFailed(pi: Stripe.PaymentIntent) {
    const invoiceId = pi.metadata?.invoiceId;
    if (!invoiceId) return;

    await InvoiceService.markFailed(invoiceId);

    logger.warn(`Invoice ${invoiceId} marked FAILED`);
  },

  /**
   * ↩️ Refund Handler
   */
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
