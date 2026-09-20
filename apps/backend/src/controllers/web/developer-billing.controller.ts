/*
 * These routes are scoped to the DEVELOPER, not to a practice.
 *
 * They were gated on `withOrgPermissions()` and keyed on an organisation, which
 * the portal's own audience never has: signing up through the developer door
 * grants the `developer` role and nothing else, there is no developer entry in
 * the RBAC role model, and no UserOrganization row is created. Every request
 * from such an account failed on the org middleware before reaching a handler.
 * See issue #2551.
 *
 * The caller's own verified id is the owner. `resolveVerifiedUserId` reads only
 * the session (`utils/request.ts` deliberately dropped its `x-user-id` header
 * fallback), so the owner cannot be spoofed by a header the way an org could be.
 */
import type { Request, Response } from "express";
import { z } from "zod";
import logger from "../../utils/logger";
import { resolveVerifiedUserId } from "src/utils/request";
import {
  DeveloperBillingService,
  DeveloperBillingServiceError,
} from "../../services/developer-billing.service";

const CheckoutSchema = z.object({
  successUrl: z.url(),
  cancelUrl: z.url(),
});

const PortalSchema = z.object({
  returnUrl: z.url(),
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
    const ownerUserId = resolveVerifiedUserId(req);
    if (!ownerUserId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    try {
      const data = await DeveloperBillingService.getSubscription(ownerUserId);
      res.json({ data });
    } catch (err) {
      handleError(err, res);
    }
  },

  createCheckout: async (req: Request, res: Response): Promise<void> => {
    const ownerUserId = resolveVerifiedUserId(req);
    if (!ownerUserId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const parsed = CheckoutSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.issues;
      res.status(400).json({
        error: errors.length > 0 ? errors[0].message : "Invalid request",
      });
      return;
    }
    try {
      const url = await DeveloperBillingService.createCheckoutSession({
        ownerUserId,
        ...parsed.data,
      });
      res.status(201).json({ data: { url } });
    } catch (err) {
      handleError(err, res);
    }
  },

  createPortal: async (req: Request, res: Response): Promise<void> => {
    const ownerUserId = resolveVerifiedUserId(req);
    if (!ownerUserId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const parsed = PortalSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "returnUrl is required" });
      return;
    }
    try {
      const url = await DeveloperBillingService.createPortalSession({
        ownerUserId,
        returnUrl: parsed.data.returnUrl,
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
