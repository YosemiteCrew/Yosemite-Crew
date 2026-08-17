import type { Request, Response } from "express";
import { z } from "zod";
import {
  QolAssessmentService,
  QolAssessmentError,
} from "src/services/qol-assessment.service";
import {
  createClinicalHandlers,
  orgParams,
  patientScopeQuery,
  uuid,
} from "src/controllers/web/shared/clinical-controller.helpers";

const HhScore = z.number().int().min(1).max(10);

const CreateBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  assessedAt: z.string().datetime(),
  hhhhhmmScore: z.number().int().min(0).max(70).optional(),
  painScore: HhScore.optional(),
  appetiteScore: HhScore.optional(),
  hygieneScore: HhScore.optional(),
  happinessScore: HhScore.optional(),
  mobilityScore: HhScore.optional(),
  moreDaysGood: z.boolean().optional(),
  overallScore: z.number().int().min(0).max(100).optional(),
  ownerAssessed: z.boolean().optional(),
  clinicianNotes: z.string().max(3000).optional(),
  ownerNotes: z.string().max(3000).optional(),
  euthanasiaDiscussed: z.boolean().optional(),
});

const UpdateBodySchema = CreateBodySchema.omit({ patientId: true }).partial();
const ListQuerySchema = patientScopeQuery.extend({
  ownerAssessed: z
    .string()
    .optional()
    .transform((v) =>
      v === "true" ? true : v === "false" ? false : undefined,
    ),
});
const AssessmentParamsSchema = orgParams.extend({ assessmentId: uuid() });

const { handleError, handler } = createClinicalHandlers(QolAssessmentError);

export const QolAssessmentController = {
  list: handler({
    params: orgParams,
    query: ListQuerySchema,
    fallback: "Failed to list QoL assessments",
    run: ({ params, input }) =>
      QolAssessmentService.list({
        organisationId: params.organisationId,
        patientId: input.patientId,
        encounterId: input.encounterId,
        ownerAssessed: input.ownerAssessed,
      }),
  }),

  create: handler({
    params: orgParams,
    body: CreateBodySchema,
    status: 201,
    fallback: "Failed to create QoL assessment",
    run: ({ params, input, userId }) =>
      QolAssessmentService.create({
        organisationId: params.organisationId,
        assessedBy: userId,
        ...input,
        assessedAt: new Date(input.assessedAt),
      }),
  }),

  get: handler({
    params: AssessmentParamsSchema,
    fallback: "Failed to get QoL assessment",
    run: ({ params }) =>
      QolAssessmentService.get(params.assessmentId, params.organisationId),
  }),

  update: handler({
    params: AssessmentParamsSchema,
    body: UpdateBodySchema,
    fallback: "Failed to update QoL assessment",
    run: ({ params, input }) => {
      const { assessedAt, ...rest } = input;
      return QolAssessmentService.update(
        params.assessmentId,
        params.organisationId,
        {
          ...rest,
          ...(assessedAt ? { assessedAt: new Date(assessedAt) } : {}),
        },
      );
    },
  }),

  trend: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = orgParams.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const patientId = req.query.patientId as string | undefined;
      if (!patientId)
        return res.status(400).json({ message: "patientId is required" });
      const limit = req.query.limit
        ? parseInt(req.query.limit as string, 10)
        : undefined;
      const records = await QolAssessmentService.trend(
        patientId,
        params.data.organisationId,
        limit,
      );
      return res.status(200).json(records);
    } catch (err) {
      return handleError(err, res, "Failed to get QoL assessment trend");
    }
  },

  delete: handler({
    params: AssessmentParamsSchema,
    status: 204,
    fallback: "Failed to delete QoL assessment",
    run: ({ params }) =>
      QolAssessmentService.delete(params.assessmentId, params.organisationId),
  }),
};
