import { prisma } from "src/config/prisma";
import { TaskService } from "../../src/services/task.service";
import { TaskScheduleEngine } from "../../src/services/task.schedule.engine";

jest.mock("src/config/prisma", () => ({
  prisma: {
    taskSchedule: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/task.service", () => ({
  TaskService: {
    createFromWorkflowSeed: jest.fn(),
  },
}));

const mockedPrisma = prisma as unknown as {
  taskSchedule: {
    findMany: jest.Mock;
    update: jest.Mock;
  };
};

const mockedTaskService = TaskService as unknown as {
  createFromWorkflowSeed: jest.Mock;
};

describe("TaskScheduleEngine", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("materializes a due deferred schedule into tasks", async () => {
    mockedPrisma.taskSchedule.findMany.mockResolvedValueOnce([
      {
        id: "schedule-1",
        templateKind: "CARE_PATHWAY",
        status: "DRAFT",
        generatedTaskIds: null,
        materializedSeeds: [
          {
            source: "ORG_TEMPLATE",
            organisationId: "org-1",
            createdBy: "creator-1",
            assignedTo: "employee-1",
            audience: "EMPLOYEE_TASK",
            category: "Medication",
            name: "Morning medicine",
            dueAt: "2026-01-01T08:00:00.000Z",
          },
        ],
      },
    ]);
    mockedTaskService.createFromWorkflowSeed.mockResolvedValueOnce({
      id: "task-1",
    });
    mockedPrisma.taskSchedule.update.mockResolvedValueOnce({
      id: "schedule-1",
      templateKind: "CARE_PATHWAY",
      status: "ACTIVE",
      generatedTaskIds: ["task-1"],
      materializedSeeds: [],
    });

    await TaskScheduleEngine.run();

    expect(mockedTaskService.createFromWorkflowSeed).toHaveBeenCalledWith(
      expect.objectContaining({
        dueAt: new Date("2026-01-01T08:00:00.000Z"),
      }),
      expect.objectContaining({ notify: false }),
    );
    expect(mockedPrisma.taskSchedule.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "schedule-1" },
        data: expect.objectContaining({
          generatedTaskIds: ["task-1"],
          status: "ACTIVE",
        }),
      }),
    );
  });

  it("materializes custom workflow seeds and completes task templates", async () => {
    mockedPrisma.taskSchedule.findMany.mockResolvedValueOnce([
      {
        id: "schedule-3",
        templateKind: "TASK_TEMPLATE",
        status: "ACTIVE",
        generatedTaskIds: null,
        materializedSeeds: [
          {
            source: "CUSTOM",
            templateId: "template-1",
            organisationId: "org-1",
            appointmentId: "appt-1",
            patientId: "patient-1",
            createdBy: "creator-1",
            assignedBy: "assigner-1",
            assignedTo: "parent-1",
            audience: "PARENT_TASK",
            libraryTaskId: "library-1",
            category: "Care",
            name: "Evening check",
            description: "Check hydration",
            additionalNotes: "Give after dinner",
            medication: {
              name: "Medication A",
              type: "tablet",
              dosage: "1",
              frequency: "daily",
              notes: "With food",
            },
            observationToolId: "tool-1",
            dueAt: "2026-01-01T20:00:00.000Z",
            timezone: "UTC+05:30",
            recurrence: {
              type: "CUSTOM",
              isMaster: true,
              masterTaskId: "master-1",
              cronExpression: "0 20 * * *",
              endDate: "2026-01-08T20:00:00.000Z",
            },
            reminder: {
              enabled: true,
              offsetMinutes: 15,
              scheduledNotificationId: "notif-1",
            },
            syncWithCalendar: true,
            calendarEventId: "event-1",
            attachments: [{ id: "att-1", name: "photo.jpg" }],
          },
        ],
      },
    ]);
    mockedTaskService.createFromWorkflowSeed.mockResolvedValueOnce({
      id: "task-2",
    });
    mockedPrisma.taskSchedule.update.mockResolvedValueOnce({
      id: "schedule-3",
      templateKind: "TASK_TEMPLATE",
      status: "COMPLETED",
      generatedTaskIds: ["task-2"],
      materializedSeeds: [],
    });

    await TaskScheduleEngine.run();

    expect(mockedTaskService.createFromWorkflowSeed).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "CUSTOM",
        audience: "PARENT_TASK",
        dueAt: new Date("2026-01-01T20:00:00.000Z"),
        recurrence: expect.objectContaining({
          type: "CUSTOM",
          isMaster: true,
          cronExpression: "0 20 * * *",
          endDate: new Date("2026-01-08T20:00:00.000Z"),
        }),
      }),
      expect.objectContaining({ notify: false }),
    );
    expect(mockedPrisma.taskSchedule.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "schedule-3" },
        data: expect.objectContaining({
          status: "COMPLETED",
          completedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("skips empty seed payloads and logs invalid ones", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockedPrisma.taskSchedule.findMany.mockResolvedValueOnce([
      {
        id: "schedule-empty",
        templateKind: "CARE_PATHWAY",
        status: "ACTIVE",
        generatedTaskIds: null,
        materializedSeeds: [],
      },
      {
        id: "schedule-bad",
        templateKind: "CARE_PATHWAY",
        status: "ACTIVE",
        generatedTaskIds: null,
        materializedSeeds: [{ name: "Missing identifiers" }],
      },
    ]);

    await TaskScheduleEngine.run();

    expect(mockedTaskService.createFromWorkflowSeed).not.toHaveBeenCalled();
    expect(mockedPrisma.taskSchedule.update).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      "Failed to process task schedule",
      "schedule-bad",
      expect.any(Error),
    );
    errorSpy.mockRestore();
  });

  it("skips schedules that already have generated task ids", async () => {
    mockedPrisma.taskSchedule.findMany.mockResolvedValueOnce([
      {
        id: "schedule-2",
        templateKind: "TASK_TEMPLATE",
        status: "ACTIVE",
        generatedTaskIds: ["task-9"],
        materializedSeeds: [{ foo: "bar" }],
      },
    ]);

    await TaskScheduleEngine.run();

    expect(mockedTaskService.createFromWorkflowSeed).not.toHaveBeenCalled();
    expect(mockedPrisma.taskSchedule.update).not.toHaveBeenCalled();
  });
});
