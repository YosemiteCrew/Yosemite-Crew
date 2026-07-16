import { Router } from "express";
import { StripeController } from "../controllers/web/stripe.controller";
import bodyParser from "body-parser";
import { requireWebAuth, requireMobileAuth } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";

const router = Router();

/* ======================================================
   STRIPE WEBHOOK (PUBLIC)
   ====================================================== */

router.post(
  "/webhook",
  bodyParser.raw({ type: "application/json" }),
  StripeController.webhook,
);

router.post(
  "/connect/webhook",
  bodyParser.raw({ type: "application/json" }),
  StripeController.connectWebhook,
);

/* ======================================================
   MOBILE ROUTES (PARENT / OWN CONTEXT)
   ====================================================== */

router.post(
  "/payment-intent/:appointmentId",
  requireMobileAuth,
  StripeController.createPaymentIntent,
);

router.get(
  "/payment-intent/:paymentIntentId",
  requireMobileAuth,
  StripeController.retrievePaymentIntent,
);

// Checkout session status (public for success/cancel pages)
router.get(
  "/checkout-session/:sessionId",
  StripeController.retrieveCheckoutSession,
);

router.get(
  "/invoice/:invoiceId/payment-intent",
  requireMobileAuth,
  StripeController.createPaymentIntentForInvoice,
);

/* ======================================================
   PMS ROUTES (RBAC ENABLED)
   ====================================================== */

// Create payment intent for invoice (PMS)
router.post(
  "/pms/payment-intent/:invoiceId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("billing:edit:any"),
  StripeController.createPaymentIntentForInvoice,
);

// Create or fetch connected Stripe account
router.post(
  "/organisation/:organisationId/account",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("billing:edit:any"),
  StripeController.createOrGetConnectedAccount,
);

// Get Stripe account status
router.get(
  "/organisation/:organisationId/account/status",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("billing:view:any"),
  StripeController.getAccountStatus,
);

// Create Stripe onboarding link
router.post(
  "/organisation/:organisationId/onboarding",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("billing:edit:any"),
  StripeController.createOnboardingLink,
);

// Create business checkout (subscription)
router.post(
  "/organisation/:organisationId/billing/checkout",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("subscription:edit:any"),
  StripeController.createBusinessCheckout,
);

// Open billing portal
router.post(
  "/organisation/:organisationId/billing/portal",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("billing:view:any"),
  StripeController.createBillingPortal,
);

// Sync seats (subscription management)
router.post(
  "/organisation/:organisationId/billing/sync-seats",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("subscription:edit:any"),
  StripeController.syncSeats,
);

export default router;
