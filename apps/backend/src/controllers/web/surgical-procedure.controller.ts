import { z } from "zod";
import {
  SurgicalProcedureService,
  SurgicalProcedureError,
} from "src/services/surgical-procedure.service";
import {
  createClinicalHandlers,
  orgParams,
  patientScopeQuery,
  uuid,
} from "src/controllers/web/shared/clinical-controller.helpers";

const OutcomeEnum = z.enum(["SUCCESS", "COMPLICATION", "ABANDONED", "PENDING"]);
const AnesthesiaEnum = z.enum([
  "GENERAL",
  "LOCAL",
  "SEDATION",
  "EPIDURAL",
  "NONE",
]);

const CreateBodySchema = z.object({
  patientId: z.uuid(),
  encounterId: z.uuid().optional(),
  procedureName: z.string().min(1).max(300),
  surgeon: z.string().max(200).optional(),
  assistants: z.array(z.string().max(200)).optional(),
  anesthesiaType: AnesthesiaEnum.optional(),
  anesthesiaAgent: z.string().max(200).optional(),
  anesthesiaDoseMs: z.number().positive().optional(),
  startedAt: z.iso.datetime().optional(),
  endedAt: z.iso.datetime().optional(),
  durationMinutes: z.number().int().positive().optional(),
  outcome: OutcomeEnum.optional(),
  complications: z.string().max(2000).optional(),
  instruments: z.array(z.string().max(200)).optional(),
  specimensSent: z.array(z.string().max(200)).optional(),
  postOpNotes: z.string().max(5000).optional(),
});

const UpdateBodySchema = CreateBodySchema.omit({
  patientId: true,
  encounterId: true,
});

const ListQuerySchema = patientScopeQuery.extend({
  outcome: OutcomeEnum.optional(),
});

const ProcedureParamsSchema = orgParams.extend({ procedureId: uuid() });

const parseDates = (data: Record<string, unknown>) => {
  const out = { ...data };
  if (typeof out.startedAt === "string")
    out.startedAt = new Date(out.startedAt);
  if (typeof out.endedAt === "string") out.endedAt = new Date(out.endedAt);
  return out;
};

const { handler } = createClinicalHandlers(SurgicalProcedureError);

export const SurgicalProcedureController = {
  list: handler({
    params: orgParams,
    query: ListQuerySchema,
    fallback: "Failed to list surgical procedures",
    run: ({ params, input }) =>
      SurgicalProcedureService.list({
        organisationId: params.organisationId,
        ...input,
      }),
  }),

  create: handler({
    params: orgParams,
    body: CreateBodySchema,
    status: 201,
    fallback: "Failed to record surgical procedure",
    run: ({ params, input, userId }) =>
      SurgicalProcedureService.create({
        organisationId: params.organisationId,
        performedBy: userId,
        ...parseDates(input),
      } as Parameters<typeof SurgicalProcedureService.create>[0]),
  }),

  get: handler({
    params: ProcedureParamsSchema,
    fallback: "Failed to get surgical procedure",
    run: ({ params }) =>
      SurgicalProcedureService.get(params.procedureId, params.organisationId),
  }),

  update: handler({
    params: ProcedureParamsSchema,
    body: UpdateBodySchema,
    fallback: "Failed to update surgical procedure",
    run: ({ params, input, userId }) =>
      SurgicalProcedureService.update(
        params.procedureId,
        params.organisationId,
        parseDates(input),
        userId,
      ),
  }),
};
