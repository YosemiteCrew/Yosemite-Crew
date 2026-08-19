import { Request, Response } from "express";
import { z } from "zod";
import { ClinicEquipmentService } from "src/services/clinic-equipment.service";

const StatusEnum = z.enum([
  "OPERATIONAL",
  "UNDER_MAINTENANCE",
  "DECOMMISSIONED",
  "AWAITING_REPAIR",
]);

const MaintenanceTypeEnum = z.enum([
  "ROUTINE_SERVICE",
  "CALIBRATION",
  "REPAIR",
  "INSPECTION",
  "CLEANING",
  "REPLACEMENT",
  "SOFTWARE_UPDATE",
]);

const CreateEquipmentSchema = z.object({
  name: z.string(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  manufacturer: z.string().optional(),
  purchasedAt: z
    .string()
    .datetime()
    .transform((v) => new Date(v))
    .optional(),
  warrantyExpiry: z
    .string()
    .datetime()
    .transform((v) => new Date(v))
    .optional(),
  status: StatusEnum.optional(),
  locationNotes: z.string().optional(),
  notes: z.string().optional(),
});

const AddMaintenanceLogSchema = z.object({
  maintenanceType: MaintenanceTypeEnum,
  performedBy: z.string().optional(),
  vendor: z.string().optional(),
  scheduledAt: z
    .string()
    .datetime()
    .transform((v) => new Date(v))
    .optional(),
  performedAt: z
    .string()
    .datetime()
    .transform((v) => new Date(v)),
  nextDueAt: z
    .string()
    .datetime()
    .transform((v) => new Date(v))
    .optional(),
  cost: z.number().positive().optional(),
  currency: z.string().optional(),
  passed: z.boolean().optional(),
  notes: z.string().optional(),
});

const ListQuerySchema = z.object({
  status: StatusEnum.optional(),
  search: z.string().optional(),
});

export const ClinicEquipmentController = {
  create: async (req: Request, res: Response) => {
    const parsed = CreateEquipmentSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.errors });

    const equipment = await ClinicEquipmentService.create({
      organisationId: req.params.organisationId,
      ...parsed.data,
    });
    return res.status(201).json(equipment);
  },

  get: async (req: Request, res: Response) => {
    const equipment = await ClinicEquipmentService.get(
      req.params.equipmentId,
      req.params.organisationId,
    );
    return res.json(equipment);
  },

  list: async (req: Request, res: Response) => {
    const parsed = ListQuerySchema.safeParse(req.query);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.errors });

    const results = await ClinicEquipmentService.list({
      organisationId: req.params.organisationId,
      ...parsed.data,
    });
    return res.json(results);
  },

  update: async (req: Request, res: Response) => {
    const parsed = CreateEquipmentSchema.partial().safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.errors });

    const equipment = await ClinicEquipmentService.update(
      req.params.equipmentId,
      req.params.organisationId,
      parsed.data,
    );
    return res.json(equipment);
  },

  delete: async (req: Request, res: Response) => {
    await ClinicEquipmentService.delete(
      req.params.equipmentId,
      req.params.organisationId,
    );
    return res.status(204).send();
  },

  addMaintenanceLog: async (req: Request, res: Response) => {
    const parsed = AddMaintenanceLogSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.errors });

    const log = await ClinicEquipmentService.addMaintenanceLog(
      req.params.equipmentId,
      req.params.organisationId,
      parsed.data,
    );
    return res.status(201).json(log);
  },

  listMaintenanceLogs: async (req: Request, res: Response) => {
    const logs = await ClinicEquipmentService.listMaintenanceLogs(
      req.params.equipmentId,
      req.params.organisationId,
    );
    return res.json(logs);
  },
};
