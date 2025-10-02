import { Router } from "express"
import { OrganizationController } from "../controllers/web/organization.controller"
const router = Router()

router.post("/", OrganizationController.onboardBusiness)
router.get("/:id", OrganizationController.getBusinessById)
router.get("/", OrganizationController.getAllBusinesses)
router.delete("/:id", OrganizationController.deleteBusinessById)
router.put("/:id", OrganizationController.updateBusinessById)

export default router