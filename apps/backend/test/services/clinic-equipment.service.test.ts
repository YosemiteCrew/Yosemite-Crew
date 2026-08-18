import { ClinicEquipmentService } from "../../src/services/clinic-equipment.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    clinicEquipment: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    equipmentMaintenanceLog: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn() },
}));

import { prisma } from "src/config/prisma";

const mockCreate = prisma.clinicEquipment.create as jest.Mock;
const mockFindFirst = prisma.clinicEquipment.findFirst as jest.Mock;
const mockFindMany = prisma.clinicEquipment.findMany as jest.Mock;
const mockUpdate = prisma.clinicEquipment.update as jest.Mock;
const mockDelete = prisma.clinicEquipment.delete as jest.Mock;
const mockLogCreate = prisma.equipmentMaintenanceLog.create as jest.Mock;
const mockLogFindMany = prisma.equipmentMaintenanceLog.findMany as jest.Mock;

const baseEquipment = {
  id: "eq-1",
  organisationId: "org-1",
  name: "Mindray iVet+ Anesthetic Machine",
  model: "iVet+",
  serialNumber: "SN-2026-001",
  manufacturer: "Mindray",
  purchasedAt: new Date("2024-01-15"),
  warrantyExpiry: new Date("2026-01-15"),
  status: "OPERATIONAL" as const,
  locationNotes: "Theatre 1",
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const baseLog = {
  id: "ml-1",
  equipmentId: "eq-1",
  maintenanceType: "ROUTINE_SERVICE" as const,
  performedBy: "Biotech Services Ltd",
  vendor: "Mindray Authorized",
  scheduledAt: new Date("2026-06-30"),
  performedAt: new Date("2026-06-30T10:00:00Z"),
  nextDueAt: new Date("2026-12-30"),
  cost: 350,
  currency: "GBP",
  passed: true,
  notes: "All checks passed. Gas flows calibrated.",
  createdAt: new Date(),
};

beforeEach(() => jest.clearAllMocks());

describe("ClinicEquipmentService.create", () => {
  it("creates an anesthetic machine entry", async () => {
    mockCreate.mockResolvedValue(baseEquipment);
    const result = await ClinicEquipmentService.create({
      organisationId: "org-1",
      name: "Mindray iVet+ Anesthetic Machine",
      manufacturer: "Mindray",
      serialNumber: "SN-2026-001",
      status: "OPERATIONAL",
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Mindray iVet+ Anesthetic Machine",
          status: "OPERATIONAL",
        }),
      }),
    );
    expect(result.manufacturer).toBe("Mindray");
  });
});

describe("ClinicEquipmentService.get", () => {
  it("returns equipment when found", async () => {
    mockFindFirst.mockResolvedValue(baseEquipment);
    const result = await ClinicEquipmentService.get("eq-1", "org-1");
    expect(result.id).toBe("eq-1");
    expect(result.serialNumber).toBe("SN-2026-001");
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      ClinicEquipmentService.get("eq-x", "org-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("ClinicEquipmentService.list", () => {
  it("filters by status", async () => {
    mockFindMany.mockResolvedValue([baseEquipment]);
    await ClinicEquipmentService.list({
      organisationId: "org-1",
      status: "OPERATIONAL",
    });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "OPERATIONAL" }),
      }),
    );
  });

  it("searches by name", async () => {
    mockFindMany.mockResolvedValue([baseEquipment]);
    await ClinicEquipmentService.list({
      organisationId: "org-1",
      search: "Mindray",
    });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              name: { contains: "Mindray", mode: "insensitive" },
            }),
          ]),
        }),
      }),
    );
  });
});

describe("ClinicEquipmentService.update", () => {
  it("marks equipment under maintenance", async () => {
    const updated = { ...baseEquipment, status: "UNDER_MAINTENANCE" as const };
    mockFindFirst.mockResolvedValue(baseEquipment);
    mockUpdate.mockResolvedValue(updated);
    const result = await ClinicEquipmentService.update("eq-1", "org-1", {
      status: "UNDER_MAINTENANCE",
    });
    expect(result.status).toBe("UNDER_MAINTENANCE");
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      ClinicEquipmentService.update("eq-x", "org-1", { name: "X" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("ClinicEquipmentService.delete", () => {
  it("throws 409 when equipment is not DECOMMISSIONED", async () => {
    mockFindFirst.mockResolvedValue(baseEquipment);
    await expect(
      ClinicEquipmentService.delete("eq-1", "org-1"),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("deletes DECOMMISSIONED equipment", async () => {
    mockFindFirst.mockResolvedValue({
      ...baseEquipment,
      status: "DECOMMISSIONED",
    });
    mockDelete.mockResolvedValue(undefined);
    await ClinicEquipmentService.delete("eq-1", "org-1");
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "eq-1" } });
  });
});

describe("ClinicEquipmentService.addMaintenanceLog", () => {
  it("adds a passed routine service log", async () => {
    mockFindFirst.mockResolvedValue(baseEquipment);
    mockLogCreate.mockResolvedValue(baseLog);
    const result = await ClinicEquipmentService.addMaintenanceLog(
      "eq-1",
      "org-1",
      {
        maintenanceType: "ROUTINE_SERVICE",
        performedAt: new Date("2026-06-30T10:00:00Z"),
        passed: true,
      },
    );
    expect(result.maintenanceType).toBe("ROUTINE_SERVICE");
    expect(result.passed).toBe(true);
  });
});

describe("ClinicEquipmentService.listMaintenanceLogs", () => {
  it("lists all maintenance logs for equipment", async () => {
    mockFindFirst.mockResolvedValue(baseEquipment);
    mockLogFindMany.mockResolvedValue([baseLog]);
    const result = await ClinicEquipmentService.listMaintenanceLogs(
      "eq-1",
      "org-1",
    );
    expect(result).toHaveLength(1);
    expect(result[0].maintenanceType).toBe("ROUTINE_SERVICE");
  });
});
