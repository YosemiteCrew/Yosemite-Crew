import type { Request, Response } from "express";
import { z } from "zod";
import {
  ControlledSubstanceLogService,
  ControlledSubstanceLogError,
} from "src/services/controlled-substance-log.service";
import type { OrgRequest } from "src/middlewares/rbac";

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
  patientId: z.string().uuid().optional(),
  encounterId: z.string().uuid().optional(),
  loggedAt: z.string().datetime(),
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
  patientId: z.string().uuid().optional(),
  drug: z.string().optional(),
  deaSchedule: DeaScheduleEnum.optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
});

const OrgParamsSchema = z.object({ organisationId: z.string().uuid() });
const LogParamsSchema = z.object({
  organisationId: z.string().uuid(),
  logId: z.string().uuid(),
});

const handleError = (
  err: unknown,
  res: Response,
  fallback: string,
): Response => {
  if (err instanceof ControlledSubstanceLogError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: fallback });
};

export const ControlledSubstanceLogController = {
  list: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = ListQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: query.error.message });
      const records = await ControlledSubstanceLogService.list({
        organisationId: params.data.organisationId,
        patientId: query.data.patientId,
        drug: query.data.drug,
        deaSchedule: query.data.deaSchedule,
        fromDate: query.data.fromDate
          ? new Date(query.data.fromDate)
          : undefined,
        toDate: query.data.toDate ? new Date(query.data.toDate) : undefined,
      });
      return res.status(200).json(records);
    } catch (err) {
      return handleError(
        err,
        res,
        "Failed to list controlled substance log entries",
      );
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
      const record = await ControlledSubstanceLogService.create({
        organisationId: params.data.organisationId,
        administeredBy: typedReq.userId ?? undefined,
        ...body.data,
        loggedAt: new Date(body.data.loggedAt),
      });
      return res.status(201).json(record);
    } catch (err) {
      return handleError(
        err,
        res,
        "Failed to create controlled substance log entry",
      );
    }
  },

  get: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = LogParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const record = await ControlledSubstanceLogService.get(
        params.data.logId,
        params.data.organisationId,
      );
      return res.status(200).json(record);
    } catch (err) {
      return handleError(
        err,
        res,
        "Failed to get controlled substance log entry",
      );
    }
  },

  update: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = LogParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = UpdateBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const record = await ControlledSubstanceLogService.update(
        params.data.logId,
        params.data.organisationId,
        body.data,
      );
      return res.status(200).json(record);
    } catch (err) {
      return handleError(
        err,
        res,
        "Failed to update controlled substance log entry",
      );
    }
  },

  delete: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = LogParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      await ControlledSubstanceLogService.delete(
        params.data.logId,
        params.data.organisationId,
      );
      return res.status(204).send();
    } catch (err) {
      return handleError(
        err,
        res,
        "Failed to delete controlled substance log entry",
      );
    }
  },
};
