import { Router } from "express";
import { OrganisationRoomController } from "../controllers/web/organisation-room.controller";
import { authorizeCognito } from "src/middlewares/auth";
const router = Router();

router.post("/", authorizeCognito, OrganisationRoomController.create);
router.put("/:id", authorizeCognito, OrganisationRoomController.update);
router.get(
  "/organization/:organizationId",
  authorizeCognito,
  OrganisationRoomController.getAllByOrganizationId,
);

export default router;
