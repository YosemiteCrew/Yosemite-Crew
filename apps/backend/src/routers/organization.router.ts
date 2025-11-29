import { Router } from "express";
import { OrganizationController } from "../controllers/web/organization.controller";
import { SpecialityController } from "src/controllers/web/speciality.controller";
import { OrganisationInviteController } from "../controllers/web/organisation-invite.controller";
import { authorizeCognito } from "src/middlewares/auth";
const router = Router();

router.post("/check", (req, res) =>
  OrganizationController.checkIsPMSOrganistaion(req, res),
);
router.get("/getNearby", (req, res) =>
  OrganizationController.getNearbyPaginated(req, res),
);
router.post("/", authorizeCognito, (req, res) =>
  OrganizationController.onboardBusiness(req, res),
);
router.get("/:id", authorizeCognito, (req, res) =>
  OrganizationController.getBusinessById(req, res),
);
router.get("/", authorizeCognito, (req, res) =>
  OrganizationController.getAllBusinesses(req, res),
);
router.delete("/:id", authorizeCognito, (req, res) =>
  OrganizationController.deleteBusinessById(req, res),
);
router.put("/:id", authorizeCognito, (req, res) =>
  OrganizationController.updateBusinessById(req, res),
);
router.get(
  "/:organizationId/specality",
  authorizeCognito,
  (req, res) => SpecialityController.getAllByOrganizationId(req, res),
);
router.post(
  "/:organisationId/invites",
  authorizeCognito,
  (req, res) => OrganisationInviteController.createInvite(req, res),
);
router.get(
  "/:organisationId/invites",
  authorizeCognito,
  (req, res) => OrganisationInviteController.listOrganisationInvites(req, res),
);
router.post("/logo/presigned-url", (req, res) =>
  OrganizationController.getLogoUploadUrl(req, res),
);
router.post("/logo/presigned-url/:orgId", (req, res) =>
  OrganizationController.getLogoUploadUrl(req, res),
);

export default router;
