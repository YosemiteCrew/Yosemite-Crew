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
