import { Router } from "express";
import { SpecialityController } from "../controllers/web/speciality.controller";
import { requireWebAuth } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";

const router = Router();

/* ======================================================
   PMS ROUTES (RBAC ENABLED)
   ====================================================== */

// Create speciality
router.post(
  "/",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  SpecialityController.create,
);

// Bulk create specialities
router.post(
  "/bulk",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  SpecialityController.createMany,
);

// List specialities by organisation
router.get(
  "/",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  SpecialityController.getAllByOrganizationId,
);

router.get(
  "/:id",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  SpecialityController.getSpecialityById,
);

// Update speciality
router.put(
  "/:id",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  SpecialityController.update,
);

// Delete speciality
router.delete(
  "/:organisationId/:specialityId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  SpecialityController.deleteSpeciality,
);

// Legacy compatibility route
router.get(
  "/organization/:organisationId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  SpecialityController.getAllByOrganizationId,
);

export default router;
