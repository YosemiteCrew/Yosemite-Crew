import { AdverseEventReportService } from "../../src/services/adverse-event-report.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    adverseEventReport: {
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

const mockCreate = prisma.adverseEventReport.create as jest.Mock;
const mockFindFirst = prisma.adverseEventReport.findFirst as jest.Mock;
const mockFindMany = prisma.adverseEventReport.findMany as jest.Mock;
const mockUpdate = prisma.adverseEventReport.update as jest.Mock;

const baseReport = {
  id: "ae-1",
  organisationId: "org-1",
  appointmentId: "apt-1",
  reporter: { name: "Dr Smith", licenceNumber: "VET-12345" },
  patient: { name: "Bella", species: "Canine" },
  product: { name: "Rimadyl", batchNumber: "B-2026-001" },
  destinations: { vmr: true, manufacturer: false },
  consent: { ownerSigned: true },
  status: "SUBMITTED" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => jest.clearAllMocks());

describe("AdverseEventReportService.create", () => {
  it("creates an adverse event report with SUBMITTED status", async () => {
    mockCreate.mockResolvedValue(baseReport);
    const result = await AdverseEventReportService.create({
      organisationId: "org-1",
      appointmentId: "apt-1",
      reporter: { name: "Dr Smith", licenceNumber: "VET-12345" },
      patient: { name: "Bella", species: "Canine" },
      product: { name: "Rimadyl", batchNumber: "B-2026-001" },
      destinations: { vmr: true },
      consent: { ownerSigned: true },
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "SUBMITTED" }),
      }),
    );
    expect(result.status).toBe("SUBMITTED");
  });
});

describe("AdverseEventReportService.get", () => {
  it("returns report when found", async () => {
    mockFindFirst.mockResolvedValue(baseReport);
    const result = await AdverseEventReportService.get("ae-1", "org-1");
    expect(result.id).toBe("ae-1");
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      AdverseEventReportService.get("ae-x", "org-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("AdverseEventReportService.list", () => {
  it("filters by status", async () => {
    mockFindMany.mockResolvedValue([baseReport]);
    await AdverseEventReportService.list({
      organisationId: "org-1",
      status: "REVIEWING",
    });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "REVIEWING" }),
      }),
    );
  });

  it("filters by appointmentId", async () => {
    mockFindMany.mockResolvedValue([baseReport]);
    await AdverseEventReportService.list({
      organisationId: "org-1",
      appointmentId: "apt-1",
    });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ appointmentId: "apt-1" }),
      }),
    );
  });
});

describe("AdverseEventReportService.updateStatus", () => {
  it("moves report to REVIEWING", async () => {
    const reviewing = { ...baseReport, status: "REVIEWING" as const };
    mockFindFirst.mockResolvedValue(baseReport);
    mockUpdate.mockResolvedValue(reviewing);
    const result = await AdverseEventReportService.updateStatus(
      "ae-1",
      "REVIEWING",
      "org-1",
    );
    expect(result.status).toBe("REVIEWING");
  });

  it("throws 409 when report is already CLOSED", async () => {
    mockFindFirst.mockResolvedValue({ ...baseReport, status: "CLOSED" });
    await expect(
      AdverseEventReportService.updateStatus("ae-1", "FORWARDED", "org-1"),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      AdverseEventReportService.updateStatus("ae-x", "REVIEWING"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
