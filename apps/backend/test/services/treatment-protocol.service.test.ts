import {
  TreatmentProtocolService,
  TreatmentProtocolError,
} from "src/services/treatment-protocol.service";
import { prisma } from "src/config/prisma";
import { AuditTrailService } from "src/services/audit-trail.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    treatmentProtocol: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    treatmentProtocolStep: {
      create: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn(),
    },
    appliedTreatmentProtocol: {
      create: jest.fn(),
    },
    task: {
      create: jest.fn(),
    },
  },
}));

jest.mock("src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn().mockResolvedValue(undefined) },
}));

const pm = prisma as unknown as {
  treatmentProtocol: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
  treatmentProtocolStep: {
    create: jest.Mock;
    findFirst: jest.Mock;
    delete: jest.Mock;
    aggregate: jest.Mock;
  };
  appliedTreatmentProtocol: { create: jest.Mock };
  task: { create: jest.Mock };
};

const protocol = (over: Record<string, unknown> = {}) => ({
  id: "proto-1",
  organisationId: "org-1",
  name: "Routine Wellness",
  description: null,
  species: "ALL",
  category: "WELLNESS",
  isActive: true,
  createdById: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  steps: [],
  ...over,
});

const step = (over: Record<string, unknown> = {}) => ({
  id: "step-1",
  stepOrder: 1,
  stepType: "TASK",
  title: "Weigh patient",
  description: null,
  inventoryItemId: null,
  doseValue: null,
  doseUnit: null,
  routeOfAdmin: null,
  frequency: null,
  durationDays: null,
  assigneeRole: null,
  dueDaysFromStart: 0,
  serviceCode: null,
  unitPrice: null,
  quantity: null,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  (AuditTrailService.recordSafely as jest.Mock).mockResolvedValue(undefined);
  pm.treatmentProtocol.findFirst.mockResolvedValue(protocol());
  pm.treatmentProtocol.create.mockImplementation(
    (args: { data: Record<string, unknown> }) =>
      Promise.resolve(protocol({ name: args.data.name as string })),
  );
  pm.treatmentProtocol.update.mockImplementation(
    (args: { data: Record<string, unknown> }) =>
      Promise.resolve(protocol({ ...args.data })),
  );
  pm.treatmentProtocol.findMany.mockResolvedValue([protocol()]);
  pm.treatmentProtocolStep.aggregate.mockResolvedValue({
    _max: { stepOrder: 2 },
  });
  pm.treatmentProtocolStep.create.mockResolvedValue(step());
  pm.treatmentProtocolStep.findFirst.mockResolvedValue(step());
  pm.appliedTreatmentProtocol.create.mockResolvedValue({
    id: "app-1",
    protocolId: "proto-1",
    encounterId: "enc-1",
    patientId: "pat-1",
    organisationId: "org-1",
    appliedById: "vet-1",
    status: "IN_PROGRESS",
    appliedAt: new Date(),
  });
  pm.task.create.mockResolvedValue({ id: "task-1" });
});

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

describe("TreatmentProtocolService.create", () => {
  it("creates a protocol with no steps", async () => {
    const result = await TreatmentProtocolService.create({
      organisationId: "org-1",
      name: "Routine Wellness",
    });
    expect(pm.treatmentProtocol.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Routine Wellness",
          organisationId: "org-1",
        }),
      }),
    );
    expect(result.name).toBe("Routine Wellness");
  });

  it("creates a protocol with steps", async () => {
    const steps = [
      { stepType: "TASK" as const, title: "Weigh patient" },
      { stepType: "NOTE" as const, title: "Record vitals" },
    ];
    await TreatmentProtocolService.create({
      organisationId: "org-1",
      name: "Wellness with steps",
      steps,
    });
    const call = pm.treatmentProtocol.create.mock.calls[0][0];
    expect(call.data.steps.create).toHaveLength(2);
    expect(call.data.steps.create[0].stepOrder).toBe(1);
    expect(call.data.steps.create[1].stepOrder).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// get / list
// ---------------------------------------------------------------------------

describe("TreatmentProtocolService.get", () => {
  it("returns a protocol by id and org", async () => {
    const result = await TreatmentProtocolService.get("proto-1", "org-1");
    expect(pm.treatmentProtocol.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "proto-1", organisationId: "org-1" },
      }),
    );
    expect(result.id).toBe("proto-1");
  });

  it("404s a missing or out-of-org protocol", async () => {
    pm.treatmentProtocol.findFirst.mockResolvedValue(null);
    await expect(
      TreatmentProtocolService.get("bad", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("TreatmentProtocolService.list", () => {
  it("lists active protocols for an org", async () => {
    const result = await TreatmentProtocolService.list({
      organisationId: "org-1",
    });
    expect(pm.treatmentProtocol.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organisationId: "org-1" }),
      }),
    );
    expect(result).toHaveLength(1);
  });

  it("filters by species and category", async () => {
    await TreatmentProtocolService.list({
      organisationId: "org-1",
      species: "CANINE",
      category: "WELLNESS",
    });
    expect(pm.treatmentProtocol.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          species: "CANINE",
          category: "WELLNESS",
        }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

describe("TreatmentProtocolService.update", () => {
  it("updates protocol name and category", async () => {
    await TreatmentProtocolService.update("proto-1", "org-1", {
      name: "Updated Name",
      category: "SURGICAL",
    });
    expect(pm.treatmentProtocol.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "proto-1" },
        data: expect.objectContaining({
          name: "Updated Name",
          category: "SURGICAL",
        }),
      }),
    );
  });

  it("404s an unknown protocol", async () => {
    pm.treatmentProtocol.findFirst.mockResolvedValue(null);
    await expect(
      TreatmentProtocolService.update("bad", "org-1", { name: "X" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ---------------------------------------------------------------------------
// addStep / removeStep
// ---------------------------------------------------------------------------

describe("TreatmentProtocolService.addStep", () => {
  it("appends a step after the last one", async () => {
    const result = await TreatmentProtocolService.addStep("proto-1", "org-1", {
      stepType: "MEDICATION",
      title: "Administer vaccine",
    });
    expect(pm.treatmentProtocolStep.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ stepOrder: 3, stepType: "MEDICATION" }),
      }),
    );
    expect(result.id).toBe("step-1");
  });

  it("uses a provided stepOrder", async () => {
    await TreatmentProtocolService.addStep("proto-1", "org-1", {
      stepType: "NOTE",
      title: "Follow-up note",
      stepOrder: 1,
    });
    expect(pm.treatmentProtocolStep.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ stepOrder: 1 }),
      }),
    );
  });
});

describe("TreatmentProtocolService.removeStep", () => {
  it("deletes an existing step", async () => {
    await TreatmentProtocolService.removeStep("step-1", "proto-1", "org-1");
    expect(pm.treatmentProtocolStep.delete).toHaveBeenCalledWith({
      where: { id: "step-1" },
    });
  });

  it("404s a missing step", async () => {
    pm.treatmentProtocolStep.findFirst.mockResolvedValue(null);
    await expect(
      TreatmentProtocolService.removeStep("bad", "proto-1", "org-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ---------------------------------------------------------------------------
// archive
// ---------------------------------------------------------------------------

describe("TreatmentProtocolService.archive", () => {
  it("sets isActive to false", async () => {
    await TreatmentProtocolService.archive("proto-1", "org-1");
    expect(pm.treatmentProtocol.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "proto-1" },
        data: { isActive: false },
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// apply
// ---------------------------------------------------------------------------

describe("TreatmentProtocolService.apply", () => {
  const base = {
    protocolId: "proto-1",
    encounterId: "enc-1",
    patientId: "pat-1",
    organisationId: "org-1",
    appliedById: "vet-1",
  };

  it("creates an AppliedTreatmentProtocol record", async () => {
    const result = await TreatmentProtocolService.apply(base);
    expect(pm.appliedTreatmentProtocol.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          protocolId: "proto-1",
          encounterId: "enc-1",
          patientId: "pat-1",
        }),
      }),
    );
    expect(result.application.id).toBe("app-1");
  });

  it("creates tasks for TASK steps and returns their IDs", async () => {
    pm.treatmentProtocol.findFirst.mockResolvedValue(
      protocol({
        steps: [step(), step({ id: "step-2", title: "Check vitals" })],
      }),
    );
    pm.task.create
      .mockResolvedValueOnce({ id: "task-1" })
      .mockResolvedValueOnce({ id: "task-2" });

    const result = await TreatmentProtocolService.apply(base);
    expect(pm.task.create).toHaveBeenCalledTimes(2);
    expect(result.createdTaskIds).toEqual(["task-1", "task-2"]);
  });

  it("skips task creation when appliedById is absent", async () => {
    pm.treatmentProtocol.findFirst.mockResolvedValue(
      protocol({ steps: [step()] }),
    );
    const result = await TreatmentProtocolService.apply({
      ...base,
      appliedById: undefined,
    });
    expect(pm.task.create).not.toHaveBeenCalled();
    expect(result.createdTaskIds).toHaveLength(0);
  });

  it("returns non-TASK steps as pendingSteps", async () => {
    pm.treatmentProtocol.findFirst.mockResolvedValue(
      protocol({
        steps: [
          step({ stepType: "TASK" }),
          step({
            id: "step-2",
            stepType: "MEDICATION",
            title: "Rabies vaccine",
          }),
          step({ id: "step-3", stepType: "SERVICE", title: "Consult fee" }),
        ],
      }),
    );
    const result = await TreatmentProtocolService.apply(base);
    expect(result.pendingSteps).toHaveLength(2);
    expect(result.pendingSteps[0].stepType).toBe("MEDICATION");
    expect(result.pendingSteps[1].stepType).toBe("SERVICE");
  });

  it("emits PROTOCOL_APPLIED audit event", async () => {
    await TreatmentProtocolService.apply(base);
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "PROTOCOL_APPLIED",
        patientId: "pat-1",
        organisationId: "org-1",
        actorId: "vet-1",
      }),
    );
  });

  it("404s an unknown protocol", async () => {
    pm.treatmentProtocol.findFirst.mockResolvedValue(null);
    await expect(TreatmentProtocolService.apply(base)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
