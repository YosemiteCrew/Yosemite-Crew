import { Request, Response } from "express";
import { z } from "zod";
import { WaitlistEntryService } from "src/services/waitlist-entry.service";

const StatusEnum = z.enum([
  "WAITING",
  "OFFERED",
  "BOOKED",
  "CANCELLED",
  "EXPIRED",
]);

const AddSchema = z.object({
  patientId: z.string(),
  requestedBy: z.string().optional(),
  preferredLeadId: z.string().optional(),
  appointmentType: z.string().optional(),
  earliestDate: z
    .string()
    .datetime()
    .transform((v) => new Date(v))
    .optional(),
  latestDate: z
    .string()
    .datetime()
    .transform((v) => new Date(v))
    .optional(),
  notes: z.string().optional(),
  expiresAt: z
    .string()
    .datetime()
    .transform((v) => new Date(v))
    .optional(),
});

const ListQuerySchema = z.object({
  patientId: z.string().optional(),
  status: StatusEnum.optional(),
  appointmentType: z.string().optional(),
});

const BookOfferSchema = z.object({
  at: z
    .string()
    .datetime()
    .transform((v) => new Date(v))
    .optional(),
});

export const WaitlistEntryController = {
  add: async (req: Request, res: Response) => {
    const parsed = AddSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.errors });

    const entry = await WaitlistEntryService.add({
      organisationId: req.params.organisationId,
      ...parsed.data,
    });
    return res.status(201).json(entry);
  },

  get: async (req: Request, res: Response) => {
    const entry = await WaitlistEntryService.get(
      req.params.entryId,
      req.params.organisationId,
    );
    return res.json(entry);
  },

  list: async (req: Request, res: Response) => {
    const parsed = ListQuerySchema.safeParse(req.query);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.errors });

    const entries = await WaitlistEntryService.list({
      organisationId: req.params.organisationId,
      ...parsed.data,
    });
    return res.json(entries);
  },

  offer: async (req: Request, res: Response) => {
    const parsed = BookOfferSchema.safeParse(req.body);
    const offeredAt = parsed.success ? parsed.data.at : undefined;
    const entry = await WaitlistEntryService.offer(
      req.params.entryId,
      req.params.organisationId,
      offeredAt,
    );
    return res.json(entry);
  },

  book: async (req: Request, res: Response) => {
    const parsed = BookOfferSchema.safeParse(req.body);
    const bookedAt = parsed.success ? parsed.data.at : undefined;
    const entry = await WaitlistEntryService.book(
      req.params.entryId,
      req.params.organisationId,
      bookedAt,
    );
    return res.json(entry);
  },

  cancel: async (req: Request, res: Response) => {
    const entry = await WaitlistEntryService.cancel(
      req.params.entryId,
      req.params.organisationId,
    );
    return res.json(entry);
  },

  expire: async (req: Request, res: Response) => {
    const entry = await WaitlistEntryService.expire(
      req.params.entryId,
      req.params.organisationId,
    );
    return res.json(entry);
  },
};
