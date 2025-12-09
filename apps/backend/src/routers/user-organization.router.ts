import { Router } from "express";
import { UserOrganizationController } from "../controllers/web/user-organization.controller";
import { authorizeCognito } from "src/middlewares/auth";

const router = Router();

router.post("/", UserOrganizationController.upsertMapping);
router.get(
  "/user/mapping",
  authorizeCognito,
  UserOrganizationController.listMappingsForUser,
);
router.get(
  "/org/mapping/:organisationId",
  //authorizeCognito,
  UserOrganizationController.listByOrganisationId
)
router.get("/:id", UserOrganizationController.getMappingById);
router.get("/", UserOrganizationController.listMappings);
router.delete("/:id", UserOrganizationController.deleteMappingById);
router.put("/:id", UserOrganizationController.updateMappingById);

export default router;
