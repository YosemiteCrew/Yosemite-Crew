const prismaMock = {
  task: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  patient: {
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
});
