import { PhysiotherapyPlanService } from "src/services/physiotherapy-plan.service";
import { prisma } from "src/config/prisma";
import { AuditTrailService } from "src/services/audit-trail.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    physiotherapyPlan: {
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
  physiotherapyPlan: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
};

const makePlan = (over: Record<string, unknown> = {}) => ({
  id: "pt-1",
  organisationId: "org-1",
  patientId: "pat-1",
  encounterId: "enc-1",
  surgicalProcedureId: "surg-1",
  diagnosis: "Left stifle OA post-TPLO",
  goals: "Restore full weight bearing at 12 weeks",
  frequency: "3x weekly",
  durationMinutes: 45,
  totalSessions: 12,
  exercisePrescription: "Passive ROM, sit-to-stand x10, cavaletti poles",
  hydrotherapy: true,
  laserTherapy: false,
  therapeuticUltrasound: false,
  massage: true,
  acupuncture: false,
  tapeApplication: false,
  precautions: "No off-lead exercise until week 8",
  homeExercises: "Leash walks 5min 3x daily, ice pack 10min after sessions",
  startDate: new Date("2026-07-01"),
  endDate: null,
  lastSessionAt: null,
  nextSessionAt: new Date("2026-07-03"),
  therapist: "Physio Team",
  prescribedBy: "vet-1",
  status: "ACTIVE",
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  (AuditTrailService.recordSafely as jest.Mock).mockResolvedValue(undefined);
  pm.physiotherapyPlan.findFirst.mockResolvedValue(makePlan());
  pm.physiotherapyPlan.create.mockResolvedValue(makePlan());
  pm.physiotherapyPlan.update.mockImplementation(
    (args: { data: Record<string, unknown> }) =>
      Promise.resolve(makePlan({ ...args.data })),
  );
  pm.physiotherapyPlan.findMany.mockResolvedValue([makePlan()]);
});

describe("PhysiotherapyPlanService.create", () => {
  it("creates an ACTIVE plan and emits audit", async () => {
    const result = await PhysiotherapyPlanService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      surgicalProcedureId: "surg-1",
      diagnosis: "Left stifle OA post-TPLO",
      hydrotherapy: true,
      prescribedBy: "vet-1",
    });
    expect(pm.physiotherapyPlan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "ACTIVE",
          diagnosis: "Left stifle OA post-TPLO",
          hydrotherapy: true,
        }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "PHYSIOTHERAPY_PLAN_CREATED",
        actorId: "vet-1",
      }),
    );
    expect(result.status).toBe("ACTIVE");
  });
});

describe("PhysiotherapyPlanService.get", () => {
  it("returns a plan by id and org", async () => {
    const result = await PhysiotherapyPlanService.get("pt-1", "org-1");
    expect(result.id).toBe("pt-1");
  });

  it("404s an unknown plan", async () => {
    pm.physiotherapyPlan.findFirst.mockResolvedValue(null);
    await expect(
      PhysiotherapyPlanService.get("bad", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("PhysiotherapyPlanService.list", () => {
  it("lists plans for the org", async () => {
    const result = await PhysiotherapyPlanService.list({
      organisationId: "org-1",
    });
    expect(result).toHaveLength(1);
  });

  it("filters by patientId and status", async () => {
    await PhysiotherapyPlanService.list({
      organisationId: "org-1",
      patientId: "pat-1",
      status: "ACTIVE",
    });
    expect(pm.physiotherapyPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          patientId: "pat-1",
          status: "ACTIVE",
        }),
      }),
    );
  });
});

describe("PhysiotherapyPlanService.update", () => {
  it("updates next session and emits PHYSIOTHERAPY_PLAN_UPDATED", async () => {
    const nextSessionAt = new Date("2026-07-05");
    await PhysiotherapyPlanService.update(
      "pt-1",
      "org-1",
      { nextSessionAt, therapist: "Dr PT" },
      "vet-1",
    );
    expect(pm.physiotherapyPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ nextSessionAt, therapist: "Dr PT" }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "PHYSIOTHERAPY_PLAN_UPDATED" }),
    );
  });

  it("emits PHYSIOTHERAPY_PLAN_DISCONTINUED when status is DISCONTINUED", async () => {
    pm.physiotherapyPlan.update.mockResolvedValue(
      makePlan({ status: "DISCONTINUED" }),
    );
    await PhysiotherapyPlanService.update("pt-1", "org-1", {
      status: "DISCONTINUED",
    });
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "PHYSIOTHERAPY_PLAN_DISCONTINUED" }),
    );
  });

  it("rejects updates on a discontinued plan", async () => {
    pm.physiotherapyPlan.findFirst.mockResolvedValue(
      makePlan({ status: "DISCONTINUED" }),
    );
    await expect(
      PhysiotherapyPlanService.update("pt-1", "org-1", {
        frequency: "2x weekly",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
