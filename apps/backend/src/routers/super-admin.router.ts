import { Router } from "express";

import { SuperAdminBusinessController } from "src/controllers/web/super-admin-business.controller";
import { requireAnyAuth } from "src/middlewares/auth";
import { requireSuperAdmin } from "src/middlewares/super-admin";

const router = Router();

router.use(requireAnyAuth, requireSuperAdmin);

router.get("/businesses", SuperAdminBusinessController.listBusinesses);
router.get("/businesses/:id", SuperAdminBusinessController.getBusiness);
router.patch("/businesses/:id", SuperAdminBusinessController.updateBusiness);

export default router;
