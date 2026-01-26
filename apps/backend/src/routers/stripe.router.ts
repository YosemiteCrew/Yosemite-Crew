import { Router } from "express";
import { StripeController } from "../controllers/web/stripe.controller";
import bodyParser from "body-parser";
import { authorizeCognito, authorizeCognitoMobile } from "src/middlewares/auth";
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

/* ======================================================
   MOBILE ROUTES (PARENT / OWN CONTEXT)
   ====================================================== */

router.post(
  "/payment-intent/:appointmentId",
  authorizeCognitoMobile,
  StripeController.createPaymentIntent,
);

router.get(
  "/payment-intent/:paymentIntentId",
  authorizeCognitoMobile,
  StripeController.retrievePaymentIntent,
);

// Checkout session status (public for success/cancel pages)
router.get("/checkout-session/:sessionId", StripeController.retrieveCheckoutSession);

router.get(
  "/invoice/:invoiceId/payment-intent",
  authorizeCognitoMobile,
  StripeController.createPaymentIntentForInvoice,
);

/* ======================================================
   PMS ROUTES (RBAC ENABLED)
   ====================================================== */

// Create payment intent for invoice (PMS)
router.post(
  "/pms/payment-intent/:invoiceId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("billing:edit:any"),
  StripeController.createPaymentIntentForInvoice,
);

// Create or fetch connected Stripe account
router.post(
  "/organisation/:organisationId/account",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("billing:edit:any"),
  StripeController.createOrGetConnectedAccount,
);

// Get Stripe account status
router.get(
  "/organisation/:organisationId/account/status",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("billing:view:any"),
  StripeController.getAccountStatus,
);

// Create Stripe onboarding link
router.post(
  "/organisation/:organisationId/onboarding",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("billing:edit:any"),
  StripeController.createOnboardingLink,
);

// Create business checkout (subscription)
router.post(
  "/organisation/:organisationId/billing/checkout",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("subscription:edit:any"),
  StripeController.createBusinessCheckout,
);

// Open billing portal
router.post(
  "/organisation/:organisationId/billing/portal",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("billing:view:any"),
  StripeController.createBillingPortal,
);

// Sync seats (subscription management)
router.post(
  "/organisation/:organisationId/billing/sync-seats",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("subscription:edit:any"),
  StripeController.syncSeats,
);

export default router;
