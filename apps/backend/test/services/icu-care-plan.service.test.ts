import { IcuCarePlanService } from "../../src/services/icu-care-plan.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    icuCarePlan: {
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

const mockCreate = prisma.icuCarePlan.create as jest.Mock;
const mockFindFirst = prisma.icuCarePlan.findFirst as jest.Mock;
const mockFindMany = prisma.icuCarePlan.findMany as jest.Mock;
const mockUpdate = prisma.icuCarePlan.update as jest.Mock;

const basePlan = {
  id: "icu-1",
  organisationId: "org-1",
  patientId: "pat-1",
  encounterId: null,
  status: "ACTIVE" as const,
  admittedAt: new Date("2026-06-30T07:00:00Z"),
  onVentilator: false,
  onOxygenSupport: true,
  hasUrinaryCatheter: false,
  hasCentralLine: false,
  hasDrain: false,
  devices: null,
  dailyGoals: "Stabilise respiratory function",
  nursingFrequency: "q2h vitals",
  alertThresholds: null,
  primaryVet: "vet-1",
  nursePrimary: null,
  anticipatedDischarge: null,
  dischargedAt: null,
  dischargeSummary: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => jest.clearAllMocks());

describe("IcuCarePlanService.create", () => {
  it("creates a plan with ACTIVE status", async () => {
    mockCreate.mockResolvedValue(basePlan);
    const result = await IcuCarePlanService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      admittedAt: new Date("2026-06-30T07:00:00Z"),
      onOxygenSupport: true,
      primaryVet: "vet-1",
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "ACTIVE" }),
      }),
    );
    expect(result.status).toBe("ACTIVE");
  });
});

describe("IcuCarePlanService.get", () => {
  it("returns plan when found", async () => {
    mockFindFirst.mockResolvedValue(basePlan);
    const result = await IcuCarePlanService.get("icu-1", "org-1");
    expect(result.id).toBe("icu-1");
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      IcuCarePlanService.get("icu-x", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("IcuCarePlanService.list", () => {
  it("returns plans for an organisation", async () => {
    mockFindMany.mockResolvedValue([basePlan]);
    const result = await IcuCarePlanService.list({ organisationId: "org-1" });
    expect(result).toHaveLength(1);
  });

  it("filters by status when provided", async () => {
    mockFindMany.mockResolvedValue([]);
    await IcuCarePlanService.list({
      organisationId: "org-1",
      status: "DISCHARGED",
    });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "DISCHARGED" }),
      }),
    );
  });
});

describe("IcuCarePlanService.update", () => {
  it("updates an ACTIVE plan", async () => {
    const updated = { ...basePlan, onVentilator: true };
    mockFindFirst.mockResolvedValue(basePlan);
    mockUpdate.mockResolvedValue(updated);
    const result = await IcuCarePlanService.update("icu-1", "org-1", {
      onVentilator: true,
    });
    expect(mockUpdate).toHaveBeenCalled();
    expect(result.onVentilator).toBe(true);
  });

  it("throws 409 when plan is not ACTIVE", async () => {
    mockFindFirst.mockResolvedValue({ ...basePlan, status: "DISCHARGED" });
    await expect(
      IcuCarePlanService.update("icu-1", "org-1", { dailyGoals: "rest" }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      IcuCarePlanService.update("icu-x", "org-1", {}),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("IcuCarePlanService.discharge", () => {
  it("sets status to DISCHARGED and stamps dischargedAt", async () => {
    const discharged = {
      ...basePlan,
      status: "DISCHARGED" as const,
      dischargedAt: new Date(),
    };
    mockFindFirst.mockResolvedValue(basePlan);
    mockUpdate.mockResolvedValue(discharged);
    const result = await IcuCarePlanService.discharge(
      "icu-1",
      "org-1",
      { status: "DISCHARGED", dischargeSummary: "Recovered well" },
      "vet-1",
    );
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DISCHARGED" }),
      }),
    );
    expect(result.status).toBe("DISCHARGED");
  });

  it("throws 409 when already closed", async () => {
    mockFindFirst.mockResolvedValue({ ...basePlan, status: "DECEASED" });
    await expect(
      IcuCarePlanService.discharge("icu-1", "org-1", { status: "DISCHARGED" }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
