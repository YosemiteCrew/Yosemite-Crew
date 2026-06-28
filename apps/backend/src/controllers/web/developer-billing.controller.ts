import type { Request, Response } from "express";
import { z } from "zod";
import logger from "../../utils/logger";
import type { OrgRequest } from "src/middlewares/rbac";
import {
  DeveloperBillingService,
  DeveloperBillingServiceError,
} from "../../services/developer-billing.service";

const getOrgId = (req: Request): string | undefined =>
  (req as OrgRequest).organisationId;

const CheckoutSchema = z.object({
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

const handleError = (err: unknown, res: Response): void => {
  if (err instanceof DeveloperBillingServiceError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  logger.error("DeveloperBillingController unexpected error", err);
  res.status(500).json({ error: "Internal server error" });
};

export const DeveloperBillingController = {
  getSubscription: async (req: Request, res: Response): Promise<void> => {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      res.status(400).json({ error: "organisationId is required" });
      return;
    }
    try {
      const data =
        await DeveloperBillingService.getSubscription(organisationId);
      res.json({ data });
    } catch (err) {
      handleError(err, res);
    }
  },

  createCheckout: async (req: Request, res: Response): Promise<void> => {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      res.status(400).json({ error: "organisationId is required" });
      return;
    }
    const parsed = CheckoutSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.errors[0]?.message ?? "Invalid request" });
      return;
    }
    try {
      const url = await DeveloperBillingService.createCheckoutSession({
        organisationId,
        ...parsed.data,
      });
      res.status(201).json({ data: { url } });
    } catch (err) {
      handleError(err, res);
    }
  },

  createPortal: async (req: Request, res: Response): Promise<void> => {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      res.status(400).json({ error: "organisationId is required" });
      return;
    }
    const returnUrl =
      typeof req.body?.returnUrl === "string" ? req.body.returnUrl : null;
    if (!returnUrl) {
      res.status(400).json({ error: "returnUrl is required" });
      return;
    }
    try {
      const url = await DeveloperBillingService.createPortalSession({
        organisationId,
        returnUrl,
      });
      res.status(201).json({ data: { url } });
    } catch (err) {
      handleError(err, res);
    }
  },

  webhook: async (req: Request, res: Response): Promise<void> => {
    const signature = req.headers["stripe-signature"];
    if (typeof signature !== "string") {
      res.status(400).json({ error: "Missing stripe-signature header" });
      return;
    }
    let event;
    try {
      event = DeveloperBillingService.verifyWebhook(
        req.body as Buffer,
        signature,
      );
    } catch (err) {
      logger.error("Developer billing webhook verification failed", err);
      res.status(400).json({ error: "Invalid webhook signature" });
      return;
    }
    try {
      await DeveloperBillingService.handleWebhookEvent(event);
      res.json({ received: true });
    } catch (err) {
      logger.error("Developer billing webhook handler failed", err);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  },
};
