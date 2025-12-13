import { Router } from "express";
import { UserProfileController } from "../controllers/web/user-profile.controller";
import { authorizeCognito } from "src/middlewares/auth";

const router = Router();

router.post("/", authorizeCognito, UserProfileController.create);
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
  "/:organizationId/:userId/profile-picture",
  authorizeCognito,
  UserProfileController.getProfilePictureUploadUrl
)

export default router;
