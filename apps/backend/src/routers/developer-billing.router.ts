import { Router } from "express";
import { DeveloperBillingController } from "../controllers/web/developer-billing.controller";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const router = Router();

/*
 * `POST /v1/developers/billing/webhook` is deliberately NOT here. Stripe's
 * signature check needs the unparsed body, and this router mounts after the
 * global `express.json()`, so a raw parser on it would never run. It is
 * registered directly on the app alongside the other webhooks instead - see
 * `app.ts`.
 */

router.get(
  "/",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("billing:view:any"),
  DeveloperBillingController.getSubscription,
);

router.post(
  "/checkout",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("billing:edit:any"),
  DeveloperBillingController.createCheckout,
);

router.post(
  "/portal",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("billing:view:any"),
  DeveloperBillingController.createPortal,
);

export default router;
