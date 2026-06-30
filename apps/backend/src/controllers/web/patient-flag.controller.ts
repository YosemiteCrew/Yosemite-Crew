import { Request, Response } from "express";
import { z } from "zod";
import {
  PatientFlagService,
  PatientFlagError,
} from "src/services/patient-flag.service";

const FlagTypeEnum = z.enum([
  "AGGRESSION",
  "ESCAPE_RISK",
  "ALLERGY_WARNING",
  "ANXIETY",
  "SPECIAL_HANDLING",
  "BILLING_NOTE",
  "VIP",
  "QUARANTINE",
  "OTHER",
]);

const SeverityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

const CreateFlagSchema = z.object({
  patientId: z.string().min(1),
  flagType: FlagTypeEnum,
  severity: SeverityEnum.optional(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  createdBy: z.string().optional(),
});

const UpdateFlagSchema = z.object({
  flagType: FlagTypeEnum.optional(),
  severity: SeverityEnum.optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
});

const handleError = (res: Response, err: unknown) => {
  if (err instanceof PatientFlagError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  return res.status(500).json({ error: "Internal server error." });
};

export const PatientFlagController = {
  create: async (req: Request, res: Response) => {
    const parsed = CreateFlagSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    try {
      const flag = await PatientFlagService.create({
        organisationId: req.params.organisationId,
        ...parsed.data,
      });
      return res.status(201).json(flag);
    } catch (err) {
      return handleError(res, err);
    }
  },

  get: async (req: Request, res: Response) => {
    try {
      const flag = await PatientFlagService.get(
        req.params.flagId,
        req.params.organisationId,
      );
      return res.json(flag);
    } catch (err) {
      return handleError(res, err);
    }
  },

  list: async (req: Request, res: Response) => {
    const patientId = req.query.patientId as string | undefined;
    const flagType = req.query.flagType as string | undefined;
    const severity = req.query.severity as string | undefined;
    const isActiveRaw = req.query.isActive as string | undefined;
    const isActive =
      isActiveRaw === "true"
        ? true
        : isActiveRaw === "false"
          ? false
          : undefined;

    try {
      const flags = await PatientFlagService.list({
        organisationId: req.params.organisationId,
        patientId,
        flagType: flagType as Parameters<
          typeof PatientFlagService.list
        >[0]["flagType"],
        severity: severity as Parameters<
          typeof PatientFlagService.list
        >[0]["severity"],
        isActive,
      });
      return res.json(flags);
    } catch (err) {
      return handleError(res, err);
    }
  },

  update: async (req: Request, res: Response) => {
    const parsed = UpdateFlagSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    try {
      const flag = await PatientFlagService.update(
        req.params.flagId,
        req.params.organisationId,
        parsed.data,
      );
      return res.json(flag);
    } catch (err) {
      return handleError(res, err);
    }
  },

  resolve: async (req: Request, res: Response) => {
    const resolvedBy = (req.body as { resolvedBy?: string }).resolvedBy;
    try {
      const flag = await PatientFlagService.resolve(
        req.params.flagId,
        req.params.organisationId,
        resolvedBy,
      );
      return res.json(flag);
    } catch (err) {
      return handleError(res, err);
    }
  },
};
