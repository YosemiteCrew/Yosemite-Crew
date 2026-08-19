import { Request, Response } from "express";
import { z } from "zod";
import { PatientTransferService } from "src/services/patient-transfer.service";

const TransferTypeEnum = z.enum([
  "REFERRAL_SPECIALIST",
  "REFERRAL_EMERGENCY",
  "INTER_HOSPITAL",
  "CLIENT_TRANSFER",
  "DISCHARGE_HOME",
]);

const CreateTransferSchema = z.object({
  patientId: z.string(),
  encounterId: z.string().optional(),
  transferType: TransferTypeEnum,
  receivingFacility: z.string(),
  receivingVetName: z.string().optional(),
  receivingVetContact: z.string().optional(),
  transferredAt: z
    .string()
    .datetime()
    .transform((v) => new Date(v)),
  transferredBy: z.string().optional(),
  chiefComplaint: z.string().optional(),
  currentDiagnoses: z.string().optional(),
  ongoingTreatments: z.string().optional(),
  medicationsDispensed: z.string().optional(),
  caseSummary: z.string().optional(),
  criticalAlerts: z.string().optional(),
  ownerInformed: z.boolean().optional(),
});

const UpdateTransferSchema = CreateTransferSchema.omit({
  patientId: true,
}).partial();

const ListQuerySchema = z.object({
  patientId: z.string().optional(),
  transferType: TransferTypeEnum.optional(),
});

export const PatientTransferController = {
  create: async (req: Request, res: Response) => {
    const parsed = CreateTransferSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.errors });

    const transfer = await PatientTransferService.create({
      organisationId: req.params.organisationId,
      ...parsed.data,
    });
    return res.status(201).json(transfer);
  },

  get: async (req: Request, res: Response) => {
    const transfer = await PatientTransferService.get(
      req.params.transferId,
      req.params.organisationId,
    );
    return res.json(transfer);
  },

  list: async (req: Request, res: Response) => {
    const parsed = ListQuerySchema.safeParse(req.query);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.errors });

    const results = await PatientTransferService.list({
      organisationId: req.params.organisationId,
      ...parsed.data,
    });
    return res.json(results);
  },

  update: async (req: Request, res: Response) => {
    const parsed = UpdateTransferSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.errors });

    const transfer = await PatientTransferService.update(
      req.params.transferId,
      req.params.organisationId,
      parsed.data,
    );
    return res.json(transfer);
  },

  delete: async (req: Request, res: Response) => {
    await PatientTransferService.delete(
      req.params.transferId,
      req.params.organisationId,
    );
    return res.status(204).send();
  },
};
