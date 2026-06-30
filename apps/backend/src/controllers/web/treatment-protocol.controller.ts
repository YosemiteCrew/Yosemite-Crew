import type { Request, Response } from "express";
import { z } from "zod";
import {
  TreatmentProtocolService,
  TreatmentProtocolError,
} from "src/services/treatment-protocol.service";
import type { OrgRequest } from "src/middlewares/rbac";

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
  isActive: z
    .string()
    .optional()
    .transform((v) =>
      v === "false" ? false : v === "true" ? true : undefined,
    ),
});

const OrgParamsSchema = z.object({ organisationId: z.string().uuid() });
const ProtocolParamsSchema = z.object({
  organisationId: z.string().uuid(),
  protocolId: z.string().uuid(),
});
const StepParamsSchema = z.object({
  organisationId: z.string().uuid(),
  protocolId: z.string().uuid(),
  stepId: z.string().uuid(),
});

const handleError = (
  err: unknown,
  res: Response,
  fallback: string,
): Response => {
  if (err instanceof TreatmentProtocolError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: fallback });
};

export const TreatmentProtocolController = {
  list: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = ListQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: "Invalid query parameters" });
      const protocols = await TreatmentProtocolService.list({
        organisationId: params.data.organisationId,
        ...query.data,
      });
      return res.status(200).json(protocols);
    } catch (err) {
      return handleError(err, res, "Failed to list protocols");
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
      const protocol = await TreatmentProtocolService.create({
        organisationId: params.data.organisationId,
        ...body.data,
        createdById: typedReq.userId ?? undefined,
      });
      return res.status(201).json(protocol);
    } catch (err) {
      return handleError(err, res, "Failed to create protocol");
    }
  },

  get: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = ProtocolParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const protocol = await TreatmentProtocolService.get(
        params.data.protocolId,
        params.data.organisationId,
      );
      return res.status(200).json(protocol);
    } catch (err) {
      return handleError(err, res, "Failed to get protocol");
    }
  },

  update: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = ProtocolParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = UpdateBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const protocol = await TreatmentProtocolService.update(
        params.data.protocolId,
        params.data.organisationId,
        body.data,
      );
      return res.status(200).json(protocol);
    } catch (err) {
      return handleError(err, res, "Failed to update protocol");
    }
  },

  archive: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = ProtocolParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      await TreatmentProtocolService.archive(
        params.data.protocolId,
        params.data.organisationId,
      );
      return res.status(204).send();
    } catch (err) {
      return handleError(err, res, "Failed to archive protocol");
    }
  },

  addStep: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = ProtocolParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = StepSchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const step = await TreatmentProtocolService.addStep(
        params.data.protocolId,
        params.data.organisationId,
        body.data,
      );
      return res.status(201).json(step);
    } catch (err) {
      return handleError(err, res, "Failed to add step");
    }
  },

  removeStep: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = StepParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      await TreatmentProtocolService.removeStep(
        params.data.stepId,
        params.data.protocolId,
        params.data.organisationId,
      );
      return res.status(204).send();
    } catch (err) {
      return handleError(err, res, "Failed to remove step");
    }
  },

  apply: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = ProtocolParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = ApplyBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const result = await TreatmentProtocolService.apply({
        protocolId: params.data.protocolId,
        encounterId: body.data.encounterId,
        patientId: body.data.patientId,
        organisationId: params.data.organisationId,
        appliedById: typedReq.userId ?? undefined,
        appointmentDate: body.data.appointmentDate
          ? new Date(body.data.appointmentDate)
          : undefined,
      });
      return res.status(201).json(result);
    } catch (err) {
      return handleError(err, res, "Failed to apply protocol");
    }
  },
};
