import { Prisma, TemplateKind } from "@prisma/client";
import { prisma } from "src/config/prisma";
import {
  materializeTaskWorkflowSeeds,
  type TaskWorkflowSeed,
} from "./task-workflow-materializer";
import { TaskService, type TaskAudience } from "./task.service";

export class TaskWorkflowServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = "TaskWorkflowServiceError";
  }
}

type TaskScheduleRow = Prisma.TaskScheduleGetPayload<Record<string, never>>;
type TaskScheduleLike = TaskScheduleRow & { _id: string };

type TemplateInstanceWorkflowPayload = Prisma.TemplateInstanceGetPayload<{
  include: {
    template: {
      select: {
        id: true;
        kind: true;
        ownership: true;
      };
    };
    taskSchedule: true;
  };
}>;

type TemplateInstanceWithSchedule = TemplateInstanceWorkflowPayload & {
  taskSchedule: NonNullable<TemplateInstanceWorkflowPayload["taskSchedule"]>;
};

type LaunchTaskWorkflowOptions = {
  client?: Prisma.TransactionClient;
  notify?: boolean;
  force?: boolean;
  deferUntil?: Date;
};

type AppointmentContext = {
  patientId?: string;
  parentId?: string;
  leadId?: string;
  supportStaffIds: string[];
  anchorAt: Date;
  admissionAt: Date;
};

const toTaskScheduleLike = (row: TaskScheduleRow): TaskScheduleLike => ({
  ...row,
  _id: row.id,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getStringId = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const getAppointmentLeadId = (lead: unknown): string | undefined =>
  isRecord(lead) ? getStringId(lead.id) : undefined;

const getAppointmentCompanionId = (companion: unknown): string | undefined =>
  isRecord(companion) ? getStringId(companion.id) : undefined;

const getAppointmentParentId = (companion: unknown): string | undefined =>
  isRecord(companion) && isRecord(companion.parent)
    ? getStringId(companion.parent.id)
    : undefined;

const getSupportStaffIds = (supportStaff: unknown): string[] =>
  Array.isArray(supportStaff)
    ? supportStaff
        .map((member) =>
          isRecord(member) ? getStringId(member.id) : undefined,
        )
        .filter((id): id is string => Boolean(id))
    : [];

const resolveSource = (
  ownership: "YC_LIBRARY" | "ORG_TEMPLATE" | "USER_TEMPLATE",
) => (ownership === "YC_LIBRARY" ? "YC_LIBRARY" : "ORG_TEMPLATE");

const toJsonSeed = (seed: TaskWorkflowSeed) => ({
  ...seed,
  dueAt: seed.dueAt.toISOString(),
  recurrence: seed.recurrence
    ? {
        ...seed.recurrence,
        endDate: seed.recurrence.endDate?.toISOString(),
      }
    : undefined,
});

const loadAppointmentContext = async (
  client: Prisma.TransactionClient,
  templateInstance: {
    appointmentId?: string | null;
    encounterId?: string | null;
    signedAt?: Date | null;
    createdAt: Date;
  },
): Promise<AppointmentContext> => {
  const appointment = templateInstance.appointmentId
    ? await client.appointment.findFirst({
        where: { id: templateInstance.appointmentId },
        select: {
          patient: true,
          lead: true,
          supportStaff: true,
          startTime: true,
          encounterId: true,
        },
      })
    : null;

  const encounterId =
    templateInstance.encounterId ?? appointment?.encounterId ?? undefined;
  const admission = encounterId
    ? await client.admission.findUnique({
        where: { encounterId },
        select: { admittedAt: true },
      })
    : null;

  const anchorAt =
    appointment?.startTime ??
    templateInstance.signedAt ??
    templateInstance.createdAt;
  const admissionAt = admission?.admittedAt ?? anchorAt;

  return {
    patientId: getAppointmentCompanionId(appointment?.patient),
    parentId: getAppointmentParentId(appointment?.patient),
    leadId: getAppointmentLeadId(appointment?.lead),
    supportStaffIds: getSupportStaffIds(appointment?.supportStaff),
    anchorAt,
    admissionAt,
  };
};

const isFutureDate = (value: Date | undefined, reference: Date) =>
  value instanceof Date && value.getTime() > reference.getTime();

const resolveAssignee = (
  audience: TaskAudience,
  context: AppointmentContext,
  createdBy: string,
  assignedRole: TaskAudience = audience,
) => {
  if (assignedRole === "PARENT_TASK") {
    return context.parentId ?? createdBy;
  }

  return context.leadId ?? context.supportStaffIds[0] ?? createdBy;
};

const normalizeTemplateInstance = (
  instance: TemplateInstanceWorkflowPayload | null,
) => {
  if (!instance) {
    throw new TaskWorkflowServiceError("Template instance not found", 404);
  }
  return instance;
};

const hasScheduleTasks = (
  schedule: TemplateInstanceWorkflowPayload["taskSchedule"] | null,
) =>
  !!schedule &&
  Array.isArray(schedule.generatedTaskIds) &&
  schedule.generatedTaskIds.length > 0;

const toTaskIdList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0,
      )
    : [];

const launchWorkflowInstance = async (
  client: Prisma.TransactionClient,
  instance: TemplateInstanceWorkflowPayload,
  submittedBy: string,
  options?: LaunchTaskWorkflowOptions,
) => {
  const existingSchedule = instance.taskSchedule;
  const now = new Date();
  const deferUntil = options?.deferUntil;
  const shouldDefer = isFutureDate(deferUntil, now);

  if (hasScheduleTasks(existingSchedule) && !options?.force) {
    const activeSchedule = existingSchedule as NonNullable<
      typeof existingSchedule
    >;
    return {
      schedule: toTaskScheduleLike(activeSchedule),
      taskIds: toTaskIdList(activeSchedule.generatedTaskIds),
      seedCount: Array.isArray(activeSchedule.materializedSeeds)
        ? activeSchedule.materializedSeeds.length
        : 0,
    };
  }

  if (options?.force && hasScheduleTasks(existingSchedule)) {
    const activeSchedule = existingSchedule as NonNullable<
      typeof existingSchedule
    >;
    for (const taskId of toTaskIdList(activeSchedule.generatedTaskIds)) {
      await TaskService.changeStatus(taskId, "CANCELLED", submittedBy);
    }
  }

  if (
    instance.template.kind !== TemplateKind.TASK_TEMPLATE &&
    instance.template.kind !== TemplateKind.CARE_PATHWAY
  ) {
    throw new TaskWorkflowServiceError(
      "Template kind does not support task workflow generation",
      400,
    );
  }

  const createdBy = submittedBy.trim();
  if (!createdBy) {
    throw new TaskWorkflowServiceError("submittedBy is required", 400);
  }

  const context = await loadAppointmentContext(client, instance);
  const source = resolveSource(instance.template.ownership);

  const seeds = materializeTaskWorkflowSeeds(
    instance.template.kind,
    instance.data,
    {
      organisationId: instance.organisationId,
      createdBy,
      assignedBy: createdBy,
      appointmentId: instance.appointmentId ?? undefined,
      patientId: context.patientId,
      templateId: instance.templateId,
      source,
      anchorAt: context.anchorAt,
      admissionAt: context.admissionAt,
      resolveAssignee: (audience, assignedRole) =>
        resolveAssignee(audience, context, createdBy, assignedRole),
    },
  );

  const metadata = {
    templateKind: instance.template.kind,
    ownership: instance.template.ownership,
    ...(shouldDefer && deferUntil
      ? { deferredUntil: deferUntil.toISOString() }
      : {}),
  } as Prisma.InputJsonValue;

  const persistedSchedule = instance.taskSchedule
    ? await client.taskSchedule.update({
        where: { templateInstanceId: instance.id },
        data: {
          templateId: instance.templateId,
          templateVersion: instance.templateVersion,
          templateKind: instance.template.kind,
          organisationId: instance.organisationId,
          appointmentId: instance.appointmentId ?? undefined,
          caseId: instance.caseId ?? undefined,
          encounterId: instance.encounterId ?? undefined,
          patientId: context.patientId,
          createdBy,
          activatedBy: submittedBy ?? createdBy,
          activatedAt: shouldDefer ? deferUntil : now,
          status: shouldDefer
            ? "DRAFT"
            : instance.template.kind === TemplateKind.TASK_TEMPLATE
              ? "COMPLETED"
              : "ACTIVE",
          scheduleInput: instance.data as Prisma.InputJsonValue,
          materializedSeeds: seeds.map(toJsonSeed) as Prisma.InputJsonValue,
          generatedTaskIds: Prisma.DbNull,
          completedAt: shouldDefer
            ? null
            : instance.template.kind === TemplateKind.TASK_TEMPLATE
              ? now
              : null,
          lastMaterializedAt: now,
          metadata,
        },
      })
    : await client.taskSchedule.create({
        data: {
          templateInstanceId: instance.id,
          templateId: instance.templateId,
          templateVersion: instance.templateVersion,
          templateKind: instance.template.kind,
          organisationId: instance.organisationId,
          appointmentId: instance.appointmentId ?? undefined,
          caseId: instance.caseId ?? undefined,
          encounterId: instance.encounterId ?? undefined,
          patientId: context.patientId,
          createdBy,
          activatedBy: submittedBy ?? createdBy,
          activatedAt: shouldDefer ? deferUntil : now,
          status: shouldDefer
            ? "DRAFT"
            : instance.template.kind === TemplateKind.TASK_TEMPLATE
              ? "COMPLETED"
              : "ACTIVE",
          scheduleInput: instance.data as Prisma.InputJsonValue,
          materializedSeeds: seeds.map(toJsonSeed) as Prisma.InputJsonValue,
          generatedTaskIds: Prisma.DbNull,
          completedAt: shouldDefer
            ? null
            : instance.template.kind === TemplateKind.TASK_TEMPLATE
              ? now
              : null,
          lastMaterializedAt: now,
          metadata,
        },
      });

  if (shouldDefer) {
    return {
      schedule: toTaskScheduleLike(persistedSchedule),
      taskIds: [],
      seedCount: seeds.length,
    };
  }

  const generatedTaskIds: string[] = [];
  for (const seed of seeds) {
    const task = await TaskService.createFromWorkflowSeed(seed, {
      client,
      notify: options?.notify,
    });
    generatedTaskIds.push(task.id);
  }

  const updatedSchedule = await client.taskSchedule.update({
    where: { id: persistedSchedule.id },
    data: {
      generatedTaskIds: generatedTaskIds as Prisma.InputJsonValue,
      completedAt:
        instance.template.kind === TemplateKind.TASK_TEMPLATE ? now : null,
      status:
        instance.template.kind === TemplateKind.TASK_TEMPLATE
          ? "COMPLETED"
          : "ACTIVE",
    },
  });

  return {
    schedule: toTaskScheduleLike(updatedSchedule),
    taskIds: generatedTaskIds,
    seedCount: seeds.length,
  };
};

const loadScheduleByInstanceId = async (
  client: Prisma.TransactionClient,
  instanceId: string,
  organisationId?: string,
): Promise<TemplateInstanceWithSchedule> => {
  const instance = normalizeTemplateInstance(
    await client.templateInstance.findUnique({
      where: { id: instanceId.trim() },
      include: {
        template: {
          select: {
            id: true,
            kind: true,
            ownership: true,
          },
        },
        taskSchedule: true,
      },
    }),
  );

  if (organisationId && instance.organisationId !== organisationId) {
    throw new TaskWorkflowServiceError(
      "Template instance does not belong to organisation",
      403,
    );
  }

  if (!instance.taskSchedule) {
    throw new TaskWorkflowServiceError("Task schedule not found", 404);
  }

  return {
    ...instance,
    taskSchedule: instance.taskSchedule,
  };
};

export const TaskWorkflowService = {
  async listSchedulesForEncounter(
    organisationId: string,
    encounterId: string,
  ): Promise<TaskScheduleLike[]> {
    const trimmedOrganisationId = organisationId.trim();
    const trimmedEncounterId = encounterId.trim();

    if (!trimmedOrganisationId) {
      throw new TaskWorkflowServiceError("Invalid organisationId", 400);
    }

    if (!trimmedEncounterId) {
      throw new TaskWorkflowServiceError("Invalid encounterId", 400);
    }

    const schedules = await prisma.taskSchedule.findMany({
      where: {
        organisationId: trimmedOrganisationId,
        encounterId: trimmedEncounterId,
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });

    return schedules.map(toTaskScheduleLike);
  },

  async launchFromTemplateInstance(
    instanceId: string,
    organisationId?: string,
    submittedBy?: string,
    options?: LaunchTaskWorkflowOptions,
  ) {
    const client = options?.client ?? prisma;
    const instance = normalizeTemplateInstance(
      await client.templateInstance.findUnique({
        where: { id: instanceId.trim() },
        include: {
          template: {
            select: {
              id: true,
              kind: true,
              ownership: true,
            },
          },
          taskSchedule: true,
        },
      }),
    );

    if (organisationId && instance.organisationId !== organisationId) {
      throw new TaskWorkflowServiceError(
        "Template instance does not belong to organisation",
        403,
      );
    }

    return launchWorkflowInstance(
      client,
      instance,
      (submittedBy ?? instance.authorId ?? instance.signedBy ?? "").trim(),
      options,
    );
  },

  async pauseSchedule(
    instanceId: string,
    actorId: string,
    organisationId?: string,
  ) {
    const client = prisma;
    const instance = await loadScheduleByInstanceId(
      client,
      instanceId,
      organisationId,
    );

    const updated = await client.taskSchedule.update({
      where: { templateInstanceId: instance.id },
      data: {
        status: "PAUSED",
        activatedBy: actorId.trim(),
      },
    });

    return toTaskScheduleLike(updated);
  },

  async resumeSchedule(
    instanceId: string,
    actorId: string,
    organisationId?: string,
  ) {
    const client = prisma;
    const instance = await loadScheduleByInstanceId(
      client,
      instanceId,
      organisationId,
    );

    if (instance.taskSchedule.status !== "PAUSED") {
      throw new TaskWorkflowServiceError("Schedule is not paused", 400);
    }

    const updated = await client.taskSchedule.update({
      where: { templateInstanceId: instance.id },
      data: {
        status: "ACTIVE",
        activatedBy: actorId.trim(),
      },
    });

    return toTaskScheduleLike(updated);
  },

  async cancelSchedule(
    instanceId: string,
    actorId: string,
    organisationId?: string,
  ) {
    const client = prisma;
    const instance = await loadScheduleByInstanceId(
      client,
      instanceId,
      organisationId,
    );

    const generatedTaskIds = toTaskIdList(
      instance.taskSchedule.generatedTaskIds,
    );
    for (const taskId of generatedTaskIds) {
      await TaskService.changeStatus(taskId, "CANCELLED", actorId.trim());
    }

    const updated = await client.taskSchedule.update({
      where: { templateInstanceId: instance.id },
      data: {
        status: "CANCELLED",
        completedAt: new Date(),
        generatedTaskIds: generatedTaskIds as Prisma.InputJsonValue,
      },
    });

    return toTaskScheduleLike(updated);
  },

  async regenerateSchedule(
    instanceId: string,
    organisationId?: string,
    submittedBy?: string,
    options?: LaunchTaskWorkflowOptions,
  ) {
    const client = options?.client ?? prisma;
    const instance = await loadScheduleByInstanceId(
      client,
      instanceId,
      organisationId,
    );

    return launchWorkflowInstance(
      client,
      instance,
      (submittedBy ?? instance.authorId ?? instance.signedBy ?? "").trim(),
      {
        ...options,
        force: true,
      },
    );
  },
};
