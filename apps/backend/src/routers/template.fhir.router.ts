import { Router } from "express";
import { TemplateFhirController } from "src/controllers/web/template.fhir.controller";
import { authorizeCognito } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const router = Router();

router.get("/questionnaire/library", authorizeCognito, (req, res) =>
  TemplateFhirController.listQuestionnaires(req, res),
);

router.get(
  "/questionnaire/organisation/:organisationId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["forms:view:any"]),
  (req, res) => TemplateFhirController.listOrganisationQuestionnaires(req, res),
);

router.get(
  "/questionnaire/organisation/:organisationId/users/me",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["forms:view:any"]),
  (req, res) => TemplateFhirController.listUserQuestionnaires(req, res),
);

router.post(
  "/questionnaire",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => TemplateFhirController.createQuestionnaire(req, res),
);

router.get(
  "/questionnaire/organisation/:organisationId/:templateId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["forms:view:any"]),
  (req, res) => TemplateFhirController.getQuestionnaire(req, res),
);

router.patch(
  "/questionnaire/organisation/:organisationId/:templateId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => TemplateFhirController.updateQuestionnaire(req, res),
);

router.post(
  "/questionnaire/organisation/:organisationId/:templateId/publish",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => TemplateFhirController.publishQuestionnaire(req, res),
);

router.delete(
  "/questionnaire/organisation/:organisationId/:templateId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => TemplateFhirController.archiveQuestionnaire(req, res),
);

router.post(
  "/questionnaire/organisation/:organisationId/:templateId/instances",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => TemplateFhirController.createQuestionnaireInstance(req, res),
);

router.patch(
  "/questionnaire/template-instances/organisation/:organisationId/:instanceId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => TemplateFhirController.updateQuestionnaireInstance(req, res),
);

router.post(
  "/questionnaire/template-instances/organisation/:organisationId/:instanceId/submit",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => TemplateFhirController.submitQuestionnaireInstance(req, res),
);

router.get("/plan-definition/library", authorizeCognito, (req, res) =>
  TemplateFhirController.listPlanDefinitions(req, res),
);

router.get(
  "/plan-definition/organisation/:organisationId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["tasks:view:any"]),
  (req, res) =>
    TemplateFhirController.listOrganisationPlanDefinitions(req, res),
);

router.get(
  "/plan-definition/organisation/:organisationId/users/me",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["tasks:view:any"]),
  (req, res) => TemplateFhirController.listUserPlanDefinitions(req, res),
);

router.post(
  "/plan-definition",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["tasks:edit:any"]),
  (req, res) => TemplateFhirController.createPlanDefinition(req, res),
);

router.get(
  "/plan-definition/organisation/:organisationId/:templateId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["tasks:view:any"]),
  (req, res) => TemplateFhirController.getPlanDefinition(req, res),
);

router.patch(
  "/plan-definition/organisation/:organisationId/:templateId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["tasks:edit:any"]),
  (req, res) => TemplateFhirController.updatePlanDefinition(req, res),
);

router.post(
  "/plan-definition/organisation/:organisationId/:templateId/publish",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["tasks:edit:any"]),
  (req, res) => TemplateFhirController.publishPlanDefinition(req, res),
);

router.delete(
  "/plan-definition/organisation/:organisationId/:templateId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["tasks:edit:any"]),
  (req, res) => TemplateFhirController.archivePlanDefinition(req, res),
);

router.post(
  "/plan-definition/organisation/:organisationId/:templateId/instances",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["tasks:edit:any"]),
  (req, res) => TemplateFhirController.createPlanDefinitionInstance(req, res),
);

router.patch(
  "/plan-definition/template-instances/organisation/:organisationId/:instanceId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["tasks:edit:any"]),
  (req, res) => TemplateFhirController.updatePlanDefinitionInstance(req, res),
);

router.post(
  "/plan-definition/template-instances/organisation/:organisationId/:instanceId/submit",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["tasks:edit:any"]),
  (req, res) => TemplateFhirController.submitPlanDefinitionInstance(req, res),
);

export default router;
