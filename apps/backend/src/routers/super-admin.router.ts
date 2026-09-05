import { Router } from "express";

import { SuperAdminBusinessController } from "src/controllers/web/super-admin-business.controller";
import { SuperAdminLabIngestionController } from "src/controllers/web/super-admin-lab-ingestion.controller";
import { requireAnyAuth } from "src/middlewares/auth";
import { requireSuperAdmin } from "src/middlewares/super-admin";

const router = Router();

router.use(requireAnyAuth, requireSuperAdmin);

router.get("/businesses", SuperAdminBusinessController.listBusinesses);
router.get("/businesses/:id", SuperAdminBusinessController.getBusiness);
router.patch("/businesses/:id", SuperAdminBusinessController.updateBusiness);

// Lab ingestion holds a result it cannot apply rather than halting the poll for
// every organisation; this is where those rows become visible to someone.
router.get(
  "/lab-ingestion/quarantine",
  SuperAdminLabIngestionController.listQuarantine,
);
// Without a writer for resolvedAt the list can only ever grow, so the count an
// operator reads as severity could never fall.
router.patch(
  "/lab-ingestion/quarantine/:id/resolve",
  SuperAdminLabIngestionController.resolveQuarantine,
);

export default router;
