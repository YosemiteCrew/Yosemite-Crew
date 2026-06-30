import { Request, Response } from "express";
import { z } from "zod";
import {
  TreatmentOutcomeService,
  TreatmentOutcomeError,
} from "src/services/treatment-outcome.service";

const OutcomeTypeEnum = z.enum([
  "RECOVERED",
  "IMPROVED",
  "STABLE",
  "DETERIORATED",
  "DECEASED",
  "REFERRED_OUT",
  "LOST_TO_FOLLOWUP",
  "ONGOING",
]);

const RecordSchema = z.object({
  patientId: z.string().min(1),
  encounterId: z.string().optional(),
  episodeOfCareId: z.string().optional(),
  recordedAt: z.string().datetime(),
  recordedBy: z.string().optional(),
  outcomeType: OutcomeTypeEnum,
  clinicalNotes: z.string().optional(),
  followUpDate: z.string().datetime().optional(),
  followUpNotes: z.string().optional(),
});

const UpdateSchema = z.object({
  outcomeType: OutcomeTypeEnum.optional(),
  clinicalNotes: z.string().optional(),
  followUpDate: z.string().datetime().nullable().optional(),
  followUpNotes: z.string().optional(),
  resolved: z.boolean().optional(),
});

const handleError = (err: unknown, res: Response) => {
  if (err instanceof TreatmentOutcomeError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: "Internal server error" });
};

export const TreatmentOutcomeController = {
  record: async (req: Request, res: Response) => {
    const parsed = RecordSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ errors: parsed.error.errors });
    try {
      const outcome = await TreatmentOutcomeService.record({
        organisationId: req.params.organisationId,
        ...parsed.data,
        recordedAt: new Date(parsed.data.recordedAt),
        followUpDate: parsed.data.followUpDate
          ? new Date(parsed.data.followUpDate)
          : undefined,
      });
      return res.status(201).json(outcome);
    } catch (err) {
      return handleError(err, res);
    }
  },

  get: async (req: Request, res: Response) => {
    try {
      const outcome = await TreatmentOutcomeService.get(
        req.params.outcomeId,
        req.params.organisationId,
      );
      return res.json(outcome);
    } catch (err) {
      return handleError(err, res);
    }
  },

  list: async (req: Request, res: Response) => {
    const { patientId, outcomeType, resolved, encounterId } =
      req.query as Record<string, string | undefined>;
    const parsedType = OutcomeTypeEnum.safeParse(outcomeType);
    try {
      const outcomes = await TreatmentOutcomeService.list({
        organisationId: req.params.organisationId,
        patientId,
        outcomeType: parsedType.success ? parsedType.data : undefined,
        resolved: resolved !== undefined ? resolved === "true" : undefined,
        encounterId,
      });
      return res.json(outcomes);
    } catch (err) {
      return handleError(err, res);
    }
  },

  update: async (req: Request, res: Response) => {
    const parsed = UpdateSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ errors: parsed.error.errors });
    try {
      const outcome = await TreatmentOutcomeService.update(
        req.params.outcomeId,
        req.params.organisationId,
        {
          ...parsed.data,
          followUpDate:
            parsed.data.followUpDate !== undefined
              ? parsed.data.followUpDate
                ? new Date(parsed.data.followUpDate)
                : null
              : undefined,
        },
      );
      return res.json(outcome);
    } catch (err) {
      return handleError(err, res);
    }
  },

  resolve: async (req: Request, res: Response) => {
    try {
      const outcome = await TreatmentOutcomeService.resolve(
        req.params.outcomeId,
        req.params.organisationId,
      );
      return res.json(outcome);
    } catch (err) {
      return handleError(err, res);
    }
  },
};
