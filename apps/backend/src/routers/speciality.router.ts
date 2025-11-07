import { Router } from "express"
import { SpecialityController } from "../controllers/web/speciality.controller"
const router = Router()

router.post("/", SpecialityController.create)
router.get("/:id", SpecialityController.getAllByOrganizationId)
router.put("/:id", SpecialityController.update)

export default router