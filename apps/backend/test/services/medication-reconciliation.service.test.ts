import { MedicationReconciliationService } from "../../src/services/medication-reconciliation.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    medicationReconciliation: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn() },
}));

import { prisma } from "src/config/prisma";

const mockCreate = prisma.medicationReconciliation.create as jest.Mock;
const mockFindFirst = prisma.medicationReconciliation.findFirst as jest.Mock;
const mockFindMany = prisma.medicationReconciliation.findMany as jest.Mock;
const mockUpdate = prisma.medicationReconciliation.update as jest.Mock;

const baseRec = {
  id: "mr-1",
  organisationId: "org-1",
  patientId: "pat-1",
  encounterId: null,
  status: "IN_PROGRESS" as const,
  reconciledBy: null,
  reconciledAt: null,
  homeMedications: [
    { name: "Carprofen", dose: "50mg", frequency: "q12h", route: "oral" },
  ],
  hospitalOrders: [
    { name: "Carprofen", dose: "50mg", frequency: "q24h", route: "oral" },
  ],
  discrepancies: null,
  reviewedBy: null,
  reviewedAt: null,
  reviewNotes: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => jest.clearAllMocks());

describe("MedicationReconciliationService.create", () => {
  it("creates a reconciliation with IN_PROGRESS status", async () => {
    mockCreate.mockResolvedValue(baseRec);
    const result = await MedicationReconciliationService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      homeMedications: [
        { name: "Carprofen", dose: "50mg", frequency: "q12h", route: "oral" },
      ],
      hospitalOrders: [
        { name: "Carprofen", dose: "50mg", frequency: "q24h", route: "oral" },
      ],
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "IN_PROGRESS" }),
      }),
    );
    expect(result.status).toBe("IN_PROGRESS");
  });
});

describe("MedicationReconciliationService.get", () => {
  it("returns record when found", async () => {
    mockFindFirst.mockResolvedValue(baseRec);
    const result = await MedicationReconciliationService.get("mr-1", "org-1");
    expect(result.id).toBe("mr-1");
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      MedicationReconciliationService.get("mr-x", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("MedicationReconciliationService.list", () => {
  it("returns records filtered by status", async () => {
    mockFindMany.mockResolvedValue([baseRec]);
    await MedicationReconciliationService.list({
      organisationId: "org-1",
      status: "IN_PROGRESS",
    });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "IN_PROGRESS" }),
      }),
    );
  });
});

describe("MedicationReconciliationService.update", () => {
  it("updates an IN_PROGRESS reconciliation", async () => {
    const updated = { ...baseRec, notes: "Updated" };
    mockFindFirst.mockResolvedValue(baseRec);
    mockUpdate.mockResolvedValue(updated);
    const result = await MedicationReconciliationService.update(
      "mr-1",
      "org-1",
      { notes: "Updated" },
    );
    expect(mockUpdate).toHaveBeenCalled();
    expect(result.notes).toBe("Updated");
  });

  it("throws 409 when COMPLETED", async () => {
    mockFindFirst.mockResolvedValue({ ...baseRec, status: "COMPLETED" });
    await expect(
      MedicationReconciliationService.update("mr-1", "org-1", { notes: "x" }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe("MedicationReconciliationService.complete", () => {
  it("sets status to COMPLETED and stamps reconciledAt", async () => {
    const completed = {
      ...baseRec,
      status: "COMPLETED" as const,
      reconciledAt: new Date(),
    };
    mockFindFirst.mockResolvedValue(baseRec);
    mockUpdate.mockResolvedValue(completed);
    const result = await MedicationReconciliationService.complete(
      "mr-1",
      "org-1",
      {},
      "vet-1",
    );
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "COMPLETED" }),
      }),
    );
    expect(result.status).toBe("COMPLETED");
  });
});

describe("MedicationReconciliationService.review", () => {
  it("sets PENDING_REVIEW when source is COMPLETED", async () => {
    const reviewed = {
      ...baseRec,
      status: "PENDING_REVIEW" as const,
      reviewedBy: "vet-2",
    };
    mockFindFirst.mockResolvedValue({ ...baseRec, status: "COMPLETED" });
    mockUpdate.mockResolvedValue(reviewed);
    const result = await MedicationReconciliationService.review(
      "mr-1",
      "org-1",
      { reviewNotes: "Looks good" },
      "vet-2",
    );
    expect(result.status).toBe("PENDING_REVIEW");
  });

  it("throws 409 when not COMPLETED", async () => {
    mockFindFirst.mockResolvedValue(baseRec);
    await expect(
      MedicationReconciliationService.review("mr-1", "org-1", {}, "vet-2"),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
