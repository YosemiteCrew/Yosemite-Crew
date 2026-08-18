import { z } from "zod";
import {
  TreatmentProtocolService,
  TreatmentProtocolError,
} from "src/services/treatment-protocol.service";
import {
  createClinicalHandlers,
  orgParams,
  uuid,
} from "src/controllers/web/shared/clinical-controller.helpers";
import { parseOptionalBooleanFlag } from "src/utils/query-flags";

const SpeciesEnum = z.enum(["CANINE", "FELINE", "AVIAN", "EXOTIC", "ALL"]);
const CategoryEnum = z.enum([
  "WELLNESS",
  "SURGICAL",
  "EMERGENCY",
  "DENTAL",
  "DERMATOLOGY",
  "ORTHOPEDIC",
  "NUTRITION",
  "OTHER",
]);
const StepTypeEnum = z.enum(["TASK", "MEDICATION", "SERVICE", "NOTE"]);

const StepSchema = z.object({
  stepOrder: z.number().int().positive().optional(),
  stepType: StepTypeEnum,
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  inventoryItemId: z.string().uuid().optional(),
  doseValue: z.number().positive().optional(),
  doseUnit: z.string().max(50).optional(),
  routeOfAdmin: z.string().max(100).optional(),
  frequency: z.string().max(100).optional(),
  durationDays: z.number().int().positive().optional(),
  assigneeRole: z.string().max(50).optional(),
  dueDaysFromStart: z.number().int().min(0).optional(),
  serviceCode: z.string().max(100).optional(),
  unitPrice: z.number().min(0).optional(),
  quantity: z.number().int().positive().optional(),
});

const CreateBodySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  species: SpeciesEnum.optional(),
  category: CategoryEnum.optional(),
  steps: z.array(StepSchema).max(50).optional(),
});

const UpdateBodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  species: SpeciesEnum.optional(),
  category: CategoryEnum.optional(),
  isActive: z.boolean().optional(),
});

const ApplyBodySchema = z.object({
  encounterId: z.string().min(1),
  patientId: z.string().uuid(),
  appointmentDate: z.string().datetime().optional(),
});

const ListQuerySchema = z.object({
  species: SpeciesEnum.optional(),
  category: CategoryEnum.optional(),
  isActive: z.string().optional().transform(parseOptionalBooleanFlag),
});

const ProtocolParamsSchema = orgParams.extend({ protocolId: uuid() });
const StepParamsSchema = orgParams.extend({
  protocolId: uuid(),
  stepId: uuid(),
});

const { handler } = createClinicalHandlers(TreatmentProtocolError);

export const TreatmentProtocolController = {
  list: handler({
    params: orgParams,
    query: ListQuerySchema,
    invalidInputMessage: "Invalid query parameters",
    fallback: "Failed to list protocols",
    run: ({ params, input }) =>
      TreatmentProtocolService.list({
        organisationId: params.organisationId,
        ...input,
      }),
  }),

  create: handler({
    params: orgParams,
    body: CreateBodySchema,
    status: 201,
    fallback: "Failed to create protocol",
    run: ({ params, input, userId }) =>
      TreatmentProtocolService.create({
        organisationId: params.organisationId,
        ...input,
        createdById: userId,
      }),
  }),

  get: handler({
    params: ProtocolParamsSchema,
    fallback: "Failed to get protocol",
    run: ({ params }) =>
      TreatmentProtocolService.get(params.protocolId, params.organisationId),
  }),

  update: handler({
    params: ProtocolParamsSchema,
    body: UpdateBodySchema,
    fallback: "Failed to update protocol",
    run: ({ params, input }) =>
      TreatmentProtocolService.update(
        params.protocolId,
        params.organisationId,
        input,
      ),
  }),

  archive: handler({
    params: ProtocolParamsSchema,
    status: 204,
    fallback: "Failed to archive protocol",
    run: ({ params }) =>
      TreatmentProtocolService.archive(
        params.protocolId,
        params.organisationId,
      ),
  }),

  addStep: handler({
    params: ProtocolParamsSchema,
    body: StepSchema,
    status: 201,
    fallback: "Failed to add step",
    run: ({ params, input }) =>
      TreatmentProtocolService.addStep(
        params.protocolId,
        params.organisationId,
        input,
      ),
  }),

  removeStep: handler({
    params: StepParamsSchema,
    status: 204,
    fallback: "Failed to remove step",
    run: ({ params }) =>
      TreatmentProtocolService.removeStep(
        params.stepId,
        params.protocolId,
        params.organisationId,
      ),
  }),

  apply: handler({
    params: ProtocolParamsSchema,
    body: ApplyBodySchema,
    status: 201,
    fallback: "Failed to apply protocol",
    run: ({ params, input, userId }) =>
      TreatmentProtocolService.apply({
        protocolId: params.protocolId,
        encounterId: input.encounterId,
        patientId: input.patientId,
        organisationId: params.organisationId,
        appliedById: userId,
        appointmentDate: input.appointmentDate
          ? new Date(input.appointmentDate)
          : undefined,
      }),
  }),
};
