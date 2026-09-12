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

import {
  TaskRecurrenceEngine,
  computeNextDueAt,
  getNextOccurrence,
} from "src/services/task.recurrence.engine";
import dayjs from "dayjs";

type MasterFixture = {
  id: string;
  organisationId: string | null;
  appointmentId: string | null;
  patientId: string | null;
  createdBy: string;
  assignedBy: string | null;
  assignedTo: string;
  audience: string;
  source: string;
  libraryTaskId: string | null;
  templateId: string | null;
  category: string;
  subcategory: string | null;
  name: string;
  description: string | null;
  additionalNotes: string | null;
  medication: unknown;
  observationToolId: string | null;
  dueAt: Date;
  timezone: string | null;
  status: string;
  recurrence: {
    isMaster: boolean;
    type: string;
    cronExpression?: string | null;
  };
  reminder: {
    enabled: boolean;
    offsetMinutes: number;
    scheduledNotificationId?: string;
  } | null;
  syncWithCalendar: boolean | null;
  attachments: unknown;
  assignedGroupId: string | null;
  priority: string | null;
};

const master = (cronExpression: string): MasterFixture => ({
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
  subcategory: null,
  name: "Recurring task",
  description: null,
  additionalNotes: null,
  medication: null,
  observationToolId: null,
  dueAt: new Date("2026-01-01T00:00:00Z"),
  timezone: "UTC",
  status: "PENDING",
  recurrence: { isMaster: true, type: "CUSTOM", cronExpression },
  reminder: null,
  syncWithCalendar: null,
  attachments: null,
  assignedGroupId: null,
  priority: null,
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

const dailyMaster = (overrides: Partial<ReturnType<typeof master>> = {}) => ({
  ...master("0 0 * * *"),
  recurrence: { isMaster: true, type: "DAILY" },
  ...overrides,
});

describe("TaskRecurrenceEngine occurrence generation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.task.findFirst.mockResolvedValue(null);
    prismaMock.task.create.mockResolvedValue({});
  });

  it("keeps the local due time stable across a DST spring-forward (DAILY)", async () => {
    prismaMock.task.findMany.mockResolvedValue([
      dailyMaster({
        // 09:00 CET (+01:00) the day before Europe's spring-forward.
        dueAt: new Date("2026-03-28T08:00:00.000Z"),
        timezone: "Europe/Madrid",
      }),
    ]);

    await TaskRecurrenceEngine.run();

    const firstCreate = prismaMock.task.create.mock.calls[0][0];
    // Still 09:00 local, but now CEST (+02:00) -> 07:00 UTC. Offset-
    // preserving duration math would instead produce 08:00 UTC (10:00 local).
    expect(firstCreate.data.dueAt).toEqual(
      new Date("2026-03-29T07:00:00.000Z"),
    );
  });

  it("keeps the local due time stable across a DST spring-forward (WEEKLY)", async () => {
    prismaMock.task.findMany.mockResolvedValue([
      dailyMaster({
        recurrence: { isMaster: true, type: "WEEKLY" },
        // 09:00 CET, one week before the transition.
        dueAt: new Date("2026-03-22T08:00:00.000Z"),
        timezone: "Europe/Madrid",
      }),
    ]);

    await TaskRecurrenceEngine.run();

    const firstCreate = prismaMock.task.create.mock.calls[0][0];
    expect(firstCreate.data.dueAt).toEqual(
      new Date("2026-03-29T07:00:00.000Z"),
    );
  });

  it("clones subcategory, additional notes, priority and group assignment onto each occurrence", async () => {
    prismaMock.task.findMany.mockResolvedValue([
      dailyMaster({
        subcategory: "vaccination",
        additionalNotes: "give with food",
        priority: "HIGH",
        assignedGroupId: "group-1",
      }),
    ]);

    await TaskRecurrenceEngine.run();

    const firstCreate = prismaMock.task.create.mock.calls[0][0];
    expect(firstCreate.data.subcategory).toBe("vaccination");
    expect(firstCreate.data.additionalNotes).toBe("give with food");
    expect(firstCreate.data.priority).toBe("HIGH");
    expect(firstCreate.data.assignedGroupId).toBe("group-1");
  });

  it("resets the reminder's sent marker on a new occurrence instead of copying the parent's", async () => {
    prismaMock.task.findMany.mockResolvedValue([
      dailyMaster({
        reminder: {
          enabled: true,
          offsetMinutes: 30,
          scheduledNotificationId: "already-sent-token",
        },
      }),
    ]);

    await TaskRecurrenceEngine.run();

    const firstCreate = prismaMock.task.create.mock.calls[0][0];
    expect(firstCreate.data.reminder).toEqual({
      enabled: true,
      offsetMinutes: 30,
      scheduledNotificationId: undefined,
    });
  });

  it("queries masters by recurrence.isMaster, never by the occurrence's own status", async () => {
    // Regression guard for #3181: the master row IS occurrence #1, so
    // filtering masters on `status !== CANCELLED` stops the whole series
    // from generating any further children the moment only that first
    // occurrence gets cancelled. Series-level stop is expressed via
    // recurrence.endDate instead (see TaskService.deleteTask ALL/
    // THIS_AND_FOLLOWING), which getNextOccurrence already honors.
    prismaMock.task.findMany.mockResolvedValue([]);

    await TaskRecurrenceEngine.run();

    expect(prismaMock.task.findMany).toHaveBeenCalledWith({
      where: { recurrence: { path: ["isMaster"], equals: true } },
    });
  });
});

describe("computeNextDueAt MONTHLY", () => {
  it("skips a short month and preserves the original day (Jan 31 -> Mar 31, not Feb 28)", () => {
    const next = computeNextDueAt(
      "MONTHLY",
      new Date("2026-01-31T09:00:00Z"),
      "UTC",
    );

    expect(next?.toISOString()).toBe("2026-03-31T09:00:00.000Z");
  });

  it("lands on the leap day when the target month has one (Jan 29 2024 -> Feb 29 2024)", () => {
    const next = computeNextDueAt(
      "MONTHLY",
      new Date("2024-01-29T09:00:00Z"),
      "UTC",
    );

    expect(next?.toISOString()).toBe("2024-02-29T09:00:00.000Z");
  });

  it("skips February in a non-leap year for a day-29 anchor (Jan 29 2026 -> Mar 29 2026)", () => {
    const next = computeNextDueAt(
      "MONTHLY",
      new Date("2026-01-29T09:00:00Z"),
      "UTC",
    );

    expect(next?.toISOString()).toBe("2026-03-29T09:00:00.000Z");
  });

  it("crosses a year boundary without skipping (Dec 31 2025 -> Jan 31 2026)", () => {
    const next = computeNextDueAt(
      "MONTHLY",
      new Date("2025-12-31T09:00:00Z"),
      "UTC",
    );

    expect(next?.toISOString()).toBe("2026-01-31T09:00:00.000Z");
  });

  it("preserves local wall-clock time across a daylight-saving transition", () => {
    // America/New_York DST began 2026-03-08. A master due 2026-02-08 at 09:00
    // local (14:00 UTC, EST) must recur 2026-03-08 at 09:00 local - which is
    // 13:00 UTC once EDT is in effect, not 14:00 UTC.
    const next = computeNextDueAt(
      "MONTHLY",
      new Date("2026-02-08T14:00:00Z"),
      "America/New_York",
    );

    expect(next?.toISOString()).toBe("2026-03-08T13:00:00.000Z");
    expect(dayjs(next).tz("America/New_York").format("HH:mm")).toBe("09:00");
  });

  it("uses the system timezone when none is stored, preserving the local calendar day", () => {
    // Derives its expectation from the same un-zoned dayjs parsing the
    // production code falls back to, rather than a hardcoded day-of-month,
    // so the assertion holds regardless of the machine's local timezone.
    const previous = new Date("2026-01-15T12:00:00Z");
    const expectedDay = dayjs(previous).date();

    const next = computeNextDueAt("MONTHLY", previous, undefined);

    expect(next).not.toBeNull();
    expect(dayjs(next).date()).toBe(expectedDay);
    expect(dayjs(next).isAfter(dayjs(previous))).toBe(true);
  });
});

describe("getNextOccurrence MONTHLY end date", () => {
  it("returns null once the next monthly occurrence passes the recurrence end date", () => {
    const horizon = dayjs("2026-12-31T00:00:00Z");

    const next = getNextOccurrence(
      "MONTHLY",
      new Date("2026-01-31T09:00:00Z"),
      "UTC",
      undefined,
      horizon,
      new Date("2026-02-15T00:00:00Z"),
    );

    // The next occurrence (Mar 31) is within the horizon but after the
    // recurrence's own end date, so it must not be generated.
    expect(next).toBeNull();
  });

  it("still generates the occurrence when it falls before the end date", () => {
    const horizon = dayjs("2026-12-31T00:00:00Z");

    const next = getNextOccurrence(
      "MONTHLY",
      new Date("2026-01-31T09:00:00Z"),
      "UTC",
      undefined,
      horizon,
      new Date("2026-04-01T00:00:00Z"),
    );

    expect(next?.toISOString()).toBe("2026-03-31T09:00:00.000Z");
  });
});

describe("TaskRecurrenceEngine end-to-end MONTHLY wiring", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.task.findFirst.mockResolvedValue(null);
    prismaMock.task.create.mockResolvedValue({});
    jest.useFakeTimers();
    // Pinned so the master's next monthly occurrence (Mar 31) is inside the
    // 30-day horizon and the one after it (May 31, since April is skipped)
    // is not - this proves the engine calls the MONTHLY branch and stops at
    // the horizon, without depending on the real wall clock.
    jest.setSystemTime(new Date("2026-03-15T00:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("generates exactly one monthly child at the correct skipped-month date", async () => {
    const monthlyMaster = {
      ...master("unused"),
      recurrence: { isMaster: true, type: "MONTHLY", cronExpression: null },
      dueAt: new Date("2026-01-31T09:00:00Z"),
      timezone: "UTC",
    };
    prismaMock.task.findMany.mockResolvedValue([monthlyMaster]);

    await TaskRecurrenceEngine.run();

    expect(prismaMock.task.create).toHaveBeenCalledTimes(1);
    const created = prismaMock.task.create.mock.calls[0][0] as {
      data: { dueAt: Date };
    };
    expect(created.data.dueAt.toISOString()).toBe("2026-03-31T09:00:00.000Z");
  });
});
