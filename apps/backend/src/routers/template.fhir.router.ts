import { Router } from "express";
import { TemplateFhirController } from "src/controllers/web/template.fhir.controller";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const router = Router();

router.get("/questionnaire/library", requireWebAuth, (req, res) =>
  TemplateFhirController.listQuestionnaires(req, res),
);

router.get(
  "/questionnaire/organisation/:organisationId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["forms:view:any"]),
  (req, res) => TemplateFhirController.listOrganisationQuestionnaires(req, res),
);

router.get(
  "/questionnaire/organisation/:organisationId/users/me",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["forms:view:any"]),
  (req, res) => TemplateFhirController.listUserQuestionnaires(req, res),
);

router.post(
  "/questionnaire",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => TemplateFhirController.createQuestionnaire(req, res),
);

router.get(
  "/questionnaire/organisation/:organisationId/:templateId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["forms:view:any"]),
  (req, res) => TemplateFhirController.getQuestionnaire(req, res),
);

router.patch(
  "/questionnaire/organisation/:organisationId/:templateId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => TemplateFhirController.updateQuestionnaire(req, res),
);

router.post(
  "/questionnaire/organisation/:organisationId/:templateId/publish",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => TemplateFhirController.publishQuestionnaire(req, res),
);

router.delete(
  "/questionnaire/organisation/:organisationId/:templateId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => TemplateFhirController.archiveQuestionnaire(req, res),
);

router.post(
  "/questionnaire/organisation/:organisationId/:templateId/instances",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => TemplateFhirController.createQuestionnaireInstance(req, res),
);

router.patch(
  "/questionnaire/template-instances/organisation/:organisationId/:instanceId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => TemplateFhirController.updateQuestionnaireInstance(req, res),
);

router.post(
  "/questionnaire/template-instances/organisation/:organisationId/:instanceId/submit",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => TemplateFhirController.submitQuestionnaireInstance(req, res),
);

router.get("/plan-definition/library", requireWebAuth, (req, res) =>
  TemplateFhirController.listPlanDefinitions(req, res),
);

router.get(
  "/plan-definition/organisation/:organisationId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["tasks:view:any"]),
  (req, res) =>
    TemplateFhirController.listOrganisationPlanDefinitions(req, res),
);

router.get(
  "/plan-definition/organisation/:organisationId/users/me",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["tasks:view:any"]),
  (req, res) => TemplateFhirController.listUserPlanDefinitions(req, res),
);

router.post(
  "/plan-definition",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["tasks:edit:any"]),
  (req, res) => TemplateFhirController.createPlanDefinition(req, res),
);

router.get(
  "/plan-definition/organisation/:organisationId/:templateId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["tasks:view:any"]),
  (req, res) => TemplateFhirController.getPlanDefinition(req, res),
);

router.patch(
  "/plan-definition/organisation/:organisationId/:templateId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["tasks:edit:any"]),
  (req, res) => TemplateFhirController.updatePlanDefinition(req, res),
);

router.post(
  "/plan-definition/organisation/:organisationId/:templateId/publish",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["tasks:edit:any"]),
  (req, res) => TemplateFhirController.publishPlanDefinition(req, res),
);

router.delete(
  "/plan-definition/organisation/:organisationId/:templateId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["tasks:edit:any"]),
  (req, res) => TemplateFhirController.archivePlanDefinition(req, res),
);

router.post(
  "/plan-definition/organisation/:organisationId/:templateId/instances",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["tasks:edit:any"]),
  (req, res) => TemplateFhirController.createPlanDefinitionInstance(req, res),
);

router.patch(
  "/plan-definition/template-instances/organisation/:organisationId/:instanceId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["tasks:edit:any"]),
  (req, res) => TemplateFhirController.updatePlanDefinitionInstance(req, res),
);

router.post(
  "/plan-definition/template-instances/organisation/:organisationId/:instanceId/submit",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["tasks:edit:any"]),
  (req, res) => TemplateFhirController.submitPlanDefinitionInstance(req, res),
);

export default router;
