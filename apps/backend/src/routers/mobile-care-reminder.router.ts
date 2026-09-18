import { Router } from "express";
import { MobileCareReminderController } from "../controllers/app/care-reminder.controller";
import { requireMobileAuth } from "src/middlewares/auth";

export const mobileCareReminderRouter = Router();

// What the signed-in parent's companions are due for.
mobileCareReminderRouter.get(
  "/mobile/due",
  requireMobileAuth,
  MobileCareReminderController.listDueReminders,
);

export default mobileCareReminderRouter;
