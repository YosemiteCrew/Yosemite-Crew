import { Router } from "express";
import { MarketingController } from "src/controllers/app/marketing.controller";

const router = Router();

router.get("/discord-members", MarketingController.getDiscordMembers);

export default router;
