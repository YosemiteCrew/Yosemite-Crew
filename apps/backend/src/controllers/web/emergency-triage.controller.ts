import { z } from "zod";
import {
  EmergencyTriageService,
  EmergencyTriageError,
} from "src/services/emergency-triage.service";
import {
  createClinicalHandlers,
  dateRange,
  orgParams,
  patientScopeQuery,
  uuid,
} from "src/controllers/web/shared/clinical-controller.helpers";

const TriagePriorityEnum = z.enum([
  "IMMEDIATE",
  "URGENT",
  "LESS_URGENT",
  "STANDARD",
  "NON_URGENT",
]);

const RecordBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  triagePriority: TriagePriorityEnum,
  chiefComplaint: z.string().min(1).max(1000),
  presentationAt: z.string().datetime(),
  heartRate: z.number().int().min(0).max(500).optional(),
  respiratoryRate: z.number().int().min(0).max(200).optional(),
  temperature: z.number().min(25).max(45).optional(),
  bloodPressureSystolic: z.number().int().min(0).max(400).optional(),
  bloodPressureDiastolic: z.number().int().min(0).max(300).optional(),
  oxygenSaturation: z.number().min(0).max(100).optional(),
  capillaryRefillTime: z.number().min(0).max(20).optional(),
  mentalStatus: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
});

const EscalateBodySchema = z.object({
  escalatedReason: z.string().min(1).max(2000),
});

const ListQuerySchema = patientScopeQuery.extend({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const TriageParamsSchema = orgParams.extend({ triageId: uuid() });

const { handler } = createClinicalHandlers(EmergencyTriageError);

export const EmergencyTriageController = {
  list: handler({
    params: orgParams,
    query: ListQuerySchema,
    fallback: "Failed to list triage records",
    run: ({ params, input }) => {
      const { from, to, ...rest } = input;
      return EmergencyTriageService.list({
        organisationId: params.organisationId,
        ...rest,
        ...dateRange(from, to),
      });
    },
  }),

  record: handler({
    params: orgParams,
    body: RecordBodySchema,
    status: 201,
    fallback: "Failed to record triage",
    run: ({ params, input, userId }) => {
      const { presentationAt, ...rest } = input;
      return EmergencyTriageService.record({
        organisationId: params.organisationId,
        triageBy: userId,
        ...rest,
        presentationAt: new Date(presentationAt),
      });
    },
  }),

  get: handler({
    params: TriageParamsSchema,
    fallback: "Failed to get triage record",
    run: ({ params }) =>
      EmergencyTriageService.get(params.triageId, params.organisationId),
  }),

  escalate: handler({
    params: TriageParamsSchema,
    body: EscalateBodySchema,
    fallback: "Failed to escalate triage",
    run: ({ params, input, userId }) =>
      EmergencyTriageService.escalate(
        params.triageId,
        params.organisationId,
        input,
        userId,
      ),
  }),
};
