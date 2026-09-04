import { Router } from "express";
import { ParasiteRiskController } from "../controllers/app/parasite-risk.controller";
import { requireMobileAuth } from "src/middlewares/auth";

const router = Router();

/* ======================================================
   MOBILE ROUTES (PET PARENT)
   ====================================================== */

// Modelled parasite risk for the grid cell containing a coordinate.
router.get("/", requireMobileAuth, ParasiteRiskController.getRiskForCell);

// Locations the parent has asked to be alerted about.
router.get(
  "/subscriptions",
  requireMobileAuth,
  ParasiteRiskController.listSubscriptions,
);

router.post(
  "/subscriptions",
  requireMobileAuth,
  ParasiteRiskController.createSubscription,
);

router.delete(
  "/subscriptions/:subscriptionId",
  requireMobileAuth,
  ParasiteRiskController.deleteSubscription,
);

export default router;
