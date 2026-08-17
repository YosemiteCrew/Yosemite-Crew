import { z } from "zod";
import {
  IcuCarePlanService,
  IcuCarePlanError,
} from "src/services/icu-care-plan.service";
import {
  createClinicalHandlers,
  orgParams,
  patientScopeBody,
  uuid,
} from "src/controllers/web/shared/clinical-controller.helpers";

const IcuStatusEnum = z.enum([
  "ACTIVE",
  "TRANSFERRED",
  "DISCHARGED",
  "DECEASED",
]);
const DischargeStatusEnum = z.enum(["TRANSFERRED", "DISCHARGED", "DECEASED"]);

/**
 * The mutable care fields of an ICU stay. They are optional everywhere, so the
 * update body is exactly this schema and the create body merges it onto the
 * patient scope plus the mandatory admission time.
 */
const CareFieldsSchema = z.object({
  onVentilator: z.boolean().optional(),
  onOxygenSupport: z.boolean().optional(),
  hasUrinaryCatheter: z.boolean().optional(),
  hasCentralLine: z.boolean().optional(),
  hasDrain: z.boolean().optional(),
  devices: z.string().max(1000).optional(),
  dailyGoals: z.string().max(3000).optional(),
  nursingFrequency: z.string().max(1000).optional(),
  alertThresholds: z.string().max(2000).optional(),
  primaryVet: z.string().max(300).optional(),
  nursePrimary: z.string().max(300).optional(),
  anticipatedDischarge: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});

const CreateBodySchema = patientScopeBody
  .extend({ admittedAt: z.string().datetime() })
  .merge(CareFieldsSchema);

const DischargeBodySchema = z.object({
  status: DischargeStatusEnum,
  dischargeSummary: z.string().max(5000).optional(),
});

const ListQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  status: IcuStatusEnum.optional(),
});

const PlanParamsSchema = orgParams.extend({ planId: uuid() });

const { handler } = createClinicalHandlers(IcuCarePlanError);

export const IcuCarePlanController = {
  list: handler({
    params: orgParams,
    query: ListQuerySchema,
    fallback: "Failed to list ICU care plans",
    run: ({ params, input }) =>
      IcuCarePlanService.list({
        organisationId: params.organisationId,
        ...input,
      }),
  }),

  create: handler({
    params: orgParams,
    body: CreateBodySchema,
    status: 201,
    fallback: "Failed to create ICU care plan",
    run: ({ params, input, userId }) => {
      const { admittedAt, anticipatedDischarge, ...rest } = input;
      return IcuCarePlanService.create({
        organisationId: params.organisationId,
        primaryVet: rest.primaryVet ?? userId,
        ...rest,
        admittedAt: new Date(admittedAt),
        ...(anticipatedDischarge
          ? { anticipatedDischarge: new Date(anticipatedDischarge) }
          : {}),
      });
    },
  }),

  get: handler({
    params: PlanParamsSchema,
    fallback: "Failed to get ICU care plan",
    run: ({ params }) =>
      IcuCarePlanService.get(params.planId, params.organisationId),
  }),

  update: handler({
    params: PlanParamsSchema,
    body: CareFieldsSchema,
    fallback: "Failed to update ICU care plan",
    run: ({ params, input }) => {
      const { anticipatedDischarge, ...rest } = input;
      return IcuCarePlanService.update(params.planId, params.organisationId, {
        ...rest,
        ...(anticipatedDischarge
          ? { anticipatedDischarge: new Date(anticipatedDischarge) }
          : {}),
      });
    },
  }),

  discharge: handler({
    params: PlanParamsSchema,
    body: DischargeBodySchema,
    fallback: "Failed to discharge ICU care plan",
    run: ({ params, input, userId }) =>
      IcuCarePlanService.discharge(
        params.planId,
        params.organisationId,
        input,
        userId,
      ),
  }),
};
