import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class ClinicEquipmentError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "ClinicEquipmentError";
  }
}

type EquipmentStatus =
  | "OPERATIONAL"
  | "UNDER_MAINTENANCE"
  | "DECOMMISSIONED"
  | "AWAITING_REPAIR";
type MaintenanceType =
  | "ROUTINE_SERVICE"
  | "CALIBRATION"
  | "REPAIR"
  | "INSPECTION"
  | "CLEANING"
  | "REPLACEMENT"
  | "SOFTWARE_UPDATE";

export interface CreateEquipmentParams {
  organisationId: string;
  name: string;
  model?: string;
  serialNumber?: string;
  manufacturer?: string;
  purchasedAt?: Date;
  warrantyExpiry?: Date;
  status?: EquipmentStatus;
  locationNotes?: string;
  notes?: string;
}

export interface AddMaintenanceLogParams {
  maintenanceType: MaintenanceType;
  performedBy?: string;
  vendor?: string;
  scheduledAt?: Date;
  performedAt: Date;
  nextDueAt?: Date;
  cost?: number;
  currency?: string;
  passed?: boolean;
  notes?: string;
}

const equipmentSelect = {
  id: true,
  organisationId: true,
  name: true,
  model: true,
  serialNumber: true,
  manufacturer: true,
  purchasedAt: true,
  warrantyExpiry: true,
  status: true,
  locationNotes: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ClinicEquipmentSelect;

const maintenanceLogSelect = {
  id: true,
  equipmentId: true,
  maintenanceType: true,
  performedBy: true,
  vendor: true,
  scheduledAt: true,
  performedAt: true,
  nextDueAt: true,
  cost: true,
  currency: true,
  passed: true,
  notes: true,
  createdAt: true,
} satisfies Prisma.EquipmentMaintenanceLogSelect;

const assertEquipment = async (id: string, organisationId: string) => {
  const equipment = await prisma.clinicEquipment.findFirst({
    where: { id, organisationId },
    select: equipmentSelect,
  });
  if (!equipment) {
    throw new ClinicEquipmentError("Equipment not found.", 404);
  }
  return equipment;
};

export const ClinicEquipmentService = {
  async create(params: CreateEquipmentParams) {
    const { organisationId, name, ...rest } = params;
    return prisma.clinicEquipment.create({
      data: {
        organisationId,
        name,
        model: rest.model ?? null,
        serialNumber: rest.serialNumber ?? null,
        manufacturer: rest.manufacturer ?? null,
        purchasedAt: rest.purchasedAt ?? null,
        warrantyExpiry: rest.warrantyExpiry ?? null,
        status: rest.status ?? "OPERATIONAL",
        locationNotes: rest.locationNotes ?? null,
        notes: rest.notes ?? null,
      },
      select: equipmentSelect,
    });
  },

  async get(id: string, organisationId: string) {
    return assertEquipment(id, organisationId);
  },

  async list(params: {
    organisationId: string;
    status?: EquipmentStatus;
    search?: string;
  }) {
    const { organisationId, status, search } = params;
    return prisma.clinicEquipment.findMany({
      where: {
        organisationId,
        ...(status ? { status } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { manufacturer: { contains: search, mode: "insensitive" } },
                { serialNumber: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: equipmentSelect,
      orderBy: { name: "asc" },
    });
  },

  async update(
    id: string,
    organisationId: string,
    params: Partial<Omit<CreateEquipmentParams, "organisationId">>,
  ) {
    await assertEquipment(id, organisationId);

    const data: Prisma.ClinicEquipmentUpdateInput = {};
    if (params.name !== undefined) data.name = params.name;
    if (params.model !== undefined) data.model = params.model;
    if (params.serialNumber !== undefined)
      data.serialNumber = params.serialNumber;
    if (params.manufacturer !== undefined)
      data.manufacturer = params.manufacturer;
    if (params.purchasedAt !== undefined) data.purchasedAt = params.purchasedAt;
    if (params.warrantyExpiry !== undefined)
      data.warrantyExpiry = params.warrantyExpiry;
    if (params.status !== undefined) data.status = params.status;
    if (params.locationNotes !== undefined)
      data.locationNotes = params.locationNotes;
    if (params.notes !== undefined) data.notes = params.notes;

    return prisma.clinicEquipment.update({
      where: { id },
      data,
      select: equipmentSelect,
    });
  },

  async delete(id: string, organisationId: string) {
    const existing = await assertEquipment(id, organisationId);
    if (existing.status !== "DECOMMISSIONED") {
      throw new ClinicEquipmentError(
        "Only DECOMMISSIONED equipment can be deleted. Update the status first.",
        409,
      );
    }
    await prisma.clinicEquipment.delete({ where: { id } });
  },

  async addMaintenanceLog(
    id: string,
    organisationId: string,
    params: AddMaintenanceLogParams,
    performedByUserId?: string,
  ) {
    await assertEquipment(id, organisationId);

    const log = await prisma.equipmentMaintenanceLog.create({
      data: {
        equipmentId: id,
        maintenanceType: params.maintenanceType,
        performedBy: params.performedBy ?? null,
        vendor: params.vendor ?? null,
        scheduledAt: params.scheduledAt ?? null,
        performedAt: params.performedAt,
        nextDueAt: params.nextDueAt ?? null,
        cost: params.cost ?? null,
        currency: params.currency ?? null,
        passed: params.passed ?? null,
        notes: params.notes ?? null,
      },
      select: maintenanceLogSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: "",
      eventType: "EQUIPMENT_MAINTENANCE_LOGGED",
      actorType: "PMS_USER",
      actorId: performedByUserId ?? null,
      entityType: "COMPANION",
      entityId: id,
      metadata: {
        maintenanceType: params.maintenanceType,
        passed: params.passed,
      },
    });

    return log;
  },

  async listMaintenanceLogs(id: string, organisationId: string) {
    await assertEquipment(id, organisationId);
    return prisma.equipmentMaintenanceLog.findMany({
      where: { equipmentId: id },
      select: maintenanceLogSelect,
      orderBy: { performedAt: "desc" },
    });
  },
};
