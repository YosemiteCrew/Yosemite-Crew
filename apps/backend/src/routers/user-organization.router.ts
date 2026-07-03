import { Router } from "express";
import { UserOrganizationController } from "../controllers/web/user-organization.controller";
import { requireWebAuth } from "src/middlewares/auth";

const router = Router();

router.post("/", requireWebAuth, UserOrganizationController.upsertMapping);
router.get(
  "/user/mapping",
  requireWebAuth,
  UserOrganizationController.listMappingsForUser,
);
router.get(
  "/org/mapping/:organisationId",
  requireWebAuth,
  UserOrganizationController.listByOrganisationId,
);
router.get("/:id", requireWebAuth, UserOrganizationController.getMappingById);
router.get("/", requireWebAuth, UserOrganizationController.listMappings);
router.delete(
  "/:id",
  requireWebAuth,
  UserOrganizationController.deleteMappingById,
);
router.put(
  "/:id",
  requireWebAuth,
  UserOrganizationController.updateMappingById,
);

export default router;
