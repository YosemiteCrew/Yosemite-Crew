import { z } from "zod";
import type { Request, Response } from "express";
import { ClientComplaintService } from "src/services/client-complaint.service";

const StatusEnum = z.enum([
  "OPEN",
  "INVESTIGATING",
  "PENDING_RESPONSE",
  "RESOLVED",
  "CLOSED",
  "ESCALATED",
]);

const CategoryEnum = z.enum([
  "CLINICAL_CARE",
  "COMMUNICATION",
  "BILLING",
  "WAIT_TIMES",
  "FACILITIES",
  "STAFF_CONDUCT",
  "OUTCOME_CONCERN",
  "OTHER",
]);

const CreateComplaintSchema = z.object({
  clientId: z.string(),
  patientId: z.string().optional(),
  encounterId: z.string().optional(),
  category: CategoryEnum.optional(),
  summary: z.string().min(1),
  description: z.string().optional(),
  reportedAt: z.string().datetime().optional(),
  reportedBy: z.string().optional(),
  assignedTo: z.string().optional(),
});

const UpdateComplaintSchema = z.object({
  status: StatusEnum.optional(),
  category: CategoryEnum.optional(),
  summary: z.string().min(1).optional(),
  description: z.string().optional(),
  assignedTo: z.string().optional(),
  resolvedAt: z.string().datetime().optional(),
  resolutionNotes: z.string().optional(),
});

const AddNoteSchema = z.object({
  content: z.string().min(1),
  authorId: z.string().optional(),
  isInternal: z.boolean().optional(),
});

export const clientComplaintController = {
  create: async (req: Request, res: Response) => {
    const { organisationId } = req.params;
    const parsed = CreateComplaintSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { reportedAt, ...rest } = parsed.data;
    try {
      const complaint = await ClientComplaintService.create({
        organisationId,
        ...rest,
        reportedAt: reportedAt ? new Date(reportedAt) : undefined,
      });
      res.status(201).json(complaint);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },

  get: async (req: Request, res: Response) => {
    const { organisationId, complaintId } = req.params;
    try {
      const complaint = await ClientComplaintService.get(
        complaintId,
        organisationId,
      );
      res.json(complaint);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },

  list: async (req: Request, res: Response) => {
    const { organisationId } = req.params;
    const statusResult = StatusEnum.safeParse(req.query.status);
    const categoryResult = CategoryEnum.safeParse(req.query.category);
    try {
      const complaints = await ClientComplaintService.list({
        organisationId,
        clientId: req.query.clientId as string | undefined,
        status: statusResult.success ? statusResult.data : undefined,
        category: categoryResult.success ? categoryResult.data : undefined,
      });
      res.json(complaints);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },

  update: async (req: Request, res: Response) => {
    const { organisationId, complaintId } = req.params;
    const parsed = UpdateComplaintSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { resolvedAt, ...rest } = parsed.data;
    try {
      const complaint = await ClientComplaintService.update(
        complaintId,
        organisationId,
        {
          ...rest,
          resolvedAt: resolvedAt ? new Date(resolvedAt) : undefined,
        },
      );
      res.json(complaint);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },

  addNote: async (req: Request, res: Response) => {
    const { organisationId, complaintId } = req.params;
    const parsed = AddNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    try {
      const note = await ClientComplaintService.addNote(
        complaintId,
        organisationId,
        parsed.data,
      );
      res.status(201).json(note);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },

  delete: async (req: Request, res: Response) => {
    const { organisationId, complaintId } = req.params;
    try {
      await ClientComplaintService.delete(complaintId, organisationId);
      res.status(204).send();
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },
};
