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

  async createPaymentIntent(req: Request, res: Response) {
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

  async createPaymentIntentForInvoice(req: Request, res: Response) {
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

  async retrievePaymentIntent(req: Request, res: Response) {
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

  async createOnboardingLink(req: Request, res: Response) {
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
