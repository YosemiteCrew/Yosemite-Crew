import type { Request, Response } from "express";
import { z } from "zod";
import { MARService, MARError } from "src/services/mar.service";
import type { OrgRequest } from "src/middlewares/rbac";

const MARStatusEnum = z.enum([
  "SCHEDULED",
  "GIVEN",
  "HELD",
  "MISSED",
  "REFUSED",
]);

const CreateBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  prescriptionId: z.string().uuid().optional(),
  medicationName: z.string().min(1).max(200),
  dose: z.string().min(1).max(100),
  route: z.string().min(1).max(100),
  scheduledAt: z.string().datetime(),
});

const AdministerBodySchema = z.object({
  administeredAt: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});

const HoldBodySchema = z.object({
  notes: z.string().max(2000).optional(),
});

const ListQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  encounterId: z.string().uuid().optional(),
  status: MARStatusEnum.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const OrgParamsSchema = z.object({ organisationId: z.string().uuid() });
const EntryParamsSchema = z.object({
  organisationId: z.string().uuid(),
  marEntryId: z.string().uuid(),
});

const handleError = (
  err: unknown,
  res: Response,
  fallback: string,
): Response => {
  if (err instanceof MARError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: fallback });
};

export const MARController = {
  list: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = ListQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: query.error.message });
      const { from, to, ...rest } = query.data;
      const entries = await MARService.list({
        organisationId: params.data.organisationId,
        ...(from ? { from: new Date(from) } : {}),
        ...(to ? { to: new Date(to) } : {}),
        ...rest,
      });
      return res.status(200).json(entries);
    } catch (err) {
      return handleError(err, res, "Failed to list MAR entries");
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
      const entry = await MARService.create({
        organisationId: params.data.organisationId,
        createdBy: typedReq.userId ?? undefined,
        ...body.data,
        scheduledAt: new Date(body.data.scheduledAt),
      });
      return res.status(201).json(entry);
    } catch (err) {
      return handleError(err, res, "Failed to create MAR entry");
    }
  },

  get: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = EntryParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const entry = await MARService.get(
        params.data.marEntryId,
        params.data.organisationId,
      );
      return res.status(200).json(entry);
    } catch (err) {
      return handleError(err, res, "Failed to get MAR entry");
    }
  },

  administer: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = EntryParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = AdministerBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const { administeredAt, ...rest } = body.data;
      const entry = await MARService.administer(
        params.data.marEntryId,
        params.data.organisationId,
        {
          ...rest,
          administeredBy: typedReq.userId ?? undefined,
          ...(administeredAt
            ? { administeredAt: new Date(administeredAt) }
            : {}),
        },
      );
      return res.status(200).json(entry);
    } catch (err) {
      return handleError(err, res, "Failed to administer MAR entry");
    }
  },

  hold: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = EntryParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = HoldBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const entry = await MARService.hold(
        params.data.marEntryId,
        params.data.organisationId,
        body.data.notes,
        typedReq.userId ?? undefined,
      );
      return res.status(200).json(entry);
    } catch (err) {
      return handleError(err, res, "Failed to hold MAR entry");
    }
  },

  markMissed: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = EntryParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = HoldBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const entry = await MARService.markMissed(
        params.data.marEntryId,
        params.data.organisationId,
        body.data.notes,
        typedReq.userId ?? undefined,
      );
      return res.status(200).json(entry);
    } catch (err) {
      return handleError(err, res, "Failed to mark MAR entry as missed");
    }
  },
};
