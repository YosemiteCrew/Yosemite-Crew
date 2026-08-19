import { Request, Response } from "express";
import { z } from "zod";
import { ClinicalAlertLogService } from "src/services/clinical-alert-log.service";

const AlertTypeEnum = z.enum([
  "DRUG_INTERACTION",
  "CRITICAL_LAB_VALUE",
  "OVERDUE_VACCINATION",
  "ALLERGY_CONTRAINDICATION",
  "DOSE_CHECK",
  "ABNORMAL_VITALS",
  "SPECIALIST_REVIEW_DUE",
  "WEIGHT_THRESHOLD",
  "OTHER",
]);

const SeverityEnum = z.enum(["INFO", "WARNING", "CRITICAL"]);

const TriggerSchema = z.object({
  patientId: z.string(),
  encounterId: z.string().optional(),
  alertType: AlertTypeEnum,
  severity: SeverityEnum.optional(),
  title: z.string(),
  body: z.string().optional(),
  triggeredBy: z.string().optional(),
});

const AcknowledgeSchema = z.object({
  acknowledgedBy: z.string(),
  note: z.string().optional(),
});

const ListQuerySchema = z.object({
  patientId: z.string().optional(),
  encounterId: z.string().optional(),
  severity: SeverityEnum.optional(),
  alertType: AlertTypeEnum.optional(),
  dismissed: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

export const ClinicalAlertLogController = {
  trigger: async (req: Request, res: Response) => {
    const parsed = TriggerSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.errors });

    const alert = await ClinicalAlertLogService.trigger({
      organisationId: req.params.organisationId,
      ...parsed.data,
    });
    return res.status(201).json(alert);
  },

  get: async (req: Request, res: Response) => {
    const alert = await ClinicalAlertLogService.get(
      req.params.alertId,
      req.params.organisationId,
    );
    return res.json(alert);
  },

  list: async (req: Request, res: Response) => {
    const parsed = ListQuerySchema.safeParse(req.query);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.errors });

    const alerts = await ClinicalAlertLogService.list({
      organisationId: req.params.organisationId,
      ...parsed.data,
    });
    return res.json(alerts);
  },

  acknowledge: async (req: Request, res: Response) => {
    const parsed = AcknowledgeSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.errors });

    const alert = await ClinicalAlertLogService.acknowledge(
      req.params.alertId,
      req.params.organisationId,
      parsed.data.acknowledgedBy,
      parsed.data.note,
    );
    return res.json(alert);
  },

  dismiss: async (req: Request, res: Response) => {
    const alert = await ClinicalAlertLogService.dismiss(
      req.params.alertId,
      req.params.organisationId,
    );
    return res.json(alert);
  },
};
