import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { Types } from "mongoose";
import { TaskService } from "../../src/services/task.service";
import TaskModel from "../../src/models/task";
import TaskLibraryDefinitionModel from "../../src/models/taskLibraryDefinition";
import TaskTemplateModel from "../../src/models/taskTemplate";
import TaskCompletionModel from "../../src/models/taskCompletion";
import UserModel from "../../src/models/user";
import CompanionModel from "../../src/models/companion";
import { sendEmailTemplate } from "../../src/utils/email";

// ----------------------------------------------------------------------
// 1. MOCKS
// ----------------------------------------------------------------------
jest.mock("../../src/models/task");
jest.mock("../../src/models/taskLibraryDefinition");
jest.mock("../../src/models/taskTemplate");
jest.mock("../../src/models/taskCompletion");
jest.mock("../../src/models/user", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
  },
}));
jest.mock("../../src/models/companion", () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
  },
}));
jest.mock("../../src/utils/email", () => ({
  sendEmailTemplate: jest.fn(),
}));

// Helper to mock mongoose chaining
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockChain = (resolvedValue: any) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {};
  chain.sort = (jest.fn() as any).mockReturnValue(chain);
  chain.exec = (jest.fn() as any).mockResolvedValue(resolvedValue);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chain.then = (resolve: any) => Promise.resolve(resolvedValue).then(resolve);
  return chain;
};

// Helper for Mock Docs
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockDoc = (data: any) => ({
  ...data,
  _id: data._id || new Types.ObjectId(),
  save: (jest.fn() as any).mockResolvedValue(true),
  toObject: (jest.fn() as any).mockReturnValue(data),
});

describe("TaskService", () => {
  const orgId = new Types.ObjectId().toString();
  const userId = new Types.ObjectId().toString();
  const companionId = new Types.ObjectId().toString();
  const taskId = new Types.ObjectId().toString();
  const libraryId = new Types.ObjectId().toString();
const templateId = new Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    (UserModel.findOne as jest.Mock).mockReturnValue({
      lean: (jest.fn() as any).mockResolvedValue(null),
    });
    (CompanionModel.findById as jest.Mock).mockReturnValue({
      select: (jest.fn() as any).mockReturnValue({
        lean: (jest.fn() as any).mockResolvedValue(null),
      }),
    });
    (sendEmailTemplate as jest.Mock).mockImplementation(async () => {});
  });

  // ======================================================================
  // 1. CREATION LOGIC
  // ======================================================================
  describe("Creation", () => {
    describe("createFromLibrary", () => {
      it("should create task from library definition", async () => {
        const libraryDef = {
          _id: libraryId,
          isActive: true,
          category: "Health",
          name: "Walk",
          defaultDescription: "Walk dog",
        };
        (TaskLibraryDefinitionModel.findById as any).mockReturnValue({
          exec: (jest.fn() as any).mockResolvedValue(libraryDef),
        });

        const createdTask = mockDoc({ ...libraryDef });
        (TaskModel.create as any).mockResolvedValue(createdTask);

        const result = await TaskService.createFromLibrary({
          libraryTaskId: libraryId,
          audience: "PARENT_TASK",
          companionId,
          createdBy: userId,
          assignedTo: userId,
          dueAt: new Date(),
          // Test override behavior
          nameOverride: "Morning Walk",
        });

        expect(TaskModel.create).toHaveBeenCalledWith(
          expect.objectContaining({
            source: "YC_LIBRARY",
            name: "Morning Walk", // Override applied
            category: "Health", // Original kept
            status: "PENDING",
          }),
        );
        expect(result).toBe(createdTask);
      });

      it("should throw if library definition not found", async () => {
        (TaskLibraryDefinitionModel.findById as any).mockReturnValue({
          exec: (jest.fn() as any).mockResolvedValue(null),
        });

        await expect(
          TaskService.createFromLibrary({
            libraryTaskId: libraryId,
            audience: "EMPLOYEE_TASK",
            createdBy: userId,
            assignedTo: userId,
            dueAt: new Date(),
          }),
        ).rejects.toThrow("Library task not found or inactive");
      });

      it("should enforce companionId for PARENT_TASK", async () => {
        const libraryDef = { isActive: true };
        (TaskLibraryDefinitionModel.findById as any).mockReturnValue({
          exec: (jest.fn() as any).mockResolvedValue(libraryDef),
        });

        await expect(
          TaskService.createFromLibrary({
            libraryTaskId: libraryId,
            audience: "PARENT_TASK", // Requires companion
            companionId: undefined, // Missing
            createdBy: userId,
            assignedTo: userId,
            dueAt: new Date(),
          }),
        ).rejects.toThrow("companionId is required");
      });
    });

    describe("createFromTemplate", () => {
      it("should create task from org template", async () => {
        const template = {
          _id: templateId,
          isActive: true,
          organisationId: orgId,
          defaultRole: "PARENT",
          defaultRecurrence: { type: "ONCE" },
          defaultMedication: { name: "Pill" },
        };
        (TaskTemplateModel.findById as any).mockReturnValue({
          exec: (jest.fn() as any).mockResolvedValue(template),
        });

        (TaskModel.create as any).mockResolvedValue(mockDoc({}));

        await TaskService.createFromTemplate({
          templateId,
          organisationId: orgId, // Matches template
          companionId,
          createdBy: userId,
          assignedTo: userId,
          dueAt: new Date(),
        });

        expect(TaskModel.create).toHaveBeenCalledWith(
          expect.objectContaining({
            source: "ORG_TEMPLATE",
            audience: "PARENT_TASK", // Default from template
            medication: expect.objectContaining({ name: "Pill" }),
          }),
        );
      });

      it("should throw if template org mismatch", async () => {
        (TaskTemplateModel.findById as any).mockReturnValue({
          exec: (jest.fn() as any).mockResolvedValue({
            isActive: true,
            organisationId: "other-org",
          }),
        });

        await expect(
          TaskService.createFromTemplate({
            templateId,
            organisationId: orgId,
            createdBy: userId,
            assignedTo: userId,
            dueAt: new Date(),
          }),
        ).rejects.toThrow("Template does not belong to organisation");
      });

      it("should handle recurring templates with end date calculation", async () => {
        const template = {
          _id: templateId,
          isActive: true,
          organisationId: orgId,
          defaultRecurrence: { type: "DAILY", defaultEndOffsetDays: 7 },
        };
        (TaskTemplateModel.findById as any).mockReturnValue({
          exec: (jest.fn() as any).mockResolvedValue(template),
        });
        (TaskModel.create as any).mockResolvedValue(mockDoc({}));

        const dueAt = new Date();
        await TaskService.createFromTemplate({
          templateId,
          organisationId: orgId,
          createdBy: userId,
          assignedTo: userId,
          dueAt,
        });

        expect(TaskModel.create).toHaveBeenCalledWith(
          expect.objectContaining({
            recurrence: expect.objectContaining({
              type: "DAILY",
              endDate: expect.any(Date), // Should be calculated
            }),
          }),
        );
      });
    });

    describe("createCustom", () => {
      it("should create a custom task with full details", async () => {
        const input = {
          organisationId: orgId,
          companionId,
          createdBy: userId,
          assignedTo: userId,
          audience: "EMPLOYEE_TASK" as const,
          category: "General",
          name: "Custom Job",
          dueAt: new Date(),
          recurrence: { type: "ONCE" as const },
          reminder: { enabled: true, offsetMinutes: 30 },
        };

        (TaskModel.create as any).mockResolvedValue(mockDoc(input));

        await TaskService.createCustom(input);

        expect(TaskModel.create).toHaveBeenCalledWith(
          expect.objectContaining({
            source: "CUSTOM",
            reminder: {
              enabled: true,
              offsetMinutes: 30,
              scheduledNotificationId: undefined,
            },
            recurrence: {
              type: "ONCE",
              isMaster: false,
              masterTaskId: undefined,
              cronExpression: undefined,
              endDate: undefined,
            },
          }),
        );
      });

      it("should validate missing name/category", async () => {
        // @ts-ignore
        await expect(TaskService.createCustom({ name: "" })).rejects.toThrow(
          "category and name are required",
        );
      });

      it("should sanitize empty medication inputs", async () => {
        const input = {
          category: "Med",
          name: "Med Task",
          createdBy: userId,
          assignedTo: userId,
          dueAt: new Date(),
          audience: "EMPLOYEE_TASK" as const,
          // Empty med object
          medication: { name: "", doses: [{ time: "", dosage: "" }] },
        };
        (TaskModel.create as any).mockResolvedValue(mockDoc({}));

        await TaskService.createCustom(input);

        expect(TaskModel.create).toHaveBeenCalledWith(
          expect.objectContaining({
            medication: undefined, // Should be stripped
          }),
        );
      });
    });
  });

  // ======================================================================
  // 2. UPDATES & STATUS CHANGE
  // ======================================================================
  describe("Updates", () => {
    describe("updateTask", () => {
      it("should update task fields if user is authorized", async () => {
        const task = mockDoc({
          _id: new Types.ObjectId(taskId),
          createdBy: userId,
          assignedTo: "other",
          recurrence: { type: "DAILY", cronExpression: "old" },
        });
        (TaskModel.findById as any).mockReturnValue({
          exec: (jest.fn() as any).mockResolvedValue(task),
        });

        const updates = {
          name: "New Name",
          assignedTo: "new-guy", // allowed because userId is creator
          recurrence: { type: "WEEKLY" as const, cronExpression: "new" },
          medication: null, // should clear medication
        };

        await TaskService.updateTask(taskId, updates, userId);

        expect(task.name).toBe("New Name");
        expect(task.assignedTo).toBe("new-guy");
        expect(task.medication).toBeUndefined();
        expect(task.recurrence.type).toBe("WEEKLY");
        expect(task.save).toHaveBeenCalled();
      });

      it("should throw if user is not creator/assignee", async () => {
        const task = mockDoc({ createdBy: "other", assignedTo: "other" });
        (TaskModel.findById as any).mockReturnValue({
          exec: (jest.fn() as any).mockResolvedValue(task),
        });

        await expect(
          TaskService.updateTask(taskId, { name: "Hack" }, userId),
        ).rejects.toThrow("Not allowed to update this task");
      });

      it("should prevent non-creator from reassigning", async () => {
        const task = mockDoc({ createdBy: "boss", assignedTo: userId }); // user is assignee
        (TaskModel.findById as any).mockReturnValue({
          exec: (jest.fn() as any).mockResolvedValue(task),
        });

        await expect(
          TaskService.updateTask(taskId, { assignedTo: "me" }, userId),
        ).rejects.toThrow("Only task creator can reassign task");
      });

      it("should handle recurrence updates correctly (null vs modify vs create)", async () => {
        const task = mockDoc({ createdBy: userId }); // no recurrence initially
        (TaskModel.findById as any).mockReturnValue({
          exec: (jest.fn() as any).mockResolvedValue(task),
        });

        // 1. Create recurrence
        await TaskService.updateTask(
          taskId,
          { recurrence: { type: "DAILY" } },
          userId,
        );
        expect(task.recurrence.type).toBe("DAILY");

        // 2. Clear recurrence
        await TaskService.updateTask(taskId, { recurrence: null }, userId);
        expect(task.recurrence).toBeUndefined();
      });
    });

    describe("changeStatus", () => {
      it("should change status from PENDING to IN_PROGRESS", async () => {
        const task = mockDoc({ status: "PENDING", assignedTo: userId });
        (TaskModel.findById as any).mockReturnValue({
          exec: (jest.fn() as any).mockResolvedValue(task),
        });

        await TaskService.changeStatus(taskId, "IN_PROGRESS", userId);
        expect(task.status).toBe("IN_PROGRESS");
        expect(task.save).toHaveBeenCalled();
      });

      it("should complete task and create completion record", async () => {
        const task = mockDoc({
          _id: new Types.ObjectId(taskId),
          status: "IN_PROGRESS",
          assignedTo: userId,
          companionId,
        });
        (TaskModel.findById as any).mockReturnValue({
          exec: (jest.fn() as any).mockResolvedValue(task),
        });

        (TaskCompletionModel.create as any).mockResolvedValue("completion-doc");

        const result = await TaskService.changeStatus(
          taskId,
          "COMPLETED",
          userId,
          {
            filledBy: userId,
            score: 10,
            answers: { q1: "yes" }, // Required to trigger TaskCompletion creation
          },
        );

        expect(task.status).toBe("COMPLETED");
        expect(task.completedBy).toBe(userId);
        expect(task.completedAt).toBeDefined();
        expect(TaskCompletionModel.create).toHaveBeenCalledWith(
          expect.objectContaining({
            taskId,
            score: 10,
          }),
        );
        expect(result.completion).toBe("completion-doc");
      });

      it("should throw if task is already finished", async () => {
        const task = mockDoc({ status: "COMPLETED", assignedTo: userId });
        (TaskModel.findById as any).mockReturnValue({
          exec: (jest.fn() as any).mockResolvedValue(task),
        });

        await expect(
          TaskService.changeStatus(taskId, "CANCELLED", userId),
        ).rejects.toThrow("Task already finished");
      });
    });
  });

  // ======================================================================
  // 3. RETRIEVAL & LISTING
  // ======================================================================
  describe("Listing", () => {
    it("getById: should return task", async () => {
      (TaskModel.findById as any).mockReturnValue({
        exec: (jest.fn() as any).mockResolvedValue("task"),
      });
      expect(await TaskService.getById(taskId)).toBe("task");
    });

    it("listForParent: should filter by audience and assignment", async () => {
      (TaskModel.find as any).mockReturnValue(mockChain([]));
      const from = new Date();

      await TaskService.listForParent({
        parentId: userId,
        companionId,
        fromDueAt: from,
        status: ["PENDING"],
      });

      expect(TaskModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          audience: "PARENT_TASK",
          $or: [{ assignedTo: userId }, { createdBy: userId }],
          companionId,
          status: { $in: ["PENDING"] },
          dueAt: { $gte: from },
        }),
      );
    });

    it("listForEmployee: should filter by org and audience", async () => {
      (TaskModel.find as any).mockReturnValue(mockChain([]));

      await TaskService.listForEmployee({
        organisationId: orgId,
        userId,
        status: ["IN_PROGRESS"],
      });

      expect(TaskModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          audience: "EMPLOYEE_TASK",
          organisationId: orgId,
          assignedTo: userId,
        }),
      );
    });

    it("listForCompanion: should filter by companion", async () => {
      (TaskModel.find as any).mockReturnValue(mockChain([]));

      await TaskService.listForCompanion({
        companionId,
        audience: "PARENT_TASK",
      });

      expect(TaskModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          companionId,
          audience: "PARENT_TASK",
        }),
      );
    });
  });

  // ======================================================================
  // 4. LINKING
  // ======================================================================
  describe("Linking", () => {
    it("linkToAppointment: should update appointmentId", async () => {
      const task = mockDoc({ _id: taskId });
      (TaskModel.findById as any).mockReturnValue({
        exec: (jest.fn() as any).mockResolvedValue(task),
      });

      const appId = new Types.ObjectId().toString();
      await TaskService.linkToAppointment({ taskId, appointmentId: appId });

      expect(task.appointmentId).toBe(appId);
      expect(task.save).toHaveBeenCalled();
    });

    it("linkToAppointment: should throw if task not found", async () => {
      (TaskModel.findById as any).mockReturnValue({
        exec: (jest.fn() as any).mockResolvedValue(null),
      });

      await expect(
        TaskService.linkToAppointment({ taskId, appointmentId: "app" }),
      ).rejects.toThrow("Task not found");
    });
  });

  // ======================================================================
  // 5. UTILS / EDGE CASES
  // ======================================================================
  describe("Utils", () => {
    it("normalizeDoseTime: should validate times", async () => {
      // Indirect testing via createCustom
      (TaskModel.create as any).mockResolvedValue(mockDoc({}));

      await TaskService.createCustom({
        category: "C",
        name: "N",
        createdBy: userId,
        assignedTo: userId,
        audience: "EMPLOYEE_TASK",
        // Add companionId because medication requires it
        companionId,
        dueAt: new Date(),
        medication: {
          doses: [
            { time: "08:00" }, // valid
            { time: "8:00" }, // invalid regex
            { time: "invalid" }, // invalid
          ],
        },
      });

      // Only the valid dose should persist
      expect(TaskModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          medication: expect.objectContaining({
            doses: [expect.objectContaining({ time: "08:00" })],
          }),
        }),
      );
    });
  });
});
