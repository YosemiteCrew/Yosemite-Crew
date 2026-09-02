import { z } from "zod";
import {
  PhysiotherapyPlanService,
  PhysiotherapyPlanError,
} from "src/services/physiotherapy-plan.service";
import {
  coerceDateFields,
  createClinicalHandlers,
  orgParams,
  patientScopeBody,
  patientScopeQuery,
  uuid,
} from "src/controllers/web/shared/clinical-controller.helpers";

const StatusEnum = z.enum(["ACTIVE", "ON_HOLD", "COMPLETED", "DISCONTINUED"]);

/**
 * Every therapy field a plan carries, all optional: this is the update body as
 * it stands. The create body drops the two fields a plan cannot be opened with
 * (`lastSessionAt`, `status`) and takes the diagnosis back as mandatory.
 */
const PlanFieldsSchema = z.object({
  diagnosis: z.string().min(1).max(500).optional(),
  goals: z.string().max(2000).optional(),
  frequency: z.string().max(200).optional(),
  durationMinutes: z.number().int().positive().optional(),
  totalSessions: z.number().int().positive().optional(),
  exercisePrescription: z.string().max(5000).optional(),
  hydrotherapy: z.boolean().optional(),
  laserTherapy: z.boolean().optional(),
  therapeuticUltrasound: z.boolean().optional(),
  massage: z.boolean().optional(),
  acupuncture: z.boolean().optional(),
  tapeApplication: z.boolean().optional(),
  precautions: z.string().max(2000).optional(),
  homeExercises: z.string().max(5000).optional(),
  startDate: z.iso.datetime().optional(),
  endDate: z.iso.datetime().optional(),
  lastSessionAt: z.iso.datetime().optional(),
  nextSessionAt: z.iso.datetime().optional(),
  therapist: z.string().max(300).optional(),
  status: StatusEnum.optional(),
  notes: z.string().max(2000).optional(),
});

const CreateBodySchema = patientScopeBody
  .extend({ surgicalProcedureId: uuid().optional() })
  .extend(
    PlanFieldsSchema.omit({ lastSessionAt: true, status: true }).required({
      diagnosis: true,
    }).shape,
  );

const ListQuerySchema = patientScopeQuery.extend({
  status: StatusEnum.optional(),
});

const PlanParamsSchema = orgParams.extend({ planId: uuid() });

const DATE_KEYS = ["startDate", "endDate", "nextSessionAt", "lastSessionAt"];

const { handler } = createClinicalHandlers(PhysiotherapyPlanError);

export const PhysiotherapyPlanController = {
  list: handler({
    params: orgParams,
    query: ListQuerySchema,
    fallback: "Failed to list physiotherapy plans",
    run: ({ params, input }) =>
      PhysiotherapyPlanService.list({
        organisationId: params.organisationId,
        ...input,
      }),
  }),

  create: handler({
    params: orgParams,
    body: CreateBodySchema,
    status: 201,
    fallback: "Failed to create physiotherapy plan",
    run: ({ params, input, userId }) => {
      const d = input;
      return PhysiotherapyPlanService.create({
        organisationId: params.organisationId,
        prescribedBy: userId,
        patientId: d.patientId,
        encounterId: d.encounterId,
        surgicalProcedureId: d.surgicalProcedureId,
        diagnosis: d.diagnosis,
        goals: d.goals,
        frequency: d.frequency,
        durationMinutes: d.durationMinutes,
        totalSessions: d.totalSessions,
        exercisePrescription: d.exercisePrescription,
        hydrotherapy: d.hydrotherapy,
        laserTherapy: d.laserTherapy,
        therapeuticUltrasound: d.therapeuticUltrasound,
        massage: d.massage,
        acupuncture: d.acupuncture,
        tapeApplication: d.tapeApplication,
        precautions: d.precautions,
        homeExercises: d.homeExercises,
        startDate: d.startDate ? new Date(d.startDate) : undefined,
        endDate: d.endDate ? new Date(d.endDate) : undefined,
        nextSessionAt: d.nextSessionAt ? new Date(d.nextSessionAt) : undefined,
        therapist: d.therapist,
        notes: d.notes,
      });
    },
  }),

  get: handler({
    params: PlanParamsSchema,
    fallback: "Failed to get physiotherapy plan",
    run: ({ params }) =>
      PhysiotherapyPlanService.get(params.planId, params.organisationId),
  }),

  update: handler({
    params: PlanParamsSchema,
    body: PlanFieldsSchema,
    fallback: "Failed to update physiotherapy plan",
    run: ({ params, input, userId }) => {
      const parsed = coerceDateFields(input, DATE_KEYS);
      return PhysiotherapyPlanService.update(
        params.planId,
        params.organisationId,
        parsed,
        userId,
      );
    },
  }),
};
