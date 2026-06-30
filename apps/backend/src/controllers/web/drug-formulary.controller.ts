import { z } from "zod";
import type { Request, Response } from "express";
import { DrugFormularyService } from "src/services/drug-formulary.service";

const CategoryEnum = z.enum([
  "ANALGESIC",
  "ANTIBIOTIC",
  "ANTIFUNGAL",
  "ANTIPARASITIC",
  "CARDIOVASCULAR",
  "CHEMOTHERAPY",
  "CONTROLLED_SUBSTANCE",
  "DERMATOLOGY",
  "ENDOCRINOLOGY",
  "GASTROINTESTINAL",
  "IMMUNOSUPPRESSANT",
  "NEUROLOGY",
  "OPHTHALMIC",
  "RESPIRATORY",
  "SEDATION_ANESTHESIA",
  "VACCINE",
  "OTHER",
]);

const DosageSchema = z.object({
  species: z.string().min(1),
  indication: z.string().optional(),
  doseMin: z.number().positive().optional(),
  doseMax: z.number().positive().optional(),
  doseUnit: z.string().optional(),
  route: z.string().optional(),
  frequency: z.string().optional(),
  maxDose: z.number().positive().optional(),
  notes: z.string().optional(),
});

const CreateFormularySchema = z.object({
  drugName: z.string().min(1),
  genericName: z.string().optional(),
  category: CategoryEnum.optional(),
  manufacturer: z.string().optional(),
  concentration: z.string().optional(),
  availableUnits: z.array(z.string()).optional(),
  notes: z.string().optional(),
  dosageEntries: z.array(DosageSchema).optional(),
});

const UpdateFormularySchema = z.object({
  drugName: z.string().min(1).optional(),
  genericName: z.string().optional(),
  category: CategoryEnum.optional(),
  manufacturer: z.string().optional(),
  concentration: z.string().optional(),
  availableUnits: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  notes: z.string().optional(),
});

export const drugFormularyController = {
  create: async (req: Request, res: Response) => {
    const { organisationId } = req.params;
    const parsed = CreateFormularySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    try {
      const entry = await DrugFormularyService.create({
        organisationId,
        ...parsed.data,
        createdBy: (req as unknown as { userId?: string }).userId,
      });
      res.status(201).json(entry);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },

  get: async (req: Request, res: Response) => {
    const { organisationId, formularyId } = req.params;
    try {
      const entry = await DrugFormularyService.get(formularyId, organisationId);
      res.json(entry);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },

  list: async (req: Request, res: Response) => {
    const { organisationId } = req.params;
    const categoryResult = CategoryEnum.safeParse(req.query.category);
    const activeParam = req.query.isActive;
    const isActive =
      activeParam === "true"
        ? true
        : activeParam === "false"
          ? false
          : undefined;
    try {
      const entries = await DrugFormularyService.list({
        organisationId,
        category: categoryResult.success ? categoryResult.data : undefined,
        isActive,
        search: req.query.search as string | undefined,
      });
      res.json(entries);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },

  update: async (req: Request, res: Response) => {
    const { organisationId, formularyId } = req.params;
    const parsed = UpdateFormularySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    try {
      const entry = await DrugFormularyService.update(
        formularyId,
        organisationId,
        parsed.data,
      );
      res.json(entry);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },

  addDosage: async (req: Request, res: Response) => {
    const { organisationId, formularyId } = req.params;
    const parsed = DosageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    try {
      const dosage = await DrugFormularyService.addDosage(
        formularyId,
        organisationId,
        parsed.data,
      );
      res.status(201).json(dosage);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },

  removeDosage: async (req: Request, res: Response) => {
    const { organisationId, formularyId, dosageId } = req.params;
    try {
      await DrugFormularyService.removeDosage(
        formularyId,
        dosageId,
        organisationId,
      );
      res.status(204).send();
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },

  delete: async (req: Request, res: Response) => {
    const { organisationId, formularyId } = req.params;
    try {
      await DrugFormularyService.delete(formularyId, organisationId);
      res.status(204).send();
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },
};
