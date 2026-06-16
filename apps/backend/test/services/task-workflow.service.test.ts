import { prisma } from "src/config/prisma";
import { TaskService } from "../../src/services/task.service";
import { TaskWorkflowService } from "../../src/services/task-workflow.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    templateInstance: {
      findUnique: jest.fn(),
    },
    taskSchedule: {
      create: jest.fn(),
      update: jest.fn(),
    },
    appointment: {
      findFirst: jest.fn(),
    },
    admission: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/task.service", () => ({
  TaskService: {
    createFromWorkflowSeed: jest.fn(),
    changeStatus: jest.fn(),
  },
}));

const mockedPrisma = prisma as unknown as {
  templateInstance: {
    findUnique: jest.Mock;
  };
  taskSchedule: {
    create: jest.Mock;
    update: jest.Mock;
  };
  appointment: {
    findFirst: jest.Mock;
  };
  admission: {
    findUnique: jest.Mock;
  };
};

const mockedTaskService = TaskService as unknown as {
  createFromWorkflowSeed: jest.Mock;
  changeStatus: jest.Mock;
};

describe("TaskWorkflowService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("launches a task template instance into a persisted schedule", async () => {
    mockedPrisma.templateInstance.findUnique.mockResolvedValueOnce({
      id: "instance-1",
      organisationId: "org-1",
      appointmentId: "appt-1",
      caseId: null,
      encounterId: null,
      templateId: "template-1",
      templateVersion: 3,
      authorId: "creator-1",
      signedBy: null,
      signedAt: null,
      createdAt: new Date("2026-01-01T08:00:00.000Z"),
      data: {
        sections: [
          {
            id: "definition",
            data: {
              taskKind: "MEDICATION",
              category: "Medication",
              name: "Evening medicine",
            },
          },
          {
            id: "assignment",
            data: {
              defaultRole: "EMPLOYEE_TASK",
              defaultAssigneeRole: "EMPLOYEE_TASK",
            },
          },
          {
            id: "timing",
            data: {
              dueOffsetMinutes: 30,
            },
          },
        ],
      },
      template: {
        id: "template-1",
        kind: "TASK_TEMPLATE",
        ownership: "ORG_TEMPLATE",
      },
      taskSchedule: null,
    });
    mockedTaskService.createFromWorkflowSeed.mockResolvedValueOnce({
      id: "task-1",
    });
    mockedPrisma.taskSchedule.create.mockResolvedValueOnce({
      id: "schedule-1",
      templateInstanceId: "instance-1",
      templateId: "template-1",
      templateVersion: 3,
      templateKind: "TASK_TEMPLATE",
      organisationId: "org-1",
      createdBy: "creator-1",
      status: "COMPLETED",
      materializedSeeds: [],
      generatedTaskIds: null,
    });
    mockedPrisma.taskSchedule.update.mockResolvedValueOnce({
      id: "schedule-1",
      templateInstanceId: "instance-1",
      templateId: "template-1",
      templateVersion: 3,
      templateKind: "TASK_TEMPLATE",
      organisationId: "org-1",
      createdBy: "creator-1",
      status: "COMPLETED",
      materializedSeeds: [],
      generatedTaskIds: ["task-1"],
    });

    const result = await TaskWorkflowService.launchFromTemplateInstance(
      "instance-1",
      "org-1",
      "creator-1",
      { client: prisma, notify: false },
    );

    expect(mockedTaskService.createFromWorkflowSeed).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.taskSchedule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          templateInstanceId: "instance-1",
          templateId: "template-1",
          templateVersion: 3,
          templateKind: "TASK_TEMPLATE",
          status: "COMPLETED",
        }),
      }),
    );
    expect(mockedPrisma.taskSchedule.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "schedule-1" },
        data: expect.objectContaining({
          generatedTaskIds: ["task-1"],
        }),
      }),
    );
    expect(result.taskIds).toEqual(["task-1"]);
  });

  it("uses an explicit assignee role when materializing a task template", async () => {
    mockedPrisma.templateInstance.findUnique.mockResolvedValueOnce({
      id: "instance-1",
      organisationId: "org-1",
      appointmentId: "appt-1",
      caseId: null,
      encounterId: null,
      templateId: "template-1",
      templateVersion: 3,
      authorId: "creator-1",
      signedBy: null,
      signedAt: null,
      createdAt: new Date("2026-01-01T08:00:00.000Z"),
      data: {
        sections: [
          {
            id: "definition",
            data: {
              taskKind: "MEDICATION",
              category: "Medication",
              name: "Parent review",
            },
          },
          {
            id: "assignment",
            data: {
              defaultRole: "EMPLOYEE_TASK",
              defaultAssigneeRole: "PARENT_TASK",
            },
          },
          {
            id: "timing",
            data: {
              dueOffsetMinutes: 30,
            },
          },
        ],
      },
      template: {
        id: "template-1",
        kind: "TASK_TEMPLATE",
        ownership: "ORG_TEMPLATE",
      },
      taskSchedule: null,
    });
    mockedPrisma.appointment.findFirst.mockResolvedValueOnce({
      companion: { parent: { id: "parent-1" } },
      lead: { id: "lead-1" },
      supportStaff: [{ id: "staff-1" }],
      startTime: new Date("2026-01-01T08:00:00.000Z"),
      encounterId: null,
    });
    mockedPrisma.taskSchedule.create.mockResolvedValueOnce({
      id: "schedule-1",
      templateInstanceId: "instance-1",
      templateId: "template-1",
      templateVersion: 3,
      templateKind: "TASK_TEMPLATE",
      organisationId: "org-1",
      createdBy: "creator-1",
      status: "COMPLETED",
      materializedSeeds: [],
      generatedTaskIds: null,
    });
    mockedPrisma.taskSchedule.update.mockResolvedValueOnce({
      id: "schedule-1",
      templateInstanceId: "instance-1",
      templateId: "template-1",
      templateVersion: 3,
      templateKind: "TASK_TEMPLATE",
      organisationId: "org-1",
      createdBy: "creator-1",
      status: "COMPLETED",
      materializedSeeds: [],
      generatedTaskIds: ["task-1"],
    });
    mockedTaskService.createFromWorkflowSeed.mockResolvedValueOnce({
      id: "task-1",
    });

    await TaskWorkflowService.launchFromTemplateInstance(
      "instance-1",
      "org-1",
      "creator-1",
      { client: prisma, notify: false },
    );

    expect(mockedTaskService.createFromWorkflowSeed).toHaveBeenCalledWith(
      expect.objectContaining({
        assignedTo: "parent-1",
        audience: "EMPLOYEE_TASK",
      }),
      expect.objectContaining({
        client: prisma,
        notify: false,
      }),
    );
  });

  it("returns an existing generated schedule without duplicating tasks", async () => {
    mockedPrisma.templateInstance.findUnique.mockResolvedValueOnce({
      id: "instance-2",
      organisationId: "org-1",
      appointmentId: null,
      caseId: null,
      encounterId: null,
      templateId: "template-2",
      templateVersion: 1,
      authorId: "creator-1",
      signedBy: null,
      signedAt: null,
      createdAt: new Date("2026-01-01T08:00:00.000Z"),
      data: {},
      template: {
        id: "template-2",
        kind: "CARE_PATHWAY",
        ownership: "ORG_TEMPLATE",
      },
      taskSchedule: {
        id: "schedule-2",
        templateInstanceId: "instance-2",
        templateId: "template-2",
        templateVersion: 1,
        templateKind: "CARE_PATHWAY",
        organisationId: "org-1",
        createdBy: "creator-1",
        status: "ACTIVE",
        generatedTaskIds: ["task-1", "task-2"],
        materializedSeeds: [{ id: "seed-1" }],
      },
    });

    const result = await TaskWorkflowService.launchFromTemplateInstance(
      "instance-2",
      "org-1",
      "creator-1",
      { client: prisma, notify: false },
    );

    expect(mockedTaskService.createFromWorkflowSeed).not.toHaveBeenCalled();
    expect(mockedPrisma.taskSchedule.update).not.toHaveBeenCalled();
    expect(result.taskIds).toEqual(["task-1", "task-2"]);
  });

  it("pauses, resumes, and cancels a schedule", async () => {
    mockedPrisma.templateInstance.findUnique.mockResolvedValueOnce({
      id: "instance-4",
      organisationId: "org-1",
      appointmentId: null,
      caseId: null,
      encounterId: null,
      templateId: "template-4",
      templateVersion: 1,
      authorId: "creator-1",
      signedBy: null,
      signedAt: null,
      createdAt: new Date("2026-01-01T08:00:00.000Z"),
      data: {},
      template: {
        id: "template-4",
        kind: "CARE_PATHWAY",
        ownership: "ORG_TEMPLATE",
      },
      taskSchedule: {
        id: "schedule-4",
        templateInstanceId: "instance-4",
        templateId: "template-4",
        templateVersion: 1,
        templateKind: "CARE_PATHWAY",
        organisationId: "org-1",
        createdBy: "creator-1",
        status: "ACTIVE",
        generatedTaskIds: ["task-7", "task-8"],
        materializedSeeds: [{ id: "seed-1" }],
      },
    });
    mockedPrisma.taskSchedule.update.mockResolvedValue({
      id: "schedule-4",
      templateInstanceId: "instance-4",
      templateId: "template-4",
      templateVersion: 1,
      templateKind: "CARE_PATHWAY",
      organisationId: "org-1",
      createdBy: "creator-1",
      status: "PAUSED",
      generatedTaskIds: ["task-7", "task-8"],
      materializedSeeds: [{ id: "seed-1" }],
    });

    const paused = await TaskWorkflowService.pauseSchedule(
      "instance-4",
      "actor-1",
      "org-1",
    );
    expect(paused.status).toBe("PAUSED");

    mockedPrisma.templateInstance.findUnique.mockResolvedValueOnce({
      id: "instance-4",
      organisationId: "org-1",
      appointmentId: null,
      caseId: null,
      encounterId: null,
      templateId: "template-4",
      templateVersion: 1,
      authorId: "creator-1",
      signedBy: null,
      signedAt: null,
      createdAt: new Date("2026-01-01T08:00:00.000Z"),
      data: {},
      template: {
        id: "template-4",
        kind: "CARE_PATHWAY",
        ownership: "ORG_TEMPLATE",
      },
      taskSchedule: {
        id: "schedule-4",
        templateInstanceId: "instance-4",
        templateId: "template-4",
        templateVersion: 1,
        templateKind: "CARE_PATHWAY",
        organisationId: "org-1",
        createdBy: "creator-1",
        status: "PAUSED",
        generatedTaskIds: ["task-7", "task-8"],
        materializedSeeds: [{ id: "seed-1" }],
      },
    });
    mockedPrisma.taskSchedule.update.mockResolvedValueOnce({
      id: "schedule-4",
      templateInstanceId: "instance-4",
      templateId: "template-4",
      templateVersion: 1,
      templateKind: "CARE_PATHWAY",
      organisationId: "org-1",
      createdBy: "creator-1",
      status: "ACTIVE",
      generatedTaskIds: ["task-7", "task-8"],
      materializedSeeds: [{ id: "seed-1" }],
    });

    const resumed = await TaskWorkflowService.resumeSchedule(
      "instance-4",
      "actor-1",
      "org-1",
    );
    expect(resumed.status).toBe("ACTIVE");

    mockedPrisma.templateInstance.findUnique.mockResolvedValueOnce({
      id: "instance-4",
      organisationId: "org-1",
      appointmentId: null,
      caseId: null,
      encounterId: null,
      templateId: "template-4",
      templateVersion: 1,
      authorId: "creator-1",
      signedBy: null,
      signedAt: null,
      createdAt: new Date("2026-01-01T08:00:00.000Z"),
      data: {},
      template: {
        id: "template-4",
        kind: "CARE_PATHWAY",
        ownership: "ORG_TEMPLATE",
      },
      taskSchedule: {
        id: "schedule-4",
        templateInstanceId: "instance-4",
        templateId: "template-4",
        templateVersion: 1,
        templateKind: "CARE_PATHWAY",
        organisationId: "org-1",
        createdBy: "creator-1",
        status: "ACTIVE",
        generatedTaskIds: ["task-7", "task-8"],
        materializedSeeds: [{ id: "seed-1" }],
      },
    });
    mockedTaskService.changeStatus.mockResolvedValue({
      task: { id: "task-7" },
    });
    mockedPrisma.taskSchedule.update.mockResolvedValueOnce({
      id: "schedule-4",
      templateInstanceId: "instance-4",
      templateId: "template-4",
      templateVersion: 1,
      templateKind: "CARE_PATHWAY",
      organisationId: "org-1",
      createdBy: "creator-1",
      status: "CANCELLED",
      generatedTaskIds: ["task-7", "task-8"],
      materializedSeeds: [{ id: "seed-1" }],
    });

    const cancelled = await TaskWorkflowService.cancelSchedule(
      "instance-4",
      "actor-1",
      "org-1",
    );
    expect(mockedTaskService.changeStatus).toHaveBeenCalledWith(
      "task-7",
      "CANCELLED",
      "actor-1",
    );
    expect(cancelled.status).toBe("CANCELLED");
  });

  it("regenerates a schedule by cancelling old tasks and creating new ones", async () => {
    mockedPrisma.templateInstance.findUnique.mockResolvedValueOnce({
      id: "instance-5",
      organisationId: "org-1",
      appointmentId: "appt-1",
      caseId: null,
      encounterId: null,
      templateId: "template-5",
      templateVersion: 1,
      authorId: "creator-1",
      signedBy: null,
      signedAt: null,
      createdAt: new Date("2026-01-01T08:00:00.000Z"),
      data: {
        sections: [
          {
            id: "definition",
            data: {
              taskKind: "MEDICATION",
              category: "Medication",
              name: "Rebuilt medicine",
            },
          },
          {
            id: "assignment",
            data: {
              defaultRole: "EMPLOYEE_TASK",
            },
          },
          {
            id: "timing",
            data: {
              dueOffsetMinutes: 15,
            },
          },
        ],
      },
      template: {
        id: "template-5",
        kind: "TASK_TEMPLATE",
        ownership: "ORG_TEMPLATE",
      },
      taskSchedule: {
        id: "schedule-5",
        templateInstanceId: "instance-5",
        templateId: "template-5",
        templateVersion: 1,
        templateKind: "TASK_TEMPLATE",
        organisationId: "org-1",
        createdBy: "creator-1",
        status: "COMPLETED",
        generatedTaskIds: ["task-old"],
        materializedSeeds: [{ id: "seed-old" }],
      },
    });
    mockedTaskService.changeStatus.mockResolvedValue({
      task: { id: "task-old" },
    });
    mockedPrisma.taskSchedule.update.mockResolvedValueOnce({
      id: "schedule-5",
      templateInstanceId: "instance-5",
      templateId: "template-5",
      templateVersion: 1,
      templateKind: "TASK_TEMPLATE",
      organisationId: "org-1",
      createdBy: "creator-1",
      status: "COMPLETED",
      generatedTaskIds: ["task-new"],
      materializedSeeds: [{ id: "seed-new" }],
    });
    mockedPrisma.taskSchedule.create.mockResolvedValueOnce({
      id: "schedule-5",
      templateInstanceId: "instance-5",
      templateId: "template-5",
      templateVersion: 1,
      templateKind: "TASK_TEMPLATE",
      organisationId: "org-1",
      createdBy: "creator-1",
      status: "COMPLETED",
      generatedTaskIds: null,
      materializedSeeds: [{ id: "seed-new" }],
    });
    mockedTaskService.createFromWorkflowSeed.mockResolvedValueOnce({
      id: "task-new",
    });

    const result = await TaskWorkflowService.regenerateSchedule(
      "instance-5",
      "org-1",
      "creator-1",
      { client: prisma, notify: false },
    );

    expect(mockedTaskService.changeStatus).toHaveBeenCalledWith(
      "task-old",
      "CANCELLED",
      "creator-1",
    );
    expect(mockedTaskService.createFromWorkflowSeed).toHaveBeenCalledTimes(1);
    expect(result.taskIds).toEqual(["task-new"]);
  });

  it("defers a schedule launch until the requested activation time", async () => {
    mockedPrisma.templateInstance.findUnique.mockResolvedValueOnce({
      id: "instance-6",
      organisationId: "org-1",
      appointmentId: "appt-1",
      caseId: null,
      encounterId: null,
      templateId: "template-6",
      templateVersion: 1,
      authorId: "creator-1",
      signedBy: null,
      signedAt: null,
      createdAt: new Date("2026-01-01T08:00:00.000Z"),
      data: {
        sections: [
          {
            id: "definition",
            data: {
              taskKind: "MEDICATION",
              category: "Medication",
              name: "Delayed medicine",
            },
          },
          {
            id: "assignment",
            data: {
              defaultRole: "EMPLOYEE_TASK",
            },
          },
          {
            id: "timing",
            data: {
              dueOffsetMinutes: 45,
            },
          },
        ],
      },
      template: {
        id: "template-6",
        kind: "TASK_TEMPLATE",
        ownership: "ORG_TEMPLATE",
      },
      taskSchedule: null,
    });
    mockedPrisma.taskSchedule.create.mockResolvedValueOnce({
      id: "schedule-6",
      templateInstanceId: "instance-6",
      templateId: "template-6",
      templateVersion: 1,
      templateKind: "TASK_TEMPLATE",
      organisationId: "org-1",
      createdBy: "creator-1",
      status: "DRAFT",
      generatedTaskIds: null,
      materializedSeeds: [{ id: "seed-delayed" }],
    });
    mockedPrisma.taskSchedule.update.mockResolvedValueOnce({
      id: "schedule-6",
      templateInstanceId: "instance-6",
      templateId: "template-6",
      templateVersion: 1,
      templateKind: "TASK_TEMPLATE",
      organisationId: "org-1",
      createdBy: "creator-1",
      status: "DRAFT",
      generatedTaskIds: null,
      materializedSeeds: [{ id: "seed-delayed" }],
    });

    const deferredUntil = new Date("2026-06-15T10:00:00.000Z");
    const result = await TaskWorkflowService.launchFromTemplateInstance(
      "instance-6",
      "org-1",
      "creator-1",
      { client: prisma, notify: false, deferUntil: deferredUntil },
    );

    expect(mockedTaskService.createFromWorkflowSeed).not.toHaveBeenCalled();
    expect(result.taskIds).toEqual([]);
    expect(mockedPrisma.taskSchedule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "DRAFT",
          activatedAt: deferredUntil,
        }),
      }),
    );
  });

  it("rejects unsupported template kinds", async () => {
    mockedPrisma.templateInstance.findUnique.mockResolvedValueOnce({
      id: "instance-3",
      organisationId: "org-1",
      appointmentId: null,
      caseId: null,
      encounterId: null,
      templateId: "template-3",
      templateVersion: 1,
      authorId: "creator-1",
      signedBy: null,
      signedAt: null,
      createdAt: new Date("2026-01-01T08:00:00.000Z"),
      data: {},
      template: {
        id: "template-3",
        kind: "SOAP_NOTE",
        ownership: "ORG_TEMPLATE",
      },
      taskSchedule: null,
    });

    await expect(
      TaskWorkflowService.launchFromTemplateInstance(
        "instance-3",
        "org-1",
        "creator-1",
        { client: prisma, notify: false },
      ),
    ).rejects.toThrow(
      "Template kind does not support task workflow generation",
    );
  });
});
