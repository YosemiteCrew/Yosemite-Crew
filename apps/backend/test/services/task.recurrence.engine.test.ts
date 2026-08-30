const prismaMock = {
  task: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
  },
};

jest.mock("src/config/prisma", () => ({
  __esModule: true,
  prisma: prismaMock,
}));

import { TaskRecurrenceEngine } from "src/services/task.recurrence.engine";

const master = (cronExpression: string) => ({
  id: "task-1",
  organisationId: "org-1",
  appointmentId: null,
  patientId: null,
  createdBy: "user-1",
  assignedBy: null,
  assignedTo: "user-2",
  audience: "STAFF",
  source: "MANUAL",
  libraryTaskId: null,
  templateId: null,
  category: "GENERAL",
  name: "Recurring task",
  description: null,
  medication: null,
  observationToolId: null,
  dueAt: new Date("2026-01-01T00:00:00Z"),
  timezone: "UTC",
  status: "PENDING",
  recurrence: { isMaster: true, type: "CUSTOM", cronExpression },
  reminder: null,
  syncWithCalendar: null,
  attachments: null,
});

describe("TaskRecurrenceEngine invalid cron logging", () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.task.findFirst.mockResolvedValue(null);
    prismaMock.task.create.mockResolvedValue({});
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("strips line breaks from the cron expression before logging it", async () => {
    prismaMock.task.findMany.mockResolvedValue([
      master("bad\r\nFAKE LOG LINE"),
    ]);

    await TaskRecurrenceEngine.run();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const logged = errorSpy.mock.calls[0][1] as string;
    expect(logged).toBe("badFAKE LOG LINE");
    expect(logged).not.toContain("\n");
    expect(logged).not.toContain("\r");
    // A cron that never parses generates nothing.
    expect(prismaMock.task.create).not.toHaveBeenCalled();
  });

  it("does not abort the run when a stored cron expression is not a string", async () => {
    // The task controllers spread req.body straight through, so an
    // authenticated caller can persist a non-string cronExpression. A bare
    // .replace() would throw inside the catch and kill the whole run, leaving
    // every later master unprocessed on every future run.
    const poisoned = master({
      evil: "object",
    } as unknown as string) as ReturnType<typeof master>;
    poisoned.id = "task-poisoned";
    const healthy = master("0 0 * * *");

    prismaMock.task.findMany.mockResolvedValue([poisoned, healthy]);

    await expect(TaskRecurrenceEngine.run()).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalled();
    // The healthy master was still processed after the poisoned one.
    expect(prismaMock.task.create).toHaveBeenCalled();
  });

  it("leaves a valid cron expression alone and generates children", async () => {
    prismaMock.task.findMany.mockResolvedValue([master("0 0 * * *")]);

    await TaskRecurrenceEngine.run();

    expect(errorSpy).not.toHaveBeenCalled();
    expect(prismaMock.task.create).toHaveBeenCalled();
  });
});
