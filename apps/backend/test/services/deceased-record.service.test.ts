import { DeceasedRecordService } from "../../src/services/deceased-record.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    deceasedRecord: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn() },
}));

import { prisma } from "src/config/prisma";

const mockCreate = prisma.deceasedRecord.create as jest.Mock;
const mockFindFirst = prisma.deceasedRecord.findFirst as jest.Mock;
const mockFindUnique = prisma.deceasedRecord.findUnique as jest.Mock;
const mockFindMany = prisma.deceasedRecord.findMany as jest.Mock;
const mockUpdate = prisma.deceasedRecord.update as jest.Mock;

const baseRecord = {
  id: "dr-1",
  organisationId: "org-1",
  patientId: "pat-1",
  deceasedAt: new Date("2026-06-30T09:00:00Z"),
  causeOfDeathType: "EUTHANASIA" as const,
  causeOfDeathDetail: "Advanced cancer",
  bodyWeightKg: 8.5,
  bodyConditionScore: 2,
  necropsyRequested: false,
  necropsyFacility: null,
  bodyDisposition: "PRIVATE_CREMATION" as const,
  ownerNotifiedAt: new Date("2026-06-30T09:30:00Z"),
  certifiedBy: "vet-1",
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => jest.clearAllMocks());

describe("DeceasedRecordService.create", () => {
  it("creates a deceased record for euthanasia", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue(baseRecord);
    const result = await DeceasedRecordService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      deceasedAt: new Date("2026-06-30T09:00:00Z"),
      causeOfDeathType: "EUTHANASIA",
      causeOfDeathDetail: "Advanced cancer",
      bodyDisposition: "PRIVATE_CREMATION",
      certifiedBy: "vet-1",
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          causeOfDeathType: "EUTHANASIA",
          patientId: "pat-1",
        }),
      }),
    );
    expect(result.causeOfDeathType).toBe("EUTHANASIA");
    expect(result.bodyDisposition).toBe("PRIVATE_CREMATION");
  });

  it("throws 409 if patient already has a deceased record", async () => {
    mockFindUnique.mockResolvedValue({ id: "dr-existing" });
    await expect(
      DeceasedRecordService.create({
        organisationId: "org-1",
        patientId: "pat-1",
        deceasedAt: new Date(),
        causeOfDeathType: "EUTHANASIA",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe("DeceasedRecordService.get", () => {
  it("returns record when found", async () => {
    mockFindFirst.mockResolvedValue(baseRecord);
    const result = await DeceasedRecordService.get("dr-1", "org-1");
    expect(result.id).toBe("dr-1");
    expect(result.certifiedBy).toBe("vet-1");
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      DeceasedRecordService.get("dr-x", "org-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("DeceasedRecordService.getByPatient", () => {
  it("returns record by patientId", async () => {
    mockFindFirst.mockResolvedValue(baseRecord);
    const result = await DeceasedRecordService.getByPatient("pat-1", "org-1");
    expect(result.patientId).toBe("pat-1");
  });

  it("throws 404 when no record exists for patient", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      DeceasedRecordService.getByPatient("pat-x", "org-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("DeceasedRecordService.list", () => {
  it("filters by cause of death type", async () => {
    mockFindMany.mockResolvedValue([baseRecord]);
    await DeceasedRecordService.list({
      organisationId: "org-1",
      causeOfDeathType: "EUTHANASIA",
    });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ causeOfDeathType: "EUTHANASIA" }),
      }),
    );
  });
});

describe("DeceasedRecordService.update", () => {
  it("updates necropsy details", async () => {
    const updated = {
      ...baseRecord,
      necropsyRequested: true,
      necropsyFacility: "State Vet Lab",
    };
    mockFindFirst.mockResolvedValue(baseRecord);
    mockUpdate.mockResolvedValue(updated);
    const result = await DeceasedRecordService.update("dr-1", "org-1", {
      necropsyRequested: true,
      necropsyFacility: "State Vet Lab",
    });
    expect(result.necropsyRequested).toBe(true);
    expect(result.necropsyFacility).toBe("State Vet Lab");
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      DeceasedRecordService.update("dr-x", "org-1", { notes: "x" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
