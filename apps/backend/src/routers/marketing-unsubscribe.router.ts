import { Router } from "express";
import { MarketingUnsubscribeController } from "src/controllers/app/marketing-unsubscribe.controller";

const router = Router();

// GET only confirms; POST performs the unsubscribe. Mail providers and link
// scanners fetch every URL in a delivered message, so a mutating GET would let
// delivery alone unsubscribe the recipient.
router.get("/unsubscribe", MarketingUnsubscribeController.confirm);
router.post("/unsubscribe", MarketingUnsubscribeController.unsubscribe);

export default router;
