import { Router } from "express";
import { UserProfileController } from "../controllers/web/user-profile.controller";
import { requireWebAuth } from "src/middlewares/auth";
import { withOrgPermissions } from "src/middlewares/rbac";

const router = Router();

// Every route here is addressed by `:organizationId` but acts on the CALLER's
// own profile, so membership is the right bar - no extra permission is needed to
// manage your own record. Without `withOrgPermissions` the organisation was
// simply whatever the path said, which let any authenticated web session write a
// profile row (and mint an org-scoped picture upload URL) inside a tenant it had
// no relationship with.
router.post(
  "/:organizationId/profile",
  requireWebAuth,
  withOrgPermissions(),
  UserProfileController.create,
);
router.put(
  "/:organizationId/profile",
  requireWebAuth,
  withOrgPermissions(),
  UserProfileController.update,
);
router.get(
  "/:organizationId/profile",
  requireWebAuth,
  withOrgPermissions(),
  UserProfileController.getByUserId,
);
router.get(
  "/:userId/:organizationId/profile",
  requireWebAuth,
  withOrgPermissions(),
  UserProfileController.getUserProfileById,
);
router.post(
  "/:organizationId/profile-picture",
  requireWebAuth,
  withOrgPermissions(),
  UserProfileController.getProfilePictureUploadUrl,
);

export default router;
