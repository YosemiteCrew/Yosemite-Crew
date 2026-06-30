import type { Request, Response } from "express";
import { z } from "zod";
import { WaitlistService, WaitlistError } from "src/services/waitlist.service";
import type { OrgRequest } from "src/middlewares/rbac";

const WaitlistStatusEnum = z.enum([
  "WAITING",
  "OFFERED",
  "BOOKED",
  "CANCELLED",
  "EXPIRED",
]);

const AddBodySchema = z.object({
  patientId: z.string().uuid(),
  preferredLeadId: z.string().uuid().optional(),
  appointmentType: z.string().max(100).optional(),
  earliestDate: z.string().datetime().optional(),
  latestDate: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
  expiresAt: z.string().datetime().optional(),
});

const ListQuerySchema = z.object({
  status: WaitlistStatusEnum.optional(),
  patientId: z.string().uuid().optional(),
  appointmentType: z.string().max(100).optional(),
});

const OrgParamsSchema = z.object({ organisationId: z.string().uuid() });
const EntryParamsSchema = z.object({
  organisationId: z.string().uuid(),
  entryId: z.string().uuid(),
});

const handleError = (
  err: unknown,
  res: Response,
  fallback: string,
): Response => {
  if (err instanceof WaitlistError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: fallback });
};

export const WaitlistController = {
  list: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = ListQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: query.error.message });
      const entries = await WaitlistService.list({
        organisationId: params.data.organisationId,
        ...query.data,
      });
      return res.status(200).json(entries);
    } catch (err) {
      return handleError(err, res, "Failed to list waitlist entries");
    }
  },

  add: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = AddBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const entry = await WaitlistService.add({
        organisationId: params.data.organisationId,
        requestedBy: typedReq.userId ?? undefined,
        ...body.data,
        earliestDate: body.data.earliestDate
          ? new Date(body.data.earliestDate)
          : undefined,
        latestDate: body.data.latestDate
          ? new Date(body.data.latestDate)
          : undefined,
        expiresAt: body.data.expiresAt
          ? new Date(body.data.expiresAt)
          : undefined,
      });
      return res.status(201).json(entry);
    } catch (err) {
      return handleError(err, res, "Failed to add waitlist entry");
    }
  },

  get: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = EntryParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const entry = await WaitlistService.get(
        params.data.entryId,
        params.data.organisationId,
      );
      return res.status(200).json(entry);
    } catch (err) {
      return handleError(err, res, "Failed to get waitlist entry");
    }
  },

  offer: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = EntryParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const entry = await WaitlistService.offer(
        params.data.entryId,
        params.data.organisationId,
        typedReq.userId ?? undefined,
      );
      return res.status(200).json(entry);
    } catch (err) {
      return handleError(err, res, "Failed to offer slot");
    }
  },

  book: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = EntryParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const entry = await WaitlistService.book(
        params.data.entryId,
        params.data.organisationId,
        typedReq.userId ?? undefined,
      );
      return res.status(200).json(entry);
    } catch (err) {
      return handleError(err, res, "Failed to book waitlist entry");
    }
  },

  cancel: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = EntryParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const entry = await WaitlistService.cancel(
        params.data.entryId,
        params.data.organisationId,
        typedReq.userId ?? undefined,
      );
      return res.status(200).json(entry);
    } catch (err) {
      return handleError(err, res, "Failed to cancel waitlist entry");
    }
  },

  expireStale: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const result = await WaitlistService.expireStale(
        params.data.organisationId,
      );
      return res.status(200).json(result);
    } catch (err) {
      return handleError(err, res, "Failed to expire stale entries");
    }
  },
};
