import { AftercarePlanService } from "../../src/services/aftercare-plan.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    aftercarePlan: {
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

const mockCreate = prisma.aftercarePlan.create as jest.Mock;
const mockFindFirst = prisma.aftercarePlan.findFirst as jest.Mock;
const mockFindMany = prisma.aftercarePlan.findMany as jest.Mock;
const mockUpdate = prisma.aftercarePlan.update as jest.Mock;
const mockDelete = prisma.aftercarePlan.delete as jest.Mock;

const basePlan = {
  id: "ac-1",
  organisationId: "org-1",
  patientId: "pat-1",
  type: "CREMATION_PRIVATE" as const,
  provider: "Forever Paws",
  estimatedCost: 350,
  depositPaid: 100,
  pawPrintRequested: true,
  furClippingRequested: false,
  urnsRequested: 1,
  instructions: "Please include a card",
  certificateNumber: null,
  completedAt: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => jest.clearAllMocks());

describe("AftercarePlanService.create", () => {
  it("creates a private cremation plan with add-ons", async () => {
    mockCreate.mockResolvedValue(basePlan);
    const result = await AftercarePlanService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      type: "CREMATION_PRIVATE",
      provider: "Forever Paws",
      pawPrintRequested: true,
      urnsRequested: 1,
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "CREMATION_PRIVATE",
          pawPrintRequested: true,
        }),
      }),
    );
    expect(result.type).toBe("CREMATION_PRIVATE");
    expect(result.pawPrintRequested).toBe(true);
  });
});

describe("AftercarePlanService.get", () => {
  it("returns plan when found", async () => {
    mockFindFirst.mockResolvedValue(basePlan);
    const result = await AftercarePlanService.get("ac-1", "org-1");
    expect(result.id).toBe("ac-1");
    expect(result.estimatedCost).toBe(350);
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      AftercarePlanService.get("ac-x", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("AftercarePlanService.list", () => {
  it("filters by completion status", async () => {
    mockFindMany.mockResolvedValue([basePlan]);
    await AftercarePlanService.list({
      organisationId: "org-1",
      completed: false,
    });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ completedAt: null }),
      }),
    );
  });
});

describe("AftercarePlanService.update", () => {
  it("marks plan as completed with certificate", async () => {
    const updated = {
      ...basePlan,
      certificateNumber: "FP-2026-001",
      completedAt: new Date("2026-07-01"),
    };
    mockFindFirst.mockResolvedValue(basePlan);
    mockUpdate.mockResolvedValue(updated);
    const result = await AftercarePlanService.update("ac-1", "org-1", {
      certificateNumber: "FP-2026-001",
      completedAt: new Date("2026-07-01"),
    });
    expect(result.certificateNumber).toBe("FP-2026-001");
    expect(result.completedAt).toBeDefined();
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      AftercarePlanService.update("ac-x", "org-1", { notes: "x" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("AftercarePlanService.delete", () => {
  it("deletes a plan", async () => {
    mockFindFirst.mockResolvedValue(basePlan);
    mockDelete.mockResolvedValue(undefined);
    await AftercarePlanService.delete("ac-1", "org-1");
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "ac-1" } });
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      AftercarePlanService.delete("ac-x", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
