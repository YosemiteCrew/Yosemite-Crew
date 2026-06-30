import { FluidTherapyPlanService } from "src/services/fluid-therapy-plan.service";
import { prisma } from "src/config/prisma";
import { AuditTrailService } from "src/services/audit-trail.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    fluidTherapyPlan: {
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
  fluidTherapyPlan: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
};

const makePlan = (over: Record<string, unknown> = {}) => ({
  id: "fp-1",
  organisationId: "org-1",
  patientId: "pat-1",
  encounterId: "enc-1",
  admissionId: null,
  fluidType: "LACTATED_RINGERS",
  customFluidName: null,
  additives: "KCl 20mEq/L",
  rateMlPerHour: 50,
  totalVolumeMl: 1200,
  durationHours: 24,
  startedAt: new Date("2026-06-30T08:00:00Z"),
  endedAt: null,
  status: "ACTIVE",
  indication: "Dehydration 7%",
  prescribedBy: "vet-1",
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  (AuditTrailService.recordSafely as jest.Mock).mockResolvedValue(undefined);
  pm.fluidTherapyPlan.findFirst.mockResolvedValue(makePlan());
  pm.fluidTherapyPlan.create.mockResolvedValue(makePlan());
  pm.fluidTherapyPlan.update.mockImplementation(
    (args: { data: Record<string, unknown> }) =>
      Promise.resolve(makePlan({ ...args.data })),
  );
  pm.fluidTherapyPlan.findMany.mockResolvedValue([makePlan()]);
});

describe("FluidTherapyPlanService.create", () => {
  it("creates an ACTIVE fluid plan and emits audit", async () => {
    const result = await FluidTherapyPlanService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      fluidType: "LACTATED_RINGERS",
      rateMlPerHour: 50,
      startedAt: new Date("2026-06-30T08:00:00Z"),
      prescribedBy: "vet-1",
    });
    expect(pm.fluidTherapyPlan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fluidType: "LACTATED_RINGERS",
          status: "ACTIVE",
          rateMlPerHour: 50,
        }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "FLUID_PLAN_CREATED",
        actorId: "vet-1",
      }),
    );
    expect(result.status).toBe("ACTIVE");
  });
});

describe("FluidTherapyPlanService.get", () => {
  it("returns a plan by id and org", async () => {
    const result = await FluidTherapyPlanService.get("fp-1", "org-1");
    expect(result.id).toBe("fp-1");
  });

  it("404s an unknown plan", async () => {
    pm.fluidTherapyPlan.findFirst.mockResolvedValue(null);
    await expect(
      FluidTherapyPlanService.get("bad", "org-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("FluidTherapyPlanService.list", () => {
  it("lists plans for the org", async () => {
    const result = await FluidTherapyPlanService.list({
      organisationId: "org-1",
    });
    expect(result).toHaveLength(1);
  });

  it("filters by status", async () => {
    await FluidTherapyPlanService.list({
      organisationId: "org-1",
      patientId: "pat-1",
      status: "ACTIVE",
    });
    expect(pm.fluidTherapyPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          patientId: "pat-1",
          status: "ACTIVE",
        }),
      }),
    );
  });
});

describe("FluidTherapyPlanService.update", () => {
  it("updates rate and emits FLUID_PLAN_UPDATED", async () => {
    await FluidTherapyPlanService.update(
      "fp-1",
      "org-1",
      { rateMlPerHour: 80 },
      "vet-1",
    );
    expect(pm.fluidTherapyPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ rateMlPerHour: 80 }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "FLUID_PLAN_UPDATED" }),
    );
  });

  it("emits FLUID_PLAN_DISCONTINUED when status is DISCONTINUED", async () => {
    pm.fluidTherapyPlan.update.mockResolvedValue(
      makePlan({ status: "DISCONTINUED" }),
    );
    await FluidTherapyPlanService.update("fp-1", "org-1", {
      status: "DISCONTINUED",
    });
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "FLUID_PLAN_DISCONTINUED" }),
    );
  });

  it("rejects updates on a discontinued plan", async () => {
    pm.fluidTherapyPlan.findFirst.mockResolvedValue(
      makePlan({ status: "DISCONTINUED" }),
    );
    await expect(
      FluidTherapyPlanService.update("fp-1", "org-1", { rateMlPerHour: 20 }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
