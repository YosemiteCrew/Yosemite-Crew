import { Router } from "express";
import { UserProfileController } from "../controllers/web/user-profile.controller";
import { authorizeCognito } from "src/middlewares/auth";

const router = Router();

router.post(
  "/:organizationId/profile",
  authorizeCognito,
  UserProfileController.create,
);
router.put(
  "/:organizationId/profile",
  authorizeCognito,
  UserProfileController.update,
);
router.get(
  "/:organizationId/profile",
  authorizeCognito,
  UserProfileController.getByUserId,
);
router.get(
  "/:userId/:organizationId/profile",
  authorizeCognito,
  UserProfileController.getUserProfileById,
);
router.post(
  "/:organizationId/profile-picture",
  authorizeCognito,
  UserProfileController.getProfilePictureUploadUrl,
);

export default router;
