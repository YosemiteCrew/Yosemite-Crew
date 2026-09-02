import { z } from "zod";
import type { Request, Response } from "express";
import { DeceasedRecordService } from "src/services/deceased-record.service";

const CauseOfDeathEnum = z.enum([
  "EUTHANASIA",
  "NATURAL_DEATH",
  "TRAUMATIC_INJURY",
  "ACUTE_ILLNESS",
  "CHRONIC_DISEASE",
  "SURGICAL_COMPLICATION",
  "ANESTHETIC_COMPLICATION",
  "UNKNOWN",
  "OTHER",
]);

const BodyDispositionEnum = z.enum([
  "OWNER_COLLECTED",
  "PRIVATE_CREMATION",
  "COMMUNAL_CREMATION",
  "AQUAMATION",
  "BURIAL",
  "NECROPSY_FACILITY",
  "DONATED_TO_SCIENCE",
]);

/**
 * The record's own fields: the death and its cause are mandatory when the
 * record is first written, and every field is optional on update.
 */
const DeceasedRecordFieldsSchema = z.object({
  deceasedAt: z.string().datetime(),
  causeOfDeathType: CauseOfDeathEnum,
  causeOfDeathDetail: z.string().optional(),
  bodyWeightKg: z.number().positive().optional(),
  bodyConditionScore: z.number().int().min(1).max(9).optional(),
  necropsyRequested: z.boolean().optional(),
  necropsyFacility: z.string().optional(),
  bodyDisposition: BodyDispositionEnum.optional(),
  ownerNotifiedAt: z.string().datetime().optional(),
  certifiedBy: z.string().optional(),
  notes: z.string().optional(),
});

const CreateDeceasedRecordSchema = z
  .object({ patientId: z.string() })
  .merge(DeceasedRecordFieldsSchema);

const UpdateDeceasedRecordSchema = DeceasedRecordFieldsSchema.partial();

export const deceasedRecordController = {
  create: async (req: Request, res: Response) => {
    const { organisationId } = req.params;
    const parsed = CreateDeceasedRecordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.flattenError(parsed.error) });
      return;
    }
    const { deceasedAt, ownerNotifiedAt, ...rest } = parsed.data;
    try {
      const record = await DeceasedRecordService.create({
        organisationId,
        ...rest,
        deceasedAt: new Date(deceasedAt),
        ownerNotifiedAt: ownerNotifiedAt
          ? new Date(ownerNotifiedAt)
          : undefined,
        recordedBy: (req as unknown as { userId?: string }).userId,
      });
      res.status(201).json(record);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },

  get: async (req: Request, res: Response) => {
    const { organisationId, recordId } = req.params;
    try {
      const record = await DeceasedRecordService.get(recordId, organisationId);
      res.json(record);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },

  getByPatient: async (req: Request, res: Response) => {
    const { organisationId, patientId } = req.params;
    try {
      const record = await DeceasedRecordService.getByPatient(
        patientId,
        organisationId,
      );
      res.json(record);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },

  list: async (req: Request, res: Response) => {
    const { organisationId } = req.params;
    const causeResult = CauseOfDeathEnum.safeParse(req.query.causeOfDeathType);
    try {
      const records = await DeceasedRecordService.list({
        organisationId,
        causeOfDeathType: causeResult.success ? causeResult.data : undefined,
      });
      res.json(records);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },

  update: async (req: Request, res: Response) => {
    const { organisationId, recordId } = req.params;
    const parsed = UpdateDeceasedRecordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.flattenError(parsed.error) });
      return;
    }
    const { deceasedAt, ownerNotifiedAt, ...rest } = parsed.data;
    try {
      const record = await DeceasedRecordService.update(
        recordId,
        organisationId,
        {
          ...rest,
          deceasedAt: deceasedAt ? new Date(deceasedAt) : undefined,
          ownerNotifiedAt: ownerNotifiedAt
            ? new Date(ownerNotifiedAt)
            : undefined,
        },
      );
      res.json(record);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },
};
