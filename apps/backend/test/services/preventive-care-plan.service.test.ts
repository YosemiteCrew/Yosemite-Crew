import {
  PreventiveCarePlanService,
  PreventiveCarePlanError,
} from "src/services/preventive-care-plan.service";
import { prisma } from "src/config/prisma";
import { AuditTrailService } from "src/services/audit-trail.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    preventiveCarePlan: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    preventiveCareItem: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn().mockResolvedValue(undefined) },
}));

const pm = prisma as unknown as {
  preventiveCarePlan: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
  preventiveCareItem: {
    create: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
  };
};

const makePlan = (over: Record<string, unknown> = {}) => ({
  id: "plan-1",
  organisationId: "org-1",
  patientId: "pat-1",
  name: "Annual Wellness Plan",
  description: null,
  status: "ACTIVE",
  createdBy: "vet-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  items: [],
  ...over,
});

const makeItem = (over: Record<string, unknown> = {}) => ({
  id: "item-1",
  planId: "plan-1",
  organisationId: "org-1",
  careType: "Annual check-up",
  frequency: "ANNUAL",
  intervalDays: null,
  lastDoneAt: null,
  nextDueAt: new Date("2027-01-01"),
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  (AuditTrailService.recordSafely as jest.Mock).mockResolvedValue(undefined);
  pm.preventiveCarePlan.findFirst.mockResolvedValue(makePlan());
  pm.preventiveCarePlan.create.mockResolvedValue(
    makePlan({ items: [makeItem()] }),
  );
  pm.preventiveCarePlan.update.mockImplementation(
    (args: { data: Record<string, unknown> }) =>
      Promise.resolve(makePlan({ ...args.data, items: [] })),
  );
  pm.preventiveCarePlan.findMany.mockResolvedValue([makePlan()]);
  pm.preventiveCareItem.findFirst.mockResolvedValue(makeItem());
  pm.preventiveCareItem.create.mockResolvedValue(makeItem());
  pm.preventiveCareItem.update.mockImplementation(
    (args: { data: Record<string, unknown> }) =>
      Promise.resolve(makeItem({ ...args.data })),
  );
});

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

describe("PreventiveCarePlanService.create", () => {
  it("creates an ACTIVE plan with items and emits audit", async () => {
    const result = await PreventiveCarePlanService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      name: "Annual Wellness Plan",
      createdBy: "vet-1",
      items: [{ careType: "Annual check-up", frequency: "ANNUAL" }],
    });
    expect(pm.preventiveCarePlan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "ACTIVE",
          name: "Annual Wellness Plan",
          items: expect.objectContaining({ create: expect.any(Array) }),
        }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "CARE_PLAN_CREATED",
        actorId: "vet-1",
      }),
    );
    expect(result.status).toBe("ACTIVE");
  });

  it("creates a plan without items", async () => {
    pm.preventiveCarePlan.create.mockResolvedValue(makePlan({ items: [] }));
    await PreventiveCarePlanService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      name: "Empty Plan",
    });
    expect(pm.preventiveCarePlan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ items: expect.anything() }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// get / list
// ---------------------------------------------------------------------------

describe("PreventiveCarePlanService.get", () => {
  it("returns a plan by id and org", async () => {
    const result = await PreventiveCarePlanService.get("plan-1", "org-1");
    expect(result.id).toBe("plan-1");
  });

  it("404s an unknown plan", async () => {
    pm.preventiveCarePlan.findFirst.mockResolvedValue(null);
    await expect(
      PreventiveCarePlanService.get("bad", "org-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("PreventiveCarePlanService.list", () => {
  it("lists plans for the org", async () => {
    const result = await PreventiveCarePlanService.list({
      organisationId: "org-1",
    });
    expect(result).toHaveLength(1);
  });

  it("filters by patientId and status", async () => {
    await PreventiveCarePlanService.list({
      organisationId: "org-1",
      patientId: "pat-1",
      status: "ACTIVE",
    });
    expect(pm.preventiveCarePlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          patientId: "pat-1",
          status: "ACTIVE",
        }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

describe("PreventiveCarePlanService.update", () => {
  it("updates plan fields and emits CARE_PLAN_UPDATED", async () => {
    await PreventiveCarePlanService.update(
      "plan-1",
      "org-1",
      { name: "Revised Plan" },
      "vet-1",
    );
    expect(pm.preventiveCarePlan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "Revised Plan" }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "CARE_PLAN_UPDATED" }),
    );
  });

  it("emits CARE_PLAN_CANCELLED when status set to CANCELLED", async () => {
    await PreventiveCarePlanService.update(
      "plan-1",
      "org-1",
      { status: "CANCELLED" },
      "vet-1",
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "CARE_PLAN_CANCELLED" }),
    );
  });
});

// ---------------------------------------------------------------------------
// addItem / completeItem
// ---------------------------------------------------------------------------

describe("PreventiveCarePlanService.addItem", () => {
  it("creates a new care item on the plan", async () => {
    const item = await PreventiveCarePlanService.addItem("plan-1", "org-1", {
      careType: "Dental cleaning",
      frequency: "BIANNUAL",
    });
    expect(pm.preventiveCareItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          careType: "Dental cleaning",
          frequency: "BIANNUAL",
        }),
      }),
    );
    expect(item.careType).toBe("Annual check-up");
  });

  it("404s if plan not found", async () => {
    pm.preventiveCarePlan.findFirst.mockResolvedValue(null);
    await expect(
      PreventiveCarePlanService.addItem("bad", "org-1", {
        careType: "Dental",
        frequency: "ANNUAL",
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("PreventiveCarePlanService.completeItem", () => {
  it("stamps lastDoneAt and nextDueAt, emits audit", async () => {
    const nextDueAt = new Date("2027-06-30");
    pm.preventiveCarePlan.findFirst.mockResolvedValue(
      makePlan({ patientId: "pat-1" }),
    );

    await PreventiveCarePlanService.completeItem(
      "item-1",
      "org-1",
      { nextDueAt },
      "vet-1",
    );

    expect(pm.preventiveCareItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastDoneAt: expect.any(Date),
          nextDueAt,
        }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "CARE_PLAN_ITEM_COMPLETED",
        actorId: "vet-1",
      }),
    );
  });

  it("404s on missing item", async () => {
    pm.preventiveCareItem.findFirst.mockResolvedValue(null);
    await expect(
      PreventiveCarePlanService.completeItem("bad", "org-1", {}),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
