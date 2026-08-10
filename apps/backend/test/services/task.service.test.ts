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
    $transaction: jest.fn(),
    task: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    taskCompletion: {
      create: jest.fn(),
    },
    taskLibraryDefinition: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    taskTemplate: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    appointment: {
      findMany: jest.fn(),
    },
    taskSchedule: {
      findMany: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
    patient: {
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
  $transaction: jest.Mock;
  task: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  taskCompletion: {
    create: jest.Mock;
  };
  taskLibraryDefinition: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
  };
  taskTemplate: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
  };
  appointment: {
    findMany: jest.Mock;
  };
  taskSchedule: {
    findMany: jest.Mock;
  };
  user: {
    findFirst: jest.Mock;
  };
  patient: {
    findFirst: jest.Mock;
  };
};
const mockedAuditTrailService = AuditTrailService as unknown as {
  recordSafely: jest.Mock;
};

describe("TaskService", () => {
  const dueAt = new Date("2026-01-01T12:00:00.000Z");

  beforeEach(() => {
    // resetAllMocks, not clearAllMocks: clearAllMocks only wipes call records
    // and leaves queued mockResolvedValueOnce values in place, so a test that
    // throws before consuming its queue poisons the next test with its
    // leftovers and one real failure cascades into several phantom ones.
    // Nothing here sets a base implementation outside a test, so dropping
    // implementations costs nothing.
    jest.resetAllMocks();
  });

  it("creates a custom task and sends an assignment email", async () => {
    mockedPrisma.task.create.mockResolvedValueOnce({
      id: "task-1",
      organisationId: "org-1",
      audience: "EMPLOYEE_TASK",
      assignedTo: "user-2",
      assignedBy: "user-1",
      createdBy: "user-1",
      patientId: "comp-1",
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
    mockedPrisma.patient.findFirst.mockResolvedValueOnce({ name: "Milo" });

    const result = await TaskService.createCustom({
      category: "Care",
      name: "Check vitals",
      createdBy: "user-1",
      assignedBy: "user-1",
      assignedTo: "user-2",
      dueAt,
      audience: "EMPLOYEE_TASK",
      patientId: "comp-1",
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
      patientId: "comp-1",
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
      patientId: "comp-1",
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

  it("persists a valid priority and drops an invalid one on a custom task", async () => {
    mockedPrisma.task.create
      .mockResolvedValueOnce({
        id: "task-p1",
        audience: "EMPLOYEE_TASK",
        assignedTo: "user-2",
        assignedGroupId: "group-1",
        dueAt,
        name: "P",
        priority: "URGENT",
      })
      .mockResolvedValueOnce({
        id: "task-p2",
        audience: "EMPLOYEE_TASK",
        assignedTo: "user-2",
        assignedGroupId: "group-1",
        dueAt,
        name: "P",
        priority: null,
      });

    await TaskService.createCustom({
      category: "Care",
      name: "P",
      createdBy: "user-1",
      assignedBy: "user-1",
      assignedTo: "user-2",
      assignedGroupId: "group-1",
      dueAt,
      audience: "EMPLOYEE_TASK",
      priority: "URGENT",
    });
    expect(mockedPrisma.task.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ priority: "URGENT" }),
      }),
    );

    await TaskService.createCustom({
      category: "Care",
      name: "P",
      createdBy: "user-1",
      assignedBy: "user-1",
      assignedTo: "user-2",
      assignedGroupId: "group-1",
      dueAt,
      audience: "EMPLOYEE_TASK",
      priority: "NONSENSE" as never,
    });
    expect(mockedPrisma.task.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ priority: undefined }),
      }),
    );
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
      patientId: "comp-1",
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
      patientId: "comp-1",
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
      patientId: "comp-1",
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
      patientId: "comp-1",
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
        patientId: "comp-1",
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
      "patientId is required for parent, medication, or observation tool tasks",
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

  it("lets a non-creator edit a task when assignedTo is resent unchanged", async () => {
    // Clients PATCH the whole entity, so assignedTo is echoed back untouched.
    // That is a no-op, not a reassignment, and must not 403 the assignee.
    mockedPrisma.task.findFirst.mockResolvedValueOnce({
      id: "task-1",
      organisationId: "org-1",
      createdBy: "user-1",
      assignedTo: "user-2",
      assignedGroupId: null,
      name: "Old name",
      recurrence: null,
      medication: null,
      reminder: null,
      attachments: null,
      syncWithCalendar: false,
    });
    mockedPrisma.task.update.mockResolvedValueOnce({
      id: "task-1",
      organisationId: "org-1",
      assignedTo: "user-2",
      name: "New name",
    });

    const result = await TaskService.updateTask(
      "task-1",
      { name: "New name", assignedTo: "user-2" },
      "user-2",
    );

    expect(mockedPrisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "New name",
          assignedTo: "user-2",
        }),
      }),
    );
    expect(result.name).toBe("New name");
  });

  it("does not treat an absent assignedTo as a reassignment for non-creators", async () => {
    mockedPrisma.task.findFirst.mockResolvedValueOnce({
      id: "task-1",
      organisationId: "org-1",
      createdBy: "user-1",
      assignedTo: "user-2",
      assignedGroupId: null,
      assignedBy: "user-1",
      name: "Old name",
      recurrence: null,
      medication: null,
      reminder: null,
      attachments: null,
      syncWithCalendar: false,
    });
    mockedPrisma.task.update.mockResolvedValueOnce({
      id: "task-1",
      organisationId: "org-1",
      assignedTo: "user-2",
      name: "New name",
    });

    await expect(
      TaskService.updateTask("task-1", { name: "New name" }, "user-2"),
    ).resolves.toEqual(expect.objectContaining({ name: "New name" }));

    // Neither assignment field is in the payload, so the assignment is left
    // entirely alone: assignedBy stays the original assigner, not the actor.
    expect(mockedPrisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assignedTo: "user-2",
          assignedBy: "user-1",
        }),
      }),
    );
  });

  it("persists a changed priority on update", async () => {
    mockedPrisma.task.findFirst.mockResolvedValueOnce({
      id: "task-1",
      organisationId: "org-1",
      createdBy: "user-1",
      assignedTo: "user-1",
      assignedGroupId: null,
      assignedBy: "user-1",
      name: "Old name",
      priority: null,
      recurrence: null,
      medication: null,
      reminder: null,
      attachments: null,
      syncWithCalendar: false,
    });
    mockedPrisma.task.update.mockResolvedValueOnce({
      id: "task-1",
      organisationId: "org-1",
      assignedTo: "user-1",
      name: "Old name",
      priority: "HIGH",
    });

    await expect(
      TaskService.updateTask("task-1", { priority: "HIGH" }, "user-1"),
    ).resolves.toEqual(expect.objectContaining({ priority: "HIGH" }));

    expect(mockedPrisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ priority: "HIGH" }),
      }),
    );
  });

  it("still blocks a non-creator when assignedTo genuinely changes", async () => {
    mockedPrisma.task.findFirst.mockResolvedValueOnce({
      id: "task-1",
      organisationId: "org-1",
      createdBy: "user-1",
      assignedTo: "user-2",
      assignedGroupId: null,
      recurrence: null,
      medication: null,
      reminder: null,
      attachments: null,
      syncWithCalendar: false,
    });

    await expect(
      TaskService.updateTask(
        "task-1",
        { name: "New name", assignedTo: "user-3" },
        "user-2",
      ),
    ).rejects.toThrow("Only task creator can reassign task");
    expect(mockedPrisma.task.update).not.toHaveBeenCalled();
  });

  it("lets a non-creator edit a task when assignedGroupId is resent unchanged", async () => {
    mockedPrisma.task.findFirst.mockResolvedValueOnce({
      id: "task-1",
      organisationId: "org-1",
      createdBy: "user-1",
      assignedTo: "user-2",
      assignedGroupId: "group-1",
      name: "Old name",
      recurrence: null,
      medication: null,
      reminder: null,
      attachments: null,
      syncWithCalendar: false,
    });
    mockedPrisma.task.update.mockResolvedValueOnce({
      id: "task-1",
      organisationId: "org-1",
      assignedGroupId: "group-1",
      name: "New name",
    });

    const result = await TaskService.updateTask(
      "task-1",
      { name: "New name", assignedGroupId: "group-1" },
      "user-2",
    );

    expect(result.name).toBe("New name");
  });

  it("lets a non-creator edit a task when a null assignedGroupId is resent on an ungrouped task", async () => {
    // A whole-entity PATCH of a task with no group sends assignedGroupId: null.
    // null === null is a no-op, not a clear, so it must not 403.
    mockedPrisma.task.findFirst.mockResolvedValueOnce({
      id: "task-1",
      organisationId: "org-1",
      createdBy: "user-1",
      assignedTo: "user-2",
      assignedGroupId: null,
      name: "Old name",
      recurrence: null,
      medication: null,
      reminder: null,
      attachments: null,
      syncWithCalendar: false,
    });
    mockedPrisma.task.update.mockResolvedValueOnce({
      id: "task-1",
      organisationId: "org-1",
      assignedGroupId: null,
      name: "New name",
    });

    const result = await TaskService.updateTask(
      "task-1",
      { name: "New name", assignedGroupId: null },
      "user-2",
    );

    expect(result.name).toBe("New name");
  });

  it("does not treat an absent assignedGroupId as a group reassignment", async () => {
    mockedPrisma.task.findFirst.mockResolvedValueOnce({
      id: "task-1",
      organisationId: "org-1",
      createdBy: "user-1",
      assignedTo: "user-2",
      assignedGroupId: "group-1",
      name: "Old name",
      recurrence: null,
      medication: null,
      reminder: null,
      attachments: null,
      syncWithCalendar: false,
    });
    mockedPrisma.task.update.mockResolvedValueOnce({
      id: "task-1",
      organisationId: "org-1",
      assignedGroupId: "group-1",
      name: "New name",
    });

    await expect(
      TaskService.updateTask("task-1", { name: "New name" }, "user-2"),
    ).resolves.toEqual(expect.objectContaining({ name: "New name" }));
  });

  it("still blocks a non-creator when assignedGroupId genuinely changes", async () => {
    mockedPrisma.task.findFirst.mockResolvedValueOnce({
      id: "task-1",
      organisationId: "org-1",
      createdBy: "user-1",
      assignedTo: "user-2",
      assignedGroupId: "group-1",
      recurrence: null,
      medication: null,
      reminder: null,
      attachments: null,
      syncWithCalendar: false,
    });

    await expect(
      TaskService.updateTask(
        "task-1",
        { name: "New name", assignedGroupId: "group-2" },
        "user-2",
      ),
    ).rejects.toThrow("Only task creator can reassign task");
    expect(mockedPrisma.task.update).not.toHaveBeenCalled();
  });

  it("still blocks a non-creator clearing assignedGroupId to null", async () => {
    // Clearing a group IS a reassignment, so null must stay guarded.
    mockedPrisma.task.findFirst.mockResolvedValueOnce({
      id: "task-1",
      organisationId: "org-1",
      createdBy: "user-1",
      assignedTo: "user-2",
      assignedGroupId: "group-1",
      recurrence: null,
      medication: null,
      reminder: null,
      attachments: null,
      syncWithCalendar: false,
    });

    await expect(
      TaskService.updateTask(
        "task-1",
        { name: "New name", assignedGroupId: null },
        "user-2",
      ),
    ).rejects.toThrow("Only task creator can reassign task");
    expect(mockedPrisma.task.update).not.toHaveBeenCalled();
  });

  it("does not rewrite assignedBy or emit TASK_REASSIGNED for a no-op whole-entity PATCH", async () => {
    // The client echoes both assignment fields back unchanged. That is not a
    // reassignment: assignedBy must stay the original assigner and no audit
    // event may be emitted, or the audit trail fills with false reassignments.
    mockedPrisma.task.findFirst.mockResolvedValueOnce({
      id: "task-1",
      organisationId: "org-1",
      patientId: "comp-1",
      createdBy: "user-1",
      assignedTo: "user-2",
      assignedGroupId: "group-1",
      assignedBy: "user-1",
      name: "Old name",
      recurrence: null,
      medication: null,
      reminder: null,
      attachments: null,
      syncWithCalendar: false,
    });
    // organisationId + patientId must both be set on the updated row, or
    // recordTaskAudit early-returns and the audit assertion below is vacuous.
    mockedPrisma.task.update.mockResolvedValueOnce({
      id: "task-1",
      organisationId: "org-1",
      patientId: "comp-1",
      assignedTo: "user-2",
      assignedGroupId: "group-1",
      assignedBy: "user-1",
      name: "New name",
    });

    await TaskService.updateTask(
      "task-1",
      { name: "New name", assignedTo: "user-2", assignedGroupId: "group-1" },
      "user-2",
    );

    expect(mockedPrisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ assignedBy: "user-1" }),
      }),
    );
    expect(mockedAuditTrailService.recordSafely).not.toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "TASK_REASSIGNED" }),
    );
  });

  it("sets assignedBy and emits TASK_REASSIGNED with correct values on a real user reassignment", async () => {
    mockedPrisma.task.findFirst.mockResolvedValueOnce({
      id: "task-1",
      organisationId: "org-1",
      patientId: "comp-1",
      createdBy: "user-1",
      assignedTo: "user-2",
      assignedGroupId: null,
      assignedBy: "user-1",
      recurrence: null,
      medication: null,
      reminder: null,
      attachments: null,
      syncWithCalendar: false,
    });
    mockedPrisma.task.update.mockResolvedValueOnce({
      id: "task-1",
      organisationId: "org-1",
      patientId: "comp-1",
      assignedTo: "user-3",
      assignedGroupId: null,
      assignedBy: "user-1",
    });

    await TaskService.updateTask("task-1", { assignedTo: "user-3" }, "user-1");

    expect(mockedPrisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assignedTo: "user-3",
          assignedBy: "user-1",
        }),
      }),
    );
    expect(mockedAuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "TASK_REASSIGNED",
        entityId: "task-1",
        metadata: expect.objectContaining({
          previousAssignedTo: "user-2",
          assignedTo: "user-3",
        }),
      }),
    );
  });

  it("reassigns a task to a group for creators", async () => {
    mockedPrisma.task.findFirst.mockResolvedValueOnce({
      id: "task-1",
      organisationId: "org-1",
      patientId: "comp-1",
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
      patientId: "comp-1",
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
      patientId: "comp-1",
      status: "PENDING",
      completedAt: null,
      completedBy: null,
    });
    mockedPrisma.taskCompletion.create.mockResolvedValueOnce({
      id: "completion-1",
      taskId: "task-1",
      patientId: "comp-1",
      filledBy: "user-2",
      answers: { ok: true },
      score: null,
      summary: null,
      createdAt: new Date(),
    });
    mockedPrisma.task.update.mockResolvedValueOnce({
      id: "task-1",
      organisationId: "org-1",
      patientId: "comp-1",
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
          patientId: "comp-1",
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

  it("filters employee tasks by priority", async () => {
    mockedPrisma.task.findMany.mockResolvedValueOnce([{ id: "task-9" }]);

    await TaskService.listForEmployee({
      organisationId: "org-1",
      userId: "user-1",
      priority: "URGENT",
    });

    expect(mockedPrisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ priority: "URGENT" }),
      }),
    );
  });

  it("lists tasks for an employee with derived schedule, appointment, and kind filters", async () => {
    mockedPrisma.appointment.findMany.mockResolvedValueOnce([{ id: "appt-1" }]);
    mockedPrisma.taskSchedule.findMany.mockResolvedValueOnce([
      { generatedTaskIds: ["task-2"] },
    ]);
    mockedPrisma.taskTemplate.findMany.mockResolvedValueOnce([
      { id: "tmpl-1" },
    ]);
    mockedPrisma.taskLibraryDefinition.findMany.mockResolvedValueOnce([
      { id: "lib-1" },
    ]);
    mockedPrisma.task.findMany.mockResolvedValueOnce([{ id: "task-2" }]);

    await TaskService.listForEmployee({
      organisationId: "org-1",
      userId: "user-1",
      appointmentId: "appt-1",
      encounterId: "enc-1",
      scheduleId: "schedule-1",
      kind: "MEDICATION",
      status: ["PENDING"],
      category: "CARE",
      subcategory: "Medication prep",
    });

    expect(mockedPrisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { encounterId: "enc-1", organisationId: "org-1" },
      }),
    );
    expect(mockedPrisma.taskSchedule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "schedule-1", organisationId: "org-1" },
      }),
    );
    expect(mockedPrisma.taskTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organisationId: "org-1", kind: "MEDICATION" },
      }),
    );
    expect(mockedPrisma.taskLibraryDefinition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { kind: "MEDICATION" },
      }),
    );

    const query = mockedPrisma.task.findMany.mock.calls[0]?.[0];
    expect(query.where).toEqual(
      expect.objectContaining({
        AND: expect.arrayContaining([
          expect.objectContaining({
            organisationId: "org-1",
            audience: "EMPLOYEE_TASK",
            assignedTo: "user-1",
            category: "CARE",
            subcategory: "Medication prep",
            status: { in: ["PENDING"] },
          }),
          expect.objectContaining({
            appointmentId: { in: ["appt-1"] },
          }),
          expect.objectContaining({
            id: { in: ["task-2"] },
          }),
          expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                templateId: { in: ["tmpl-1"] },
              }),
              expect.objectContaining({
                libraryTaskId: { in: ["lib-1"] },
              }),
            ]),
          }),
        ]),
      }),
    );
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

  it("lists tasks for a companion with includeCompleted enabled", async () => {
    mockedPrisma.task.findMany.mockResolvedValueOnce([{ id: "task-4" }]);

    await TaskService.listForCompanion({
      patientId: "comp-1",
      organisationId: "org-1",
      companionId: "comp-1",
      clientId: "comp-1",
      includeCompleted: true,
    });

    const query = mockedPrisma.task.findMany.mock.calls[0]?.[0];
    expect(query.where).toEqual(
      expect.objectContaining({
        patientId: "comp-1",
        organisationId: "org-1",
      }),
    );
    expect(query.where.status).toBeUndefined();
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

  describe("organisation binding", () => {
    it("scopes getById to the supplied organisationId", async () => {
      mockedPrisma.task.findFirst.mockResolvedValueOnce(null);

      const result = await TaskService.getById("task-1", "org-1");

      expect(mockedPrisma.task.findFirst).toHaveBeenCalledWith({
        where: { id: "task-1", organisationId: "org-1" },
      });
      expect(result).toBeNull();
    });

    it("returns null for a task that belongs to another organisation", async () => {
      // Cross-tenant read attempt: task exists but not in org-1, so the
      // org-scoped findFirst yields no row.
      mockedPrisma.task.findFirst.mockResolvedValueOnce(null);

      const result = await TaskService.getById("task-other-org", "org-1");

      expect(result).toBeNull();
    });

    it("does not org-scope getById when no organisationId is supplied (mobile)", async () => {
      mockedPrisma.task.findFirst.mockResolvedValueOnce(null);

      await TaskService.getById("task-1");

      expect(mockedPrisma.task.findFirst).toHaveBeenCalledWith({
        where: { id: "task-1" },
      });
    });

    it("scopes updateTask lookup to the supplied organisationId", async () => {
      mockedPrisma.task.findFirst.mockResolvedValueOnce(null);

      await expect(
        TaskService.updateTask("task-1", { name: "x" }, "user-1", "org-1"),
      ).rejects.toThrow("Task not found");

      expect(mockedPrisma.task.findFirst).toHaveBeenCalledWith({
        where: { id: "task-1", organisationId: "org-1" },
      });
    });

    it("scopes changeStatus lookup to the supplied organisationId", async () => {
      mockedPrisma.task.findFirst.mockResolvedValueOnce(null);

      await expect(
        TaskService.changeStatus(
          "task-1",
          "COMPLETED",
          "user-1",
          undefined,
          "org-1",
        ),
      ).rejects.toThrow("Task not found");

      expect(mockedPrisma.task.findFirst).toHaveBeenCalledWith({
        where: { id: "task-1", organisationId: "org-1" },
      });
    });
  });

  // A recurrence scope fans one authorized task id out across the series.
  // Ownership was only proven for the URL task, so the other rows must be
  // re-checked before they are written.
  describe("recurring series ownership", () => {
    const seriesTask = (overrides: Record<string, unknown> = {}) => ({
      id: "task-1",
      organisationId: "org-1",
      createdBy: "actor-1",
      assignedTo: "actor-1",
      dueAt: new Date("2026-02-01T09:00:00.000Z"),
      status: "PENDING",
      recurrence: { type: "DAILY", isMaster: true },
      ...overrides,
    });

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("rejects scope=ALL when the series contains a row the actor does not own", async () => {
      mockedPrisma.task.findFirst.mockResolvedValueOnce(seriesTask() as never);
      mockedPrisma.task.findMany.mockResolvedValueOnce([
        seriesTask(),
        seriesTask({
          id: "task-2",
          createdBy: "someone-else",
          assignedTo: "someone-else",
          dueAt: new Date("2026-02-02T09:00:00.000Z"),
          recurrence: { type: "DAILY", masterTaskId: "task-1" },
        }),
      ] as never);

      await expect(
        TaskService.updateTask(
          "task-1",
          { name: "hijacked" },
          "actor-1",
          "ALL",
          "org-1",
        ),
      ).rejects.toMatchObject({ statusCode: 403 });

      expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
    });

    it("rejects deleteTask scope=ALL when a series row is not owned", async () => {
      mockedPrisma.task.findFirst.mockResolvedValueOnce(seriesTask() as never);
      mockedPrisma.task.findMany.mockResolvedValueOnce([
        {
          id: "task-1",
          dueAt: new Date("2026-02-01T09:00:00.000Z"),
          createdBy: "actor-1",
          assignedTo: "actor-1",
        },
        {
          id: "task-2",
          dueAt: new Date("2026-02-02T09:00:00.000Z"),
          createdBy: "someone-else",
          assignedTo: "someone-else",
        },
      ] as never);

      await expect(
        TaskService.deleteTask("task-1", "actor-1", "ALL", "org-1"),
      ).rejects.toMatchObject({ statusCode: 403 });

      expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
    });

    it("scopes the deleteTask lookup to the supplied organisationId", async () => {
      mockedPrisma.task.findFirst.mockResolvedValueOnce(null);

      await expect(
        TaskService.deleteTask("task-1", "actor-1", "THIS", "org-1"),
      ).rejects.toThrow("Task not found");

      expect(mockedPrisma.task.findFirst).toHaveBeenCalledWith({
        where: { id: "task-1", organisationId: "org-1" },
      });
    });

    it("allows scope=ALL when the actor owns every row", async () => {
      mockedPrisma.task.findFirst.mockResolvedValueOnce(seriesTask() as never);
      mockedPrisma.task.findMany.mockResolvedValueOnce([
        seriesTask(),
        seriesTask({
          id: "task-2",
          dueAt: new Date("2026-02-02T09:00:00.000Z"),
          recurrence: { type: "DAILY", masterTaskId: "task-1" },
        }),
      ] as never);
      const txUpdate = jest
        .fn()
        .mockResolvedValue(seriesTask({ name: "renamed" }));
      mockedPrisma.$transaction.mockImplementationOnce(
        async (cb: (tx: unknown) => Promise<unknown>) =>
          cb({ task: { update: txUpdate } }),
      );

      await TaskService.updateTask(
        "task-1",
        { name: "renamed" },
        "actor-1",
        "ALL",
        "org-1",
      );

      expect(txUpdate).toHaveBeenCalledTimes(2);
    });

    it("splits the series on THIS_AND_FOLLOWING, capping the master and re-parenting future rows", async () => {
      const occurrenceDueAt = new Date("2026-02-02T09:00:00.000Z");
      const occurrence = seriesTask({
        id: "task-2",
        dueAt: occurrenceDueAt,
        recurrence: { type: "DAILY", masterTaskId: "task-1" },
      });
      mockedPrisma.task.findFirst.mockResolvedValueOnce(occurrence as never);
      mockedPrisma.task.findMany.mockResolvedValueOnce([
        seriesTask({
          recurrence: {
            type: "DAILY",
            isMaster: true,
            cronExpression: "0 9 * * *",
          },
        }),
        occurrence,
        seriesTask({
          id: "task-3",
          dueAt: new Date("2026-02-03T09:00:00.000Z"),
          recurrence: { type: "DAILY", masterTaskId: "task-1" },
        }),
      ] as never);
      const txUpdate = jest
        .fn()
        .mockResolvedValue(seriesTask({ id: "task-2", name: "renamed" }));
      mockedPrisma.$transaction.mockImplementationOnce(
        async (cb: (tx: unknown) => Promise<unknown>) =>
          cb({ task: { update: txUpdate } }),
      );

      const result = await TaskService.updateTask(
        "task-2",
        { name: "renamed" },
        "actor-1",
        "THIS_AND_FOLLOWING",
        "org-1",
      );

      // current occurrence + old master + one future row
      expect(txUpdate).toHaveBeenCalledTimes(3);
      expect(txUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "task-1" },
          data: expect.objectContaining({
            recurrence: expect.objectContaining({
              endDate: new Date(occurrenceDueAt.getTime() - 1),
            }),
          }),
        }),
      );
      expect(txUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "task-3" },
          data: expect.objectContaining({
            recurrence: expect.objectContaining({ masterTaskId: "task-2" }),
          }),
        }),
      );
      expect(result.id).toBe("task-2");
    });
  });
});
