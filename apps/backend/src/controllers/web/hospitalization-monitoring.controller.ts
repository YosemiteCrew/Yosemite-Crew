import { z } from "zod";
import {
  HospitalizationMonitoringService,
  HospitalizationMonitoringError,
} from "src/services/hospitalization-monitoring.service";
import {
  createClinicalHandlers,
  dateRange,
  orgParams,
  uuid,
} from "src/controllers/web/shared/clinical-controller.helpers";

const RecordBodySchema = z.object({
  patientId: z.uuid(),
  admissionId: z.uuid().optional(),
  encounterId: z.uuid().optional(),
  observedAt: z.iso.datetime(),
  temperature: z.number().optional(),
  temperatureUnit: z.enum(["C", "F"]).optional(),
  heartRate: z.number().int().positive().optional(),
  respiratoryRate: z.number().int().positive().optional(),
  spo2: z.number().int().min(0).max(100).optional(),
  bloodPressureSystolic: z.number().int().positive().optional(),
  bloodPressureDiastolic: z.number().int().positive().optional(),
  etco2: z.number().int().positive().optional(),
  painScore: z.number().int().min(0).max(10).optional(),
  crtSecs: z.number().min(0).optional(),
  mucousMembranes: z.string().max(200).optional(),
  inputMl: z.number().min(0).optional(),
  outputMl: z.number().min(0).optional(),
  mentalStatus: z.string().max(200).optional(),
  appetite: z.string().max(200).optional(),
  urination: z.string().max(200).optional(),
  defecation: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

const ListQuerySchema = z.object({
  patientId: z.uuid().optional(),
  admissionId: z.uuid().optional(),
  encounterId: z.uuid().optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});

const ObsParamsSchema = orgParams.extend({ obsId: uuid() });

const { handler } = createClinicalHandlers(HospitalizationMonitoringError);

export const HospitalizationMonitoringController = {
  list: handler({
    params: orgParams,
    query: ListQuerySchema,
    fallback: "Failed to list monitoring observations",
    run: ({ params, input }) => {
      const { from, to, ...rest } = input;
      return HospitalizationMonitoringService.list({
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
    fallback: "Failed to record monitoring observation",
    run: ({ params, input, userId }) => {
      const { observedAt, ...rest } = input;
      return HospitalizationMonitoringService.record({
        organisationId: params.organisationId,
        observedBy: userId,
        ...rest,
        observedAt: new Date(observedAt),
      });
    },
  }),

  get: handler({
    params: ObsParamsSchema,
    fallback: "Failed to get monitoring observation",
    run: ({ params }) =>
      HospitalizationMonitoringService.get(params.obsId, params.organisationId),
  }),

  delete: handler({
    params: ObsParamsSchema,
    status: 204,
    fallback: "Failed to delete monitoring observation",
    run: ({ params }) =>
      HospitalizationMonitoringService.delete(
        params.obsId,
        params.organisationId,
      ),
  }),
};
