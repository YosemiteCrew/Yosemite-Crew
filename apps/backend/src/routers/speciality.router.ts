import { Router } from "express";
import { SpecialityController } from "../controllers/web/speciality.controller";
import { authorizeCognito } from "src/middlewares/auth";
const router = Router();

router.post("/", authorizeCognito, SpecialityController.create);
router.get(
  "/:organisationId",
  authorizeCognito,
  SpecialityController.getAllByOrganizationId,
);
router.put("/:id", authorizeCognito, SpecialityController.update);
router.delete(
  "/:organisationId/:specialityId",
  SpecialityController.deleteSpeciality,
);

export default router;
