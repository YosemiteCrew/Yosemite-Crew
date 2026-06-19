import { Router } from "express";
import { TemplateController } from "src/controllers/web/template.controller";
import { authorizeCognito } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const router = Router();

router.get(
  "/pms/resolve",
  authorizeCognito,
  requirePermission(["forms:view:any"]),
  (req, res) => TemplateController.resolve(req, res),
);

router.get("/pms/templates/library", authorizeCognito, (req, res) =>
  TemplateController.listLibrary(req, res),
);

router.get(
  "/pms/templates/organisation/:organisationId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["forms:view:any"]),
  (req, res) => TemplateController.listOrganisationTemplates(req, res),
);

router.get(
  "/pms/templates/organisation/:organisationId/users/me",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["forms:view:any"]),
  (req, res) => TemplateController.listUserTemplates(req, res),
);

router.post(
  "/pms/templates",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => TemplateController.create(req, res),
);

router.get(
  "/pms/templates/organisation/:organisationId/:templateId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["forms:view:any"]),
  (req, res) => TemplateController.getById(req, res),
);

router.patch(
  "/pms/templates/organisation/:organisationId/:templateId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => TemplateController.update(req, res),
);

router.patch(
  "/pms/templates/organisation/:organisationId/:templateId/catalog-links",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => TemplateController.updateCatalogLinks(req, res),
);

router.post(
  "/pms/templates/organisation/:organisationId/:templateId/publish",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => TemplateController.publish(req, res),
);

router.delete(
  "/pms/templates/organisation/:organisationId/:templateId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => TemplateController.archive(req, res),
);

router.post(
  "/pms/templates/organisation/:organisationId/:templateId/instances",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => TemplateController.createInstance(req, res),
);

router.patch(
  "/pms/template-instances/organisation/:organisationId/:instanceId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => TemplateController.updateInstance(req, res),
);

router.post(
  "/pms/template-instances/organisation/:organisationId/:instanceId/submit",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => TemplateController.submitInstance(req, res),
);

export default router;
