import { Request, Response } from "express";
import { z } from "zod";
import { TelemedicineSessionService } from "src/services/telemedicine-session.service";

const PlatformEnum = z.enum(["VIDEO_CALL", "PHONE_CALL", "CHAT", "EMAIL"]);

const StatusEnum = z.enum([
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "NO_SHOW",
  "CANCELLED",
]);

const ScheduleSchema = z.object({
  clientId: z.string(),
  patientId: z.string().optional(),
  appointmentId: z.string().optional(),
  platform: PlatformEnum,
  conductedBy: z.string().optional(),
  chiefComplaint: z.string().optional(),
  externalSessionId: z.string().optional(),
});

const CompleteSchema = z.object({
  clinicianNotes: z.string().optional(),
  followUpRequired: z.boolean().optional(),
  recordingUrl: z.string().optional(),
});

const ListQuerySchema = z.object({
  clientId: z.string().optional(),
  patientId: z.string().optional(),
  status: StatusEnum.optional(),
  platform: PlatformEnum.optional(),
});

export const TelemedicineSessionController = {
  schedule: async (req: Request, res: Response) => {
    const parsed = ScheduleSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.errors });

    const session = await TelemedicineSessionService.schedule({
      organisationId: req.params.organisationId,
      ...parsed.data,
    });
    return res.status(201).json(session);
  },

  get: async (req: Request, res: Response) => {
    const session = await TelemedicineSessionService.get(
      req.params.sessionId,
      req.params.organisationId,
    );
    return res.json(session);
  },

  list: async (req: Request, res: Response) => {
    const parsed = ListQuerySchema.safeParse(req.query);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.errors });

    const sessions = await TelemedicineSessionService.list({
      organisationId: req.params.organisationId,
      ...parsed.data,
    });
    return res.json(sessions);
  },

  start: async (req: Request, res: Response) => {
    const session = await TelemedicineSessionService.start(
      req.params.sessionId,
      req.params.organisationId,
    );
    return res.json(session);
  },

  complete: async (req: Request, res: Response) => {
    const parsed = CompleteSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.errors });

    const session = await TelemedicineSessionService.complete(
      req.params.sessionId,
      req.params.organisationId,
      parsed.data,
    );
    return res.json(session);
  },

  cancel: async (req: Request, res: Response) => {
    const session = await TelemedicineSessionService.cancel(
      req.params.sessionId,
      req.params.organisationId,
    );
    return res.json(session);
  },

  markNoShow: async (req: Request, res: Response) => {
    const session = await TelemedicineSessionService.markNoShow(
      req.params.sessionId,
      req.params.organisationId,
    );
    return res.json(session);
  },
};
