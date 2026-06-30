import { WaitlistEntryService } from "../../src/services/waitlist-entry.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    waitlistEntry: {
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

const mockCreate = prisma.waitlistEntry.create as jest.Mock;
const mockFindFirst = prisma.waitlistEntry.findFirst as jest.Mock;
const mockFindMany = prisma.waitlistEntry.findMany as jest.Mock;
const mockUpdate = prisma.waitlistEntry.update as jest.Mock;

const baseEntry = {
  id: "wl-1",
  organisationId: "org-1",
  patientId: "pat-1",
  requestedBy: "client-1",
  preferredLeadId: null,
  appointmentType: "GENERAL",
  earliestDate: new Date("2026-07-01"),
  latestDate: new Date("2026-07-31"),
  notes: "Please call first.",
  status: "WAITING" as const,
  offeredAt: null,
  bookedAt: null,
  expiresAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => jest.clearAllMocks());

describe("WaitlistEntryService.add", () => {
  it("creates a waitlist entry with WAITING status", async () => {
    mockCreate.mockResolvedValue(baseEntry);
    const result = await WaitlistEntryService.add({
      organisationId: "org-1",
      patientId: "pat-1",
      appointmentType: "GENERAL",
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "WAITING",
          patientId: "pat-1",
        }),
      }),
    );
    expect(result.status).toBe("WAITING");
  });
});

describe("WaitlistEntryService.get", () => {
  it("returns entry when found", async () => {
    mockFindFirst.mockResolvedValue(baseEntry);
    const result = await WaitlistEntryService.get("wl-1", "org-1");
    expect(result.id).toBe("wl-1");
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      WaitlistEntryService.get("wl-x", "org-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("WaitlistEntryService.list", () => {
  it("filters by status", async () => {
    mockFindMany.mockResolvedValue([baseEntry]);
    await WaitlistEntryService.list({
      organisationId: "org-1",
      status: "WAITING",
    });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "WAITING" }),
      }),
    );
  });
});

describe("WaitlistEntryService.offer", () => {
  it("transitions WAITING → OFFERED", async () => {
    const offered = {
      ...baseEntry,
      status: "OFFERED" as const,
      offeredAt: new Date(),
    };
    mockFindFirst.mockResolvedValue(baseEntry);
    mockUpdate.mockResolvedValue(offered);
    const result = await WaitlistEntryService.offer("wl-1", "org-1");
    expect(result.status).toBe("OFFERED");
  });

  it("throws 409 when already BOOKED", async () => {
    mockFindFirst.mockResolvedValue({ ...baseEntry, status: "BOOKED" });
    await expect(
      WaitlistEntryService.offer("wl-1", "org-1"),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe("WaitlistEntryService.book", () => {
  it("transitions OFFERED → BOOKED", async () => {
    const offered = { ...baseEntry, status: "OFFERED" as const };
    const booked = {
      ...baseEntry,
      status: "BOOKED" as const,
      bookedAt: new Date(),
    };
    mockFindFirst.mockResolvedValue(offered);
    mockUpdate.mockResolvedValue(booked);
    const result = await WaitlistEntryService.book("wl-1", "org-1");
    expect(result.status).toBe("BOOKED");
  });

  it("throws 409 when already CANCELLED", async () => {
    mockFindFirst.mockResolvedValue({ ...baseEntry, status: "CANCELLED" });
    await expect(
      WaitlistEntryService.book("wl-1", "org-1"),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe("WaitlistEntryService.cancel", () => {
  it("cancels a WAITING entry", async () => {
    const cancelled = { ...baseEntry, status: "CANCELLED" as const };
    mockFindFirst.mockResolvedValue(baseEntry);
    mockUpdate.mockResolvedValue(cancelled);
    const result = await WaitlistEntryService.cancel("wl-1", "org-1");
    expect(result.status).toBe("CANCELLED");
  });

  it("throws 409 when already EXPIRED", async () => {
    mockFindFirst.mockResolvedValue({ ...baseEntry, status: "EXPIRED" });
    await expect(
      WaitlistEntryService.cancel("wl-1", "org-1"),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe("WaitlistEntryService.expire", () => {
  it("expires an OFFERED entry", async () => {
    const offered = { ...baseEntry, status: "OFFERED" as const };
    const expired = { ...baseEntry, status: "EXPIRED" as const };
    mockFindFirst.mockResolvedValue(offered);
    mockUpdate.mockResolvedValue(expired);
    const result = await WaitlistEntryService.expire("wl-1", "org-1");
    expect(result.status).toBe("EXPIRED");
  });
});
