import { IsolationProtocolService } from "../../src/services/isolation-protocol.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    isolationProtocol: {
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

const mockCreate = prisma.isolationProtocol.create as jest.Mock;
const mockFindFirst = prisma.isolationProtocol.findFirst as jest.Mock;
const mockFindMany = prisma.isolationProtocol.findMany as jest.Mock;
const mockUpdate = prisma.isolationProtocol.update as jest.Mock;

const baseProtocol = {
  id: "iso-1",
  organisationId: "org-1",
  patientId: "pat-1",
  reason: "PARVOVIRUS" as const,
  level: "STRICT" as const,
  unitId: "unit-iso",
  startedAt: new Date("2026-06-30T08:00:00Z"),
  endedAt: null,
  initiatedBy: "vet-1",
  endedBy: null,
  ppe: ["gloves", "gown", "mask"],
  notes: "Suspected parvo — confirmed by SNAP test",
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => jest.clearAllMocks());

describe("IsolationProtocolService.start", () => {
  it("starts a STRICT parvo isolation protocol", async () => {
    mockCreate.mockResolvedValue(baseProtocol);
    const result = await IsolationProtocolService.start({
      organisationId: "org-1",
      patientId: "pat-1",
      reason: "PARVOVIRUS",
      level: "STRICT",
      startedAt: new Date("2026-06-30T08:00:00Z"),
      initiatedBy: "vet-1",
      ppe: ["gloves", "gown", "mask"],
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reason: "PARVOVIRUS",
          level: "STRICT",
        }),
      }),
    );
    expect(result.reason).toBe("PARVOVIRUS");
    expect(result.ppe).toHaveLength(3);
  });
});

describe("IsolationProtocolService.get", () => {
  it("returns protocol when found", async () => {
    mockFindFirst.mockResolvedValue(baseProtocol);
    const result = await IsolationProtocolService.get("iso-1", "org-1");
    expect(result.id).toBe("iso-1");
    expect(result.endedAt).toBeNull();
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      IsolationProtocolService.get("iso-x", "org-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("IsolationProtocolService.list", () => {
  it("filters active protocols (endedAt null)", async () => {
    mockFindMany.mockResolvedValue([baseProtocol]);
    await IsolationProtocolService.list({
      organisationId: "org-1",
      active: true,
    });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ endedAt: null }),
      }),
    );
  });

  it("filters by reason", async () => {
    mockFindMany.mockResolvedValue([baseProtocol]);
    await IsolationProtocolService.list({
      organisationId: "org-1",
      reason: "PARVOVIRUS",
    });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ reason: "PARVOVIRUS" }),
      }),
    );
  });
});

describe("IsolationProtocolService.end", () => {
  it("ends an active protocol", async () => {
    const ended = { ...baseProtocol, endedAt: new Date(), endedBy: "vet-2" };
    mockFindFirst.mockResolvedValue(baseProtocol);
    mockUpdate.mockResolvedValue(ended);
    const result = await IsolationProtocolService.end("iso-1", "org-1", {
      endedAt: new Date(),
      endedBy: "vet-2",
    });
    expect(result.endedAt).toBeTruthy();
    expect(result.endedBy).toBe("vet-2");
  });

  it("throws 409 when protocol is already ended", async () => {
    mockFindFirst.mockResolvedValue({ ...baseProtocol, endedAt: new Date() });
    await expect(
      IsolationProtocolService.end("iso-1", "org-1", { endedAt: new Date() }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      IsolationProtocolService.end("iso-x", "org-1", { endedAt: new Date() }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("IsolationProtocolService.update", () => {
  it("upgrades isolation level to AIRBORNE", async () => {
    const upgraded = { ...baseProtocol, level: "AIRBORNE" as const };
    mockFindFirst.mockResolvedValue(baseProtocol);
    mockUpdate.mockResolvedValue(upgraded);
    const result = await IsolationProtocolService.update("iso-1", "org-1", {
      level: "AIRBORNE",
    });
    expect(result.level).toBe("AIRBORNE");
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      IsolationProtocolService.update("iso-x", "org-1", { level: "CONTACT" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
