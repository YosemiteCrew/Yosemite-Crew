import TaskModel from "../../src/models/task";
import TaskCompletionModel from "../../src/models/taskCompletion";
import TaskLibraryDefinitionModel from "../../src/models/taskLibraryDefinition";
import TaskTemplateModel from "../../src/models/taskTemplate";
import {
  TaskService,
  TaskServiceError,
} from "../../src/services/task.service";

type MockedTaskModel = {
  findById: jest.Mock;
  create: jest.Mock;
  find: jest.Mock;
};

type MockedTaskCompletionModel = {
  create: jest.Mock;
};

type MockedTaskLibraryDefinitionModel = {
  findById: jest.Mock;
};

type MockedTaskTemplateModel = {
  findById: jest.Mock;
};

jest.mock("../../src/models/task", () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
  },
}));

jest.mock("../../src/models/taskCompletion", () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
  },
}));

jest.mock("../../src/models/taskLibraryDefinition", () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
  },
}));

jest.mock("../../src/models/taskTemplate", () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
  },
}));

const mockedTaskModel = TaskModel as unknown as MockedTaskModel;
const mockedCompletionModel =
  TaskCompletionModel as unknown as MockedTaskCompletionModel;
const mockedLibraryModel =
  TaskLibraryDefinitionModel as unknown as MockedTaskLibraryDefinitionModel;
const mockedTemplateModel =
  TaskTemplateModel as unknown as MockedTaskTemplateModel;

describe("TaskService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createFromLibrary", () => {
    it("creates task when library item exists and active", async () => {
      const library = {
        isActive: true,
        category: "CAT",
        name: "Check vitals",
        defaultDescription: "desc",
      };
      mockedLibraryModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(library),
      });
      const created = { _id: "task-1" };
      mockedTaskModel.create.mockResolvedValueOnce(created);

      const dueAt = new Date("2024-01-01T00:00:00Z");
      const result = await TaskService.createFromLibrary({
        audience: "EMPLOYEE_TASK",
        companionId: "comp-1",
        libraryTaskId: "lib-1",
        createdBy: "creator-1",
        assignedTo: "assignee-1",
        dueAt,
        recurrence: { type: "ONCE" },
      } as any);

      expect(mockedTaskModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          source: "YC_LIBRARY",
          recurrence: {
            type: "ONCE",
            isMaster: false,
            masterTaskId: undefined,
            cronExpression: undefined,
            endDate: undefined,
          },
          reminder: undefined,
          syncWithCalendar: false,
          status: "PENDING",
        }),
      );
      expect(result).toBe(created);
    });

    it("throws when library task missing or inactive", async () => {
      mockedLibraryModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        TaskService.createFromLibrary({
          audience: "EMPLOYEE_TASK",
          companionId: "comp-1",
          libraryTaskId: "missing",
          createdBy: "creator",
          assignedTo: "assignee",
          dueAt: new Date(),
        } as any),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe("createFromTemplate", () => {
    it("creates task with defaults from template", async () => {
      const template = {
        _id: "tmpl-1",
        isActive: true,
        organisationId: "org-1",
        libraryTaskId: "lib-1",
        category: "Care",
        name: "Checkup",
        description: "desc",
        defaultRole: "PARENT",
        defaultMedication: { name: "med" },
        defaultObservationToolId: "obs-1",
        defaultRecurrence: {
          type: "DAILY",
          defaultEndOffsetDays: 2,
          customCron: "0 0 * * *",
        },
        defaultReminderOffsetMinutes: 45,
      };
      mockedTemplateModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(template),
      });
      const created = { _id: "task-created" };
      mockedTaskModel.create.mockResolvedValueOnce(created);

      const dueAt = new Date("2024-05-01T00:00:00Z");
      const result = await TaskService.createFromTemplate({
        organisationId: "org-1",
        companionId: "comp-1",
        templateId: "tmpl-1",
        createdBy: "creator-2",
        assignedTo: "assignee-2",
        dueAt,
      } as any);

      expect(mockedTaskModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          audience: "PARENT_TASK",
          source: "ORG_TEMPLATE",
          templateId: "tmpl-1",
          libraryTaskId: "lib-1",
          recurrence: expect.objectContaining({
            type: "DAILY",
            endDate: new Date(dueAt.getTime() + 2 * 24 * 60 * 60 * 1000),
          }),
          reminder: {
            enabled: true,
            offsetMinutes: 45,
            scheduledNotificationId: undefined,
          },
        }),
      );
      expect(result).toBe(created);
    });

    it("throws when template organisation mismatched", async () => {
      mockedTemplateModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({
          _id: "tmpl-1",
          isActive: true,
          organisationId: "another",
        }),
      });

      await expect(
        TaskService.createFromTemplate({
          organisationId: "org-1",
          companionId: "comp",
          templateId: "tmpl-1",
          createdBy: "c",
          assignedTo: "a",
          dueAt: new Date(),
        } as any),
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe("createCustom", () => {
    it("requires category and name", async () => {
      await expect(
        TaskService.createCustom({
          audience: "PARENT_TASK",
          companionId: "comp",
          createdBy: "c",
          assignedTo: "a",
          dueAt: new Date(),
          category: "",
          name: "",
        } as any),
      ).rejects.toBeInstanceOf(TaskServiceError);
    });

    it("creates custom task", async () => {
      const created = { _id: "task-3" };
      mockedTaskModel.create.mockResolvedValueOnce(created);

      const result = await TaskService.createCustom({
        audience: "PARENT_TASK",
        companionId: "comp",
        createdBy: "creator",
        assignedTo: "assignee",
        dueAt: new Date(),
        category: "General",
        name: "Walk",
        recurrence: { type: "ONCE" },
      });

      expect(mockedTaskModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          source: "CUSTOM",
          audience: "PARENT_TASK",
          assignedBy: "creator",
          recurrence: {
            type: "ONCE",
            isMaster: false,
            masterTaskId: undefined,
            cronExpression: undefined,
            endDate: undefined,
          },
        }),
      );
      expect(result).toBe(created);
    });
  });

  describe("updateTask", () => {
    it("throws when task not found", async () => {
      mockedTaskModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        TaskService.updateTask("missing", {}, "actor"),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("throws when actor not allowed", async () => {
      mockedTaskModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({
          createdBy: "someone-else",
          assignedTo: "other",
        }),
      });

      await expect(
        TaskService.updateTask("task-1", {}, "actor"),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("updates editable fields", async () => {
      const save = jest.fn().mockResolvedValue(undefined);
      const task = {
        _id: "task-1",
        createdBy: "actor",
        assignedTo: "actor",
        name: "Old name",
        description: "Old desc",
        dueAt: new Date("2024-01-01T00:00:00Z"),
        timezone: "UTC",
        medication: { name: "Old" },
        observationToolId: "obs-1",
        reminder: { enabled: true, offsetMinutes: 15, scheduledNotificationId: "sched-1" },
        syncWithCalendar: false,
        attachments: [],
        recurrence: {
          type: "DAILY",
          isMaster: true,
          masterTaskId: "master",
          cronExpression: "0 0 * * *",
          endDate: new Date("2024-02-01T00:00:00Z"),
        },
        save,
      };

      mockedTaskModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(task),
      });

      const newDue = new Date("2024-03-01T00:00:00Z");
      await TaskService.updateTask(
        "task-1",
        {
          name: "New",
          description: "New desc",
          dueAt: newDue,
          timezone: null,
          medication: null,
          observationToolId: null,
          reminder: { enabled: false, offsetMinutes: 5 },
          syncWithCalendar: true,
          attachments: [{ id: "a1", name: "file" }],
          recurrence: { type: "WEEKLY" as any },
        },
        "actor",
      );

      expect(task.name).toBe("New");
      expect(task.description).toBe("New desc");
      expect(task.dueAt).toBe(newDue);
      expect(task.timezone).toBeUndefined();
      expect(task.medication).toBeUndefined();
      expect(task.observationToolId).toBeUndefined();
      expect(task.reminder).toEqual({
        enabled: false,
        offsetMinutes: 5,
        scheduledNotificationId: "sched-1",
      });
      expect(task.syncWithCalendar).toBe(true);
      expect(task.attachments).toEqual([{ id: "a1", name: "file" }]);
      expect(task.recurrence).toEqual(
        expect.objectContaining({
          type: "WEEKLY",
          isMaster: true,
        }),
      );
      expect(save).toHaveBeenCalled();
    });
  });

  describe("changeStatus", () => {
    it("throws when task not found", async () => {
      mockedTaskModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        TaskService.changeStatus("missing", "COMPLETED", "actor"),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("prevents updates when actor unauthorized", async () => {
      mockedTaskModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({
          assignedTo: "other",
          createdBy: "another",
          status: "PENDING",
        }),
      });

      await expect(
        TaskService.changeStatus("task-1", "COMPLETED", "actor"),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("creates completion entry when marking completed", async () => {
      const save = jest.fn().mockResolvedValue(undefined);
      const task = {
        _id: "task-1",
        companionId: "comp-1",
        assignedTo: "actor",
        createdBy: "actor",
        status: "PENDING",
        completedBy: undefined,
        completedAt: undefined as Date | undefined,
        save,
      };
      mockedTaskModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(task),
      });
      const completionDoc = { _id: "comp-1" };
      mockedCompletionModel.create.mockResolvedValueOnce(completionDoc as any);

      const result = await TaskService.changeStatus(
        "task-1",
        "COMPLETED",
        "actor",
        {
          filledBy: "actor",
          answers: { q1: "a" },
          score: 5,
          summary: "done",
        },
      );

      expect(task.status).toBe("COMPLETED");
      expect(task.completedBy).toBe("actor");
      expect(task.completedAt).toBeInstanceOf(Date);
      expect(mockedCompletionModel.create).toHaveBeenCalledWith({
        taskId: "task-1",
        companionId: "comp-1",
        filledBy: "actor",
        answers: { q1: "a" },
        score: 5,
        summary: "done",
      });
      expect(save).toHaveBeenCalled();
      expect(result.completion).toBe(completionDoc);
    });

    it("rejects finished tasks", async () => {
      mockedTaskModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({
          assignedTo: "actor",
          createdBy: "actor",
          status: "COMPLETED",
        }),
      });

      await expect(
        TaskService.changeStatus("task-1", "CANCELLED", "actor"),
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe("lists", () => {
    it("listForParent builds query", async () => {
      const sort = jest.fn().mockReturnThis();
      const exec = jest.fn().mockResolvedValue([{ _id: "t" }]);
      mockedTaskModel.find.mockReturnValueOnce({ sort, exec } as any);

      const result = await TaskService.listForParent({
        parentId: "parent-1",
        companionId: "comp-1",
        fromDueAt: new Date("2024-01-01T00:00:00Z"),
        toDueAt: new Date("2024-01-02T00:00:00Z"),
        status: ["PENDING"],
      });

      expect(mockedTaskModel.find).toHaveBeenCalledWith({
        audience: "PARENT_TASK",
        assignedTo: "parent-1",
        companionId: "comp-1",
        status: { $in: ["PENDING"] },
        dueAt: {
          $gte: new Date("2024-01-01T00:00:00Z"),
          $lte: new Date("2024-01-02T00:00:00Z"),
        },
      });
      expect(sort).toHaveBeenCalledWith({ dueAt: 1 });
      expect(result).toEqual([{ _id: "t" }]);
    });

    it("listForEmployee builds query", async () => {
      const sort = jest.fn().mockReturnThis();
      const exec = jest.fn().mockResolvedValue([{ _id: "t" }]);
      mockedTaskModel.find.mockReturnValueOnce({ sort, exec } as any);

      await TaskService.listForEmployee({
        organisationId: "org-1",
        userId: "user-1",
        status: [],
      });

      expect(mockedTaskModel.find).toHaveBeenCalledWith({
        audience: "EMPLOYEE_TASK",
        organisationId: "org-1",
        assignedTo: "user-1",
      });
    });

    it("listForCompanion builds query", async () => {
      const sort = jest.fn().mockReturnThis();
      const exec = jest.fn().mockResolvedValue([{ _id: "t" }]);
      mockedTaskModel.find.mockReturnValueOnce({ sort, exec } as any);

      await TaskService.listForCompanion({
        companionId: "comp-1",
        audience: "PARENT_TASK",
        status: ["PENDING", "IN_PROGRESS"],
      });

      expect(mockedTaskModel.find).toHaveBeenCalledWith({
        companionId: "comp-1",
        audience: "PARENT_TASK",
        status: { $in: ["PENDING", "IN_PROGRESS"] },
      });
    });
  });
});
