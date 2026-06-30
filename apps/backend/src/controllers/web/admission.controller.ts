import { z } from "zod";
import type { Request, Response } from "express";
import { AdmissionService } from "src/services/admission.service";

const CreateAdmissionSchema = z.object({
  patientId: z.string(),
  unitId: z.string().optional(),
  expectedStayDays: z.number().int().positive().optional(),
  admittedAt: z.string().datetime(),
  admittedBy: z.string().optional(),
});

const UpdateAdmissionSchema = z.object({
  unitId: z.string().optional(),
  expectedStayDays: z.number().int().positive().optional(),
  admittedBy: z.string().optional(),
});

const DischargeSchema = z.object({
  dischargedAt: z.string().datetime(),
  dischargedBy: z.string().optional(),
});

export const admissionController = {
  admit: async (req: Request, res: Response) => {
    const { organisationId, encounterId } = req.params;
    const parsed = CreateAdmissionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { admittedAt, ...rest } = parsed.data;
    try {
      const admission = await AdmissionService.admit({
        encounterId,
        organisationId,
        ...rest,
        admittedAt: new Date(admittedAt),
      });
      res.status(201).json(admission);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },

  get: async (req: Request, res: Response) => {
    const { organisationId, encounterId } = req.params;
    try {
      const admission = await AdmissionService.get(encounterId, organisationId);
      res.json(admission);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },

  list: async (req: Request, res: Response) => {
    const { organisationId } = req.params;
    const activeParam = req.query.active;
    const active =
      activeParam === "true"
        ? true
        : activeParam === "false"
          ? false
          : undefined;
    try {
      const admissions = await AdmissionService.list({
        organisationId,
        active,
        patientId: req.query.patientId as string | undefined,
      });
      res.json(admissions);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },

  update: async (req: Request, res: Response) => {
    const { organisationId, encounterId } = req.params;
    const parsed = UpdateAdmissionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    try {
      const admission = await AdmissionService.update(
        encounterId,
        organisationId,
        parsed.data,
      );
      res.json(admission);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },

  discharge: async (req: Request, res: Response) => {
    const { organisationId, encounterId } = req.params;
    const parsed = DischargeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    try {
      const admission = await AdmissionService.discharge(
        encounterId,
        organisationId,
        {
          dischargedAt: new Date(parsed.data.dischargedAt),
          dischargedBy: parsed.data.dischargedBy,
        },
      );
      res.json(admission);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },
};
