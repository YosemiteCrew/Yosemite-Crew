import { Request, Response } from "express";
import { StripeService } from "src/services/stripe.service";
import logger from "src/utils/logger";

export const StripeController = {
  /** 1️⃣ Create Payment Intent **/
  createPaymentIntent: async (req: Request, res: Response) => {
    try {
      const { invoiceId } = req.params;

      if (!invoiceId) {
        return res.status(400).json({ message: "invoiceId is required" });
      }

      const result =
        await StripeService.createPaymentIntentForInvoice(invoiceId);

      return res.status(200).json(result);
    } catch (err: unknown) {
      logger.error("Stripe createPaymentIntent failed:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      return res.status(500).json({ message });
    }
  },

  /** 2️⃣ Stripe Webhook **/
  webhook: async (req: Request<unknown, unknown, Buffer>, res: Response) => {
    try {
      const sig = req.headers["stripe-signature"];
      if (!sig) return res.status(400).send("Missing signature");

      const event = StripeService.verifyWebhook(req.body, sig);

      await StripeService.handleWebhookEvent(event);

      res.status(200).send("OK");
    } catch (err: unknown) {
      logger.error("Stripe webhook error:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      return res.status(400).send(`Webhook Error: ${message}`);
    }
  },
};
