import type { Request, Response } from "express";
import { z } from "zod";
import {
  PhysiotherapyPlanService,
  PhysiotherapyPlanError,
} from "src/services/physiotherapy-plan.service";
import type { OrgRequest } from "src/middlewares/rbac";

const StatusEnum = z.enum(["ACTIVE", "ON_HOLD", "COMPLETED", "DISCONTINUED"]);

const CreateBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  surgicalProcedureId: z.string().uuid().optional(),
  diagnosis: z.string().min(1).max(500),
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
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  nextSessionAt: z.string().datetime().optional(),
  therapist: z.string().max(300).optional(),
  notes: z.string().max(2000).optional(),
});

const UpdateBodySchema = z.object({
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
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  lastSessionAt: z.string().datetime().optional(),
  nextSessionAt: z.string().datetime().optional(),
  therapist: z.string().max(300).optional(),
  status: StatusEnum.optional(),
  notes: z.string().max(2000).optional(),
});

const ListQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  encounterId: z.string().uuid().optional(),
  status: StatusEnum.optional(),
});

const OrgParamsSchema = z.object({ organisationId: z.string().uuid() });
const PlanParamsSchema = z.object({
  organisationId: z.string().uuid(),
  planId: z.string().uuid(),
});

const handleError = (
  err: unknown,
  res: Response,
  fallback: string,
): Response => {
  if (err instanceof PhysiotherapyPlanError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: fallback });
};

const parseDateFields = (obj: Record<string, unknown>, keys: string[]) => {
  const out = { ...obj };
  for (const k of keys) {
    if (typeof out[k] === "string") out[k] = new Date(out[k] as string);
  }
  return out;
};

const DATE_KEYS = ["startDate", "endDate", "nextSessionAt", "lastSessionAt"];

export const PhysiotherapyPlanController = {
  list: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = ListQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: query.error.message });
      const records = await PhysiotherapyPlanService.list({
        organisationId: params.data.organisationId,
        ...query.data,
      });
      return res.status(200).json(records);
    } catch (err) {
      return handleError(err, res, "Failed to list physiotherapy plans");
    }
  },

  create: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = CreateBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const d = body.data;
      const record = await PhysiotherapyPlanService.create({
        organisationId: params.data.organisationId,
        prescribedBy: typedReq.userId ?? undefined,
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
      return res.status(201).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to create physiotherapy plan");
    }
  },

  get: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = PlanParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const record = await PhysiotherapyPlanService.get(
        params.data.planId,
        params.data.organisationId,
      );
      return res.status(200).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to get physiotherapy plan");
    }
  },

  update: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = PlanParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = UpdateBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const parsed = parseDateFields(
        body.data as Record<string, unknown>,
        DATE_KEYS,
      );
      const record = await PhysiotherapyPlanService.update(
        params.data.planId,
        params.data.organisationId,
        parsed as Parameters<typeof PhysiotherapyPlanService.update>[2],
        typedReq.userId ?? undefined,
      );
      return res.status(200).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to update physiotherapy plan");
    }
  },
};
