import { AdmissionService } from "../../src/services/admission.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    admission: {
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

const mockCreate = prisma.admission.create as jest.Mock;
const mockFindFirst = prisma.admission.findFirst as jest.Mock;
const mockFindMany = prisma.admission.findMany as jest.Mock;
const mockUpdate = prisma.admission.update as jest.Mock;

const baseAdmission = {
  encounterId: "enc-1",
  organisationId: "org-1",
  patientId: "pat-1",
  unitId: "unit-A",
  expectedStayDays: 3,
  admittedAt: new Date("2026-06-30T08:00:00Z"),
  admittedBy: "vet-1",
  dischargedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => jest.clearAllMocks());

describe("AdmissionService.admit", () => {
  it("creates an admission for an encounter", async () => {
    mockFindFirst.mockResolvedValue(null);
    mockCreate.mockResolvedValue(baseAdmission);
    const result = await AdmissionService.admit({
      encounterId: "enc-1",
      organisationId: "org-1",
      patientId: "pat-1",
      unitId: "unit-A",
      expectedStayDays: 3,
      admittedAt: new Date("2026-06-30T08:00:00Z"),
      admittedBy: "vet-1",
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          encounterId: "enc-1",
          unitId: "unit-A",
          expectedStayDays: 3,
        }),
      }),
    );
    expect(result.patientId).toBe("pat-1");
    expect(result.dischargedAt).toBeNull();
  });

  it("throws 409 when active admission already exists for encounter", async () => {
    mockFindFirst.mockResolvedValue({ ...baseAdmission, dischargedAt: null });
    await expect(
      AdmissionService.admit({
        encounterId: "enc-1",
        organisationId: "org-1",
        patientId: "pat-1",
        admittedAt: new Date(),
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe("AdmissionService.get", () => {
  it("returns admission when found", async () => {
    mockFindFirst.mockResolvedValue(baseAdmission);
    const result = await AdmissionService.get("enc-1", "org-1");
    expect(result.encounterId).toBe("enc-1");
    expect(result.unitId).toBe("unit-A");
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(AdmissionService.get("enc-x", "org-1")).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("AdmissionService.list", () => {
  it("filters active admissions", async () => {
    mockFindMany.mockResolvedValue([baseAdmission]);
    await AdmissionService.list({ organisationId: "org-1", active: true });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ dischargedAt: null }),
      }),
    );
  });

  it("filters by patientId", async () => {
    mockFindMany.mockResolvedValue([baseAdmission]);
    await AdmissionService.list({
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

describe("AdmissionService.update", () => {
  it("updates unit assignment", async () => {
    const updated = { ...baseAdmission, unitId: "unit-B" };
    mockFindFirst.mockResolvedValue(baseAdmission);
    mockUpdate.mockResolvedValue(updated);
    const result = await AdmissionService.update("enc-1", "org-1", {
      unitId: "unit-B",
    });
    expect(result.unitId).toBe("unit-B");
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      AdmissionService.update("enc-x", "org-1", { unitId: "unit-B" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("AdmissionService.discharge", () => {
  it("records discharge timestamp", async () => {
    const dischargedAt = new Date("2026-07-03T10:00:00Z");
    const discharged = { ...baseAdmission, dischargedAt };
    mockFindFirst.mockResolvedValue(baseAdmission);
    mockUpdate.mockResolvedValue(discharged);
    const result = await AdmissionService.discharge("enc-1", "org-1", {
      dischargedAt,
      dischargedBy: "vet-2",
    });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ dischargedAt }),
      }),
    );
    expect(result.dischargedAt).toEqual(dischargedAt);
  });

  it("throws 409 when patient already discharged", async () => {
    mockFindFirst.mockResolvedValue({
      ...baseAdmission,
      dischargedAt: new Date("2026-07-01"),
    });
    await expect(
      AdmissionService.discharge("enc-1", "org-1", {
        dischargedAt: new Date(),
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("throws 404 when admission not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      AdmissionService.discharge("enc-x", "org-1", {
        dischargedAt: new Date(),
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
