import { z } from "zod";
import {
  FluidTherapyPlanService,
  FluidTherapyPlanError,
} from "src/services/fluid-therapy-plan.service";
import {
  createClinicalHandlers,
  orgParams,
  patientScopeQuery,
  uuid,
} from "src/controllers/web/shared/clinical-controller.helpers";

const FluidTypeEnum = z.enum([
  "SALINE_09",
  "LACTATED_RINGERS",
  "DEXTROSE_5",
  "HARTMANNS",
  "PLASMALYTE",
  "COLLOID",
  "BLOOD_PRODUCT",
  "CUSTOM",
]);
const StatusEnum = z.enum(["ACTIVE", "PAUSED", "COMPLETED", "DISCONTINUED"]);

const CreateBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  admissionId: z.string().uuid().optional(),
  fluidType: FluidTypeEnum,
  customFluidName: z.string().max(200).optional(),
  additives: z.string().max(500).optional(),
  rateMlPerHour: z.number().positive(),
  totalVolumeMl: z.number().positive().optional(),
  durationHours: z.number().positive().optional(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().optional(),
  indication: z.string().max(1000).optional(),
  notes: z.string().max(2000).optional(),
});

const UpdateBodySchema = z.object({
  fluidType: FluidTypeEnum.optional(),
  customFluidName: z.string().max(200).optional(),
  additives: z.string().max(500).optional(),
  rateMlPerHour: z.number().positive().optional(),
  totalVolumeMl: z.number().positive().optional(),
  durationHours: z.number().positive().optional(),
  endedAt: z.string().datetime().optional(),
  status: StatusEnum.optional(),
  indication: z.string().max(1000).optional(),
  notes: z.string().max(2000).optional(),
});

const ListQuerySchema = patientScopeQuery.extend({
  admissionId: z.string().uuid().optional(),
  status: StatusEnum.optional(),
});

const PlanParamsSchema = orgParams.extend({ planId: uuid() });

const { handler } = createClinicalHandlers(FluidTherapyPlanError);

export const FluidTherapyPlanController = {
  list: handler({
    params: orgParams,
    query: ListQuerySchema,
    fallback: "Failed to list fluid therapy plans",
    run: ({ params, input }) =>
      FluidTherapyPlanService.list({
        organisationId: params.organisationId,
        ...input,
      }),
  }),

  create: handler({
    params: orgParams,
    body: CreateBodySchema,
    status: 201,
    fallback: "Failed to create fluid therapy plan",
    run: ({ params, input, userId }) => {
      const { startedAt, endedAt, ...rest } = input;
      return FluidTherapyPlanService.create({
        organisationId: params.organisationId,
        prescribedBy: userId,
        ...rest,
        startedAt: new Date(startedAt),
        ...(endedAt ? { endedAt: new Date(endedAt) } : {}),
      });
    },
  }),

  get: handler({
    params: PlanParamsSchema,
    fallback: "Failed to get fluid therapy plan",
    run: ({ params }) =>
      FluidTherapyPlanService.get(params.planId, params.organisationId),
  }),

  update: handler({
    params: PlanParamsSchema,
    body: UpdateBodySchema,
    fallback: "Failed to update fluid therapy plan",
    run: ({ params, input, userId }) => {
      const { endedAt, ...rest } = input;
      return FluidTherapyPlanService.update(
        params.planId,
        params.organisationId,
        {
          ...rest,
          ...(endedAt ? { endedAt: new Date(endedAt) } : {}),
        },
        userId,
      );
    },
  }),
};
