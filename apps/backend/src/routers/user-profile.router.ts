import { Router } from "express";
import { UserProfileController } from "../controllers/web/user-profile.controller";
import { requireWebAuth } from "src/middlewares/auth";

const router = Router();

router.post(
  "/:organizationId/profile",
  requireWebAuth,
  UserProfileController.create,
);
router.put(
  "/:organizationId/profile",
  requireWebAuth,
  UserProfileController.update,
);
router.get(
  "/:organizationId/profile",
  requireWebAuth,
  UserProfileController.getByUserId,
);
router.get(
  "/:userId/:organizationId/profile",
  requireWebAuth,
  UserProfileController.getUserProfileById,
);
router.post(
  "/:organizationId/profile-picture",
  requireWebAuth,
  UserProfileController.getProfilePictureUploadUrl,
);

export default router;
