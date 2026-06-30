import { MARService, MARError } from "src/services/mar.service";
import { prisma } from "src/config/prisma";
import { AuditTrailService } from "src/services/audit-trail.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    mAREntry: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn().mockResolvedValue(undefined) },
}));

const pm = prisma as unknown as {
  mAREntry: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
};

const makeEntry = (over: Record<string, unknown> = {}) => ({
  id: "mar-1",
  organisationId: "org-1",
  patientId: "pat-1",
  encounterId: "enc-1",
  prescriptionId: null,
  medicationName: "Amoxicillin",
  dose: "250mg",
  route: "oral",
  scheduledAt: new Date("2026-06-30T08:00:00Z"),
  administeredAt: null,
  administeredBy: null,
  status: "SCHEDULED",
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  (AuditTrailService.recordSafely as jest.Mock).mockResolvedValue(undefined);
  pm.mAREntry.findFirst.mockResolvedValue(makeEntry());
  pm.mAREntry.create.mockResolvedValue(makeEntry());
  pm.mAREntry.update.mockImplementation(
    (args: { data: Record<string, unknown> }) =>
      Promise.resolve(makeEntry({ ...args.data })),
  );
  pm.mAREntry.findMany.mockResolvedValue([makeEntry()]);
});

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

describe("MARService.create", () => {
  it("creates a SCHEDULED MAR entry and emits audit", async () => {
    const result = await MARService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      encounterId: "enc-1",
      medicationName: "Amoxicillin",
      dose: "250mg",
      route: "oral",
      scheduledAt: new Date("2026-06-30T08:00:00Z"),
      createdBy: "vet-1",
    });
    expect(pm.mAREntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "SCHEDULED",
          medicationName: "Amoxicillin",
          dose: "250mg",
        }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "MAR_ENTRY_CREATED",
        actorId: "vet-1",
      }),
    );
    expect(result.status).toBe("SCHEDULED");
  });
});

// ---------------------------------------------------------------------------
// get / list
// ---------------------------------------------------------------------------

describe("MARService.get", () => {
  it("returns a MAR entry by id and org", async () => {
    const result = await MARService.get("mar-1", "org-1");
    expect(result.id).toBe("mar-1");
  });

  it("404s an unknown entry", async () => {
    pm.mAREntry.findFirst.mockResolvedValue(null);
    await expect(MARService.get("bad", "org-1")).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("MARService.list", () => {
  it("lists all entries for the org", async () => {
    const result = await MARService.list({ organisationId: "org-1" });
    expect(result).toHaveLength(1);
  });

  it("filters by patientId, encounterId, status, and date range", async () => {
    const from = new Date("2026-06-30T00:00:00Z");
    const to = new Date("2026-06-30T23:59:59Z");
    await MARService.list({
      organisationId: "org-1",
      patientId: "pat-1",
      encounterId: "enc-1",
      status: "SCHEDULED",
      from,
      to,
    });
    expect(pm.mAREntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          patientId: "pat-1",
          encounterId: "enc-1",
          status: "SCHEDULED",
          scheduledAt: { gte: from, lte: to },
        }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// administer
// ---------------------------------------------------------------------------

describe("MARService.administer", () => {
  it("transitions SCHEDULED to GIVEN and emits audit", async () => {
    const result = await MARService.administer("mar-1", "org-1", {
      administeredBy: "nurse-1",
    });
    expect(pm.mAREntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "GIVEN",
          administeredBy: "nurse-1",
        }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "MAR_ENTRY_ADMINISTERED",
        actorId: "nurse-1",
      }),
    );
    expect(result.status).toBe("GIVEN");
  });

  it("rejects administering a non-SCHEDULED entry", async () => {
    pm.mAREntry.findFirst.mockResolvedValue(makeEntry({ status: "GIVEN" }));
    await expect(
      MARService.administer("mar-1", "org-1", {}),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

// ---------------------------------------------------------------------------
// hold / markMissed
// ---------------------------------------------------------------------------

describe("MARService.hold", () => {
  it("transitions SCHEDULED to HELD and emits audit", async () => {
    await MARService.hold("mar-1", "org-1", "Patient vomiting", "vet-1");
    expect(pm.mAREntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "HELD",
          notes: "Patient vomiting",
        }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "MAR_ENTRY_HELD" }),
    );
  });

  it("rejects holding a non-SCHEDULED entry", async () => {
    pm.mAREntry.findFirst.mockResolvedValue(makeEntry({ status: "HELD" }));
    await expect(
      MARService.hold("mar-1", "org-1", undefined),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe("MARService.markMissed", () => {
  it("transitions SCHEDULED to MISSED and emits audit", async () => {
    await MARService.markMissed(
      "mar-1",
      "org-1",
      "Patient discharged early",
      "vet-1",
    );
    expect(pm.mAREntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "MISSED" }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "MAR_ENTRY_MISSED" }),
    );
  });

  it("rejects marking a non-SCHEDULED entry as missed", async () => {
    pm.mAREntry.findFirst.mockResolvedValue(makeEntry({ status: "MISSED" }));
    await expect(
      MARService.markMissed("mar-1", "org-1", undefined),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
