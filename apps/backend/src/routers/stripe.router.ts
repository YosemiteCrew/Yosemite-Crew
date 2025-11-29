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
  "/payment-intent/:invoiceId",
  authorizeCognitoMobile,
  (req, res) => StripeController.createPaymentIntent(req, res),
);

// PMS Payment Intent Router
router.post(
  "/pms/payment-intent/:invoiceId",
  authorizeCognito,
  (req, res) => StripeController.createPaymentIntent(req, res),
);

export default router;