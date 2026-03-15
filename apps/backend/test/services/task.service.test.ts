import { TaskService } from "../../src/services/task.service";
import TaskModel from "../../src/models/task";
import TaskLibraryDefinitionModel from "../../src/models/taskLibraryDefinition";
import TaskTemplateModel from "../../src/models/taskTemplate";
import UserModel from "../../src/models/user";
import TaskCompletionModel from "../../src/models/taskCompletion";
import { sendEmailTemplate } from "../../src/utils/email";
import logger from "../../src/utils/logger";
import { prisma } from "src/config/prisma";

// --- Mocks ---
jest.mock("../../src/models/task");
jest.mock("../../src/models/taskLibraryDefinition");
jest.mock("../../src/models/taskTemplate");
jest.mock("../../src/models/companion");
jest.mock("../../src/models/user");
jest.mock("../../src/models/taskCompletion");
jest.mock("../../src/utils/email");
jest.mock("../../src/utils/logger");

jest.mock("src/config/prisma", () => ({
  prisma: {
    task: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    taskCompletion: {
      create: jest.fn(),
    },
  },
}));

// Helpers for Mongoose Chains
const mockChain = (result: any) => ({
  select: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(result),
  exec: jest.fn().mockResolvedValue(result),
});

const mockDoc = (data: any) => ({
  ...data,
  save: jest.fn().mockResolvedValue(data),
  toObject: jest.fn().mockReturnValue(data),
  _id: data._id ?? "task-id",
});

describe("TaskService", () => {
  const mockDate = new Date("2025-01-01T12:00:00Z");
  const libraryTaskId = "507f1f77bcf86cd799439011";
  const templateId = "507f1f77bcf86cd799439012";
  const otherTemplateId = "507f1f77bcf86cd799439013";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Postgres branches", () => {
    const originalReadFromPostgres = process.env.READ_FROM_POSTGRES;

    beforeEach(() => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.task.create as jest.Mock).mockReset();
      (prisma.task.findFirst as jest.Mock).mockReset();
      (prisma.task.findMany as jest.Mock).mockReset();
      (prisma.task.update as jest.Mock).mockReset();
      (prisma.taskCompletion.create as jest.Mock).mockReset();
    });

    afterEach(() => {
      process.env.READ_FROM_POSTGRES = originalReadFromPostgres;
    });

    it("createCustom creates task via prisma", async () => {
      (prisma.task.create as jest.Mock).mockResolvedValueOnce({
        id: "task-1",
        createdBy: "u1",
        assignedTo: "u2",
      });

      const result = await TaskService.createCustom({
        category: "Cat",
        name: "Task",
        createdBy: "u1",
        assignedTo: "u2",
        dueAt: mockDate,
        audience: "EMPLOYEE_TASK",
      });

      expect(prisma.task.create).toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({ id: "task-1", createdBy: "u1" }),
      );
    });

    it("changeStatus updates task and creates completion", async () => {
      (prisma.task.findFirst as jest.Mock).mockResolvedValueOnce({
        id: "task-1",
        assignedTo: "u1",
        createdBy: "u2",
        status: "PENDING",
        companionId: "comp-1",
        completedAt: null,
        completedBy: null,
      });
      (prisma.taskCompletion.create as jest.Mock).mockResolvedValueOnce({
        id: "comp-1",
      });
      (prisma.task.update as jest.Mock).mockResolvedValueOnce({
        id: "task-1",
        status: "COMPLETED",
      });

      const res = await TaskService.changeStatus("task-1", "COMPLETED", "u1", {
        answers: [{ questionId: "q1", answer: "a1" }],
      } as any);

      expect(prisma.taskCompletion.create).toHaveBeenCalled();
      expect(res.task.status).toBe("COMPLETED");
    });

    it("getById returns task via prisma", async () => {
      (prisma.task.findFirst as jest.Mock).mockResolvedValueOnce({
        id: "task-1",
      });
      const res = await TaskService.getById("task-1");
      expect(res).toEqual(expect.objectContaining({ id: "task-1" }));
    });

    it("listForParent returns tasks", async () => {
      (prisma.task.findMany as jest.Mock).mockResolvedValueOnce([
        { id: "task-1" },
      ]);
      const res = await TaskService.listForParent({ parentId: "p1" });
      expect(res).toHaveLength(1);
      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            audience: "PARENT_TASK",
            OR: [{ assignedTo: "p1" }, { createdBy: "p1" }],
          }),
        }),
      );
    });

    it("listForEmployee returns tasks", async () => {
      (prisma.task.findMany as jest.Mock).mockResolvedValueOnce([
        { id: "task-1" },
      ]);
      const res = await TaskService.listForEmployee({
        organisationId: "org-1",
      });
      expect(res).toHaveLength(1);
      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organisationId: "org-1",
            audience: "EMPLOYEE_TASK",
          }),
        }),
      );
    });

    it("listForCompanion returns tasks", async () => {
      (prisma.task.findMany as jest.Mock).mockResolvedValueOnce([
        { id: "task-1" },
      ]);
      const res = await TaskService.listForCompanion({ companionId: "c1" });
      expect(res).toHaveLength(1);
      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companionId: "c1" }),
        }),
      );
    });

    it("linkToAppointment updates task", async () => {
      (prisma.task.findFirst as jest.Mock).mockResolvedValueOnce({
        id: "task-1",
      });
      (prisma.task.update as jest.Mock).mockResolvedValueOnce({
        id: "task-1",
        appointmentId: "appt-1",
      });

      const res = await TaskService.linkToAppointment({
        taskId: "task-1",
        appointmentId: "appt-1",
      });
      expect(res.appointmentId).toBe("appt-1");
    });
  });

  // --- Helper Tests (Indirectly tested via public methods, but explicit checks ensure coverage) ---

  describe("Internal Helpers (Medication & Recurrence)", () => {
    // We test these via createCustom to hit the private functions
    it("should sanitize medication input (valid)", async () => {
      (TaskModel.create as jest.Mock).mockResolvedValue(mockDoc({}));

      await TaskService.createCustom({
        category: "Health",
        name: "Meds",
        createdBy: "u1",
        assignedTo: "u1",
        dueAt: mockDate,
        audience: "EMPLOYEE_TASK",
        companionId: "c1", // FIX: Required when medication is present
        medication: {
          name: "  Pill  ",
          type: "  Type  ",
          notes: "  Note  ",
          doses: [{ time: "08:00", dosage: " 5mg ", instructions: " food " }],
        },
      });

      expect(TaskModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          medication: {
            name: "Pill",
            type: "Type",
            notes: "Note",
            doses: [{ time: "08:00", dosage: "5mg", instructions: "food" }],
          },
        }),
      );
    });

    it("should filter invalid medication doses", async () => {
      (TaskModel.create as jest.Mock).mockResolvedValue(mockDoc({}));

      await TaskService.createCustom({
        category: "Health",
        name: "Meds",
        createdBy: "u1",
        assignedTo: "u1",
        dueAt: mockDate,
        audience: "EMPLOYEE_TASK",
        companionId: "c1", // FIX: Required when medication is present
        medication: {
          doses: [
            { time: "invalid" }, // Invalid time format
            { time: "08:00" }, // Valid
            { dosage: "5mg" }, // Valid (no time required if dosage present)
          ],
        },
      });

      expect(TaskModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          medication: {
            doses: [
              { time: "08:00", dosage: undefined, instructions: undefined },
              { time: undefined, dosage: "5mg", instructions: undefined },
            ],
          },
        }),
      );
    });

    it("should return undefined for empty medication object", async () => {
      (TaskModel.create as jest.Mock).mockResolvedValue(mockDoc({}));
      await TaskService.createCustom({
        category: "C",
        name: "N",
        createdBy: "u1",
        assignedTo: "u1",
        dueAt: mockDate,
        audience: "EMPLOYEE_TASK",
        medication: { name: "", doses: [] },
      });
      expect(TaskModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          medication: undefined,
        }),
      );
    });

    it("should build ONCE recurrence correctly", async () => {
      (TaskModel.create as jest.Mock).mockResolvedValue(mockDoc({}));
      await TaskService.createCustom({
        category: "C",
        name: "N",
        createdBy: "u1",
        assignedTo: "u1",
        dueAt: mockDate,
        audience: "EMPLOYEE_TASK",
        recurrence: { type: "ONCE" },
      });
      expect(TaskModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recurrence: expect.objectContaining({
            type: "ONCE",
            isMaster: false,
          }),
        }),
      );
    });

    it("should build RECURRING recurrence correctly", async () => {
      (TaskModel.create as jest.Mock).mockResolvedValue(mockDoc({}));
      await TaskService.createCustom({
        category: "C",
        name: "N",
        createdBy: "u1",
        assignedTo: "u1",
        dueAt: mockDate,
        audience: "EMPLOYEE_TASK",
        recurrence: {
          type: "DAILY",
          cronExpression: "* * *",
          endDate: mockDate,
        },
      });
      expect(TaskModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recurrence: expect.objectContaining({
            type: "DAILY",
            isMaster: true,
            endDate: mockDate,
          }),
        }),
      );
    });
  });

  // --- Creation Methods ---

  describe("createFromLibrary", () => {
    it("should create task from library definition", async () => {
      const libraryTask = {
        _id: libraryTaskId,
        isActive: true,
        category: "Cat",
        name: "LibName",
        defaultDescription: "Desc",
      };
      (TaskLibraryDefinitionModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(libraryTask),
      });
      (TaskModel.create as jest.Mock).mockResolvedValue(
        mockDoc({ name: "LibName" }),
      );

      await TaskService.createFromLibrary({
        libraryTaskId,
        createdBy: "u1",
        assignedTo: "u2",
        dueAt: mockDate,
        audience: "EMPLOYEE_TASK",
        reminder: { enabled: true, offsetMinutes: 30 },
      });

      expect(TaskModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          source: "YC_LIBRARY",
          name: "LibName",
          reminder: {
            enabled: true,
            offsetMinutes: 30,
            scheduledNotificationId: undefined,
          },
        }),
      );
    });

    it("should throw 404 if library task not found or inactive", async () => {
      (TaskLibraryDefinitionModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(
        TaskService.createFromLibrary({ libraryTaskId } as any),
      ).rejects.toThrow("Library task not found");
    });

    it("should validate companion requirement for PARENT_TASK", async () => {
      (TaskLibraryDefinitionModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ isActive: true }),
      });
      await expect(
        TaskService.createFromLibrary({
          libraryTaskId,
          audience: "PARENT_TASK",
          companionId: undefined,
        } as any),
      ).rejects.toThrow("companionId is required");
    });
  });

  describe("createFromTemplate", () => {
    const validTemplate = {
      _id: templateId,
      isActive: true,
      organisationId: "org1",
      defaultRole: "EMPLOYEE",
      defaultRecurrence: { type: "DAILY", defaultEndOffsetDays: 7 },
      defaultReminderOffsetMinutes: 15,
    };

    it("should create task from template", async () => {
      (TaskTemplateModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(validTemplate),
      });
      (TaskModel.create as jest.Mock).mockResolvedValue(mockDoc({}));

      await TaskService.createFromTemplate({
        templateId,
        organisationId: "org1",
        createdBy: "u1",
        assignedTo: "u1",
        dueAt: mockDate,
      });

      expect(TaskModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          source: "ORG_TEMPLATE",
          recurrence: expect.objectContaining({ type: "DAILY" }), // Calculated end date logic
          reminder: expect.objectContaining({ offsetMinutes: 15 }),
        }),
      );
    });

    it("should throw if template org mismatch", async () => {
      (TaskTemplateModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(validTemplate),
      });
      await expect(
        TaskService.createFromTemplate({
          templateId,
          organisationId: "org2", // Mismatch
        } as any),
      ).rejects.toThrow("Template does not belong to organisation");
    });

    it("should throw 404 if template not found", async () => {
      (TaskTemplateModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(
        TaskService.createFromTemplate({ templateId: otherTemplateId } as any),
      ).rejects.toThrow("not found");
    });
  });

  describe("createCustom", () => {
    it("should create a custom task", async () => {
      (TaskModel.create as jest.Mock).mockResolvedValue(
        mockDoc({ _id: "t1", audience: "EMPLOYEE_TASK" }),
      );

      const result = await TaskService.createCustom({
        category: "Misc",
        name: "Custom Task",
        createdBy: "u1",
        assignedTo: "u1",
        dueAt: mockDate,
        audience: "EMPLOYEE_TASK",
      });

      expect(result).toBeDefined();
      expect(TaskModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ source: "CUSTOM" }),
      );
    });

    it("should throw if name/category missing", async () => {
      await expect(
        TaskService.createCustom({ name: "" } as any),
      ).rejects.toThrow("category and name are required");
    });
  });

  // --- Email Notification Logic ---

  describe("sendTaskAssignmentEmail (Private function triggered via create)", () => {
    it("should send email if audience is EMPLOYEE_TASK", async () => {
      // Setup mock return for TaskModel.create
      const taskDoc = mockDoc({
        _id: "t1",
        audience: "EMPLOYEE_TASK",
        name: "Task",
        assignedTo: "u2",
        createdBy: "u1",
        dueAt: mockDate,
      });
      (TaskModel.create as jest.Mock).mockResolvedValue(taskDoc);

      // Setup User mocks for email logic
      (UserModel.findOne as jest.Mock)
        .mockReturnValueOnce(
          mockChain({
            email: "u2@test.com",
            firstName: "User",
            lastName: "Two",
          }),
        ) // Assignee
        .mockReturnValueOnce(mockChain({ firstName: "User", lastName: "One" })); // Assigner

      await TaskService.createCustom({
        category: "C",
        name: "T",
        createdBy: "u1",
        assignedTo: "u2",
        dueAt: mockDate,
        audience: "EMPLOYEE_TASK",
      });

      // We need to wait a tick because sendTaskAssignmentEmail is called without await (void)
      await new Promise(process.nextTick);

      expect(sendEmailTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "u2@test.com",
          templateId: "taskAssigned",
          templateData: expect.objectContaining({ taskName: "Task" }),
        }),
      );
    });

    it("should NOT send email if audience is PARENT_TASK", async () => {
      const taskDoc = mockDoc({
        _id: "t1",
        audience: "PARENT_TASK",
        assignedTo: "u2",
        createdBy: "u1",
        companionId: "c1",
        dueAt: mockDate,
      });
      (TaskModel.create as jest.Mock).mockResolvedValue(taskDoc);

      await TaskService.createCustom({
        category: "C",
        name: "T",
        createdBy: "u1",
        assignedTo: "u2",
        dueAt: mockDate,
        audience: "PARENT_TASK",
        companionId: "c1",
      });

      await new Promise(process.nextTick);
      expect(sendEmailTemplate).not.toHaveBeenCalled();
    });

    it("should catch errors during email sending", async () => {
      const taskDoc = mockDoc({
        _id: "t1",
        audience: "EMPLOYEE_TASK",
        assignedTo: "u2",
        dueAt: mockDate,
      });
      (TaskModel.create as jest.Mock).mockResolvedValue(taskDoc);
      (UserModel.findOne as jest.Mock).mockReturnValue(
        mockChain({ email: "u2@test.com" }),
      );
      (sendEmailTemplate as jest.Mock).mockRejectedValue(
        new Error("Mail Fail"),
      );

      await TaskService.createCustom({
        category: "C",
        name: "T",
        createdBy: "u1",
        assignedTo: "u2",
        dueAt: mockDate,
        audience: "EMPLOYEE_TASK",
      });
      await new Promise(process.nextTick);

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to send task assignment email"),
        expect.anything(),
      );
    });
  });

  // --- Update Operations ---

  describe("updateTask", () => {
    it("should allow creator to update and reassign", async () => {
      const task = mockDoc({ createdBy: "u1", assignedTo: "u1" });
      (TaskModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(task),
      });

      await TaskService.updateTask(
        "t1",
        { assignedTo: "u2", name: "New Name" },
        "u1",
      );

      expect(task.assignedTo).toBe("u2");
      expect(task.name).toBe("New Name");
      expect(task.save).toHaveBeenCalled();
    });

    it("should forbid non-creator from reassigning", async () => {
      const task = mockDoc({ createdBy: "u1", assignedTo: "u2" }); // u2 is assignee, not creator
      (TaskModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(task),
      });

      await expect(
        TaskService.updateTask("t1", { assignedTo: "u3" }, "u2"),
      ).rejects.toThrow("Only task creator can reassign task");
    });

    it("should forbid random user from updating", async () => {
      const task = mockDoc({ createdBy: "u1", assignedTo: "u2" });
      (TaskModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(task),
      });

      await expect(
        TaskService.updateTask("t1", { name: "Hack" }, "u3"),
      ).rejects.toThrow("Not allowed to update this task");
    });

    it("should handle complex updates (medication, reminder, recurrence)", async () => {
      const task = mockDoc({
        createdBy: "u1",
        assignedTo: "u1",
        recurrence: { type: "ONCE" },
      });
      (TaskModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(task),
      });

      await TaskService.updateTask(
        "t1",
        {
          medication: null, // Clear med
          reminder: null, // Clear reminder
          recurrence: { type: "DAILY" }, // Change recurrence
        },
        "u1",
      );

      expect(task.medication).toBeUndefined();
      expect(task.reminder).toBeUndefined();
      expect(task.recurrence.type).toBe("DAILY");
    });

    it("should handle recurrence updates when existing recurrence is null", async () => {
      const task = mockDoc({
        createdBy: "u1",
        assignedTo: "u1",
        recurrence: undefined,
      });
      (TaskModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(task),
      });

      await TaskService.updateTask(
        "t1",
        { recurrence: { type: "DAILY" } },
        "u1",
      );
      expect(task.recurrence).toBeDefined();
    });

    it("should handle recurrence updates clearing recurrence", async () => {
      const task = mockDoc({
        createdBy: "u1",
        assignedTo: "u1",
        recurrence: {},
      });
      (TaskModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(task),
      });

      await TaskService.updateTask("t1", { recurrence: null }, "u1");
      expect(task.recurrence).toBeUndefined();
    });
  });

  describe("changeStatus", () => {
    it("should change status to IN_PROGRESS", async () => {
      const task = mockDoc({ createdBy: "u1", status: "PENDING" });
      (TaskModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(task),
      });

      await TaskService.changeStatus("t1", "IN_PROGRESS", "u1");
      expect(task.status).toBe("IN_PROGRESS");
    });

    it("should change status to COMPLETED and create Completion record", async () => {
      const task = mockDoc({
        _id: "t1",
        createdBy: "u1",
        status: "IN_PROGRESS",
        companionId: "c1",
      });
      (TaskModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(task),
      });
      (TaskCompletionModel.create as jest.Mock).mockResolvedValue({
        _id: "comp1",
      });

      const result = await TaskService.changeStatus("t1", "COMPLETED", "u1", {
        filledBy: "u1",
        answers: { q: 1 },
      });

      expect(task.status).toBe("COMPLETED");
      expect(task.completedAt).toBeDefined();
      expect(TaskCompletionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ taskId: "t1" }),
      );
      expect(result.completion).toBeDefined();
    });

    it("should throw if task already finished", async () => {
      const task = mockDoc({ createdBy: "u1", status: "COMPLETED" });
      (TaskModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(task),
      });
      await expect(
        TaskService.changeStatus("t1", "PENDING", "u1"),
      ).rejects.toThrow("Task already finished");
    });

    it("should handle arbitrary status change", async () => {
      const task = mockDoc({ createdBy: "u1", status: "IN_PROGRESS" });
      (TaskModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(task),
      });
      await TaskService.changeStatus("t1", "PENDING", "u1");
      expect(task.status).toBe("PENDING");
    });
  });

  // --- List Queries ---

  describe("getById", () => {
    it("should return task", async () => {
      (TaskModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue("task"),
      });
      expect(await TaskService.getById("t1")).toBe("task");
    });
  });

  describe("listForParent", () => {
    it("should list tasks with correct filters", async () => {
      (TaskModel.find as jest.Mock).mockReturnValue(mockChain([]));

      await TaskService.listForParent({
        parentId: "p1",
        companionId: "c1",
        fromDueAt: mockDate,
        status: ["PENDING"],
      });

      expect(TaskModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          audience: "PARENT_TASK",
          companionId: "c1",
          status: { $in: ["PENDING"] },
          dueAt: { $gte: mockDate },
        }),
      );
    });
  });

  describe("listForEmployee", () => {
    it("should list tasks with correct filters", async () => {
      (TaskModel.find as jest.Mock).mockReturnValue(mockChain([]));

      await TaskService.listForEmployee({
        organisationId: "o1",
        userId: "u1",
      });

      expect(TaskModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          audience: "EMPLOYEE_TASK",
          organisationId: "o1",
          assignedTo: "u1",
        }),
      );
    });
  });

  describe("listForCompanion", () => {
    it("should list tasks for companion", async () => {
      (TaskModel.find as jest.Mock).mockReturnValue(mockChain([]));
      await TaskService.listForCompanion({
        companionId: "c1",
        audience: "PARENT_TASK",
      });
      expect(TaskModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          companionId: "c1",
          audience: "PARENT_TASK",
        }),
      );
    });
  });

  describe("linkToAppointment", () => {
    it("should update appointmentId", async () => {
      const task = mockDoc({});
      (TaskModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(task),
      });

      await TaskService.linkToAppointment({
        taskId: "t1",
        appointmentId: "a1",
      });
      expect(task.appointmentId).toBe("a1");
      expect(task.save).toHaveBeenCalled();
    });

    it("should throw if task not found", async () => {
      (TaskModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(
        TaskService.linkToAppointment({ taskId: "t1", appointmentId: "a1" }),
      ).rejects.toThrow("not found");
    });
  });
});
