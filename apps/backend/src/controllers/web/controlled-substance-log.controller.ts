import { z } from "zod";
import {
  ControlledSubstanceLogService,
  ControlledSubstanceLogError,
} from "src/services/controlled-substance-log.service";
import {
  createClinicalHandlers,
  orgParams,
  uuid,
} from "src/controllers/web/shared/clinical-controller.helpers";

const DeaScheduleEnum = z.enum(["II", "III", "IV", "V"]);
const DrugUnitEnum = z.enum([
  "ML",
  "MG",
  "MCG",
  "TABLET",
  "CAPSULE",
  "PATCH",
  "UNIT",
]);

const CreateBodySchema = z.object({
  patientId: z.uuid().optional(),
  encounterId: z.uuid().optional(),
  loggedAt: z.iso.datetime(),
  drug: z.string().min(1).max(200),
  deaSchedule: DeaScheduleEnum,
  lotNumber: z.string().max(100).optional(),
  strength: z.number().positive().optional(),
  unit: DrugUnitEnum,
  amountDrawn: z.number().positive(),
  amountAdministered: z.number().min(0),
  amountWasted: z.number().min(0).optional(),
  wastedWitness: z.string().max(200).optional(),
  balanceBefore: z.number().min(0).optional(),
  balanceAfter: z.number().min(0).optional(),
  notes: z.string().max(2000).optional(),
});

const UpdateBodySchema = z.object({
  lotNumber: z.string().max(100).optional(),
  strength: z.number().positive().optional(),
  amountDrawn: z.number().positive().optional(),
  amountAdministered: z.number().min(0).optional(),
  amountWasted: z.number().min(0).optional(),
  wastedWitness: z.string().max(200).optional(),
  balanceBefore: z.number().min(0).optional(),
  balanceAfter: z.number().min(0).optional(),
  administeredBy: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

const ListQuerySchema = z.object({
  patientId: z.uuid().optional(),
  drug: z.string().optional(),
  deaSchedule: DeaScheduleEnum.optional(),
  fromDate: z.iso.datetime().optional(),
  toDate: z.iso.datetime().optional(),
});

const LogParamsSchema = orgParams.extend({ logId: uuid() });

const { handler } = createClinicalHandlers(ControlledSubstanceLogError);

export const ControlledSubstanceLogController = {
  list: handler({
    params: orgParams,
    query: ListQuerySchema,
    fallback: "Failed to list controlled substance log entries",
    run: ({ params, input }) =>
      ControlledSubstanceLogService.list({
        organisationId: params.organisationId,
        patientId: input.patientId,
        drug: input.drug,
        deaSchedule: input.deaSchedule,
        fromDate: input.fromDate ? new Date(input.fromDate) : undefined,
        toDate: input.toDate ? new Date(input.toDate) : undefined,
      }),
  }),

  create: handler({
    params: orgParams,
    body: CreateBodySchema,
    status: 201,
    fallback: "Failed to create controlled substance log entry",
    run: ({ params, input, userId }) =>
      ControlledSubstanceLogService.create({
        organisationId: params.organisationId,
        administeredBy: userId,
        ...input,
        loggedAt: new Date(input.loggedAt),
      }),
  }),

  get: handler({
    params: LogParamsSchema,
    fallback: "Failed to get controlled substance log entry",
    run: ({ params }) =>
      ControlledSubstanceLogService.get(params.logId, params.organisationId),
  }),

  update: handler({
    params: LogParamsSchema,
    body: UpdateBodySchema,
    fallback: "Failed to update controlled substance log entry",
    run: ({ params, input, userId }) =>
      ControlledSubstanceLogService.update(
        params.logId,
        params.organisationId,
        {
          ...input,
          // Applied after the spread so the DEA audit actor is always the
          // authenticated corrector, never a caller-supplied `administeredBy`.
          correctedBy: userId,
        },
      ),
  }),

  delete: handler({
    params: LogParamsSchema,
    status: 204,
    fallback: "Failed to delete controlled substance log entry",
    run: ({ params, userId }) =>
      ControlledSubstanceLogService.delete(
        params.logId,
        params.organisationId,
        {
          voidedBy: userId,
        },
      ),
  }),
};
