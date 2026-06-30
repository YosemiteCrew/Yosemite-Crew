import { Request, Response } from "express";
import { z } from "zod";
import { AdverseEventReportService } from "src/services/adverse-event-report.service";

const StatusEnum = z.enum([
  "DRAFT",
  "SUBMITTED",
  "REVIEWING",
  "FORWARDED",
  "CLOSED",
]);

const CreateSchema = z.object({
  appointmentId: z.string().optional(),
  reporter: z.record(z.unknown()),
  patient: z.record(z.unknown()),
  product: z.record(z.unknown()),
  destinations: z.record(z.unknown()),
  consent: z.record(z.unknown()),
  status: StatusEnum.optional(),
});

const UpdateStatusSchema = z.object({
  status: StatusEnum,
});

const ListQuerySchema = z.object({
  status: StatusEnum.optional(),
  appointmentId: z.string().optional(),
});

export const AdverseEventReportController = {
  create: async (req: Request, res: Response) => {
    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.errors });

    const report = await AdverseEventReportService.create({
      organisationId: req.params.organisationId,
      ...parsed.data,
    });
    return res.status(201).json(report);
  },

  get: async (req: Request, res: Response) => {
    const report = await AdverseEventReportService.get(
      req.params.reportId,
      req.params.organisationId,
    );
    return res.json(report);
  },

  list: async (req: Request, res: Response) => {
    const parsed = ListQuerySchema.safeParse(req.query);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.errors });

    const reports = await AdverseEventReportService.list({
      organisationId: req.params.organisationId,
      ...parsed.data,
    });
    return res.json(reports);
  },

  updateStatus: async (req: Request, res: Response) => {
    const parsed = UpdateStatusSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.errors });

    const report = await AdverseEventReportService.updateStatus(
      req.params.reportId,
      parsed.data.status,
      req.params.organisationId,
    );
    return res.json(report);
  },
};
