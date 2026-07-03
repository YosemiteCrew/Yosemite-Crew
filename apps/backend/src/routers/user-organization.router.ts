import { Router } from "express";
import { UserOrganizationController } from "../controllers/web/user-organization.controller";
import { authorizeCognito } from "src/middlewares/auth";

const router = Router();

router.post("/", authorizeCognito, UserOrganizationController.upsertMapping);
router.get(
  "/user/mapping",
  authorizeCognito,
  UserOrganizationController.listMappingsForUser,
);
router.get(
  "/org/mapping/:organisationId",
  authorizeCognito,
  UserOrganizationController.listByOrganisationId,
);
router.get("/:id", authorizeCognito, UserOrganizationController.getMappingById);
router.get("/", authorizeCognito, UserOrganizationController.listMappings);
router.delete(
  "/:id",
  authorizeCognito,
  UserOrganizationController.deleteMappingById,
);
router.put(
  "/:id",
  authorizeCognito,
  UserOrganizationController.updateMappingById,
);

export default router;
