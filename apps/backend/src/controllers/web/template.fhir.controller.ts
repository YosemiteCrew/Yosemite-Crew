import { Request, Response } from "express";
import { TemplateKind, TemplateScope, TemplateStatus } from "@prisma/client";
import {
  Questionnaire,
  QuestionnaireResponse,
  PlanDefinition,
} from "@yosemite-crew/fhir";
import { z } from "zod";
import { AuthenticatedRequest } from "src/middlewares/auth";
import {
  TemplateService,
  TemplateServiceError,
} from "src/services/template.service";
import {
  templateMapper,
  type TemplateLike,
} from "src/services/fhir-template.mapper";
import logger from "src/utils/logger";

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
  kind: z.nativeEnum(TemplateKind).optional(),
  status: z.nativeEnum(TemplateStatus).optional(),
  scope: z.nativeEnum(TemplateScope).optional(),
});

const handleError = (error: unknown, res: Response) => {
  if (error instanceof TemplateServiceError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  if (error instanceof z.ZodError) {
    return res.status(400).json({
      message: "Invalid FHIR payload.",
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  logger.error("Unexpected FHIR template error", error);
  return res.status(500).json({ message: "Internal Server Error" });
};

const resolveUserId = (req: Request) => {
  const typed = req as AuthenticatedRequest;
  return typeof typed.userId === "string" ? typed.userId : "";
};

const questionnaireKinds = new Set<TemplateKind>([
  "FORM",
  "SOAP_NOTE",
  "VITAL_RECORD",
  "PRESCRIPTION",
  "DISCHARGE_SUMMARY",
]);

const planDefinitionKinds = new Set<TemplateKind>([
  "TASK_TEMPLATE",
  "CARE_PATHWAY",
]);

const isQuestionnaireTemplate = (kind: TemplateKind) =>
  questionnaireKinds.has(kind);
const isPlanDefinitionTemplate = (kind: TemplateKind) =>
  planDefinitionKinds.has(kind);

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
        resolveUserId(req),
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
      const userId = resolveUserId(req);
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
        resolveUserId(req),
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
        resolveUserId(req),
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
        resolveUserId(req),
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
          resolveUserId(req),
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
          resolveUserId(req),
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
          resolveUserId(req),
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
        resolveUserId(req),
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
      const userId = resolveUserId(req);
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
        resolveUserId(req),
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
        resolveUserId(req),
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
        resolveUserId(req),
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
          resolveUserId(req),
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
          resolveUserId(req),
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
          resolveUserId(req),
          true,
        );
      return res.status(200).json(questionnaireResponse);
    } catch (error) {
      return handleError(error, res);
    }
  },
};
