import { Router } from "express";
import { MarketingUnsubscribeController } from "src/controllers/app/marketing-unsubscribe.controller";

const router = Router();

router.get("/unsubscribe", MarketingUnsubscribeController.unsubscribe);
router.post("/unsubscribe", MarketingUnsubscribeController.unsubscribe);

export default router;
