import { z } from "zod";
import {
  PostOpCarePlanService,
  PostOpCarePlanError,
} from "src/services/post-op-care-plan.service";
import {
  coerceDateFields,
  createClinicalHandlers,
  orgParams,
  patientScopeQuery,
  uuid,
} from "src/controllers/web/shared/clinical-controller.helpers";

const StatusEnum = z.enum(["ACTIVE", "COMPLETED", "CANCELLED"]);

const CreateBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  surgicalProcedureId: z.string().uuid().optional(),
  painScore: z.number().int().min(0).max(10).optional(),
  analgesiaProtocol: z.string().max(2000).optional(),
  woundCareInstructions: z.string().max(5000).optional(),
  activityRestrictions: z.string().max(2000).optional(),
  dietaryNotes: z.string().max(2000).optional(),
  fluidTherapyNotes: z.string().max(2000).optional(),
  monitoringParams: z.string().max(2000).optional(),
  firstReviewAt: z.string().datetime().optional(),
  nextReviewAt: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});

const ReviewBodySchema = z.object({
  painScore: z.number().int().min(0).max(10).optional(),
  reviewNotes: z.string().min(1).max(5000),
  nextReviewAt: z.string().datetime().optional(),
  status: StatusEnum.optional(),
});

const UpdateBodySchema = z.object({
  analgesiaProtocol: z.string().max(2000).optional(),
  woundCareInstructions: z.string().max(5000).optional(),
  activityRestrictions: z.string().max(2000).optional(),
  dietaryNotes: z.string().max(2000).optional(),
  fluidTherapyNotes: z.string().max(2000).optional(),
  monitoringParams: z.string().max(2000).optional(),
  firstReviewAt: z.string().datetime().optional(),
  nextReviewAt: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
  status: StatusEnum.optional(),
});

const ListQuerySchema = patientScopeQuery.extend({
  status: StatusEnum.optional(),
});

const PlanParamsSchema = orgParams.extend({ planId: uuid() });

const DATE_KEYS = ["firstReviewAt", "nextReviewAt"];

const { handler } = createClinicalHandlers(PostOpCarePlanError);

export const PostOpCarePlanController = {
  list: handler({
    params: orgParams,
    query: ListQuerySchema,
    fallback: "Failed to list post-op care plans",
    run: ({ params, input }) =>
      PostOpCarePlanService.list({
        organisationId: params.organisationId,
        ...input,
      }),
  }),

  create: handler({
    params: orgParams,
    body: CreateBodySchema,
    status: 201,
    fallback: "Failed to create post-op care plan",
    run: ({ params, input, userId }) =>
      PostOpCarePlanService.create({
        organisationId: params.organisationId,
        prescribedBy: userId,
        ...coerceDateFields(input, DATE_KEYS),
      } as Parameters<typeof PostOpCarePlanService.create>[0]),
  }),

  get: handler({
    params: PlanParamsSchema,
    fallback: "Failed to get post-op care plan",
    run: ({ params }) =>
      PostOpCarePlanService.get(params.planId, params.organisationId),
  }),

  review: handler({
    params: PlanParamsSchema,
    body: ReviewBodySchema,
    fallback: "Failed to review post-op care plan",
    run: ({ params, input, userId }) => {
      const { nextReviewAt, ...rest } = input;
      return PostOpCarePlanService.review(
        params.planId,
        params.organisationId,
        {
          ...rest,
          ...(nextReviewAt ? { nextReviewAt: new Date(nextReviewAt) } : {}),
        },
        userId,
      );
    },
  }),

  update: handler({
    params: PlanParamsSchema,
    body: UpdateBodySchema,
    fallback: "Failed to update post-op care plan",
    run: ({ params, input }) =>
      PostOpCarePlanService.update(
        params.planId,
        params.organisationId,
        coerceDateFields(input, DATE_KEYS),
      ),
  }),
};
