import { Router } from "express";
import { StripeController } from "../controllers/web/stripe.controller";
import bodyParser from "body-parser";
import { authorizeCognito, authorizeCognitoMobile } from "src/middlewares/auth";

const router = Router();

router.post(
  "/webhook",
  bodyParser.raw({ type: "application/json" }),
  (req, res) => StripeController.webhook(req, res),
);

router.post(
  "/payment-intent/:appointmentId",
  authorizeCognitoMobile,
  (req, res) => StripeController.createPaymentIntent(req, res),
);

router.get(
  "/payment-intent/:paymentIntentId",
  authorizeCognitoMobile,
  (req, res) => StripeController.retrievePaymentIntent(req, res),
);

router.get(
  "/invoice/:invoiceId/payment-intent",
  authorizeCognitoMobile,
  (req, res) => StripeController.createPaymentIntentForInvoice(req, res),
);

router.post("/pms/payment-intent/:invoiceId", authorizeCognito, (req, res) =>
  StripeController.createPaymentIntentForInvoice(req, res),
);

router.post(
  "/organisation/:organisationId/account",
  authorizeCognito,
  (req, res) => StripeController.createOrGetConnectedAccount(req, res),
);

router.get(
  "/organisation/:organisationId/account/status",
  authorizeCognito,
  (req, res) => StripeController.getAccountStatus(req, res),
);

router.post(
  "/organisation/:organisationId/onboarding",
  authorizeCognito,
  (req, res) => StripeController.createOnboardingLink(req, res),
);

router.post(
  "/organisation/:organisationId/billing/checkout",
  authorizeCognito,
  (req, res) => StripeController.createBusinessCheckout(req, res),
);

router.post(
  "/organisation/:organisationId/billing/portal",
  authorizeCognito,
  (req, res) => StripeController.createBillingPortal(req, res),
);

router.post(
  "/organisation/:organisationId/billing/sync-seats",
  authorizeCognito,
  (req, res) => StripeController.syncSeats(req, res),
);

export default router;
