import { Router } from "express";
import { SpecialityController } from "../controllers/web/speciality.controller";
import { authorizeCognito } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";

const router = Router();

/* ======================================================
   PMS ROUTES (RBAC ENABLED)
   ====================================================== */

// Create speciality
router.post(
  "/",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  SpecialityController.create,
);

// List specialities by organisation
router.get(
  "/:organisationId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  SpecialityController.getAllByOrganizationId,
);

// Update speciality
router.put(
  "/:id",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  SpecialityController.update,
);

// Delete speciality
router.delete(
  "/:organisationId/:specialityId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  SpecialityController.deleteSpeciality,
);

export default router;
