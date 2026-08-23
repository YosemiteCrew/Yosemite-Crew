import { Router } from "express";
import { CareReminderOptOutController } from "src/controllers/app/care-reminder-opt-out.controller";

const router = Router();

// Public and unauthenticated by design: the recipient follows this link from an
// email client and is not signed in. The encrypted token is the only credential,
// and it authorises exactly one action for one address at one practice.
router.get("/unsubscribe", CareReminderOptOutController.unsubscribe);
router.post("/unsubscribe", CareReminderOptOutController.unsubscribe);

export default router;
