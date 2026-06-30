import {
  BloodTransfusionService,
  BloodTransfusionError,
} from "src/services/blood-transfusion.service";
import { prisma } from "src/config/prisma";
import { AuditTrailService } from "src/services/audit-trail.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    bloodTransfusion: {
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
  bloodTransfusion: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
};

const makeTransfusion = (over: Record<string, unknown> = {}) => ({
  id: "tx-1",
  organisationId: "org-1",
  patientId: "pat-1",
  encounterId: "enc-1",
  donorId: null,
  productType: "pRBC",
  bloodType: "DEA_1_POSITIVE",
  volumeMl: 250,
  startedAt: new Date("2026-06-30T10:00:00Z"),
  endedAt: null,
  durationMinutes: null,
  reaction: "NONE",
  reactionNotes: null,
  administeredBy: "vet-1",
  crossMatchDone: true,
  crossMatchResult: "Compatible",
  preTransfusionPCV: 18.5,
  postTransfusionPCV: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  (AuditTrailService.recordSafely as jest.Mock).mockResolvedValue(undefined);
  pm.bloodTransfusion.findFirst.mockResolvedValue(makeTransfusion());
  pm.bloodTransfusion.create.mockResolvedValue(makeTransfusion());
  pm.bloodTransfusion.update.mockImplementation(
    (args: { data: Record<string, unknown> }) =>
      Promise.resolve(makeTransfusion({ ...args.data })),
  );
  pm.bloodTransfusion.findMany.mockResolvedValue([makeTransfusion()]);
});

// ---------------------------------------------------------------------------
// record
// ---------------------------------------------------------------------------

describe("BloodTransfusionService.record", () => {
  it("creates a transfusion record and emits audit", async () => {
    const result = await BloodTransfusionService.record({
      organisationId: "org-1",
      patientId: "pat-1",
      productType: "pRBC",
      bloodType: "DEA_1_POSITIVE",
      volumeMl: 250,
      startedAt: new Date("2026-06-30T10:00:00Z"),
      administeredBy: "vet-1",
      crossMatchDone: true,
      preTransfusionPCV: 18.5,
    });
    expect(pm.bloodTransfusion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          productType: "pRBC",
          bloodType: "DEA_1_POSITIVE",
          volumeMl: 250,
          reaction: "NONE",
        }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "TRANSFUSION_RECORDED",
        actorId: "vet-1",
      }),
    );
    expect(result.reaction).toBe("NONE");
  });

  it("defaults reaction to NONE and crossMatchDone to false", async () => {
    await BloodTransfusionService.record({
      organisationId: "org-1",
      patientId: "pat-1",
      productType: "FFP",
      bloodType: "UNKNOWN",
      volumeMl: 100,
      startedAt: new Date(),
    });
    expect(pm.bloodTransfusion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reaction: "NONE",
          crossMatchDone: false,
        }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// get / list
// ---------------------------------------------------------------------------

describe("BloodTransfusionService.get", () => {
  it("returns a transfusion by id and org", async () => {
    const result = await BloodTransfusionService.get("tx-1", "org-1");
    expect(result.id).toBe("tx-1");
  });

  it("404s an unknown record", async () => {
    pm.bloodTransfusion.findFirst.mockResolvedValue(null);
    await expect(
      BloodTransfusionService.get("bad", "org-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("BloodTransfusionService.list", () => {
  it("lists transfusions for the org", async () => {
    const result = await BloodTransfusionService.list({
      organisationId: "org-1",
    });
    expect(result).toHaveLength(1);
  });

  it("filters by patientId and encounterId", async () => {
    await BloodTransfusionService.list({
      organisationId: "org-1",
      patientId: "pat-1",
      encounterId: "enc-1",
    });
    expect(pm.bloodTransfusion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          patientId: "pat-1",
          encounterId: "enc-1",
        }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// reportReaction
// ---------------------------------------------------------------------------

describe("BloodTransfusionService.reportReaction", () => {
  it("reports a reaction and emits audit", async () => {
    pm.bloodTransfusion.update.mockResolvedValue(
      makeTransfusion({
        reaction: "FEBRILE",
        reactionNotes: "Temp spike 30min post",
      }),
    );
    const result = await BloodTransfusionService.reportReaction(
      "tx-1",
      "org-1",
      { reaction: "FEBRILE", reactionNotes: "Temp spike 30min post" },
      "vet-1",
    );
    expect(pm.bloodTransfusion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reaction: "FEBRILE" }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "TRANSFUSION_REACTION_REPORTED" }),
    );
    expect(result.reaction).toBe("FEBRILE");
  });

  it("rejects if reaction already reported", async () => {
    pm.bloodTransfusion.findFirst.mockResolvedValue(
      makeTransfusion({ reaction: "FEBRILE" }),
    );
    await expect(
      BloodTransfusionService.reportReaction("tx-1", "org-1", {
        reaction: "HAEMOLYTIC",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

describe("BloodTransfusionService.update", () => {
  it("updates post-transfusion fields", async () => {
    await BloodTransfusionService.update("tx-1", "org-1", {
      postTransfusionPCV: 28.0,
      durationMinutes: 120,
    });
    expect(pm.bloodTransfusion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          postTransfusionPCV: 28.0,
          durationMinutes: 120,
        }),
      }),
    );
  });
});
