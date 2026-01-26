import { Request, Response } from "express";
import { StripeService } from "src/services/stripe.service";
import logger from "src/utils/logger";

export const StripeController = {
  createOrGetConnectedAccount: async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      const result =
        await StripeService.createOrGetConnectedAccount(organisationId);
      return res.status(200).json(result);
    } catch (err) {
      logger.error("Error createOrGetConnectedAccount:", err);
      return res.status(400).json({
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },

  getAccountStatus: async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      const result = await StripeService.getAccountStatus(organisationId);
      return res.status(200).json(result);
    } catch (err) {
      logger.error("Error getAccountStatus:", err);
      return res.status(400).json({
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },

  // -------------------------
  // 🆕 SAAS BILLING
  // -------------------------

  /**
   * Create Checkout Session for Business plan
   */
  createBusinessCheckout: async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      const body: unknown = req.body;
      const intervalValue =
        typeof body === "object" && body !== null && "interval" in body
          ? (body as { interval?: unknown }).interval
          : undefined;
      const interval =
        intervalValue === "month" || intervalValue === "year"
          ? intervalValue
          : undefined;

      if (!interval) {
        return res.status(400).json({
          error: "interval must be 'month' or 'year'",
        });
      }

      const result = await StripeService.createBusinessCheckoutSession(
        organisationId,
        interval,
      );

      return res.status(200).json(result);
    } catch (err) {
      logger.error("Error createBusinessCheckout:", err);
      return res.status(400).json({
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },

  /**
   * Open Stripe Customer Portal
   */
  createBillingPortal: async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      const result =
        await StripeService.createCustomerPortalSession(organisationId);
      return res.status(200).json(result);
    } catch (err) {
      logger.error("Error createBillingPortal:", err);
      return res.status(400).json({
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },

  /**
   * Force sync seats (admin/debug)
   */
  syncSeats: async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      const result = await StripeService.syncSubscriptionSeats(organisationId);
      return res.status(200).json(result);
    } catch (err) {
      logger.error("Error syncSeats:", err);
      return res.status(400).json({
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },

  // -------------------------
  // EXISTING PAYMENT FLOWS
  // -------------------------

  refundPayment: async (req: Request, res: Response) => {
    try {
      const { paymentIntentId } = req.params;
      const result = await StripeService.refundPaymentIntent(paymentIntentId);
      return res.status(200).json(result);
    } catch (err) {
      logger.error("Error refundPayment:", err);
      return res.status(400).json({
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },

  webhook: async (req: Request<unknown, unknown, Buffer>, res: Response) => {
    const sig = req.headers["stripe-signature"];
    try {
      const event = StripeService.verifyWebhook(req.body, sig);
      await StripeService.handleWebhookEvent(event);
      return res.status(200).send("OK");
    } catch (err) {
      logger.error("Stripe Webhook Error:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      return res.status(400).send(`Webhook Error: ${message}`);
    }
  },

  createPaymentIntent: async (req: Request, res: Response) => {
    try {
      const { appointmentId } = req.params;
      const paymentIntent =
        await StripeService.createPaymentIntentForAppointment(appointmentId);
      return res.status(200).json(paymentIntent);
    } catch (err) {
      logger.error("Error createPaymentIntent:", err);
      return res.status(400).json({
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },

  createPaymentIntentForInvoice: async (req: Request, res: Response) => {
    try {
      const { invoiceId } = req.params;
      const paymentIntent =
        await StripeService.createPaymentIntentForInvoice(invoiceId);
      return res.status(200).json(paymentIntent);
    } catch (err) {
      logger.error("Error createPaymentIntentForInvoice:", err);
      return res.status(400).json({
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },

  retrievePaymentIntent: async (req: Request, res: Response) => {
    try {
      const { paymentIntentId } = req.params;
      const paymentIntent =
        await StripeService.retrievePaymentIntent(paymentIntentId);
      return res.status(200).json(paymentIntent);
    } catch (err) {
      logger.error("Error retrievePaymentIntent:", err);
      return res.status(400).json({
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },

  retrieveCheckoutSession: async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const session = await StripeService.retrieveCheckoutSession(sessionId);
      return res.status(200).json(session);
    } catch (err) {
      logger.error("Error retrieveCheckoutSession:", err);
      return res.status(400).json({
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },

  createOnboardingLink: async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      const result = await StripeService.createOnboardingLink(organisationId);
      return res.status(200).json(result);
    } catch (err) {
      logger.error("Error createOnboardingLink:", err);
      return res.status(400).json({
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
};
