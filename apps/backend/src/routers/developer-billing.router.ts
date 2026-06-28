import express, { Router } from "express";
import { DeveloperBillingController } from "../controllers/web/developer-billing.controller";
import { authorizeCognito } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const router = Router();

// Public — Stripe calls this directly; raw body required for signature verification
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  DeveloperBillingController.webhook,
);

router.get(
  "/",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("billing:view:any"),
  DeveloperBillingController.getSubscription,
);

router.post(
  "/checkout",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("billing:edit:any"),
  DeveloperBillingController.createCheckout,
);

router.post(
  "/portal",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("billing:view:any"),
  DeveloperBillingController.createPortal,
);

export default router;
