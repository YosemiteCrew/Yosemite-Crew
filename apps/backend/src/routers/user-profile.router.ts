import { Router } from "express";
import { UserProfileController } from "../controllers/web/user-profile.controller";

const router = Router();

router.post("/", UserProfileController.create);
router.put("/:organizationId/:userId", UserProfileController.update);
router.get("/:organizationId/:userId", UserProfileController.getByUserId);

export default router;
