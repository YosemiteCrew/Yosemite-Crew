import { Router } from "express";
import { CareReminderOptOutController } from "src/controllers/app/care-reminder-opt-out.controller";

const router = Router();

// Public and unauthenticated by design: the recipient follows this link from an
// email client and is not signed in. The encrypted token is the only credential,
// and it authorises exactly one action for one address at one practice.
//
// GET only confirms; POST performs the opt-out. Mail providers and link scanners
// fetch every URL in a delivered message, so a mutating GET would let delivery
// alone unsubscribe someone.
router.get("/unsubscribe", CareReminderOptOutController.confirm);
router.post("/unsubscribe", CareReminderOptOutController.unsubscribe);

export default router;
