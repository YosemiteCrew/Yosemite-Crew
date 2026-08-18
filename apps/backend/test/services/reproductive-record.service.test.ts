import { ReproductiveRecordService } from "../../src/services/reproductive-record.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    reproductiveRecord: {
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

const mockCreate = prisma.reproductiveRecord.create as jest.Mock;
const mockFindFirst = prisma.reproductiveRecord.findFirst as jest.Mock;
const mockFindMany = prisma.reproductiveRecord.findMany as jest.Mock;
const mockUpdate = prisma.reproductiveRecord.update as jest.Mock;

const baseRecord = {
  id: "rr-1",
  organisationId: "org-1",
  patientId: "pat-1",
  reproductiveStatus: "INTACT" as const,
  lastHeatDate: null,
  nextHeatExpected: null,
  matingDate: null,
  sireId: null,
  sireName: null,
  pregnancyStatus: null,
  pregnancyConfirmedAt: null,
  expectedWhelp: null,
  litterSizeUltrasound: null,
  litterSizeXray: null,
  actualWhelp: null,
  litterSizeBorn: null,
  litterSizeAlive: null,
  recordedBy: "vet-1",
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => jest.clearAllMocks());

describe("ReproductiveRecordService.create", () => {
  it("creates a record with INTACT status", async () => {
    mockCreate.mockResolvedValue(baseRecord);
    const result = await ReproductiveRecordService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      reproductiveStatus: "INTACT",
      recordedBy: "vet-1",
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reproductiveStatus: "INTACT" }),
      }),
    );
    expect(result.reproductiveStatus).toBe("INTACT");
  });
});

describe("ReproductiveRecordService.get", () => {
  it("returns record when found", async () => {
    mockFindFirst.mockResolvedValue(baseRecord);
    const result = await ReproductiveRecordService.get("rr-1", "org-1");
    expect(result.id).toBe("rr-1");
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      ReproductiveRecordService.get("rr-x", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("ReproductiveRecordService.list", () => {
  it("returns records filtered by status", async () => {
    mockFindMany.mockResolvedValue([baseRecord]);
    await ReproductiveRecordService.list({
      organisationId: "org-1",
      reproductiveStatus: "INTACT",
    });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ reproductiveStatus: "INTACT" }),
      }),
    );
  });
});

describe("ReproductiveRecordService.update", () => {
  it("updates pregnancy status", async () => {
    const pregnancyDate = new Date("2026-07-01");
    const updated = {
      ...baseRecord,
      pregnancyStatus: "CONFIRMED" as const,
      pregnancyConfirmedAt: pregnancyDate,
    };
    mockFindFirst.mockResolvedValue(baseRecord);
    mockUpdate.mockResolvedValue(updated);
    const result = await ReproductiveRecordService.update(
      "rr-1",
      "org-1",
      { pregnancyStatus: "CONFIRMED", pregnancyConfirmedAt: pregnancyDate },
      "vet-2",
    );
    expect(result.pregnancyStatus).toBe("CONFIRMED");
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      ReproductiveRecordService.update("rr-x", "org-1", { notes: "x" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
