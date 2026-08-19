import { PostOpCarePlanService } from "src/services/post-op-care-plan.service";
import { prisma } from "src/config/prisma";
import { AuditTrailService } from "src/services/audit-trail.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    postOpCarePlan: {
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
  postOpCarePlan: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
};

const makePlan = (over: Record<string, unknown> = {}) => ({
  id: "pop-1",
  organisationId: "org-1",
  patientId: "pat-1",
  encounterId: "enc-1",
  surgicalProcedureId: "surg-1",
  status: "ACTIVE",
  painScore: 3,
  analgesiaProtocol: "Buprenorphine 0.02mg/kg q8h",
  woundCareInstructions: "E-collar at all times. Clean wound BID with saline.",
  activityRestrictions: "Strict rest for 2 weeks",
  dietaryNotes: "Soft food only for 3 days",
  fluidTherapyNotes: "Continue IV LR at 2ml/kg/hr for 12h post-op",
  monitoringParams: "HR, RR, temp, pain score q4h",
  firstReviewAt: new Date("2026-06-30T18:00:00Z"),
  nextReviewAt: new Date("2026-07-01T08:00:00Z"),
  reviewedBy: null,
  reviewNotes: null,
  prescribedBy: "vet-1",
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  (AuditTrailService.recordSafely as jest.Mock).mockResolvedValue(undefined);
  pm.postOpCarePlan.findFirst.mockResolvedValue(makePlan());
  pm.postOpCarePlan.create.mockResolvedValue(makePlan());
  pm.postOpCarePlan.update.mockImplementation(
    (args: { data: Record<string, unknown> }) =>
      Promise.resolve(makePlan({ ...args.data })),
  );
  pm.postOpCarePlan.findMany.mockResolvedValue([makePlan()]);
});

describe("PostOpCarePlanService.create", () => {
  it("creates an ACTIVE post-op plan and emits audit", async () => {
    const result = await PostOpCarePlanService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      encounterId: "enc-1",
      surgicalProcedureId: "surg-1",
      painScore: 3,
      analgesiaProtocol: "Buprenorphine 0.02mg/kg q8h",
      prescribedBy: "vet-1",
    });
    expect(pm.postOpCarePlan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "ACTIVE",
          surgicalProcedureId: "surg-1",
          painScore: 3,
        }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "POST_OP_PLAN_CREATED",
        actorId: "vet-1",
      }),
    );
    expect(result.status).toBe("ACTIVE");
  });
});

describe("PostOpCarePlanService.get", () => {
  it("returns a plan by id and org", async () => {
    const result = await PostOpCarePlanService.get("pop-1", "org-1");
    expect(result.id).toBe("pop-1");
  });

  it("404s an unknown plan", async () => {
    pm.postOpCarePlan.findFirst.mockResolvedValue(null);
    await expect(
      PostOpCarePlanService.get("bad", "org-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("PostOpCarePlanService.list", () => {
  it("lists plans for the org", async () => {
    const result = await PostOpCarePlanService.list({
      organisationId: "org-1",
    });
    expect(result).toHaveLength(1);
  });

  it("filters by status", async () => {
    await PostOpCarePlanService.list({
      organisationId: "org-1",
      patientId: "pat-1",
      status: "ACTIVE",
    });
    expect(pm.postOpCarePlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          patientId: "pat-1",
          status: "ACTIVE",
        }),
      }),
    );
  });
});

describe("PostOpCarePlanService.review", () => {
  it("records a review and emits POST_OP_PLAN_REVIEWED", async () => {
    await PostOpCarePlanService.review(
      "pop-1",
      "org-1",
      { reviewNotes: "Patient comfortable. Pain score 2.", painScore: 2 },
      "vet-1",
    );
    expect(pm.postOpCarePlan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reviewNotes: "Patient comfortable. Pain score 2.",
          painScore: 2,
          reviewedBy: "vet-1",
        }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "POST_OP_PLAN_REVIEWED" }),
    );
  });

  it("emits POST_OP_PLAN_COMPLETED when status is COMPLETED", async () => {
    pm.postOpCarePlan.update.mockResolvedValue(
      makePlan({ status: "COMPLETED" }),
    );
    await PostOpCarePlanService.review(
      "pop-1",
      "org-1",
      {
        reviewNotes: "Fully recovered. Discharge home.",
        status: "COMPLETED",
      },
      "vet-1",
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "POST_OP_PLAN_COMPLETED" }),
    );
  });

  it("rejects reviewing a non-ACTIVE plan", async () => {
    pm.postOpCarePlan.findFirst.mockResolvedValue(
      makePlan({ status: "COMPLETED" }),
    );
    await expect(
      PostOpCarePlanService.review("pop-1", "org-1", {
        reviewNotes: "...",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe("PostOpCarePlanService.update", () => {
  it("updates analgesiaProtocol", async () => {
    await PostOpCarePlanService.update("pop-1", "org-1", {
      analgesiaProtocol: "Methadone 0.1mg/kg q6h",
    });
    expect(pm.postOpCarePlan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          analgesiaProtocol: "Methadone 0.1mg/kg q6h",
        }),
      }),
    );
  });
});
