import type { Request, Response } from "express";
import { z } from "zod";
import {
  ReproductiveRecordService,
  ReproductiveRecordError,
} from "src/services/reproductive-record.service";
import type { OrgRequest } from "src/middlewares/rbac";

const ReproductiveStatusEnum = z.enum([
  "INTACT",
  "SPAYED",
  "NEUTERED",
  "CASTRATED",
  "UNKNOWN",
]);
const PregnancyStatusEnum = z.enum([
  "SUSPECTED",
  "CONFIRMED",
  "WHELPED",
  "QUEENED",
  "ABORTED",
  "RESORBED",
]);

const CreateBodySchema = z.object({
  patientId: z.string().uuid(),
  reproductiveStatus: ReproductiveStatusEnum,
  lastHeatDate: z.string().datetime().optional(),
  nextHeatExpected: z.string().datetime().optional(),
  matingDate: z.string().datetime().optional(),
  sireId: z.string().uuid().optional(),
  sireName: z.string().max(300).optional(),
  pregnancyStatus: PregnancyStatusEnum.optional(),
  pregnancyConfirmedAt: z.string().datetime().optional(),
  expectedWhelp: z.string().datetime().optional(),
  litterSizeUltrasound: z.number().int().min(0).optional(),
  litterSizeXray: z.number().int().min(0).optional(),
  actualWhelp: z.string().datetime().optional(),
  litterSizeBorn: z.number().int().min(0).optional(),
  litterSizeAlive: z.number().int().min(0).optional(),
  notes: z.string().max(3000).optional(),
});

const UpdateBodySchema = CreateBodySchema.omit({ patientId: true }).partial();

const ListQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  reproductiveStatus: ReproductiveStatusEnum.optional(),
});

const OrgParamsSchema = z.object({ organisationId: z.string().uuid() });
const RepParamsSchema = z.object({
  organisationId: z.string().uuid(),
  recordId: z.string().uuid(),
});

const parseOptionalDate = (val?: string): Date | undefined =>
  val ? new Date(val) : undefined;

const handleError = (
  err: unknown,
  res: Response,
  fallback: string,
): Response => {
  if (err instanceof ReproductiveRecordError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: fallback });
};

export const ReproductiveRecordController = {
  list: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = ListQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: query.error.message });
      const records = await ReproductiveRecordService.list({
        organisationId: params.data.organisationId,
        ...query.data,
      });
      return res.status(200).json(records);
    } catch (err) {
      return handleError(err, res, "Failed to list reproductive records");
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
      const {
        lastHeatDate,
        nextHeatExpected,
        matingDate,
        pregnancyConfirmedAt,
        expectedWhelp,
        actualWhelp,
        ...rest
      } = body.data;
      const record = await ReproductiveRecordService.create({
        organisationId: params.data.organisationId,
        recordedBy: typedReq.userId ?? undefined,
        ...rest,
        lastHeatDate: parseOptionalDate(lastHeatDate),
        nextHeatExpected: parseOptionalDate(nextHeatExpected),
        matingDate: parseOptionalDate(matingDate),
        pregnancyConfirmedAt: parseOptionalDate(pregnancyConfirmedAt),
        expectedWhelp: parseOptionalDate(expectedWhelp),
        actualWhelp: parseOptionalDate(actualWhelp),
      });
      return res.status(201).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to create reproductive record");
    }
  },

  get: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = RepParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const record = await ReproductiveRecordService.get(
        params.data.recordId,
        params.data.organisationId,
      );
      return res.status(200).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to get reproductive record");
    }
  },

  update: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = RepParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = UpdateBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const {
        lastHeatDate,
        nextHeatExpected,
        matingDate,
        pregnancyConfirmedAt,
        expectedWhelp,
        actualWhelp,
        ...rest
      } = body.data;
      const record = await ReproductiveRecordService.update(
        params.data.recordId,
        params.data.organisationId,
        {
          ...rest,
          lastHeatDate: parseOptionalDate(lastHeatDate),
          nextHeatExpected: parseOptionalDate(nextHeatExpected),
          matingDate: parseOptionalDate(matingDate),
          pregnancyConfirmedAt: parseOptionalDate(pregnancyConfirmedAt),
          expectedWhelp: parseOptionalDate(expectedWhelp),
          actualWhelp: parseOptionalDate(actualWhelp),
        },
        typedReq.userId ?? undefined,
      );
      return res.status(200).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to update reproductive record");
    }
  },
};
