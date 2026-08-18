import { z } from "zod";
import type { Request, Response } from "express";
import { SurgicalChecklistService } from "src/services/surgical-checklist.service";

const PhaseEnum = z.enum(["SIGN_IN", "TIME_OUT", "SIGN_OUT"]);
const StatusEnum = z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "ABANDONED"]);

const ChecklistItemSchema = z.object({
  label: z.string().min(1),
  sortOrder: z.number().int().optional(),
  notes: z.string().optional(),
});

const CreateChecklistSchema = z.object({
  patientId: z.string(),
  encounterId: z.string(),
  phase: PhaseEnum.optional(),
  conductedBy: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(ChecklistItemSchema).optional(),
});

const UpdateChecklistSchema = z.object({
  phase: PhaseEnum.optional(),
  status: StatusEnum.optional(),
  conductedBy: z.string().optional(),
  notes: z.string().optional(),
  completedAt: z.string().datetime().optional(),
});

const CheckItemSchema = z.object({
  checkedBy: z.string().optional(),
  notes: z.string().optional(),
});

export const surgicalChecklistController = {
  create: async (req: Request, res: Response) => {
    const { organisationId } = req.params;
    const parsed = CreateChecklistSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    try {
      const checklist = await SurgicalChecklistService.create({
        organisationId,
        ...parsed.data,
      });
      res.status(201).json(checklist);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },

  get: async (req: Request, res: Response) => {
    const { organisationId, checklistId } = req.params;
    try {
      const checklist = await SurgicalChecklistService.get(
        checklistId,
        organisationId,
      );
      res.json(checklist);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },

  list: async (req: Request, res: Response) => {
    const { organisationId } = req.params;
    const statusResult = StatusEnum.safeParse(req.query.status);
    try {
      const checklists = await SurgicalChecklistService.list({
        organisationId,
        patientId: req.query.patientId as string | undefined,
        encounterId: req.query.encounterId as string | undefined,
        status: statusResult.success ? statusResult.data : undefined,
      });
      res.json(checklists);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },

  update: async (req: Request, res: Response) => {
    const { organisationId, checklistId } = req.params;
    const parsed = UpdateChecklistSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { completedAt, ...rest } = parsed.data;
    try {
      const checklist = await SurgicalChecklistService.update(
        checklistId,
        organisationId,
        {
          ...rest,
          completedAt: completedAt ? new Date(completedAt) : undefined,
        },
      );
      res.json(checklist);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },

  checkItem: async (req: Request, res: Response) => {
    const { organisationId, checklistId, itemId } = req.params;
    const parsed = CheckItemSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    try {
      const item = await SurgicalChecklistService.checkItem(
        checklistId,
        itemId,
        organisationId,
        parsed.data,
      );
      res.json(item);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },

  uncheckItem: async (req: Request, res: Response) => {
    const { organisationId, checklistId, itemId } = req.params;
    try {
      const item = await SurgicalChecklistService.uncheckItem(
        checklistId,
        itemId,
        organisationId,
      );
      res.json(item);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },

  delete: async (req: Request, res: Response) => {
    const { organisationId, checklistId } = req.params;
    try {
      await SurgicalChecklistService.delete(checklistId, organisationId);
      res.status(204).send();
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },
};
