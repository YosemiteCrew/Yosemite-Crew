import { Router } from "express";
import { OrganizationController } from "../controllers/web/organization.controller";
import { SpecialityController } from "src/controllers/web/speciality.controller";
import { OrganisationInviteController } from "../controllers/web/organisation-invite.controller";
import { authorizeCognito } from "src/middlewares/auth";
const router = Router();

router.post("/", authorizeCognito, OrganizationController.onboardBusiness);
router.get("/:id", authorizeCognito, OrganizationController.getBusinessById);
router.get("/", authorizeCognito, OrganizationController.getAllBusinesses);
router.delete(
  "/:id",
  authorizeCognito,
  OrganizationController.deleteBusinessById,
);
router.put("/:id", authorizeCognito, OrganizationController.updateBusinessById);
router.get(
  "/:organizationId/specality",
  authorizeCognito,
  SpecialityController.getAllByOrganizationId,
);
router.post(
  "/:organisationId/invites",
  authorizeCognito,
  OrganisationInviteController.createInvite,
);
router.get(
  "/:organisationId/invites",
  authorizeCognito,
  OrganisationInviteController.listOrganisationInvites,
);
router.post("/logo/presigned-url", OrganizationController.getLogoUploadUrl);
router.post(
  "/logo/presigned-url/:orgId",
  OrganizationController.getLogoUploadUrl,
);
router.get(
  "/check",
  OrganizationController.checkIsPMSOrganistaion,
)

export default router;
