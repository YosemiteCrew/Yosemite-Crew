import { Router } from "express";
import { FormDraftImportController } from "src/controllers/web/formDraftImport.controller";
import { requireWebAuth } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";

/*
 * #3055: convert supplied intake-form text into a draft Form for a
 * developer/practice configurator to review, using the existing forms
 * permission model - `forms:edit:any` for anything that writes a draft
 * Form, `forms:view:any` for reading one back. Publishing a draft stays on
 * the existing `/fhir/v1/form/admin/:formId/publish` route (form.router.ts);
 * nothing here can reach it.
 */
const router = Router();

router.post(
  "/:orgId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("forms:edit:any"),
  FormDraftImportController.create,
);

router.get(
  "/:orgId/:id",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("forms:view:any"),
  FormDraftImportController.get,
);

router.delete(
  "/:orgId/:id",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("forms:edit:any"),
  FormDraftImportController.discard,
);

export default router;
