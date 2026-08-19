import {
  PatientFlagService,
  PatientFlagError,
} from "../../src/services/patient-flag.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    patientOrganisation: { findFirst: jest.fn() },
    patientFlag: {
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
import { AuditTrailService } from "../../src/services/audit-trail.service";

const mockCreate = prisma.patientFlag.create as jest.Mock;
const mockFindFirst = prisma.patientFlag.findFirst as jest.Mock;
const mockFindMany = prisma.patientFlag.findMany as jest.Mock;
const mockUpdate = prisma.patientFlag.update as jest.Mock;
const mockAudit = AuditTrailService.recordSafely as jest.Mock;

const activeFlag = {
  id: "flag-1",
  organisationId: "org-1",
  patientId: "pat-1",
  flagType: "AGGRESSION" as const,
  severity: "HIGH" as const,
  title: "Muzzle required",
  description: "Bites during nail trims",
  isActive: true,
  createdBy: "user-1",
  resolvedAt: null,
  resolvedBy: null,
  createdAt: new Date("2026-02-01T09:00:00.000Z"),
  updatedAt: new Date("2026-02-01T09:00:00.000Z"),
};

const resolvedFlag = {
  ...activeFlag,
  isActive: false,
  resolvedAt: new Date("2026-02-10T09:00:00.000Z"),
  resolvedBy: "user-2",
};

beforeEach(() => {
  jest.clearAllMocks();

  // Default: the companion belongs to the caller's organisation, so every

  // pre-existing case keeps its original meaning. Cross-tenant is asserted

  // explicitly in its own test below.

  (prisma.patientOrganisation.findFirst as jest.Mock).mockResolvedValue({
    id: "patient-org-1",
  });
});

describe("PatientFlagService.create", () => {
  it("defaults severity to MEDIUM, activates the flag and records an audit event", async () => {
    mockCreate.mockResolvedValue({ ...activeFlag, severity: "MEDIUM" });

    const result = await PatientFlagService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      flagType: "ESCAPE_RISK",
      title: "Slips the lead",
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        organisationId: "org-1",
        patientId: "pat-1",
        flagType: "ESCAPE_RISK",
        severity: "MEDIUM",
        title: "Slips the lead",
        description: null,
        createdBy: null,
        isActive: true,
      },
      select: expect.objectContaining({ id: true, isActive: true }),
    });
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "org-1",
        patientId: "pat-1",
        eventType: "PATIENT_FLAG_CREATED",
        actorType: "PMS_USER",
        actorId: null,
        entityType: "COMPANION",
        entityId: "pat-1",
        metadata: {
          flagId: "flag-1",
          flagType: "ESCAPE_RISK",
          severity: "MEDIUM",
        },
      }),
    );
    expect(result.severity).toBe("MEDIUM");
  });

  it("keeps an explicit severity, description and author", async () => {
    mockCreate.mockResolvedValue(activeFlag);

    await PatientFlagService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      flagType: "AGGRESSION",
      severity: "CRITICAL",
      title: "Muzzle required",
      description: "Bites during nail trims",
      createdBy: "user-1",
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          severity: "CRITICAL",
          description: "Bites during nail trims",
          createdBy: "user-1",
        }),
      }),
    );
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: "user-1" }),
    );
  });
});

describe("PatientFlagService.get", () => {
  it("scopes the lookup to the organisation", async () => {
    mockFindFirst.mockResolvedValue(activeFlag);

    await expect(PatientFlagService.get("flag-1", "org-1")).resolves.toBe(
      activeFlag,
    );
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { id: "flag-1", organisationId: "org-1" },
      select: expect.objectContaining({ id: true }),
    });
  });

  it("throws a 404 for a flag in another organisation", async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(
      PatientFlagService.get("flag-1", "org-2"),
    ).rejects.toBeInstanceOf(PatientFlagError);
    await expect(
      PatientFlagService.get("flag-1", "org-2"),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Patient flag not found.",
    });
  });
});

describe("PatientFlagService.list", () => {
  it("applies every supplied filter and sorts the most severe first", async () => {
    mockFindMany.mockResolvedValue([activeFlag]);

    await PatientFlagService.list({
      organisationId: "org-1",
      patientId: "pat-1",
      flagType: "AGGRESSION",
      severity: "HIGH",
      isActive: true,
    });

    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        organisationId: "org-1",
        patientId: "pat-1",
        flagType: "AGGRESSION",
        severity: "HIGH",
        isActive: true,
      },
      select: expect.objectContaining({ id: true }),
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    });
  });

  it("keeps resolved flags in scope when isActive is explicitly false", async () => {
    mockFindMany.mockResolvedValue([resolvedFlag]);

    await PatientFlagService.list({ organisationId: "org-1", isActive: false });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organisationId: "org-1", isActive: false },
      }),
    );
  });

  it("omits filters that were not supplied", async () => {
    mockFindMany.mockResolvedValue([]);

    await PatientFlagService.list({ organisationId: "org-1" });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organisationId: "org-1" } }),
    );
  });
});

describe("PatientFlagService.update", () => {
  it("writes only the supplied fields", async () => {
    mockFindFirst.mockResolvedValue(activeFlag);
    mockUpdate.mockResolvedValue({ ...activeFlag, severity: "CRITICAL" });

    await PatientFlagService.update("flag-1", "org-1", {
      flagType: "SPECIAL_HANDLING",
      severity: "CRITICAL",
      title: "Two handlers required",
      description: "Needs sedation",
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "flag-1" },
      data: {
        flagType: "SPECIAL_HANDLING",
        severity: "CRITICAL",
        title: "Two handlers required",
        description: "Needs sedation",
      },
      select: expect.objectContaining({ id: true }),
    });
  });

  it("sends an empty data object when nothing was supplied", async () => {
    mockFindFirst.mockResolvedValue(activeFlag);
    mockUpdate.mockResolvedValue(activeFlag);

    await PatientFlagService.update("flag-1", "org-1", {});

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: {} }),
    );
  });

  it("refuses to edit a resolved flag", async () => {
    mockFindFirst.mockResolvedValue(resolvedFlag);

    await expect(
      PatientFlagService.update("flag-1", "org-1", { title: "Reopened" }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "Cannot update a resolved flag.",
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("refuses to edit a flag from another organisation", async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(
      PatientFlagService.update("flag-1", "org-2", { title: "Nope" }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("PatientFlagService.resolve", () => {
  it("deactivates the flag, stamps the resolver and records an audit event", async () => {
    mockFindFirst.mockResolvedValue(activeFlag);
    mockUpdate.mockResolvedValue(resolvedFlag);

    const result = await PatientFlagService.resolve(
      "flag-1",
      "org-1",
      "user-2",
    );

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "flag-1" },
      data: {
        isActive: false,
        resolvedAt: expect.any(Date),
        resolvedBy: "user-2",
      },
      select: expect.objectContaining({ id: true }),
    });
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "org-1",
        patientId: "pat-1",
        eventType: "PATIENT_FLAG_RESOLVED",
        actorId: "user-2",
        metadata: { flagId: "flag-1", flagType: "AGGRESSION" },
      }),
    );
    expect(result.isActive).toBe(false);
  });

  it("records a null resolver when no user was supplied", async () => {
    mockFindFirst.mockResolvedValue(activeFlag);
    mockUpdate.mockResolvedValue({ ...resolvedFlag, resolvedBy: null });

    await PatientFlagService.resolve("flag-1", "org-1");

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ resolvedBy: null }),
      }),
    );
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: null }),
    );
  });

  it("refuses to resolve a flag twice", async () => {
    mockFindFirst.mockResolvedValue(resolvedFlag);

    await expect(
      PatientFlagService.resolve("flag-1", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "Flag is already resolved.",
    });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("refuses to resolve a flag from another organisation", async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(
      PatientFlagService.resolve("flag-1", "org-2"),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("PatientFlagService cross-tenant protection", () => {
  it("refuses to write against a companion in another organisation", async () => {
    // The caller is a legitimate member of org-1; the companion is not.
    (prisma.patientOrganisation.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      PatientFlagService.create({
        organisationId: "org-1",
        patientId: "pat-1",
        flagType: "ESCAPE_RISK",
        title: "Slips the lead",
      }),
    ).rejects.toThrow("Companion not found.");

    // Rejecting is not enough - nothing may be persisted on the way out.
    expect(prisma.patientFlag.create as jest.Mock).not.toHaveBeenCalled();
  });
});
