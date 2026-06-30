import { Request, Response } from "express";
import { z } from "zod";
import { PatientCheckInService } from "src/services/patient-check-in.service";

const TriagePriorityEnum = z.enum([
  "IMMEDIATE",
  "URGENT",
  "LESS_URGENT",
  "STANDARD",
  "NON_URGENT",
]);

const StatusEnum = z.enum([
  "WAITING",
  "IN_CONSULTATION",
  "COMPLETED",
  "NO_SHOW",
  "CANCELLED",
]);

const CreateSchema = z.object({
  patientId: z.string(),
  clientId: z.string(),
  appointmentId: z.string().optional(),
  arrivedAt: z
    .string()
    .datetime()
    .transform((v) => new Date(v)),
  triagePriority: TriagePriorityEnum.optional(),
  triageNote: z.string().optional(),
  checkedInBy: z.string().optional(),
  notes: z.string().optional(),
});

const ListQuerySchema = z.object({
  patientId: z.string().optional(),
  status: StatusEnum.optional(),
  date: z
    .string()
    .datetime()
    .transform((v) => new Date(v))
    .optional(),
});

const AssignRoomSchema = z.object({
  roomId: z.string(),
});

export const PatientCheckInController = {
  create: async (req: Request, res: Response) => {
    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.errors });

    const result = await PatientCheckInService.create({
      organisationId: req.params.organisationId,
      ...parsed.data,
    });
    return res.status(201).json(result);
  },

  get: async (req: Request, res: Response) => {
    const result = await PatientCheckInService.get(
      req.params.checkInId,
      req.params.organisationId,
    );
    return res.json(result);
  },

  list: async (req: Request, res: Response) => {
    const parsed = ListQuerySchema.safeParse(req.query);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.errors });

    const results = await PatientCheckInService.list({
      organisationId: req.params.organisationId,
      ...parsed.data,
    });
    return res.json(results);
  },

  markSeen: async (req: Request, res: Response) => {
    const result = await PatientCheckInService.markSeen(
      req.params.checkInId,
      req.params.organisationId,
    );
    return res.json(result);
  },

  complete: async (req: Request, res: Response) => {
    const result = await PatientCheckInService.complete(
      req.params.checkInId,
      req.params.organisationId,
    );
    return res.json(result);
  },

  cancel: async (req: Request, res: Response) => {
    const result = await PatientCheckInService.cancel(
      req.params.checkInId,
      req.params.organisationId,
    );
    return res.json(result);
  },

  markNoShow: async (req: Request, res: Response) => {
    const result = await PatientCheckInService.markNoShow(
      req.params.checkInId,
      req.params.organisationId,
    );
    return res.json(result);
  },

  assignRoom: async (req: Request, res: Response) => {
    const parsed = AssignRoomSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.errors });

    const result = await PatientCheckInService.assignRoom(
      req.params.checkInId,
      req.params.organisationId,
      parsed.data.roomId,
    );
    return res.json(result);
  },
};
