import { prisma } from "src/config/prisma";
import { sendEmailTemplate } from "../../src/utils/email";
import logger from "../../src/utils/logger";
import { AuditTrailService } from "../../src/services/audit-trail.service";
import { TaskService } from "../../src/services/task.service";

jest.mock("../../src/services/audit-trail.service", () => ({
  AuditTrailService: {
    recordSafely: jest.fn(),
  },
}));

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
    taskLibraryDefinition: {
      findFirst: jest.fn(),
    },
    taskTemplate: {
      findFirst: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
    companion: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock("../../src/utils/email", () => ({
  sendEmailTemplate: jest.fn(),
}));

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

const mockedPrisma = prisma as unknown as {
  task: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
  taskCompletion: {
    create: jest.Mock;
  };
  taskLibraryDefinition: {
    findFirst: jest.Mock;
  };
  taskTemplate: {
    findFirst: jest.Mock;
  };
  user: {
    findFirst: jest.Mock;
  };
  companion: {
    findFirst: jest.Mock;
  };
};
const mockedAuditTrailService = AuditTrailService as unknown as {
  recordSafely: jest.Mock;
};

describe("TaskService", () => {
  const dueAt = new Date("2026-01-01T12:00:00.000Z");

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a custom task and sends an assignment email", async () => {
    mockedPrisma.task.create.mockResolvedValueOnce({
      id: "task-1",
      organisationId: "org-1",
      audience: "EMPLOYEE_TASK",
      assignedTo: "user-2",
      assignedBy: "user-1",
      createdBy: "user-1",
      companionId: "comp-1",
      dueAt,
      name: "Check vitals",
      additionalNotes: "Take before lunch",
    });
    mockedPrisma.user.findFirst
      .mockResolvedValueOnce({
        email: "assignee@test.com",
        firstName: "Jane",
        lastName: "Doe",
      })
      .mockResolvedValueOnce({
        firstName: "John",
        lastName: "Smith",
      });
    mockedPrisma.companion.findFirst.mockResolvedValueOnce({ name: "Milo" });

    const result = await TaskService.createCustom({
      category: "Care",
      name: "Check vitals",
      createdBy: "user-1",
      assignedBy: "user-1",
      assignedTo: "user-2",
      dueAt,
      audience: "EMPLOYEE_TASK",
      companionId: "comp-1",
      additionalNotes: "Take before lunch",
    });

    await new Promise(process.nextTick);

    expect(mockedPrisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: "CUSTOM",
          assignedTo: "user-2",
          audience: "EMPLOYEE_TASK",
        }),
      }),
    );
    expect(sendEmailTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "assignee@test.com",
        templateId: "taskAssigned",
      }),
    );
    expect(mockedAuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "TASK_CREATED",
        entityType: "TASK",
        entityId: "task-1",
      }),
    );
    expect(result.id).toBe("task-1");
  });

  it("creates a custom task with a group target without emailing a user", async () => {
    mockedPrisma.task.create.mockResolvedValueOnce({
      id: "task-group-1",
      organisationId: "org-1",
      audience: "EMPLOYEE_TASK",
      assignedTo: "user-2",
      assignedGroupId: "group-1",
      assignedBy: "user-1",
      createdBy: "user-1",
      companionId: "comp-1",
      dueAt,
      name: "Check vitals",
      additionalNotes: "Take before lunch",
    });

    const result = await TaskService.createCustom({
      category: "Care",
      name: "Check vitals",
      createdBy: "user-1",
      assignedBy: "user-1",
      assignedTo: "user-2",
      assignedGroupId: "group-1",
      dueAt,
      audience: "EMPLOYEE_TASK",
      companionId: "comp-1",
      additionalNotes: "Take before lunch",
    });

    expect(mockedPrisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assignedGroupId: "group-1",
        }),
      }),
    );
    expect(sendEmailTemplate).not.toHaveBeenCalled();
    expect(mockedAuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "TASK_CREATED",
        entityType: "TASK",
        entityId: "task-group-1",
      }),
    );
    expect(result.assignedGroupId).toBe("group-1");
  });

  it("creates a task from a library definition", async () => {
    mockedPrisma.taskLibraryDefinition.findFirst.mockResolvedValueOnce({
      id: "lib-1",
      isActive: true,
      category: "Library",
      name: "Hydration",
      defaultDescription: "Give water",
    });
    mockedPrisma.task.create.mockResolvedValueOnce({
      id: "task-2",
      organisationId: "org-1",
      companionId: "comp-1",
      audience: "EMPLOYEE_TASK",
      createdBy: "user-1",
      assignedTo: "user-2",
      dueAt,
      name: "Hydration",
    });
    mockedPrisma.user.findFirst.mockResolvedValue({
      email: "assignee@test.com",
      firstName: "Jane",
      lastName: "Doe",
    });

    await TaskService.createFromLibrary({
      libraryTaskId: "lib-1",
      createdBy: "user-1",
      assignedTo: "user-2",
      dueAt,
      audience: "EMPLOYEE_TASK",
    });

    expect(mockedPrisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: "YC_LIBRARY",
          libraryTaskId: "lib-1",
          name: "Hydration",
        }),
      }),
    );
    expect(mockedAuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "TASK_CREATED",
        entityType: "TASK",
        entityId: "task-2",
      }),
    );
  });

  it("creates a task from a template with reminder defaults", async () => {
    mockedPrisma.taskTemplate.findFirst.mockResolvedValueOnce({
      id: "tmpl-1",
      organisationId: "org-1",
      isActive: true,
      defaultRole: "PARENT",
      category: "Discharge",
      name: "Follow up",
      description: "Call owner",
      defaultMedication: null,
      defaultObservationToolId: null,
      defaultRecurrence: {
        type: "DAILY",
        defaultEndOffsetDays: 2,
      },
      defaultReminderOffsetMinutes: 15,
      libraryTaskId: null,
    });
    mockedPrisma.task.create.mockResolvedValueOnce({
      id: "task-3",
      organisationId: "org-1",
      companionId: "comp-1",
      audience: "PARENT_TASK",
      createdBy: "user-1",
      assignedTo: "user-3",
      dueAt,
      name: "Follow up",
    });

    const result = await TaskService.createFromTemplate({
      templateId: "tmpl-1",
      organisationId: "org-1",
      createdBy: "user-1",
      assignedTo: "user-3",
      dueAt,
      companionId: "comp-1",
    });

    expect(mockedPrisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: "ORG_TEMPLATE",
          templateId: "tmpl-1",
          audience: "PARENT_TASK",
        }),
      }),
    );
    expect(mockedAuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "TASK_CREATED",
        entityType: "TASK",
        entityId: "task-3",
      }),
    );
    expect(result.id).toBe("task-3");
  });

  it("creates a task from a workflow seed", async () => {
    mockedPrisma.task.create.mockResolvedValueOnce({
      id: "task-4",
      organisationId: "org-1",
      companionId: "comp-1",
      audience: "PARENT_TASK",
      createdBy: "user-1",
      assignedTo: "parent-1",
      dueAt,
      name: "Discharge follow-up",
    });

    const result = await TaskService.createFromWorkflowSeed(
      {
        source: "ORG_TEMPLATE",
        organisationId: "org-1",
        createdBy: "user-1",
        assignedBy: "user-1",
        assignedTo: "parent-1",
        audience: "PARENT_TASK",
        companionId: "comp-1",
        category: "Discharge",
        name: "Discharge follow-up",
        medication: {
          name: "Antibiotic",
          frequency: "BID",
        },
        dueAt,
      },
      { notify: false },
    );

    expect(mockedPrisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: "ORG_TEMPLATE",
          assignedTo: "parent-1",
          medication: expect.objectContaining({
            name: "Antibiotic",
            frequency: "BID",
          }),
        }),
      }),
    );
    expect(mockedAuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "TASK_CREATED",
        entityType: "TASK",
        entityId: "task-4",
      }),
    );
    expect(result.id).toBe("task-4");
  });

  it("rejects workflow seeds that require a companion but do not provide one", async () => {
    await expect(
      TaskService.createFromWorkflowSeed(
        {
          source: "ORG_TEMPLATE",
          organisationId: "org-1",
          createdBy: "user-1",
          assignedTo: "parent-1",
          audience: "PARENT_TASK",
          category: "Discharge",
          name: "Discharge follow-up",
          dueAt,
        },
        { notify: false },
      ),
    ).rejects.toThrow(
      "companionId is required for parent, medication, or observation tool tasks",
    );
  });

  it("updates a task and blocks reassignment by non-creators", async () => {
    mockedPrisma.task.findFirst.mockResolvedValueOnce({
      id: "task-1",
      organisationId: "org-1",
      createdBy: "user-1",
      assignedTo: "user-2",
      recurrence: null,
      medication: null,
      reminder: null,
      attachments: null,
      syncWithCalendar: false,
    });

    await expect(
      TaskService.updateTask("task-1", { assignedTo: "user-3" }, "user-2"),
    ).rejects.toThrow("Only task creator can reassign task");
  });

  it("reassigns a task to a group for creators", async () => {
    mockedPrisma.task.findFirst.mockResolvedValueOnce({
      id: "task-1",
      organisationId: "org-1",
      companionId: "comp-1",
      createdBy: "user-1",
      assignedTo: "user-2",
      assignedGroupId: null,
      recurrence: null,
      medication: null,
      reminder: null,
      attachments: null,
      syncWithCalendar: false,
    });
    mockedPrisma.task.update.mockResolvedValueOnce({
      id: "task-1",
      organisationId: "org-1",
      companionId: "comp-1",
      assignedGroupId: "group-1",
      assignedBy: "user-1",
    });

    const result = await TaskService.updateTask(
      "task-1",
      { assignedGroupId: "group-1" },
      "user-1",
    );

    expect(mockedPrisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assignedGroupId: "group-1",
          assignedBy: "user-1",
        }),
      }),
    );
    expect(mockedAuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "TASK_REASSIGNED",
        entityType: "TASK",
        entityId: "task-1",
      }),
    );
    expect(result.assignedGroupId).toBe("group-1");
  });

  it("changes status and creates completion records", async () => {
    mockedPrisma.task.findFirst.mockResolvedValueOnce({
      id: "task-1",
      organisationId: "org-1",
      createdBy: "user-1",
      assignedTo: "user-2",
      companionId: "comp-1",
      status: "PENDING",
      completedAt: null,
      completedBy: null,
    });
    mockedPrisma.taskCompletion.create.mockResolvedValueOnce({
      id: "completion-1",
      taskId: "task-1",
      companionId: "comp-1",
      filledBy: "user-2",
      answers: { ok: true },
      score: null,
      summary: null,
      createdAt: new Date(),
    });
    mockedPrisma.task.update.mockResolvedValueOnce({
      id: "task-1",
      organisationId: "org-1",
      companionId: "comp-1",
      status: "COMPLETED",
    });

    const result = await TaskService.changeStatus(
      "task-1",
      "COMPLETED",
      "user-2",
      {
        filledBy: "user-2",
        answers: { ok: true },
      },
    );

    expect(mockedPrisma.taskCompletion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          taskId: "task-1",
          companionId: "comp-1",
        }),
      }),
    );
    expect(mockedAuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "TASK_STATUS_CHANGED",
        entityType: "TASK",
        entityId: "task-1",
      }),
    );
    expect(result.task.status).toBe("COMPLETED");
    expect(result.completion?.id).toBe("completion-1");
  });

  it("lists tasks for a parent", async () => {
    mockedPrisma.task.findMany.mockResolvedValueOnce([{ id: "task-1" }]);

    const result = await TaskService.listForParent({
      parentId: "parent-1",
      status: ["PENDING"],
    });

    expect(mockedPrisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          audience: "PARENT_TASK",
          OR: [{ assignedTo: "parent-1" }, { createdBy: "parent-1" }],
          status: { in: ["PENDING"] },
        }),
      }),
    );
    expect(result).toEqual([{ id: "task-1", _id: "task-1" }]);
  });

  it("lists tasks for an employee", async () => {
    mockedPrisma.task.findMany.mockResolvedValueOnce([{ id: "task-2" }]);

    const result = await TaskService.listForEmployee({
      organisationId: "org-1",
      userId: "user-1",
    });

    expect(mockedPrisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          audience: "EMPLOYEE_TASK",
          organisationId: "org-1",
          assignedTo: "user-1",
        }),
      }),
    );
    expect(result).toEqual([{ id: "task-2", _id: "task-2" }]);
  });

  it("lists tasks for a group", async () => {
    mockedPrisma.task.findMany.mockResolvedValueOnce([{ id: "task-3" }]);

    const result = await TaskService.listForGroup({
      organisationId: "org-1",
      groupId: "group-1",
    });

    expect(mockedPrisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organisationId: "org-1",
          assignedGroupId: "group-1",
        }),
      }),
    );
    expect(result).toEqual([{ id: "task-3", _id: "task-3" }]);
  });

  it("links a task to an appointment", async () => {
    mockedPrisma.task.findFirst.mockResolvedValueOnce({
      id: "task-1",
    });
    mockedPrisma.task.update.mockResolvedValueOnce({
      id: "task-1",
      appointmentId: "appt-1",
    });

    const result = await TaskService.linkToAppointment({
      taskId: "task-1",
      appointmentId: "appt-1",
    });

    expect(result.appointmentId).toBe("appt-1");
  });
});
