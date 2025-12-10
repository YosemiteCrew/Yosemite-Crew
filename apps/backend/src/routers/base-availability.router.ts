import { Router } from "express";
import { BaseAvailabilityController } from "../controllers/web/base-availability.controller";

const router = Router();

router.post("/", BaseAvailabilityController.create);
router.put("/:userId", BaseAvailabilityController.update);
router.get("/:userId", BaseAvailabilityController.getByUserId);

export default router;
