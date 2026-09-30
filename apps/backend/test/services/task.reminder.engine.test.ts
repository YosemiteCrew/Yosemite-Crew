const prismaMock = {
  task: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  patient: {
    findFirst: jest.fn(),
  },
  parentPatient: {
    findFirst: jest.fn(),
  },
};

jest.mock("src/config/prisma", () => ({
  __esModule: true,
  prisma: prismaMock,
}));

const sendToUserMock = jest.fn();
jest.mock("src/services/notification.service", () => ({
  NotificationService: {
    sendToUser: (...args: unknown[]) => sendToUserMock(...args),
  },
}));

jest.mock("src/utils/notificationTemplates", () => ({
  NotificationTemplates: {
    Task: {
      TASK_DUE_REMINDER: (
        companionName: string,
        taskName: string,
        when: string,
      ) => ({
        companionName,
        taskName,
        when,
      }),
    },
  },
}));

import { TaskReminderEngine } from "src/services/task.reminder.engine";

const dueTask = (overrides: Record<string, unknown> = {}) => ({
  id: "task-1",
  name: "Give medication",
  assignedTo: "user-1",
  patientId: "patient-1",
  status: "PENDING",
  timezone: "UTC",
  dueAt: new Date("2026-01-01T12:00:00.000Z"),
  reminder: { enabled: true, offsetMinutes: 0 },
  ...overrides,
});

describe("TaskReminderEngine", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.patient.findFirst.mockResolvedValue({ name: "Rex" });
    prismaMock.task.update.mockResolvedValue({});
    sendToUserMock.mockResolvedValue([{ token: "notif-token" }]);
  });

  it("sends a zero-offset reminder on the first tick strictly after the due time", async () => {
    // Regression for #3183: a `dueAt >= now` query upper bound excluded the
    // task the instant its due time passed, so the tick just before due
    // found it "too early" and the tick just after found it already
    // filtered out - no tick ever delivered a zero-offset reminder.
    jest.useFakeTimers({ now: new Date("2026-01-01T12:00:01.000Z") });
    try {
      prismaMock.task.findMany.mockResolvedValue([dueTask()]);

      await TaskReminderEngine.run();

      expect(sendToUserMock).toHaveBeenCalledTimes(1);
      expect(sendToUserMock).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({ taskName: "Give medication" }),
      );
      expect(prismaMock.task.update).toHaveBeenCalledWith({
        where: { id: "task-1" },
        data: {
          reminder: expect.objectContaining({
            scheduledNotificationId: "notif-token",
          }),
        },
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it("still skips a task whose reminder time has not arrived yet", async () => {
    jest.useFakeTimers({ now: new Date("2026-01-01T11:59:59.000Z") });
    try {
      prismaMock.task.findMany.mockResolvedValue([dueTask()]);

      await TaskReminderEngine.run();

      expect(sendToUserMock).not.toHaveBeenCalled();
      expect(prismaMock.task.update).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it("skips a task with no companion without looking any companion up", async () => {
    jest.useFakeTimers({ now: new Date("2026-01-01T12:00:01.000Z") });
    try {
      prismaMock.task.findMany.mockResolvedValue([
        dueTask({ patientId: null }),
      ]);

      await TaskReminderEngine.run();

      expect(prismaMock.patient.findFirst).not.toHaveBeenCalled();
      expect(sendToUserMock).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it("looks up exactly the task's companion", async () => {
    jest.useFakeTimers({ now: new Date("2026-01-01T12:00:01.000Z") });
    try {
      prismaMock.task.findMany.mockResolvedValue([dueTask()]);

      await TaskReminderEngine.run();

      expect(prismaMock.patient.findFirst).toHaveBeenCalledWith({
        where: { id: dueTask().patientId },
        select: { name: true },
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it("does not resend once scheduledNotificationId is already set", async () => {
    jest.useFakeTimers({ now: new Date("2026-01-01T12:00:01.000Z") });
    try {
      prismaMock.task.findMany.mockResolvedValue([
        dueTask({
          reminder: {
            enabled: true,
            offsetMinutes: 0,
            scheduledNotificationId: "already-sent",
          },
        }),
      ]);

      await TaskReminderEngine.run();

      expect(sendToUserMock).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  describe("a parent task", () => {
    const parentTask = () =>
      dueTask({ audience: "PARENT_TASK", assignedTo: "parent-1" });

    beforeEach(() => {
      jest.useFakeTimers({ now: new Date("2026-01-01T12:00:01.000Z") });
      prismaMock.task.findMany.mockResolvedValue([parentTask()]);
    });

    afterEach(() => {
      jest.useRealTimers();
      prismaMock.parentPatient.findFirst.mockReset();
    });

    it("reminds a parent who may work on the companion's tasks", async () => {
      prismaMock.parentPatient.findFirst.mockResolvedValue({
        role: "CO_PARENT",
        permissions: { tasks: true },
      });

      await TaskReminderEngine.run();

      expect(prismaMock.parentPatient.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            parentId: "parent-1",
            patientId: "patient-1",
            status: "ACTIVE",
          }),
        }),
      );
      expect(sendToUserMock).toHaveBeenCalledWith(
        "parent-1",
        expect.objectContaining({ taskName: "Give medication" }),
      );
    });

    it.each([
      [
        "a co-parent whose tasks access is off",
        { role: "CO_PARENT", permissions: { tasks: false } },
      ],
      ["a parent no longer linked to the companion", null],
    ])("does not remind %s", async (_label, link) => {
      prismaMock.parentPatient.findFirst.mockResolvedValue(link);

      await TaskReminderEngine.run();

      expect(sendToUserMock).not.toHaveBeenCalled();
      // Marked handled, as a sent one is, so it is not re-checked every
      // minute or sent late if access comes back before it is due.
      expect(prismaMock.task.update).toHaveBeenCalledWith({
        where: { id: parentTask().id },
        data: {
          reminder: expect.objectContaining({
            enabled: true,
            scheduledNotificationId: "skipped",
          }),
        },
      });
    });
  });

  it("reminds a staff assignee without a parent access check", async () => {
    jest.useFakeTimers({ now: new Date("2026-01-01T12:00:01.000Z") });
    try {
      prismaMock.task.findMany.mockResolvedValue([
        dueTask({ audience: "EMPLOYEE_TASK", assignedTo: "vet-1" }),
      ]);

      await TaskReminderEngine.run();

      expect(prismaMock.parentPatient.findFirst).not.toHaveBeenCalled();
      expect(sendToUserMock).toHaveBeenCalledWith("vet-1", expect.anything());
    } finally {
      jest.useRealTimers();
    }
  });

  it("bounds the scan query with a lookback window rather than an upper bound of now", async () => {
    const fixedNow = new Date("2026-01-05T00:00:00.000Z");
    jest.useFakeTimers({ now: fixedNow });
    try {
      prismaMock.task.findMany.mockResolvedValue([]);

      await TaskReminderEngine.run();

      expect(prismaMock.task.findMany).toHaveBeenCalledWith({
        where: {
          status: { in: ["PENDING", "IN_PROGRESS"] },
          dueAt: { gte: new Date("2026-01-04T00:00:00.000Z") },
        },
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it("sends reminders one task at a time and keeps going after a failure", async () => {
    jest.useFakeTimers({
      now: new Date("2026-01-01T12:00:01.000Z"),
      doNotFake: ["setImmediate"],
    });
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      prismaMock.task.findMany.mockResolvedValue([
        dueTask({ id: "task-1", assignedTo: "user-1" }),
        dueTask({ id: "task-2", assignedTo: "user-2" }),
        dueTask({ id: "task-3", assignedTo: "user-3" }),
      ]);
      let inFlight = 0;
      let peak = 0;
      sendToUserMock.mockImplementation(async (userId: string) => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setImmediate(resolve));
        inFlight -= 1;
        if (userId === "user-2") throw new Error("push failed");
        return [{ token: `token-${userId}` }];
      });

      await TaskReminderEngine.run();

      expect(peak).toBe(1);
      expect(sendToUserMock.mock.calls.map(([userId]) => userId)).toEqual([
        "user-1",
        "user-2",
        "user-3",
      ]);
      expect(errorSpy).toHaveBeenCalledWith(
        "Failed reminder for task task-2",
        expect.any(Error),
      );
      expect(prismaMock.task.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "task-3" } }),
      );
      expect(prismaMock.task.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "task-2" } }),
      );
    } finally {
      errorSpy.mockRestore();
      jest.useRealTimers();
    }
  });
});
