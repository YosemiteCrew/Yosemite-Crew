import { z } from "zod";
import {
  DischargeInstructionService,
  DischargeInstructionError,
} from "src/services/discharge-instruction.service";
import {
  createClinicalHandlers,
  orgParams,
  patientScopeQuery,
  uuid,
} from "src/controllers/web/shared/clinical-controller.helpers";

const DischargeStatusEnum = z.enum(["DRAFT", "SENT", "ACKNOWLEDGED"]);

const CreateBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  medicationSchedule: z.string().max(5000).optional(),
  dietaryNotes: z.string().max(2000).optional(),
  activityNotes: z.string().max(2000).optional(),
  woundCareNotes: z.string().max(2000).optional(),
  warningSigns: z.string().max(2000).optional(),
  followUpDate: z.string().datetime().optional(),
  followUpNotes: z.string().max(2000).optional(),
  emergencyContact: z.string().max(500).optional(),
  additionalNotes: z.string().max(5000).optional(),
});

const UpdateBodySchema = CreateBodySchema.omit({
  patientId: true,
  encounterId: true,
});

const ListQuerySchema = patientScopeQuery.extend({
  status: DischargeStatusEnum.optional(),
});

const DischargeParamsSchema = orgParams.extend({ dischargeId: uuid() });

const { handler } = createClinicalHandlers(DischargeInstructionError);

export const DischargeInstructionController = {
  list: handler({
    params: orgParams,
    query: ListQuerySchema,
    fallback: "Failed to list discharge instructions",
    run: ({ params, input }) =>
      DischargeInstructionService.list({
        organisationId: params.organisationId,
        ...input,
      }),
  }),

  create: handler({
    params: orgParams,
    body: CreateBodySchema,
    status: 201,
    fallback: "Failed to create discharge instructions",
    run: ({ params, input, userId }) => {
      const { followUpDate, ...rest } = input;
      return DischargeInstructionService.create({
        organisationId: params.organisationId,
        preparedBy: userId,
        ...rest,
        ...(followUpDate ? { followUpDate: new Date(followUpDate) } : {}),
      });
    },
  }),

  get: handler({
    params: DischargeParamsSchema,
    fallback: "Failed to get discharge instructions",
    run: ({ params }) =>
      DischargeInstructionService.get(
        params.dischargeId,
        params.organisationId,
      ),
  }),

  update: handler({
    params: DischargeParamsSchema,
    body: UpdateBodySchema,
    fallback: "Failed to update discharge instructions",
    run: ({ params, input }) => {
      const { followUpDate, ...rest } = input;
      return DischargeInstructionService.update(
        params.dischargeId,
        params.organisationId,
        {
          ...rest,
          ...(followUpDate ? { followUpDate: new Date(followUpDate) } : {}),
        },
      );
    },
  }),

  send: handler({
    params: DischargeParamsSchema,
    fallback: "Failed to send discharge instructions",
    run: ({ params, userId }) =>
      DischargeInstructionService.send(
        params.dischargeId,
        params.organisationId,
        userId,
      ),
  }),

  acknowledge: handler({
    params: DischargeParamsSchema,
    fallback: "Failed to acknowledge discharge instructions",
    run: ({ params, userId }) =>
      DischargeInstructionService.acknowledge(
        params.dischargeId,
        params.organisationId,
        userId,
      ),
  }),
};
