import type { Request, Response } from "express";
import { z } from "zod";
import {
  DischargeInstructionService,
  DischargeInstructionError,
} from "src/services/discharge-instruction.service";
import type { OrgRequest } from "src/middlewares/rbac";

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

const ListQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  encounterId: z.string().uuid().optional(),
  status: DischargeStatusEnum.optional(),
});

const OrgParamsSchema = z.object({ organisationId: z.string().uuid() });
const DischargeParamsSchema = z.object({
  organisationId: z.string().uuid(),
  dischargeId: z.string().uuid(),
});

const handleError = (
  err: unknown,
  res: Response,
  fallback: string,
): Response => {
  if (err instanceof DischargeInstructionError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: fallback });
};

export const DischargeInstructionController = {
  list: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = ListQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: query.error.message });
      const records = await DischargeInstructionService.list({
        organisationId: params.data.organisationId,
        ...query.data,
      });
      return res.status(200).json(records);
    } catch (err) {
      return handleError(err, res, "Failed to list discharge instructions");
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
      const { followUpDate, ...rest } = body.data;
      const record = await DischargeInstructionService.create({
        organisationId: params.data.organisationId,
        preparedBy: typedReq.userId ?? undefined,
        ...rest,
        ...(followUpDate ? { followUpDate: new Date(followUpDate) } : {}),
      });
      return res.status(201).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to create discharge instructions");
    }
  },

  get: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = DischargeParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const record = await DischargeInstructionService.get(
        params.data.dischargeId,
        params.data.organisationId,
      );
      return res.status(200).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to get discharge instructions");
    }
  },

  update: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = DischargeParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = UpdateBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const { followUpDate, ...rest } = body.data;
      const record = await DischargeInstructionService.update(
        params.data.dischargeId,
        params.data.organisationId,
        {
          ...rest,
          ...(followUpDate ? { followUpDate: new Date(followUpDate) } : {}),
        },
        typedReq.userId ?? undefined,
      );
      return res.status(200).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to update discharge instructions");
    }
  },

  send: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = DischargeParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const record = await DischargeInstructionService.send(
        params.data.dischargeId,
        params.data.organisationId,
        typedReq.userId ?? undefined,
      );
      return res.status(200).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to send discharge instructions");
    }
  },

  acknowledge: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = DischargeParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const record = await DischargeInstructionService.acknowledge(
        params.data.dischargeId,
        params.data.organisationId,
      );
      return res.status(200).json(record);
    } catch (err) {
      return handleError(
        err,
        res,
        "Failed to acknowledge discharge instructions",
      );
    }
  },
};
