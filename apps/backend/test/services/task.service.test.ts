import { Prisma } from "@prisma/client";
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

  // ------------------------------------------------------------------
  // Medication normalisation (sanitizeMedication + normalizeDoseTime)
  // ------------------------------------------------------------------
  describe("medication normalisation", () => {
    const createdRow = {
      id: "task-med",
      organisationId: "org-1",
      patientId: "comp-1",
      audience: "EMPLOYEE_TASK",
      assignedTo: "user-2",
      // A group target short-circuits the assignment email, keeping these
      // tests focused on the persisted payload.
      assignedGroupId: "group-1",
      createdBy: "user-1",
      dueAt,
      name: "Meds",
    };

    const createWithMedication = async (medication: unknown) => {
      mockedPrisma.task.create.mockResolvedValueOnce(createdRow as never);
      await TaskService.createCustom({
        category: "CARE",
        name: "Meds",
        createdBy: "user-1",
        assignedTo: "user-2",
        assignedGroupId: "group-1",
        patientId: "comp-1",
        dueAt,
        audience: "EMPLOYEE_TASK",
        medication: medication as never,
      });
      return mockedPrisma.task.create.mock.calls[0][0].data;
    };

    it("trims dose fields, drops malformed dose times, and removes fully empty doses", async () => {
      const data = await createWithMedication({
        name: "  Amoxicillin  ",
        type: "  Tablet  ",
        notes: "  After meals  ",
        frequency: "  BID  ",
        doses: [
          {
            time: " 08:00 ",
            dosage: "  5mg  ",
            instructions: "  with food  ",
          },
          // "8:00" fails the HH:mm shape, and with no other field the whole
          // dose is dropped rather than persisted as an empty object.
          { time: "8:00" },
          { time: 123, dosage: 456, instructions: "  crush  " },
        ],
      });

      expect(data.medication).toEqual({
        name: "Amoxicillin",
        type: "Tablet",
        notes: "After meals",
        frequency: "BID",
        doses: [
          { time: "08:00", dosage: "5mg", instructions: "with food" },
          { time: undefined, dosage: undefined, instructions: "crush" },
        ],
      });
    });

    it("drops a medication whose scalar fields are all blank and has no doses", async () => {
      const data = await createWithMedication({
        name: "   ",
        type: "   ",
        notes: "   ",
        frequency: "   ",
        doses: [],
      });

      expect(data.medication).toBeUndefined();
    });

    it("drops a medication whose every dose is unusable", async () => {
      const data = await createWithMedication({
        name: "   ",
        doses: [{ time: "8:00" }, { time: "noon" }],
      });

      expect(data.medication).toBeUndefined();
    });

    it("keeps a medication that only carries a name", async () => {
      const data = await createWithMedication({ name: " Metacam " });

      expect(data.medication).toEqual({
        name: "Metacam",
        type: undefined,
        notes: undefined,
        frequency: undefined,
        doses: undefined,
      });
    });

    it("discards non-string scalar fields instead of persisting them", async () => {
      const data = await createWithMedication({
        name: 42,
        type: " Tablet ",
        notes: { text: "nope" },
        frequency: ["BID"],
      });

      expect(data.medication).toEqual({
        name: undefined,
        type: "Tablet",
        notes: undefined,
        frequency: undefined,
        doses: undefined,
      });
    });

    it("requires a companion when a medication survives sanitisation", async () => {
      await expect(
        TaskService.createCustom({
          category: "CARE",
          name: "Meds",
          createdBy: "user-1",
          assignedTo: "user-2",
          assignedGroupId: "group-1",
          dueAt,
          audience: "EMPLOYEE_TASK",
          medication: { name: "Metacam" },
        }),
      ).rejects.toThrow(
        "patientId is required for parent, medication, or observation tool tasks",
      );
      expect(mockedPrisma.task.create).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------------------------------
  // Recurrence normalisation on create (buildRecurrence)
  // ------------------------------------------------------------------
  describe("recurrence normalisation on create", () => {
    const createdRow = {
      id: "task-rec",
      organisationId: "org-1",
      audience: "EMPLOYEE_TASK",
      assignedTo: "user-2",
      assignedGroupId: "group-1",
      createdBy: "user-1",
      dueAt,
      name: "Rec",
    };

    const createWithRecurrence = async (recurrence: unknown) => {
      mockedPrisma.task.create.mockResolvedValueOnce(createdRow as never);
      await TaskService.createCustom({
        category: "CARE",
        name: "Rec",
        createdBy: "user-1",
        assignedTo: "user-2",
        assignedGroupId: "group-1",
        dueAt,
        audience: "EMPLOYEE_TASK",
        recurrence: recurrence as never,
      });
      return mockedPrisma.task.create.mock.calls[0][0].data;
    };

    it("stores a ONCE recurrence as a non-master with no cron or end date", async () => {
      const data = await createWithRecurrence({
        type: "ONCE",
        cronExpression: "0 9 * * *",
        endDate: dueAt,
      });

      expect(data.recurrence).toEqual({
        type: "ONCE",
        isMaster: false,
        masterTaskId: undefined,
        cronExpression: undefined,
        endDate: undefined,
      });
    });

    it("stores a repeating recurrence as the series master", async () => {
      const endDate = new Date("2026-02-01T12:00:00.000Z");
      const data = await createWithRecurrence({
        type: "WEEKLY",
        cronExpression: "0 9 * * 1",
        endDate,
      });

      expect(data.recurrence).toEqual({
        type: "WEEKLY",
        isMaster: true,
        masterTaskId: undefined,
        cronExpression: "0 9 * * 1",
        endDate,
      });
    });
  });

  // ------------------------------------------------------------------
  // PATCH merge semantics (buildTaskUpdatePatch + mergeRecurrence)
  // ------------------------------------------------------------------
  describe("update payload merging", () => {
    const storedTask = (overrides: Record<string, unknown> = {}) => ({
      id: "task-1",
      organisationId: "org-1",
      patientId: "comp-1",
      createdBy: "user-1",
      assignedTo: "user-1",
      assignedBy: "user-1",
      assignedGroupId: null,
      name: "Stored name",
      description: "Stored description",
      additionalNotes: "Stored notes",
      subcategory: "Stored subcategory",
      priority: "HIGH",
      timezone: "Europe/London",
      observationToolId: "tool-1",
      medication: { name: "Stored" },
      reminder: { enabled: true, offsetMinutes: 10 },
      attachments: [{ id: "a-1", name: "chart.pdf" }],
      syncWithCalendar: true,
      dueAt,
      recurrence: null,
      ...overrides,
    });

    const runUpdate = async (
      updates: Record<string, unknown>,
      task: Record<string, unknown> = storedTask(),
    ) => {
      mockedPrisma.task.findFirst.mockResolvedValueOnce(task as never);
      mockedPrisma.task.update.mockResolvedValueOnce({
        id: "task-1",
        organisationId: "org-1",
      } as never);
      await TaskService.updateTask("task-1", updates as never, "user-1");
      return mockedPrisma.task.update.mock.calls[0][0].data;
    };

    it("keeps every stored value when the PATCH body is empty", async () => {
      const data = await runUpdate({});

      expect(data).toEqual(
        expect.objectContaining({
          name: "Stored name",
          description: "Stored description",
          additionalNotes: "Stored notes",
          subcategory: "Stored subcategory",
          priority: "HIGH",
          timezone: "Europe/London",
          observationToolId: "tool-1",
          syncWithCalendar: true,
          dueAt,
          assignedBy: "user-1",
        }),
      );
    });

    it("clears every nullable field when the PATCH sends explicit nulls", async () => {
      const data = await runUpdate({
        description: null,
        additionalNotes: null,
        subcategory: null,
        timezone: null,
        observationToolId: null,
        medication: null,
        reminder: null,
        attachments: null,
      });

      expect(data).toEqual(
        expect.objectContaining({
          description: undefined,
          additionalNotes: undefined,
          subcategory: undefined,
          timezone: undefined,
          observationToolId: undefined,
          medication: undefined,
          reminder: undefined,
        }),
      );
      // `attachments` is a JSON column, so an explicit clear has to become
      // Prisma's DbNull sentinel rather than a dropped `undefined` field.
      expect(data.attachments).toBe(Prisma.DbNull);
    });

    it("replaces nullable fields when the PATCH sends new values", async () => {
      const data = await runUpdate({
        description: "New description",
        additionalNotes: "New notes",
        subcategory: "New subcategory",
        timezone: "America/New_York",
        observationToolId: "tool-2",
        medication: { name: " Meloxicam " },
        reminder: { enabled: false, offsetMinutes: 45 },
        attachments: [{ id: "a-2", name: "labs.pdf" }],
        syncWithCalendar: false,
      });

      expect(data).toEqual(
        expect.objectContaining({
          description: "New description",
          additionalNotes: "New notes",
          subcategory: "New subcategory",
          timezone: "America/New_York",
          observationToolId: "tool-2",
          medication: expect.objectContaining({ name: "Meloxicam" }),
          reminder: {
            enabled: false,
            offsetMinutes: 45,
            scheduledNotificationId: undefined,
          },
          attachments: [{ id: "a-2", name: "labs.pdf" }],
          syncWithCalendar: false,
        }),
      );
    });

    it("falls back to the stored priority when the PATCH sends an invalid one", async () => {
      const data = await runUpdate({ priority: "NONSENSE" });

      expect(data.priority).toBe("HIGH");
    });

    it("leaves the priority unset when neither the PATCH nor the row has a valid one", async () => {
      const data = await runUpdate(
        { priority: "NONSENSE" },
        storedTask({ priority: null }),
      );

      expect(data.priority).toBeUndefined();
    });

    it("clears the recurrence when the PATCH sends null", async () => {
      const data = await runUpdate(
        { recurrence: null },
        storedTask({ recurrence: { type: "DAILY", isMaster: true } }),
      );

      expect(data.recurrence).toBe(Prisma.DbNull);
    });

    it("collapses an occurrence to ONCE while keeping its master link", async () => {
      const data = await runUpdate(
        { recurrence: { type: "ONCE" } },
        storedTask({
          recurrence: {
            type: "DAILY",
            masterTaskId: "master-1",
            cronExpression: "0 9 * * *",
            endDate: dueAt,
          },
        }),
      );

      expect(data.recurrence).toEqual({
        type: "ONCE",
        isMaster: false,
        masterTaskId: "master-1",
        cronExpression: undefined,
        endDate: undefined,
      });
    });

    it("collapses to ONCE with no master link when the stored recurrence has none", async () => {
      const data = await runUpdate(
        { recurrence: { type: "ONCE" } },
        storedTask({ recurrence: { type: "DAILY", masterTaskId: 42 } }),
      );

      expect(data.recurrence).toEqual({
        type: "ONCE",
        isMaster: false,
        masterTaskId: undefined,
        cronExpression: undefined,
        endDate: undefined,
      });
    });

    it("treats a corrupt stored recurrence as empty and defaults the series to a master", async () => {
      const data = await runUpdate(
        { recurrence: { type: "DAILY" } },
        storedTask({ recurrence: "not-an-object" }),
      );

      expect(data.recurrence).toEqual({
        type: "DAILY",
        isMaster: true,
        masterTaskId: undefined,
        cronExpression: undefined,
        endDate: undefined,
      });
    });

    it("keeps stored cron and end date when the PATCH omits them", async () => {
      const endDate = new Date("2026-03-01T09:00:00.000Z");
      const data = await runUpdate(
        { recurrence: { type: "WEEKLY" } },
        storedTask({
          recurrence: {
            type: "DAILY",
            isMaster: false,
            masterTaskId: "master-1",
            cronExpression: "0 9 * * *",
            endDate,
          },
        }),
      );

      expect(data.recurrence).toEqual({
        type: "WEEKLY",
        isMaster: false,
        masterTaskId: "master-1",
        cronExpression: "0 9 * * *",
        endDate,
      });
    });

    it("clears stored cron and end date when the PATCH sends nulls for them", async () => {
      const data = await runUpdate(
        {
          recurrence: { type: "WEEKLY", cronExpression: null, endDate: null },
        },
        storedTask({
          recurrence: {
            type: "DAILY",
            isMaster: true,
            masterTaskId: "master-1",
            cronExpression: "0 9 * * *",
            endDate: dueAt,
          },
        }),
      );

      expect(data.recurrence).toEqual({
        type: "WEEKLY",
        isMaster: true,
        masterTaskId: "master-1",
        cronExpression: undefined,
        endDate: undefined,
      });
    });
  });

  // ------------------------------------------------------------------
  // Status transition legality + completion records
  // ------------------------------------------------------------------
  describe("status transitions", () => {
    const taskRow = (overrides: Record<string, unknown> = {}) => ({
      id: "task-1",
      organisationId: "org-1",
      patientId: "comp-1",
      createdBy: "user-1",
      assignedTo: "user-2",
      status: "PENDING",
      completedAt: null,
      completedBy: null,
      ...overrides,
    });

    const runChangeStatus = async (
      newStatus: string,
      task: Record<string, unknown> = taskRow(),
      actorId = "user-2",
      completion?: Record<string, unknown>,
    ) => {
      mockedPrisma.task.findFirst.mockResolvedValueOnce(task as never);
      mockedPrisma.task.update.mockResolvedValueOnce({
        id: "task-1",
        organisationId: "org-1",
        patientId: "comp-1",
        status: newStatus,
      } as never);
      const result = await TaskService.changeStatus(
        "task-1",
        newStatus as never,
        actorId,
        completion as never,
      );
      return { result, data: mockedPrisma.task.update.mock.calls[0][0].data };
    };

    it("starts a pending task without stamping completion metadata", async () => {
      const { data } = await runChangeStatus("IN_PROGRESS");

      expect(data).toEqual({
        status: "IN_PROGRESS",
        completedAt: null,
        completedBy: null,
      });
      expect(mockedPrisma.taskCompletion.create).not.toHaveBeenCalled();
    });

    it("keeps IN_PROGRESS when it is re-requested on an already started task", async () => {
      const { data } = await runChangeStatus(
        "IN_PROGRESS",
        taskRow({ status: "IN_PROGRESS" }),
      );

      expect(data.status).toBe("IN_PROGRESS");
    });

    it("cancels a task", async () => {
      const { data } = await runChangeStatus("CANCELLED");

      expect(data).toEqual({
        status: "CANCELLED",
        completedAt: null,
        completedBy: null,
      });
    });

    it("reopens an in-progress task back to PENDING", async () => {
      const { data } = await runChangeStatus(
        "PENDING",
        taskRow({ status: "IN_PROGRESS" }),
      );

      expect(data.status).toBe("PENDING");
    });

    it("stamps completedAt and completedBy when completing", async () => {
      const { data } = await runChangeStatus("COMPLETED");

      expect(data.status).toBe("COMPLETED");
      expect(data.completedBy).toBe("user-2");
      expect(data.completedAt).toBeInstanceOf(Date);
    });

    it("attributes a completion record to the actor when filledBy is omitted", async () => {
      mockedPrisma.taskCompletion.create.mockResolvedValueOnce({
        id: "completion-auto",
      } as never);
      const { result } = await runChangeStatus(
        "COMPLETED",
        taskRow(),
        "user-2",
        { answers: { pain: 2 } },
      );

      expect(mockedPrisma.taskCompletion.create).toHaveBeenCalledWith({
        data: {
          taskId: "task-1",
          patientId: "comp-1",
          filledBy: "user-2",
          answers: { pain: 2 },
          score: undefined,
          summary: undefined,
        },
      });
      expect(result.completion?.id).toBe("completion-auto");
    });

    it("keeps an explicit filler, score, and summary on the completion record", async () => {
      mockedPrisma.taskCompletion.create.mockResolvedValueOnce({
        id: "completion-9",
      } as never);
      const { result } = await runChangeStatus(
        "COMPLETED",
        taskRow(),
        "user-2",
        {
          filledBy: "user-7",
          answers: { pain: 1 },
          score: 88,
          summary: "Doing well",
        },
      );

      expect(mockedPrisma.taskCompletion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          filledBy: "user-7",
          score: 88,
          summary: "Doing well",
        }),
      });
      expect(result.completion?.id).toBe("completion-9");
    });

    it("refuses to record a completion for a task with no companion", async () => {
      mockedPrisma.task.findFirst.mockResolvedValueOnce(
        taskRow({ patientId: null }) as never,
      );

      await expect(
        TaskService.changeStatus("task-1", "COMPLETED", "user-2", {
          filledBy: "user-2",
          answers: { pain: 3 },
        }),
      ).rejects.toMatchObject({
        message: "Companion is required for completion.",
        statusCode: 400,
      });
      expect(mockedPrisma.task.update).not.toHaveBeenCalled();
    });

    it("lets the creator change the status of a task assigned to someone else", async () => {
      const { data } = await runChangeStatus(
        "CANCELLED",
        taskRow(),
        // createdBy on the row, not the assignee.
        "user-1",
      );

      expect(data.status).toBe("CANCELLED");
    });

    it("rejects a status change from a user who neither created nor owns the task", async () => {
      mockedPrisma.task.findFirst.mockResolvedValueOnce(taskRow() as never);

      await expect(
        TaskService.changeStatus("task-1", "COMPLETED", "stranger-1"),
      ).rejects.toMatchObject({
        message: "Not allowed to update this task",
        statusCode: 403,
      });
      expect(mockedPrisma.task.update).not.toHaveBeenCalled();
    });

    it.each(["COMPLETED", "CANCELLED"])(
      "rejects a status change on an already %s task",
      async (status) => {
        mockedPrisma.task.findFirst.mockResolvedValueOnce(
          taskRow({ status }) as never,
        );

        await expect(
          TaskService.changeStatus("task-1", "IN_PROGRESS", "user-2"),
        ).rejects.toMatchObject({
          message: "Task already finished",
          statusCode: 400,
        });
        expect(mockedPrisma.task.update).not.toHaveBeenCalled();
      },
    );
  });

  // ------------------------------------------------------------------
  // Assignment email + audit actor resolution
  // ------------------------------------------------------------------
  describe("assignment email", () => {
    const flush = async () => {
      await new Promise(process.nextTick);
      await new Promise(process.nextTick);
    };

    it("does not email for parent tasks", async () => {
      mockedPrisma.task.create.mockResolvedValueOnce({
        id: "task-parent",
        organisationId: "org-1",
        patientId: "comp-1",
        audience: "PARENT_TASK",
        assignedTo: "parent-1",
        createdBy: "user-1",
        dueAt,
        name: "Give meds",
      } as never);

      await TaskService.createCustom({
        category: "CARE",
        name: "Give meds",
        createdBy: "user-1",
        assignedTo: "parent-1",
        patientId: "comp-1",
        dueAt,
        audience: "PARENT_TASK",
      });
      await flush();

      expect(sendEmailTemplate).not.toHaveBeenCalled();
      expect(mockedPrisma.user.findFirst).not.toHaveBeenCalled();
    });

    it("omits companion and display names when they are unavailable", async () => {
      mockedPrisma.task.create.mockResolvedValueOnce({
        id: "task-email",
        organisationId: "org-1",
        // No companion: the patient lookup is skipped entirely.
        patientId: null,
        audience: "EMPLOYEE_TASK",
        assignedTo: "user-2",
        assignedGroupId: null,
        assignedBy: null,
        createdBy: "user-1",
        dueAt,
        name: "Check vitals",
        additionalNotes: null,
      } as never);
      mockedPrisma.user.findFirst
        .mockResolvedValueOnce({
          email: "assignee@test.com",
          firstName: null,
          lastName: null,
        } as never)
        .mockResolvedValueOnce(null as never);

      await TaskService.createCustom({
        category: "CARE",
        name: "Check vitals",
        createdBy: "user-1",
        assignedTo: "user-2",
        dueAt,
        audience: "EMPLOYEE_TASK",
      });
      await flush();

      expect(mockedPrisma.patient.findFirst).not.toHaveBeenCalled();
      expect(sendEmailTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "assignee@test.com",
          templateId: "taskAssigned",
          templateData: expect.objectContaining({
            employeeName: undefined,
            assignedByName: undefined,
            companionName: undefined,
            additionalNotes: undefined,
            dueTime: dueAt.toUTCString(),
          }),
        }),
      );
    });

    it("does not email an unassigned employee task", async () => {
      mockedPrisma.task.create.mockResolvedValueOnce({
        id: "task-unassigned",
        organisationId: "org-1",
        patientId: null,
        audience: "EMPLOYEE_TASK",
        assignedTo: null,
        assignedGroupId: null,
        createdBy: "user-1",
        dueAt,
        name: "Unassigned",
      } as never);

      await TaskService.createCustom({
        category: "CARE",
        name: "Unassigned",
        createdBy: "user-1",
        assignedTo: "",
        dueAt,
        audience: "EMPLOYEE_TASK",
      });
      await flush();

      expect(mockedPrisma.user.findFirst).not.toHaveBeenCalled();
      expect(sendEmailTemplate).not.toHaveBeenCalled();
    });

    it("does not email an assignee with no address on file", async () => {
      mockedPrisma.task.create.mockResolvedValueOnce({
        id: "task-email-2",
        organisationId: "org-1",
        patientId: null,
        audience: "EMPLOYEE_TASK",
        assignedTo: "user-2",
        assignedGroupId: null,
        createdBy: "user-1",
        dueAt,
        name: "Check vitals",
      } as never);
      mockedPrisma.user.findFirst
        .mockResolvedValueOnce({ email: null, firstName: "Jane" } as never)
        .mockResolvedValueOnce(null as never);

      await TaskService.createCustom({
        category: "CARE",
        name: "Check vitals",
        createdBy: "user-1",
        assignedTo: "user-2",
        dueAt,
        audience: "EMPLOYEE_TASK",
      });
      await flush();

      expect(sendEmailTemplate).not.toHaveBeenCalled();
    });

    it("logs and swallows a failure while sending, without failing the create", async () => {
      mockedPrisma.task.create.mockResolvedValueOnce({
        id: "task-email-3",
        organisationId: "org-1",
        patientId: null,
        audience: "EMPLOYEE_TASK",
        assignedTo: "user-2",
        assignedGroupId: null,
        createdBy: "user-1",
        dueAt,
        name: "Check vitals",
      } as never);
      mockedPrisma.user.findFirst.mockRejectedValue(new Error("db down"));

      const result = await TaskService.createCustom({
        category: "CARE",
        name: "Check vitals",
        createdBy: "user-1",
        assignedTo: "user-2",
        dueAt,
        audience: "EMPLOYEE_TASK",
      });
      await flush();

      expect(result.id).toBe("task-email-3");
      expect(sendEmailTemplate).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to send task assignment email.",
        expect.any(Error),
      );
    });

    it("records a SYSTEM actor when the persisted row carries no creator", async () => {
      mockedPrisma.task.create.mockResolvedValueOnce({
        id: "task-system",
        organisationId: "org-1",
        patientId: "comp-1",
        audience: "PARENT_TASK",
        assignedTo: "parent-1",
        assignedGroupId: null,
        createdBy: null,
        status: "PENDING",
        source: "ORG_TEMPLATE",
        dueAt,
        name: "Seeded",
      } as never);

      await TaskService.createFromWorkflowSeed(
        {
          source: "ORG_TEMPLATE",
          organisationId: "org-1",
          createdBy: "system",
          assignedTo: "parent-1",
          audience: "PARENT_TASK",
          patientId: "comp-1",
          category: "CARE",
          name: "Seeded",
          dueAt,
        } as never,
        { notify: false },
      );

      expect(mockedAuditTrailService.recordSafely).toHaveBeenCalledWith(
        expect.objectContaining({
          actorType: "SYSTEM",
          actorId: undefined,
          eventType: "TASK_CREATED",
        }),
      );
    });

    it("skips the audit entirely when the row has no companion", async () => {
      mockedPrisma.task.create.mockResolvedValueOnce({
        id: "task-no-audit",
        organisationId: "org-1",
        patientId: null,
        audience: "EMPLOYEE_TASK",
        assignedTo: "user-2",
        assignedGroupId: "group-1",
        createdBy: "user-1",
        dueAt,
        name: "Restock",
      } as never);

      await TaskService.createCustom({
        category: "CARE",
        name: "Restock",
        createdBy: "user-1",
        assignedTo: "user-2",
        assignedGroupId: "group-1",
        dueAt,
        audience: "EMPLOYEE_TASK",
      });

      expect(mockedAuditTrailService.recordSafely).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------------------------------
  // Library / template / workflow-seed creation guards
  // ------------------------------------------------------------------
  describe("create guards", () => {
    it("rejects a library task that is missing or inactive", async () => {
      mockedPrisma.taskLibraryDefinition.findFirst.mockResolvedValueOnce(
        null as never,
      );

      await expect(
        TaskService.createFromLibrary({
          libraryTaskId: "lib-x",
          createdBy: "user-1",
          assignedTo: "user-2",
          dueAt,
          audience: "EMPLOYEE_TASK",
        }),
      ).rejects.toMatchObject({
        message: "Library task not found or inactive",
        statusCode: 404,
      });
      expect(mockedPrisma.task.create).not.toHaveBeenCalled();
    });

    it("leaves the description unset when the library entry has none", async () => {
      mockedPrisma.taskLibraryDefinition.findFirst.mockResolvedValueOnce({
        id: "lib-1",
        isActive: true,
        category: "CARE",
        name: "Hydration",
        defaultDescription: null,
      } as never);
      mockedPrisma.task.create.mockResolvedValueOnce({
        id: "task-lib",
        organisationId: "org-1",
        audience: "EMPLOYEE_TASK",
        assignedTo: "user-2",
        assignedGroupId: "group-1",
        createdBy: "user-1",
        dueAt,
        name: "Hydration",
      } as never);

      await TaskService.createFromLibrary({
        libraryTaskId: "lib-1",
        createdBy: "user-1",
        assignedTo: "user-2",
        assignedGroupId: "group-1",
        dueAt,
        audience: "EMPLOYEE_TASK",
      });

      const data = mockedPrisma.task.create.mock.calls[0][0].data;
      expect(data.description).toBeUndefined();
      expect(data.category).toBe("CARE");
    });

    it("rejects a template that is missing or inactive", async () => {
      mockedPrisma.taskTemplate.findFirst.mockResolvedValueOnce(null as never);

      await expect(
        TaskService.createFromTemplate({
          templateId: "tmpl-x",
          organisationId: "org-1",
          createdBy: "user-1",
          assignedTo: "user-2",
          dueAt,
        }),
      ).rejects.toMatchObject({
        message: "Task template not found or inactive",
        statusCode: 404,
      });
    });

    it("rejects a template that belongs to another organisation", async () => {
      mockedPrisma.taskTemplate.findFirst.mockResolvedValueOnce({
        id: "tmpl-1",
        organisationId: "org-other",
        isActive: true,
      } as never);

      await expect(
        TaskService.createFromTemplate({
          templateId: "tmpl-1",
          organisationId: "org-1",
          createdBy: "user-1",
          assignedTo: "user-2",
          dueAt,
        }),
      ).rejects.toMatchObject({
        message: "Template does not belong to organisation",
        statusCode: 400,
      });
      expect(mockedPrisma.task.create).not.toHaveBeenCalled();
    });

    it("defaults a non-parent template to an employee task with no recurrence or reminder", async () => {
      mockedPrisma.taskTemplate.findFirst.mockResolvedValueOnce({
        id: "tmpl-2",
        organisationId: "org-1",
        isActive: true,
        defaultRole: "STAFF",
        category: "CARE",
        name: "Restock",
        description: null,
        defaultMedication: null,
        defaultObservationToolId: null,
        defaultRecurrence: null,
        defaultReminderOffsetMinutes: null,
        libraryTaskId: null,
      } as never);
      mockedPrisma.task.create.mockResolvedValueOnce({
        id: "task-tmpl-2",
        organisationId: "org-1",
        audience: "EMPLOYEE_TASK",
        assignedTo: "user-2",
        assignedGroupId: "group-1",
        createdBy: "user-1",
        dueAt,
        name: "Restock",
      } as never);

      await TaskService.createFromTemplate({
        templateId: "tmpl-2",
        organisationId: "org-1",
        createdBy: "user-1",
        assignedTo: "user-2",
        assignedGroupId: "group-1",
        dueAt,
      });

      const data = mockedPrisma.task.create.mock.calls[0][0].data;
      expect(data.audience).toBe("EMPLOYEE_TASK");
      expect(data.description).toBeUndefined();
      expect(data.recurrence).toBeUndefined();
      expect(data.reminder).toBeUndefined();
    });

    it("takes the template cron but leaves the end date open when no offset is configured", async () => {
      mockedPrisma.taskTemplate.findFirst.mockResolvedValueOnce({
        id: "tmpl-3",
        organisationId: "org-1",
        isActive: true,
        defaultRole: "STAFF",
        category: "CARE",
        name: "Rounds",
        description: "Ward rounds",
        defaultMedication: null,
        defaultObservationToolId: null,
        defaultRecurrence: {
          type: "CUSTOM",
          defaultEndOffsetDays: null,
          customCron: "0 7 * * *",
        },
        defaultReminderOffsetMinutes: 20,
        libraryTaskId: "lib-9",
      } as never);
      mockedPrisma.task.create.mockResolvedValueOnce({
        id: "task-tmpl-3",
        organisationId: "org-1",
        audience: "EMPLOYEE_TASK",
        assignedTo: "user-2",
        assignedGroupId: "group-1",
        createdBy: "user-1",
        dueAt,
        name: "Rounds",
      } as never);

      await TaskService.createFromTemplate({
        templateId: "tmpl-3",
        organisationId: "org-1",
        createdBy: "user-1",
        assignedTo: "user-2",
        assignedGroupId: "group-1",
        dueAt,
      });

      const data = mockedPrisma.task.create.mock.calls[0][0].data;
      expect(data.recurrence).toEqual({
        type: "CUSTOM",
        isMaster: true,
        masterTaskId: undefined,
        cronExpression: "0 7 * * *",
        endDate: undefined,
      });
      expect(data.reminder).toEqual({
        enabled: true,
        offsetMinutes: 20,
        scheduledNotificationId: undefined,
      });
      expect(data.libraryTaskId).toBe("lib-9");
    });

    it("rejects a custom task with no category or name", async () => {
      await expect(
        TaskService.createCustom({
          category: "",
          name: "",
          createdBy: "user-1",
          assignedTo: "user-2",
          dueAt,
          audience: "EMPLOYEE_TASK",
        }),
      ).rejects.toMatchObject({
        message: "category and name are required",
        statusCode: 400,
      });
    });

    it("writes a workflow seed through a supplied transaction client and notifies by default", async () => {
      const txCreate = jest.fn().mockResolvedValue({
        id: "task-seed",
        organisationId: "org-1",
        patientId: "comp-1",
        audience: "EMPLOYEE_TASK",
        assignedTo: "user-2",
        assignedGroupId: null,
        createdBy: "user-1",
        dueAt,
        name: "Seeded",
      });
      mockedPrisma.user.findFirst.mockResolvedValue(null as never);

      await TaskService.createFromWorkflowSeed(
        {
          source: "CUSTOM",
          organisationId: "org-1",
          createdBy: "user-1",
          assignedTo: "user-2",
          audience: "EMPLOYEE_TASK",
          patientId: "comp-1",
          category: "CARE",
          name: "Seeded",
          dueAt,
          recurrence: {
            type: "DAILY",
            endDate: new Date("2026-02-01T12:00:00.000Z"),
            cronExpression: "0 9 * * *",
          },
        } as never,
        { client: { task: { create: txCreate } } as never },
      );
      await new Promise(process.nextTick);

      expect(mockedPrisma.task.create).not.toHaveBeenCalled();
      expect(txCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          recurrence: expect.objectContaining({
            type: "DAILY",
            isMaster: true,
            cronExpression: "0 9 * * *",
          }),
        }),
      });
      // notify defaults to on, so the assignee lookup runs.
      expect(mockedPrisma.user.findFirst).toHaveBeenCalled();
    });
  });

  // ------------------------------------------------------------------
  // Permission + org-scope guards on update / delete
  // ------------------------------------------------------------------
  describe("update and delete guards", () => {
    const ownedTask = (overrides: Record<string, unknown> = {}) => ({
      id: "task-1",
      organisationId: "org-1",
      createdBy: "user-1",
      assignedTo: "user-2",
      assignedGroupId: null,
      assignedBy: "user-1",
      dueAt,
      status: "PENDING",
      recurrence: null,
      medication: null,
      reminder: null,
      attachments: null,
      syncWithCalendar: false,
      ...overrides,
    });

    it("rejects an update from a user who neither created nor owns the task", async () => {
      mockedPrisma.task.findFirst.mockResolvedValueOnce(ownedTask() as never);

      await expect(
        TaskService.updateTask("task-1", { name: "x" }, "stranger-1"),
      ).rejects.toMatchObject({
        message: "Not allowed to update this task",
        statusCode: 403,
      });
      expect(mockedPrisma.task.update).not.toHaveBeenCalled();
    });

    it("rejects a delete from a user who neither created nor owns the task", async () => {
      mockedPrisma.task.findFirst.mockResolvedValueOnce(ownedTask() as never);

      await expect(
        TaskService.deleteTask("task-1", "stranger-1"),
      ).rejects.toMatchObject({
        message: "Not allowed to update this task",
        statusCode: 403,
      });
      expect(mockedPrisma.task.update).not.toHaveBeenCalled();
    });

    it("treats a blank organisationId as no org scope on the update lookup", async () => {
      mockedPrisma.task.findFirst.mockResolvedValueOnce(null as never);

      await expect(
        TaskService.updateTask("task-1", { name: "x" }, "user-1", "THIS", "  "),
      ).rejects.toThrow("Task not found");

      expect(mockedPrisma.task.findFirst).toHaveBeenCalledWith({
        where: { id: "task-1" },
      });
    });

    it("cancels a single non-recurring task without a transaction", async () => {
      mockedPrisma.task.findFirst.mockResolvedValueOnce(ownedTask() as never);
      mockedPrisma.task.update.mockResolvedValueOnce({} as never);

      await TaskService.deleteTask("task-1", "user-1");

      expect(mockedPrisma.task.findFirst).toHaveBeenCalledWith({
        where: { id: "task-1" },
      });
      expect(mockedPrisma.task.update).toHaveBeenCalledWith({
        where: { id: "task-1" },
        data: { status: "CANCELLED" },
      });
      expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
    });

    it("cancels every occurrence for scope=ALL without touching the master recurrence", async () => {
      mockedPrisma.task.findFirst.mockResolvedValueOnce(
        ownedTask({
          assignedTo: "user-1",
          recurrence: { type: "DAILY", isMaster: true },
        }) as never,
      );
      mockedPrisma.task.findMany.mockResolvedValueOnce([
        { id: "task-1", dueAt, createdBy: "user-1", assignedTo: "user-1" },
        {
          id: "task-2",
          dueAt: new Date("2026-01-02T12:00:00.000Z"),
          createdBy: "user-1",
          assignedTo: "user-1",
        },
      ] as never);
      const txUpdateMany = jest.fn().mockResolvedValue({ count: 2 });
      const txUpdate = jest.fn();
      mockedPrisma.$transaction.mockImplementationOnce(
        async (cb: (tx: unknown) => Promise<unknown>) =>
          cb({ task: { updateMany: txUpdateMany, update: txUpdate } }),
      );

      await TaskService.deleteTask("task-1", "user-1", "ALL", "org-1");

      expect(txUpdateMany).toHaveBeenCalledWith({
        where: { id: { in: ["task-1", "task-2"] }, organisationId: "org-1" },
        data: { status: "CANCELLED" },
      });
      expect(txUpdate).not.toHaveBeenCalled();
    });

    it("caps the master recurrence and cancels only future rows for THIS_AND_FOLLOWING", async () => {
      const splitDueAt = new Date("2026-02-02T09:00:00.000Z");
      mockedPrisma.task.findFirst.mockResolvedValueOnce(
        ownedTask({
          id: "task-2",
          assignedTo: "user-1",
          dueAt: splitDueAt,
          recurrence: { type: "DAILY", masterTaskId: "task-1" },
        }) as never,
      );
      mockedPrisma.task.findMany.mockResolvedValueOnce([
        {
          id: "task-1",
          dueAt: new Date("2026-02-01T09:00:00.000Z"),
          createdBy: "user-1",
          assignedTo: "user-1",
        },
        {
          id: "task-2",
          dueAt: splitDueAt,
          createdBy: "user-1",
          assignedTo: "user-1",
        },
        {
          id: "task-3",
          dueAt: new Date("2026-02-03T09:00:00.000Z"),
          createdBy: "user-1",
          assignedTo: "user-1",
        },
      ] as never);
      const txUpdateMany = jest.fn().mockResolvedValue({ count: 2 });
      const txUpdate = jest.fn().mockResolvedValue({});
      mockedPrisma.$transaction.mockImplementationOnce(
        async (cb: (tx: unknown) => Promise<unknown>) =>
          cb({ task: { updateMany: txUpdateMany, update: txUpdate } }),
      );

      await TaskService.deleteTask(
        "task-2",
        "user-1",
        "THIS_AND_FOLLOWING",
        "org-1",
      );

      // task-1 is before the split point, so it survives; the split point and
      // everything after it is cancelled.
      expect(txUpdateMany).toHaveBeenCalledWith({
        where: { id: { in: ["task-2", "task-3"] }, organisationId: "org-1" },
        data: { status: "CANCELLED" },
      });
      expect(txUpdate).toHaveBeenCalledWith({
        where: { id: "task-1" },
        data: {
          recurrence: {
            type: "DAILY",
            isMaster: true,
            masterTaskId: "task-1",
            cronExpression: undefined,
            endDate: new Date(splitDueAt.getTime() - 1),
          },
        },
      });
    });

    it("falls back to a ONCE recurrence when capping a master that stored no type", async () => {
      const splitDueAt = new Date("2026-02-02T09:00:00.000Z");
      mockedPrisma.task.findFirst.mockResolvedValueOnce(
        ownedTask({
          id: "task-2",
          assignedTo: "user-1",
          dueAt: splitDueAt,
          recurrence: { masterTaskId: "task-1" },
        }) as never,
      );
      mockedPrisma.task.findMany.mockResolvedValueOnce([
        {
          id: "task-1",
          dueAt: new Date("2026-02-01T09:00:00.000Z"),
          createdBy: "user-1",
          assignedTo: "user-1",
        },
        {
          id: "task-2",
          dueAt: splitDueAt,
          createdBy: "user-1",
          assignedTo: "user-1",
        },
      ] as never);
      const txUpdate = jest.fn().mockResolvedValue({});
      mockedPrisma.$transaction.mockImplementationOnce(
        async (cb: (tx: unknown) => Promise<unknown>) =>
          cb({
            task: {
              updateMany: jest.fn().mockResolvedValue({ count: 1 }),
              update: txUpdate,
            },
          }),
      );

      await TaskService.deleteTask(
        "task-2",
        "user-1",
        "THIS_AND_FOLLOWING",
        "org-1",
      );

      expect(txUpdate).toHaveBeenCalledWith({
        where: { id: "task-1" },
        data: {
          recurrence: expect.objectContaining({
            type: "ONCE",
            masterTaskId: "task-1",
          }),
        },
      });
    });

    it("rejects THIS_AND_FOLLOWING deletion when the master is owned by someone else", async () => {
      const splitDueAt = new Date("2026-02-02T09:00:00.000Z");
      mockedPrisma.task.findFirst.mockResolvedValueOnce(
        ownedTask({
          id: "task-2",
          assignedTo: "user-1",
          dueAt: splitDueAt,
          recurrence: { type: "DAILY", masterTaskId: "task-1" },
        }) as never,
      );
      mockedPrisma.task.findMany.mockResolvedValueOnce([
        {
          id: "task-1",
          dueAt: new Date("2026-02-01T09:00:00.000Z"),
          createdBy: "someone-else",
          assignedTo: "someone-else",
        },
        {
          id: "task-2",
          dueAt: splitDueAt,
          createdBy: "user-1",
          assignedTo: "user-1",
        },
      ] as never);

      await expect(
        TaskService.deleteTask(
          "task-2",
          "user-1",
          "THIS_AND_FOLLOWING",
          "org-1",
        ),
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------------------------------
  // Recurring series updates
  // ------------------------------------------------------------------
  describe("recurring series updates", () => {
    const seriesRow = (overrides: Record<string, unknown> = {}) => ({
      id: "task-1",
      organisationId: "org-1",
      patientId: "comp-1",
      createdBy: "actor-1",
      assignedTo: "actor-1",
      assignedBy: null,
      assignedGroupId: null,
      dueAt: new Date("2026-02-01T09:00:00.000Z"),
      status: "PENDING",
      name: "Series",
      recurrence: { type: "DAILY", isMaster: true },
      medication: null,
      reminder: null,
      attachments: null,
      syncWithCalendar: false,
      ...overrides,
    });

    const withTransaction = () => {
      const txUpdate = jest
        .fn()
        .mockImplementation(async ({ where }: { where: { id: string } }) =>
          seriesRow({ id: where.id, name: "renamed" }),
        );
      mockedPrisma.$transaction.mockImplementationOnce(
        async (cb: (tx: unknown) => Promise<unknown>) =>
          cb({ task: { update: txUpdate } }),
      );
      return txUpdate;
    };

    it("records a reassignment audit for a series-wide update", async () => {
      mockedPrisma.task.findFirst.mockResolvedValueOnce(seriesRow() as never);
      mockedPrisma.task.findMany.mockResolvedValueOnce([
        seriesRow(),
        seriesRow({
          id: "task-2",
          dueAt: new Date("2026-02-02T09:00:00.000Z"),
          recurrence: { type: "DAILY", masterTaskId: "task-1" },
        }),
      ] as never);
      const txUpdate = withTransaction();

      await TaskService.updateTask(
        "task-1",
        { assignedTo: "actor-2" },
        "actor-1",
        "ALL",
        "org-1",
      );

      // Every row in the series is rewritten, and assignedBy falls back to the
      // creator because the stored row had no assigner.
      expect(txUpdate).toHaveBeenCalledTimes(2);
      expect(txUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            assignedTo: "actor-2",
            assignedBy: "actor-1",
          }),
        }),
      );
      expect(mockedAuditTrailService.recordSafely).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "TASK_REASSIGNED",
          metadata: expect.objectContaining({
            previousAssignedTo: "actor-1",
            previousAssignedGroupId: null,
            assignedBy: null,
          }),
        }),
      );
    });

    it("falls back to the addressed task when the master row is missing from the series", async () => {
      const occurrenceDueAt = new Date("2026-02-02T09:00:00.000Z");
      mockedPrisma.task.findFirst.mockResolvedValueOnce(
        seriesRow({
          id: "task-2",
          dueAt: occurrenceDueAt,
          // The master row named here is not returned by the series query.
          recurrence: { masterTaskId: "task-missing" },
        }) as never,
      );
      mockedPrisma.task.findMany.mockResolvedValueOnce([
        seriesRow({
          id: "task-2",
          dueAt: occurrenceDueAt,
          recurrence: { masterTaskId: "task-missing" },
        }),
      ] as never);
      const txUpdate = withTransaction();

      await TaskService.updateTask(
        "task-2",
        { name: "renamed" },
        "actor-1",
        "THIS_AND_FOLLOWING",
        "org-1",
      );

      // The addressed row doubles as its own master (there are no future rows
      // to re-parent), so it is written twice: once as the new split head and
      // once to cap the old master's recurrence.
      expect(txUpdate).toHaveBeenCalledTimes(2);
      expect(txUpdate).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: { id: "task-2" },
          data: expect.objectContaining({
            // No recurrence type was stored, so the series falls back to ONCE.
            recurrence: expect.objectContaining({
              type: "ONCE",
              isMaster: true,
              masterTaskId: undefined,
              cronExpression: undefined,
              endDate: undefined,
            }),
          }),
        }),
      );
      expect(txUpdate).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: { id: "task-2" },
          data: {
            recurrence: expect.objectContaining({
              endDate: new Date(occurrenceDueAt.getTime() - 1),
            }),
          },
        }),
      );
    });

    it("clears cron and end date on the split when the PATCH sends an empty recurrence", async () => {
      const occurrenceDueAt = new Date("2026-02-02T09:00:00.000Z");
      const occurrence = seriesRow({
        id: "task-2",
        dueAt: occurrenceDueAt,
        recurrence: { type: "DAILY", masterTaskId: "task-1" },
      });
      mockedPrisma.task.findFirst.mockResolvedValueOnce(occurrence as never);
      mockedPrisma.task.findMany.mockResolvedValueOnce([
        // Master has no cronExpression, so the split inherits nothing.
        seriesRow({ recurrence: { type: "DAILY", isMaster: true } }),
        occurrence,
      ] as never);
      const txUpdate = withTransaction();

      await TaskService.updateTask(
        "task-2",
        { recurrence: { type: "DAILY", endDate: null } },
        "actor-1",
        "THIS_AND_FOLLOWING",
        "org-1",
      );

      expect(txUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "task-2" },
          data: expect.objectContaining({
            recurrence: expect.objectContaining({
              type: "DAILY",
              isMaster: true,
              cronExpression: undefined,
              endDate: undefined,
            }),
          }),
        }),
      );
      expect(txUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "task-1" },
          data: {
            recurrence: expect.objectContaining({
              cronExpression: undefined,
              endDate: new Date(occurrenceDueAt.getTime() - 1),
            }),
          },
        }),
      );
    });

    it("drops the inherited cron when the PATCH nulls it on the split", async () => {
      const occurrenceDueAt = new Date("2026-02-02T09:00:00.000Z");
      const occurrence = seriesRow({
        id: "task-2",
        dueAt: occurrenceDueAt,
        recurrence: { type: "DAILY", masterTaskId: "task-1" },
      });
      mockedPrisma.task.findFirst.mockResolvedValueOnce(occurrence as never);
      mockedPrisma.task.findMany.mockResolvedValueOnce([
        seriesRow({
          recurrence: {
            type: "DAILY",
            isMaster: true,
            cronExpression: "0 9 * * *",
          },
        }),
        occurrence,
      ] as never);
      const txUpdate = withTransaction();

      await TaskService.updateTask(
        "task-2",
        { recurrence: { type: "DAILY", cronExpression: null } },
        "actor-1",
        "THIS_AND_FOLLOWING",
        "org-1",
      );

      expect(txUpdate).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: { id: "task-2" },
          data: expect.objectContaining({
            recurrence: expect.objectContaining({ cronExpression: undefined }),
          }),
        }),
      );
    });

    it("takes cron and end date from the PATCH on the split", async () => {
      const occurrenceDueAt = new Date("2026-02-02T09:00:00.000Z");
      const patchEndDate = new Date("2026-03-01T09:00:00.000Z");
      const occurrence = seriesRow({
        id: "task-2",
        dueAt: occurrenceDueAt,
        recurrence: { type: "DAILY", masterTaskId: "task-1" },
      });
      mockedPrisma.task.findFirst.mockResolvedValueOnce(occurrence as never);
      mockedPrisma.task.findMany.mockResolvedValueOnce([
        seriesRow({
          recurrence: {
            type: "DAILY",
            isMaster: true,
            cronExpression: "0 9 * * *",
          },
        }),
        occurrence,
      ] as never);
      const txUpdate = withTransaction();

      await TaskService.updateTask(
        "task-2",
        {
          recurrence: {
            type: "WEEKLY",
            cronExpression: "0 7 * * 1",
            endDate: patchEndDate,
          },
        },
        "actor-1",
        "THIS_AND_FOLLOWING",
        "org-1",
      );

      expect(txUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "task-2" },
          data: expect.objectContaining({
            recurrence: expect.objectContaining({
              // The split keeps the SERIES type; only cron and end date come
              // from the PATCH.
              type: "DAILY",
              isMaster: true,
              cronExpression: "0 7 * * 1",
              endDate: patchEndDate,
            }),
          }),
        }),
      );
    });
  });

  // ------------------------------------------------------------------
  // List filters and org-scope guards
  // ------------------------------------------------------------------
  describe("list guards", () => {
    it("rejects a blank parentId", async () => {
      await expect(
        TaskService.listForParent({ parentId: "   " }),
      ).rejects.toMatchObject({
        message: "Invalid parentId",
        statusCode: 400,
      });
      expect(mockedPrisma.task.findMany).not.toHaveBeenCalled();
    });

    it("rejects a blank organisationId for employee lists", async () => {
      await expect(
        TaskService.listForEmployee({ organisationId: "   " }),
      ).rejects.toThrow("Invalid organisationId");
    });

    it("rejects a blank organisationId for group lists", async () => {
      await expect(
        TaskService.listForGroup({ organisationId: "  ", groupId: "group-1" }),
      ).rejects.toThrow("Invalid organisationId");
    });

    it("rejects a blank groupId for group lists", async () => {
      await expect(
        TaskService.listForGroup({ organisationId: "org-1", groupId: "  " }),
      ).rejects.toThrow("Invalid groupId");
    });

    it("rejects a blank patientId for companion lists", async () => {
      await expect(
        TaskService.listForCompanion({
          patientId: "  ",
          organisationId: "org-1",
        }),
      ).rejects.toThrow("Invalid patientId");
    });

    it("rejects linking an unknown task to an appointment", async () => {
      mockedPrisma.task.findFirst.mockResolvedValueOnce(null as never);

      await expect(
        TaskService.linkToAppointment({
          taskId: "task-x",
          appointmentId: "appt-1",
        }),
      ).rejects.toMatchObject({
        message: "Task not found",
        statusCode: 404,
      });
      expect(mockedPrisma.task.update).not.toHaveBeenCalled();
    });

    it("returns the mapped task from getById when one exists", async () => {
      mockedPrisma.task.findFirst.mockResolvedValueOnce({
        id: "task-1",
        organisationId: "org-1",
      } as never);

      await expect(TaskService.getById("task-1", "org-1")).resolves.toEqual({
        id: "task-1",
        _id: "task-1",
        organisationId: "org-1",
      });
    });
  });

  describe("list filter composition", () => {
    const whereOf = () => mockedPrisma.task.findMany.mock.calls[0][0].where;

    it("applies patient and due-date filters to a parent list", async () => {
      mockedPrisma.task.findMany.mockResolvedValueOnce([] as never);
      const fromDueAt = new Date("2026-01-01T00:00:00.000Z");
      const toDueAt = new Date("2026-01-31T00:00:00.000Z");

      await TaskService.listForParent({
        parentId: "parent-1",
        patientId: "comp-1",
        fromDueAt,
        toDueAt,
        status: ["PENDING"],
      });

      expect(whereOf()).toEqual({
        audience: "PARENT_TASK",
        OR: [{ assignedTo: "parent-1" }, { createdBy: "parent-1" }],
        patientId: "comp-1",
        status: { in: ["PENDING"] },
        dueAt: { gte: fromDueAt, lte: toDueAt },
      });
    });

    it("drops an unrecognised status list and an invalid due-date on a parent list", async () => {
      mockedPrisma.task.findMany.mockResolvedValueOnce([] as never);

      await TaskService.listForParent({
        parentId: "parent-1",
        status: ["NOT_A_STATUS"] as never,
        fromDueAt: new Date("nonsense"),
      });

      const where = whereOf();
      expect(where.status).toBeUndefined();
      expect(where.dueAt).toBeUndefined();
    });

    it("applies patient and due-date filters to a group list", async () => {
      mockedPrisma.task.findMany.mockResolvedValueOnce([] as never);
      const toDueAt = new Date("2026-01-31T00:00:00.000Z");

      await TaskService.listForGroup({
        organisationId: "org-1",
        groupId: "group-1",
        patientId: "comp-1",
        toDueAt,
      });

      expect(whereOf()).toEqual({
        organisationId: "org-1",
        assignedGroupId: "group-1",
        patientId: "comp-1",
        dueAt: { lte: toDueAt },
      });
    });

    it("restricts an own-scope employee list to tasks the actor created or owns", async () => {
      mockedPrisma.task.findMany.mockResolvedValueOnce([] as never);

      await TaskService.listForEmployee({
        organisationId: "org-1",
        ownerId: "actor-1",
        includeCompleted: true,
      });

      expect(whereOf()).toEqual({
        AND: [
          { organisationId: "org-1", audience: "EMPLOYEE_TASK" },
          { OR: [{ createdBy: "actor-1" }, { assignedTo: "actor-1" }] },
        ],
      });
    });

    it("hides completed tasks unless includeCompleted is set", async () => {
      mockedPrisma.task.findMany.mockResolvedValueOnce([] as never);

      await TaskService.listForEmployee({ organisationId: "org-1" });

      expect(whereOf()).toEqual(
        expect.objectContaining({ status: { not: "COMPLETED" } }),
      );
    });

    it("applies category, priority, and due-date range filters", async () => {
      mockedPrisma.task.findMany.mockResolvedValueOnce([] as never);
      const dueFrom = new Date("2026-01-01T00:00:00.000Z");
      const dueTo = new Date("2026-01-31T00:00:00.000Z");

      await TaskService.listForEmployee({
        organisationId: "org-1",
        category: "CARE",
        subcategory: "  Rounds  ",
        priority: "URGENT",
        dueFrom,
        dueTo,
        includeCompleted: true,
      });

      expect(whereOf()).toEqual(
        expect.objectContaining({
          category: "CARE",
          subcategory: "Rounds",
          priority: "URGENT",
          dueAt: { gte: dueFrom, lte: dueTo },
        }),
      );
    });

    it("drops unrecognised category, priority, and blank subcategory filters", async () => {
      mockedPrisma.task.findMany.mockResolvedValueOnce([] as never);

      await TaskService.listForEmployee({
        organisationId: "org-1",
        category: "NOT_A_CATEGORY",
        subcategory: "   ",
        priority: "NOT_A_PRIORITY" as never,
        dueFrom: new Date("nonsense"),
        dueTo: new Date("nonsense"),
        includeCompleted: true,
      });

      const where = whereOf();
      expect(where.category).toBeUndefined();
      expect(where.subcategory).toBeUndefined();
      expect(where.priority).toBeUndefined();
      expect(where.dueAt).toBeUndefined();
    });

    it("returns an unsatisfiable filter when the patient ids conflict", async () => {
      mockedPrisma.task.findMany.mockResolvedValueOnce([] as never);

      await TaskService.listForCompanion({
        patientId: "comp-1",
        organisationId: "org-1",
        companionId: "comp-2",
      });

      // Two different companions can never both be the task's patient, so the
      // query short-circuits instead of silently dropping one of them.
      expect(whereOf()).toEqual({ id: { in: [] } });
    });

    it("intersects appointment ids across encounter, episode, and admission filters", async () => {
      mockedPrisma.appointment.findMany
        .mockResolvedValueOnce([{ id: "appt-1" }, { id: "appt-9" }] as never)
        .mockResolvedValueOnce([{ id: "appt-1" }, { id: "appt-2" }] as never);
      mockedPrisma.task.findMany.mockResolvedValueOnce([] as never);

      await TaskService.listForEmployee({
        organisationId: "org-1",
        appointmentId: "appt-1",
        episodeOfCareId: "case-1",
        admissionId: "adm-1",
        includeCompleted: true,
      });

      expect(mockedPrisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organisationId: "org-1", caseId: "case-1" },
        }),
      );
      expect(mockedPrisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organisationId: "org-1", encounterId: "adm-1" },
        }),
      );
      expect(whereOf()).toEqual({
        AND: [
          { organisationId: "org-1", audience: "EMPLOYEE_TASK" },
          { appointmentId: { in: ["appt-1"] } },
        ],
      });
    });

    it("short-circuits when an encounter filter matches no appointment", async () => {
      mockedPrisma.appointment.findMany.mockResolvedValueOnce([] as never);
      mockedPrisma.task.findMany.mockResolvedValueOnce([] as never);

      await TaskService.listForEmployee({
        organisationId: "org-1",
        encounterId: "enc-1",
        includeCompleted: true,
      });

      expect(whereOf()).toEqual({ id: { in: [] } });
      expect(mockedPrisma.taskSchedule.findMany).not.toHaveBeenCalled();
    });

    it("scopes appointment and schedule lookups without an organisation on the mobile path", async () => {
      mockedPrisma.appointment.findMany
        .mockResolvedValueOnce([{ id: "appt-1" }, { id: "appt-2" }] as never)
        .mockResolvedValueOnce([{ id: "appt-1" }, { id: "appt-3" }] as never)
        .mockResolvedValueOnce([{ id: "appt-1" }] as never);
      mockedPrisma.taskSchedule.findMany.mockResolvedValueOnce([
        { generatedTaskIds: ["task-1", "task-2", 5] },
        { generatedTaskIds: ["task-2"] },
      ] as never);
      mockedPrisma.task.findMany.mockResolvedValueOnce([] as never);

      await TaskService.listForCompanion({
        patientId: "comp-1",
        organisationId: undefined,
        encounterId: "enc-1",
        episodeOfCareId: "case-1",
        admissionId: "adm-1",
        templateInstanceId: "inst-1",
        includeCompleted: true,
      });

      expect(mockedPrisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { encounterId: "enc-1" } }),
      );
      expect(mockedPrisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { caseId: "case-1" } }),
      );
      expect(mockedPrisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { encounterId: "adm-1" } }),
      );
      expect(mockedPrisma.taskSchedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { templateInstanceId: "inst-1" } }),
      );
      expect(whereOf()).toEqual({
        AND: [
          { patientId: "comp-1" },
          { appointmentId: { in: ["appt-1"] } },
          // Only the id present in BOTH schedules survives, and the non-string
          // entry is discarded.
          { id: { in: ["task-2"] } },
        ],
      });
    });

    it("short-circuits when a schedule filter matches no schedule", async () => {
      mockedPrisma.taskSchedule.findMany.mockResolvedValueOnce([] as never);
      mockedPrisma.task.findMany.mockResolvedValueOnce([] as never);

      await TaskService.listForEmployee({
        organisationId: "org-1",
        scheduleId: "sched-1",
        includeCompleted: true,
      });

      expect(mockedPrisma.taskSchedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organisationId: "org-1", id: "sched-1" },
        }),
      );
      expect(whereOf()).toEqual({ id: { in: [] } });
    });

    it("short-circuits when a schedule has generated no tasks", async () => {
      mockedPrisma.taskSchedule.findMany.mockResolvedValueOnce([
        { generatedTaskIds: null },
      ] as never);
      mockedPrisma.task.findMany.mockResolvedValueOnce([] as never);

      await TaskService.listForEmployee({
        organisationId: "org-1",
        scheduleId: "sched-1",
        includeCompleted: true,
      });

      expect(whereOf()).toEqual({ id: { in: [] } });
    });

    it("maps a CUSTOM kind filter onto the task source", async () => {
      mockedPrisma.task.findMany.mockResolvedValueOnce([] as never);

      await TaskService.listForEmployee({
        organisationId: "org-1",
        kind: "CUSTOM",
        includeCompleted: true,
      });

      expect(mockedPrisma.taskTemplate.findMany).not.toHaveBeenCalled();
      expect(whereOf()).toEqual({
        AND: [
          { organisationId: "org-1", audience: "EMPLOYEE_TASK" },
          { source: "CUSTOM" },
        ],
      });
    });

    it("short-circuits a kind filter with no matching templates", async () => {
      mockedPrisma.taskTemplate.findMany.mockResolvedValueOnce([] as never);
      mockedPrisma.taskLibraryDefinition.findMany.mockResolvedValueOnce([
        { id: "lib-1" },
      ] as never);
      mockedPrisma.task.findMany.mockResolvedValueOnce([] as never);

      await TaskService.listForEmployee({
        organisationId: "org-1",
        kind: "MEDICATION",
        includeCompleted: true,
      });

      expect(whereOf()).toEqual({ id: { in: [] } });
    });

    it("short-circuits a kind filter with no matching library definitions", async () => {
      mockedPrisma.taskTemplate.findMany.mockResolvedValueOnce([
        { id: "tmpl-1" },
      ] as never);
      mockedPrisma.taskLibraryDefinition.findMany.mockResolvedValueOnce(
        [] as never,
      );
      mockedPrisma.task.findMany.mockResolvedValueOnce([] as never);

      await TaskService.listForEmployee({
        organisationId: "org-1",
        kind: "MEDICATION",
        includeCompleted: true,
      });

      expect(whereOf()).toEqual({ id: { in: [] } });
    });

    it("never queries organisation templates on the mobile companion path", async () => {
      mockedPrisma.taskLibraryDefinition.findMany.mockResolvedValueOnce([
        { id: "lib-1" },
      ] as never);
      mockedPrisma.task.findMany.mockResolvedValueOnce([] as never);

      await TaskService.listForCompanion({
        patientId: "comp-1",
        organisationId: undefined,
        kind: "MEDICATION",
        includeCompleted: true,
      });

      expect(mockedPrisma.taskTemplate.findMany).not.toHaveBeenCalled();
      // With no organisation there are no org templates, so the kind filter
      // collapses to an empty template id list.
      expect(whereOf()).toEqual({ id: { in: [] } });
    });
  });
});
