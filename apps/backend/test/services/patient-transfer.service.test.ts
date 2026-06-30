import { PatientTransferService } from "../../src/services/patient-transfer.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    patientTransfer: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn() },
}));

import { prisma } from "src/config/prisma";

const mockCreate = prisma.patientTransfer.create as jest.Mock;
const mockFindFirst = prisma.patientTransfer.findFirst as jest.Mock;
const mockFindMany = prisma.patientTransfer.findMany as jest.Mock;
const mockUpdate = prisma.patientTransfer.update as jest.Mock;
const mockDelete = prisma.patientTransfer.delete as jest.Mock;

const baseTransfer = {
  id: "pt-1",
  organisationId: "org-1",
  patientId: "pat-1",
  encounterId: "enc-1",
  transferType: "REFERRAL_SPECIALIST" as const,
  receivingFacility: "City Veterinary Referral Centre",
  receivingVetName: "Dr. Sarah Jones",
  receivingVetContact: "+44 20 1234 5678",
  transferredAt: new Date("2026-06-30T14:00:00Z"),
  transferredBy: "vet-1",
  chiefComplaint: "Suspected GDV",
  currentDiagnoses: "Gastric dilatation-volvulus, early stage",
  ongoingTreatments: "IV fluids, gastroprotectants",
  medicationsDispensed: null,
  caseSummary:
    "7yo male Weimaraner presented with distended abdomen and retching.",
  criticalAlerts: "NPO — possible surgical candidate",
  ownerInformed: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => jest.clearAllMocks());

describe("PatientTransferService.create", () => {
  it("creates a specialist referral transfer record", async () => {
    mockCreate.mockResolvedValue(baseTransfer);
    const result = await PatientTransferService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      encounterId: "enc-1",
      transferType: "REFERRAL_SPECIALIST",
      receivingFacility: "City Veterinary Referral Centre",
      transferredAt: new Date("2026-06-30T14:00:00Z"),
      transferredBy: "vet-1",
      ownerInformed: true,
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          transferType: "REFERRAL_SPECIALIST",
          receivingFacility: "City Veterinary Referral Centre",
          ownerInformed: true,
        }),
      }),
    );
    expect(result.transferType).toBe("REFERRAL_SPECIALIST");
    expect(result.ownerInformed).toBe(true);
  });
});

describe("PatientTransferService.get", () => {
  it("returns transfer when found", async () => {
    mockFindFirst.mockResolvedValue(baseTransfer);
    const result = await PatientTransferService.get("pt-1", "org-1");
    expect(result.id).toBe("pt-1");
    expect(result.receivingVetName).toBe("Dr. Sarah Jones");
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      PatientTransferService.get("pt-x", "org-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("PatientTransferService.list", () => {
  it("filters by transferType", async () => {
    mockFindMany.mockResolvedValue([baseTransfer]);
    await PatientTransferService.list({
      organisationId: "org-1",
      transferType: "REFERRAL_SPECIALIST",
    });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ transferType: "REFERRAL_SPECIALIST" }),
      }),
    );
  });

  it("filters by patientId", async () => {
    mockFindMany.mockResolvedValue([baseTransfer]);
    await PatientTransferService.list({
      organisationId: "org-1",
      patientId: "pat-1",
    });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ patientId: "pat-1" }),
      }),
    );
  });
});

describe("PatientTransferService.update", () => {
  it("adds a case summary after the fact", async () => {
    const updated = {
      ...baseTransfer,
      caseSummary: "Updated post-op summary.",
    };
    mockFindFirst.mockResolvedValue(baseTransfer);
    mockUpdate.mockResolvedValue(updated);
    const result = await PatientTransferService.update("pt-1", "org-1", {
      caseSummary: "Updated post-op summary.",
    });
    expect(result.caseSummary).toBe("Updated post-op summary.");
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      PatientTransferService.update("pt-x", "org-1", { ownerInformed: true }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("PatientTransferService.delete", () => {
  it("deletes a transfer record", async () => {
    mockFindFirst.mockResolvedValue(baseTransfer);
    mockDelete.mockResolvedValue(undefined);
    await PatientTransferService.delete("pt-1", "org-1");
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "pt-1" } });
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      PatientTransferService.delete("pt-x", "org-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
