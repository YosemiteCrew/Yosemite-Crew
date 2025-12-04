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

// Mobile Payment Intent Router
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
  "payment-intent/:invoiceId",
  authorizeCognitoMobile,
  (req, res) => StripeController.createPaymentIntentForInvoice(req, res),
);

// PMS Payment Intent Router
router.post("/pms/payment-intent/:invoiceId", authorizeCognito, (req, res) =>
  StripeController.createPaymentIntent(req, res),
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

export default router;
