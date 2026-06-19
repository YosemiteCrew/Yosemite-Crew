import { Request, Response } from "express";
import {
  TemplateKind as PrismaTemplateKind,
  TemplateScope,
  TemplateStatus,
} from "@prisma/client";
import {
  Questionnaire,
  QuestionnaireResponse,
  PlanDefinition,
} from "@yosemite-crew/fhir";
import type { TemplateKind as TemplateContractKind } from "@yosemite-crew/types";
import { z } from "zod";
import {
  TemplateService,
  TemplateServiceError,
} from "src/services/template.service";
import {
  templateMapper,
  type TemplateLike,
} from "src/services/fhir-template.mapper";
import { createFhirErrorHandler } from "src/controllers/web/fhir-controller.shared";
import { resolveUserIdFromRequest } from "src/utils/request";

const questionnaireResourceSchema = z
  .object({ resourceType: z.literal("Questionnaire") })
  .passthrough();
const planDefinitionResourceSchema = z
  .object({ resourceType: z.literal("PlanDefinition") })
  .passthrough();
const questionnaireResponseSchema = z
  .object({ resourceType: z.literal("QuestionnaireResponse") })
  .passthrough();

const listQuerySchema = z.object({
  kind: z
    .union([
      z.nativeEnum(PrismaTemplateKind),
      z.enum([
        "SOAP_NOTE",
        "VITAL_RECORD",
        "DISCHARGE_SUMMARY",
        "PRESCRIPTION",
        "FORM",
        "CONSENT",
        "INPATIENT_SCHEDULE",
        "TASK_ASSIGNMENT",
      ]),
    ])
    .optional(),
  status: z.nativeEnum(TemplateStatus).optional(),
  scope: z.nativeEnum(TemplateScope).optional(),
});

const handleError = createFhirErrorHandler({
  isServiceError: (error): error is TemplateServiceError =>
    error instanceof TemplateServiceError,
  invalidPayloadMessage: "Invalid FHIR payload.",
  logMessage: "Unexpected FHIR template error",
});

const isQuestionnaireTemplate = (kind: TemplateContractKind) =>
  templateMapper.isQuestionnaireResourceKind(kind);
const isPlanDefinitionTemplate = (kind: TemplateContractKind) =>
  templateMapper.isPlanDefinitionResourceKind(kind);

const filterQuestionnaires = (templates: TemplateLike[]) =>
  templates.filter((template) => isQuestionnaireTemplate(template.kind));

const filterPlanDefinitions = (templates: TemplateLike[]) =>
  templates.filter((template) => isPlanDefinitionTemplate(template.kind));

const buildQuestionnaireBundle = (templates: TemplateLike[]) =>
  templateMapper.listBundle(templates, templateMapper.templateToQuestionnaire);

const buildPlanDefinitionBundle = (templates: TemplateLike[]) =>
  templateMapper.listBundle(templates, templateMapper.templateToPlanDefinition);

const getTemplateOrThrow = async (
  templateId: string,
  organisationId?: string,
) => {
  const template = await TemplateService.getById(templateId, organisationId);
  return template as TemplateLike;
};

const updateTemplateFromQuestionnaire = async (
  templateId: string,
  questionnaire: Questionnaire,
  organisationId: string | undefined,
  userId: string,
) => {
  const input = templateMapper.questionnaireToTemplateInput(questionnaire, {
    createdBy: userId,
    updatedBy: userId,
    organisationId,
  });

  if (!isQuestionnaireTemplate(input.kind)) {
    throw new TemplateServiceError(
      "FHIR Questionnaire routes only support questionnaire-style template kinds",
      400,
    );
  }

  return TemplateService.update(templateId, input as never, organisationId);
};

const updateTemplateFromPlanDefinition = async (
  templateId: string,
  planDefinition: PlanDefinition,
  organisationId: string | undefined,
  userId: string,
) => {
  const input = templateMapper.planDefinitionToTemplateInput(planDefinition, {
    createdBy: userId,
    updatedBy: userId,
    organisationId,
  });

  if (!isPlanDefinitionTemplate(input.kind)) {
    throw new TemplateServiceError(
      "FHIR PlanDefinition routes only support workflow template kinds",
      400,
    );
  }

  return TemplateService.update(templateId, input as never, organisationId);
};

const createInstanceFromQuestionnaireResponse = async (
  instanceId: string | undefined,
  templateId: string,
  response: QuestionnaireResponse,
  organisationId: string | undefined,
  userId: string,
  submit: boolean,
) => {
  const template = await getTemplateOrThrow(templateId, organisationId);
  const instanceInput = templateMapper.questionnaireResponseToTemplateInstance(
    response,
    template,
  );

  const instanceUpdateData = submit
    ? {
        data: instanceInput.data,
      }
    : {
        data: instanceInput.data,
        status: instanceInput.status,
      };

  let instance = instanceId
    ? await TemplateService.updateInstance(
        instanceId,
        instanceUpdateData as never,
        organisationId,
      )
    : await TemplateService.createInstance({
        templateId,
        organisationId: organisationId ?? template.organisationId ?? "",
        appointmentId: instanceInput.appointmentId ?? undefined,
        caseId: instanceInput.caseId ?? undefined,
        encounterId: instanceInput.encounterId ?? undefined,
        authorId: instanceInput.authorId ?? userId,
        data: instanceInput.data,
      });

  if (submit) {
    await TemplateService.submitInstance(instance.id, organisationId, userId);
    instance = {
      ...instance,
      status: "COMPLETED" as const,
      updatedAt: new Date(),
    };
  }

  return templateMapper.templateInstanceToQuestionnaireResponse(
    instance as Parameters<
      typeof templateMapper.templateInstanceToQuestionnaireResponse
    >[0],
    template,
  );
};

export const TemplateFhirController = {
  async listQuestionnaires(req: Request, res: Response) {
    try {
      const query = listQuerySchema.parse(req.query);
      const templates = (await TemplateService.listLibrary(
        query,
      )) as TemplateLike[];
      return res
        .status(200)
        .json(buildQuestionnaireBundle(filterQuestionnaires(templates)));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async listOrganisationQuestionnaires(req: Request, res: Response) {
    try {
      const query = listQuerySchema.parse(req.query);
      const templates = (await TemplateService.listForOrganisation(
        req.params.organisationId,
        query,
      )) as TemplateLike[];
      return res
        .status(200)
        .json(buildQuestionnaireBundle(filterQuestionnaires(templates)));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async listUserQuestionnaires(req: Request, res: Response) {
    try {
      const query = listQuerySchema.parse(req.query);
      const templates = (await TemplateService.listForUser(
        req.params.organisationId,
        resolveUserIdFromRequest(req) ?? "",
        query,
      )) as TemplateLike[];
      return res
        .status(200)
        .json(buildQuestionnaireBundle(filterQuestionnaires(templates)));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async createQuestionnaire(req: Request, res: Response) {
    try {
      const questionnaire = questionnaireResourceSchema.parse(
        req.body,
      ) as unknown as Questionnaire;
      const userId = resolveUserIdFromRequest(req) ?? "";
      const input = templateMapper.questionnaireToTemplateInput(questionnaire, {
        createdBy: userId,
        updatedBy: userId,
      });

      if (!isQuestionnaireTemplate(input.kind)) {
        throw new TemplateServiceError(
          "FHIR Questionnaire routes only support questionnaire-style template kinds",
          400,
        );
      }

      const template = await TemplateService.create(input as never);
      return res
        .status(201)
        .json(templateMapper.templateToQuestionnaire(template));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async getQuestionnaire(req: Request, res: Response) {
    try {
      const template = await getTemplateOrThrow(
        req.params.templateId,
        req.params.organisationId,
      );

      if (!isQuestionnaireTemplate(template.kind)) {
        return res.status(404).json({ message: "Questionnaire not found" });
      }

      return res
        .status(200)
        .json(templateMapper.templateToQuestionnaire(template));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async updateQuestionnaire(req: Request, res: Response) {
    try {
      const questionnaire = questionnaireResourceSchema.parse(
        req.body,
      ) as unknown as Questionnaire;
      const template = await updateTemplateFromQuestionnaire(
        req.params.templateId,
        questionnaire,
        req.params.organisationId,
        resolveUserIdFromRequest(req) ?? "",
      );
      return res
        .status(200)
        .json(templateMapper.templateToQuestionnaire(template));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async publishQuestionnaire(req: Request, res: Response) {
    try {
      const template = await TemplateService.publish(
        req.params.templateId,
        resolveUserIdFromRequest(req) ?? "",
        req.params.organisationId,
      );
      if (!isQuestionnaireTemplate(template.kind)) {
        return res.status(404).json({ message: "Questionnaire not found" });
      }
      return res
        .status(200)
        .json(templateMapper.templateToQuestionnaire(template));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async archiveQuestionnaire(req: Request, res: Response) {
    try {
      const template = await TemplateService.archive(
        req.params.templateId,
        resolveUserIdFromRequest(req) ?? "",
        req.params.organisationId,
      );
      if (!isQuestionnaireTemplate(template.kind)) {
        return res.status(404).json({ message: "Questionnaire not found" });
      }
      return res
        .status(200)
        .json(templateMapper.templateToQuestionnaire(template));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async createQuestionnaireInstance(req: Request, res: Response) {
    try {
      const body = questionnaireResponseSchema.parse(
        req.body,
      ) as unknown as QuestionnaireResponse;
      const questionnaireResponse =
        await createInstanceFromQuestionnaireResponse(
          undefined,
          req.params.templateId,
          body,
          req.params.organisationId,
          resolveUserIdFromRequest(req) ?? "",
          false,
        );
      return res.status(201).json(questionnaireResponse);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async updateQuestionnaireInstance(req: Request, res: Response) {
    try {
      const body = questionnaireResponseSchema.parse(
        req.body,
      ) as unknown as QuestionnaireResponse;
      const questionnaireResponse =
        await createInstanceFromQuestionnaireResponse(
          req.params.instanceId,
          req.params.templateId,
          body,
          req.params.organisationId,
          resolveUserIdFromRequest(req) ?? "",
          false,
        );
      return res.status(200).json(questionnaireResponse);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async submitQuestionnaireInstance(req: Request, res: Response) {
    try {
      const body = questionnaireResponseSchema.parse(
        req.body,
      ) as unknown as QuestionnaireResponse;
      const questionnaireResponse =
        await createInstanceFromQuestionnaireResponse(
          req.params.instanceId,
          req.params.templateId,
          body,
          req.params.organisationId,
          resolveUserIdFromRequest(req) ?? "",
          true,
        );
      return res.status(200).json(questionnaireResponse);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async listPlanDefinitions(req: Request, res: Response) {
    try {
      const query = listQuerySchema.parse(req.query);
      const templates = (await TemplateService.listLibrary(
        query,
      )) as TemplateLike[];
      return res
        .status(200)
        .json(buildPlanDefinitionBundle(filterPlanDefinitions(templates)));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async listOrganisationPlanDefinitions(req: Request, res: Response) {
    try {
      const query = listQuerySchema.parse(req.query);
      const templates = (await TemplateService.listForOrganisation(
        req.params.organisationId,
        query,
      )) as TemplateLike[];
      return res
        .status(200)
        .json(buildPlanDefinitionBundle(filterPlanDefinitions(templates)));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async listUserPlanDefinitions(req: Request, res: Response) {
    try {
      const query = listQuerySchema.parse(req.query);
      const templates = (await TemplateService.listForUser(
        req.params.organisationId,
        resolveUserIdFromRequest(req) ?? "",
        query,
      )) as TemplateLike[];
      return res
        .status(200)
        .json(buildPlanDefinitionBundle(filterPlanDefinitions(templates)));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async createPlanDefinition(req: Request, res: Response) {
    try {
      const planDefinition = planDefinitionResourceSchema.parse(
        req.body,
      ) as unknown as PlanDefinition;
      const userId = resolveUserIdFromRequest(req) ?? "";
      const input = templateMapper.planDefinitionToTemplateInput(
        planDefinition,
        {
          createdBy: userId,
          updatedBy: userId,
        },
      );

      if (!isPlanDefinitionTemplate(input.kind)) {
        throw new TemplateServiceError(
          "FHIR PlanDefinition routes only support workflow template kinds",
          400,
        );
      }

      const template = await TemplateService.create(input as never);
      return res
        .status(201)
        .json(templateMapper.templateToPlanDefinition(template));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async getPlanDefinition(req: Request, res: Response) {
    try {
      const template = await getTemplateOrThrow(
        req.params.templateId,
        req.params.organisationId,
      );

      if (!isPlanDefinitionTemplate(template.kind)) {
        return res.status(404).json({ message: "PlanDefinition not found" });
      }

      return res
        .status(200)
        .json(templateMapper.templateToPlanDefinition(template));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async updatePlanDefinition(req: Request, res: Response) {
    try {
      const planDefinition = planDefinitionResourceSchema.parse(
        req.body,
      ) as unknown as PlanDefinition;
      const template = await updateTemplateFromPlanDefinition(
        req.params.templateId,
        planDefinition,
        req.params.organisationId,
        resolveUserIdFromRequest(req) ?? "",
      );
      return res
        .status(200)
        .json(templateMapper.templateToPlanDefinition(template));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async publishPlanDefinition(req: Request, res: Response) {
    try {
      const template = await TemplateService.publish(
        req.params.templateId,
        resolveUserIdFromRequest(req) ?? "",
        req.params.organisationId,
      );
      if (!isPlanDefinitionTemplate(template.kind)) {
        return res.status(404).json({ message: "PlanDefinition not found" });
      }
      return res
        .status(200)
        .json(templateMapper.templateToPlanDefinition(template));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async archivePlanDefinition(req: Request, res: Response) {
    try {
      const template = await TemplateService.archive(
        req.params.templateId,
        resolveUserIdFromRequest(req) ?? "",
        req.params.organisationId,
      );
      if (!isPlanDefinitionTemplate(template.kind)) {
        return res.status(404).json({ message: "PlanDefinition not found" });
      }
      return res
        .status(200)
        .json(templateMapper.templateToPlanDefinition(template));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async createPlanDefinitionInstance(req: Request, res: Response) {
    try {
      const body = questionnaireResponseSchema.parse(
        req.body,
      ) as unknown as QuestionnaireResponse;
      const questionnaireResponse =
        await createInstanceFromQuestionnaireResponse(
          undefined,
          req.params.templateId,
          body,
          req.params.organisationId,
          resolveUserIdFromRequest(req) ?? "",
          false,
        );
      return res.status(201).json(questionnaireResponse);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async updatePlanDefinitionInstance(req: Request, res: Response) {
    try {
      const body = questionnaireResponseSchema.parse(
        req.body,
      ) as unknown as QuestionnaireResponse;
      const questionnaireResponse =
        await createInstanceFromQuestionnaireResponse(
          req.params.instanceId,
          req.params.templateId,
          body,
          req.params.organisationId,
          resolveUserIdFromRequest(req) ?? "",
          false,
        );
      return res.status(200).json(questionnaireResponse);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async submitPlanDefinitionInstance(req: Request, res: Response) {
    try {
      const body = questionnaireResponseSchema.parse(
        req.body,
      ) as unknown as QuestionnaireResponse;
      const questionnaireResponse =
        await createInstanceFromQuestionnaireResponse(
          req.params.instanceId,
          req.params.templateId,
          body,
          req.params.organisationId,
          resolveUserIdFromRequest(req) ?? "",
          true,
        );
      return res.status(200).json(questionnaireResponse);
    } catch (error) {
      return handleError(error, res);
    }
  },
};
