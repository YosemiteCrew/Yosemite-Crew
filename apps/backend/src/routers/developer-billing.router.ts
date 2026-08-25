import express, { Router } from "express";
import { DeveloperBillingController } from "../controllers/web/developer-billing.controller";
import { requireWebAuth } from "src/middlewares/auth";
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
