import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { IntegrationController } from "src/controllers/web/integration.controller";

const router = Router();

router.get(
  "/pms/organisation/:organisationId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("integrations:view:any"),
  IntegrationController.listForOrganisation,
);

router.get(
  "/pms/organisation/:organisationId/:provider",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("integrations:view:any"),
  IntegrationController.getForOrganisation,
);

router.post(
  "/pms/organisation/:organisationId/:provider/credentials",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("integrations:edit:any"),
  IntegrationController.updateCredentials,
);

router.post(
  "/pms/organisation/:organisationId/:provider/enable",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("integrations:edit:any"),
  IntegrationController.enable,
);

router.post(
  "/pms/organisation/:organisationId/:provider/disable",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("integrations:edit:any"),
  IntegrationController.disable,
);

router.post(
  "/pms/organisation/:organisationId/:provider/validate",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("integrations:edit:any"),
  IntegrationController.validate,
);

export default router;
