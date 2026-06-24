import {
  Prisma,
  TaskAudience as PrismaTaskAudience,
  TaskSource as PrismaTaskSource,
  TaskKind as PrismaTaskKind,
  TaskStatus as PrismaTaskStatus,
} from "@prisma/client";
import { isTaskCategory } from "@yosemite-crew/types";
import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { TaskWorkflowSeed } from "./task-workflow-materializer";
import { sendEmailTemplate } from "../utils/email";
import logger from "../utils/logger";

export class TaskServiceError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "TaskServiceError";
  }
}

export type TaskAudience = "EMPLOYEE_TASK" | "PARENT_TASK";
export type TaskSource = "YC_LIBRARY" | "ORG_TEMPLATE" | "CUSTOM";
export type TaskStatus = PrismaTaskStatus;

export type MedicationDoseInput = {
  time?: string;
  dosage?: string;
  instructions?: string;
};

export type MedicationInput = {
  name?: string;
  type?: string;
  notes?: string;
  frequency?: string;
  doses?: MedicationDoseInput[];
};

const SUPPORT_EMAIL_ADDRESS =
  process.env.SUPPORT_EMAIL ??
  process.env.SUPPORT_EMAIL_ADDRESS ??
  process.env.HELP_EMAIL ??
  "support@yosemitecrew.com";
const DEFAULT_PMS_URL =
  process.env.PMS_BASE_URL ??
  process.env.FRONTEND_BASE_URL ??
  process.env.APP_URL ??
  "https://app.yosemitecrew.com";

const TASK_STATUSES = new Set<TaskStatus>([
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);

type TaskRow = Prisma.TaskGetPayload<Record<string, never>>;
type TaskCompletionRow = Prisma.TaskCompletionGetPayload<Record<string, never>>;

type TaskLike = TaskRow & { _id: string };
type TaskCompletionLike = TaskCompletionRow & { _id: string };
type TaskListWhereResult = Prisma.TaskWhereInput[] | Prisma.TaskWhereInput;

const toTaskLike = (row: TaskRow): TaskLike => ({
  ...row,
  _id: row.id,
});

const toTaskCompletionLike = (row: TaskCompletionRow): TaskCompletionLike => ({
  ...row,
  _id: row.id,
});

const asNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const isValidDate = (value: unknown): value is Date =>
  value instanceof Date && !Number.isNaN(value.getTime());

const toNullableJsonInput = (
  value: unknown,
): Prisma.InputJsonValue | Prisma.NullTypes.DbNull | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.DbNull;
  return value as Prisma.InputJsonValue;
};

const sanitizeStatusList = (value: unknown): TaskStatus[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const filtered = value.filter(
    (status): status is TaskStatus =>
      typeof status === "string" && TASK_STATUSES.has(status as TaskStatus),
  );
  return filtered.length ? filtered : undefined;
};

const sanitizeTaskCategory = (value: unknown): string | undefined =>
  typeof value === "string" && isTaskCategory(value) ? value : undefined;

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter((item) => item.length > 0)
    : [];

const intersectStringLists = (
  left: string[] | undefined,
  right: string[] | undefined,
) => {
  if (!left) return right;
  if (!right) return left;
  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value));
};

const buildDisplayName = (
  user?: { firstName?: string | null; lastName?: string | null } | null,
) => {
  if (!user) return undefined;
  const parts = [user.firstName, user.lastName].filter(Boolean);
  return parts.length ? parts.join(" ") : undefined;
};

type TaskAssignmentEmailTask = {
  audience: TaskAudience;
  assignedTo?: string | null;
  assignedGroupId?: string | null;
  assignedBy?: string | null;
  createdBy: string;
  patientId?: string | null;
  dueAt: Date;
  name: string;
  additionalNotes?: string | null;
};

const sendTaskAssignmentEmail = async (task: TaskAssignmentEmailTask) => {
  if (task.audience !== "EMPLOYEE_TASK") return;
  if (task.assignedGroupId) return;
  if (!task.assignedTo) return;
  logger.info("Sending task assigned email");
  try {
    const [assignee, assigner, companion] = await Promise.all([
      prisma.user.findFirst({
        where: { userId: task.assignedTo },
        select: { email: true, firstName: true, lastName: true },
      }),
      prisma.user.findFirst({
        where: { userId: task.assignedBy ?? task.createdBy },
        select: { firstName: true, lastName: true },
      }),
      task.patientId
        ? prisma.patient.findFirst({
            where: { id: task.patientId },
            select: { name: true },
          })
        : Promise.resolve(null),
    ]);

    if (!assignee?.email) return;

    const dueTime = task.dueAt.toUTCString();

    await sendEmailTemplate({
      to: assignee.email,
      templateId: "taskAssigned",
      templateData: {
        employeeName: buildDisplayName(assignee),
        taskName: task.name,
        companionName: companion?.name ?? undefined,
        dueTime,
        assignedByName: buildDisplayName(assigner),
        additionalNotes: task.additionalNotes ?? undefined,
        ctaUrl: DEFAULT_PMS_URL,
        ctaLabel: "Open PMS",
        supportEmail: SUPPORT_EMAIL_ADDRESS,
      },
    });
  } catch (error) {
    logger.error("Failed to send task assignment email.", error);
  }
};

const recordTaskAudit = async (params: {
  organisationId?: string | null;
  patientId?: string | null;
  eventType: "TASK_CREATED" | "TASK_REASSIGNED" | "TASK_STATUS_CHANGED";
  actorId?: string | null;
  entityId: string;
  metadata?: Record<string, unknown>;
}) => {
  if (!params.organisationId || !params.patientId) {
    return;
  }

  await AuditTrailService.recordSafely({
    organisationId: params.organisationId,
    patientId: params.patientId,
    actorType: params.actorId ? "PMS_USER" : "SYSTEM",
    actorId: params.actorId ?? undefined,
    eventType: params.eventType,
    entityType: "TASK",
    entityId: params.entityId,
    metadata: params.metadata,
  });
};

const recordTaskCreatedAudit = async (task: TaskLike) =>
  recordTaskAudit({
    organisationId: task.organisationId,
    patientId: task.patientId,
    actorId: task.createdBy,
    eventType: "TASK_CREATED",
    entityId: task.id,
    metadata: {
      source: task.source,
      audience: task.audience,
      assignedTo: task.assignedTo,
      assignedGroupId: task.assignedGroupId ?? null,
      status: task.status,
    },
  });

const assertCanUpdateTask = (isCreator: boolean, isAssignee: boolean) => {
  if (!isCreator && !isAssignee) {
    throw new TaskServiceError("Not allowed to update this task", 403);
  }
};

const resolveNextTaskStatus = (params: {
  currentStatus: TaskStatus;
  requestedStatus: TaskStatus;
  completedAt: Date | null;
  completedBy: string | null;
  actorId: string;
}) => {
  let nextStatus: PrismaTaskStatus;
  let completedAt = params.completedAt;
  let completedBy = params.completedBy;

  if (
    params.requestedStatus === "IN_PROGRESS" &&
    params.currentStatus === "PENDING"
  ) {
    nextStatus = "IN_PROGRESS";
  } else if (params.requestedStatus === "COMPLETED") {
    nextStatus = "COMPLETED";
    completedAt = new Date();
    completedBy = params.actorId;
  } else if (params.requestedStatus === "CANCELLED") {
    nextStatus = "CANCELLED";
  } else if (params.requestedStatus === "PENDING") {
    nextStatus = "PENDING";
  } else {
    nextStatus = params.requestedStatus;
  }

  return { nextStatus, completedAt, completedBy };
};

const createTaskCompletionIfNeeded = async (params: {
  task: TaskRow;
  newStatus: TaskStatus;
  completion?: CompleteTaskInput;
  actorId: string;
}) => {
  const completion = params.completion;
  const completionAnswers = completion?.answers;
  if (params.newStatus !== "COMPLETED" || !completionAnswers) {
    return undefined;
  }

  if (!params.task.patientId) {
    throw new TaskServiceError("Companion is required for completion.", 400);
  }

  const created = await prisma.taskCompletion.create({
    data: {
      taskId: params.task.id,
      patientId: params.task.patientId,
      filledBy: completion.filledBy ?? params.actorId,
      answers: completionAnswers as unknown as Prisma.InputJsonValue,
      score: completion.score ?? undefined,
      summary: completion.summary ?? undefined,
    },
  });

  return toTaskCompletionLike(created);
};

const normalizeDoseTime = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  if (!/^\d{2}:\d{2}$/.test(t)) return undefined;
  return t;
};

const sanitizeMedication = (input?: MedicationInput | null) => {
  if (!input) return undefined;

  const doses =
    Array.isArray(input.doses) && input.doses.length
      ? input.doses
          .map((d) => ({
            time: normalizeDoseTime(d.time),
            dosage: typeof d.dosage === "string" ? d.dosage.trim() : undefined,
            instructions:
              typeof d.instructions === "string"
                ? d.instructions.trim()
                : undefined,
          }))
          .filter((d) => d.time || d.dosage || d.instructions)
      : undefined;

  const name = typeof input.name === "string" ? input.name.trim() : undefined;
  const type = typeof input.type === "string" ? input.type.trim() : undefined;
  const notes =
    typeof input.notes === "string" ? input.notes.trim() : undefined;
  const frequency =
    typeof input.frequency === "string" ? input.frequency.trim() : undefined;

  if (
    !name &&
    !type &&
    !notes &&
    !frequency &&
    (!doses || doses.length === 0)
  ) {
    return undefined;
  }

  return {
    name,
    type,
    notes,
    frequency,
    doses: doses?.length ? doses : undefined,
  };
};

const assertCompanionRequirement = (input: {
  audience: TaskAudience;
  patientId?: string;
  medication?: MedicationInput;
  observationToolId?: string;
}) => {
  const requiresCompanion =
    input.audience === "PARENT_TASK" ||
    !!input.observationToolId ||
    !!sanitizeMedication(input.medication);

  if (requiresCompanion && !input.patientId) {
    throw new TaskServiceError(
      "patientId is required for parent, medication, or observation tool tasks",
      400,
    );
  }
};

const buildRecurrence = (input?: {
  type: "ONCE" | "DAILY" | "WEEKLY" | "CUSTOM";
  endDate?: Date;
  cronExpression?: string;
}) => {
  if (!input) return undefined;

  if (input.type === "ONCE") {
    return {
      type: "ONCE",
      isMaster: false,
      masterTaskId: undefined,
      cronExpression: undefined,
      endDate: undefined,
    };
  }

  return {
    type: input.type,
    isMaster: true,
    masterTaskId: undefined,
    cronExpression: input.cronExpression,
    endDate: input.endDate,
  };
};

const mergeRecurrence = (
  existing: unknown,
  input?: {
    type: "ONCE" | "DAILY" | "WEEKLY" | "CUSTOM";
    endDate?: Date | null;
    cronExpression?: string | null;
  } | null,
) => {
  if (input === undefined) return undefined;
  if (input === null) return Prisma.DbNull;

  const existingRecurrence =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};

  if (input.type === "ONCE") {
    return {
      type: "ONCE",
      isMaster: false,
      masterTaskId:
        typeof existingRecurrence.masterTaskId === "string"
          ? existingRecurrence.masterTaskId
          : undefined,
      cronExpression: undefined,
      endDate: undefined,
    };
  }

  return {
    type: input.type,
    isMaster:
      typeof existingRecurrence.isMaster === "boolean"
        ? existingRecurrence.isMaster
        : true,
    masterTaskId:
      typeof existingRecurrence.masterTaskId === "string"
        ? existingRecurrence.masterTaskId
        : undefined,
    cronExpression:
      input.cronExpression === undefined
        ? (existingRecurrence.cronExpression as string | undefined)
        : (input.cronExpression ?? undefined),
    endDate:
      input.endDate === undefined
        ? (existingRecurrence.endDate as Date | undefined)
        : (input.endDate ?? undefined),
  };
};

const buildReminder = (
  input?: { enabled: boolean; offsetMinutes: number } | null,
) =>
  input
    ? {
        enabled: input.enabled,
        offsetMinutes: input.offsetMinutes,
        scheduledNotificationId: undefined,
      }
    : undefined;

const buildCreateTaskData = (input: {
  organisationId?: string;
  appointmentId?: string;
  patientId?: string;
  createdBy: string;
  assignedBy?: string;
  assignedTo: string;
  assignedGroupId?: string | null;
  audience: TaskAudience;
  source: TaskSource;
  libraryTaskId?: string;
  templateId?: string;
  category: string;
  subcategory?: string;
  name: string;
  description?: string;
  additionalNotes?: string;
  medication?: MedicationInput;
  observationToolId?: string;
  dueAt: Date;
  timezone?: string;
  recurrence?: {
    type: "ONCE" | "DAILY" | "WEEKLY" | "CUSTOM";
    endDate?: Date;
    cronExpression?: string;
  };
  reminder?: {
    enabled: boolean;
    offsetMinutes: number;
  } | null;
  syncWithCalendar?: boolean;
  attachments?: {
    id: string;
    name: string;
  }[];
}) => ({
  organisationId: input.organisationId ?? undefined,
  appointmentId: input.appointmentId ?? undefined,
  patientId: input.patientId ?? undefined,
  createdBy: input.createdBy,
  assignedBy: input.assignedBy ?? input.createdBy,
  assignedTo: input.assignedTo,
  assignedGroupId: input.assignedGroupId ?? undefined,
  audience: input.audience as PrismaTaskAudience,
  source: input.source as PrismaTaskSource,
  libraryTaskId: input.libraryTaskId ?? undefined,
  templateId: input.templateId ?? undefined,
  category: input.category,
  subcategory: input.subcategory ?? undefined,
  name: input.name,
  description: input.description ?? undefined,
  additionalNotes: input.additionalNotes ?? undefined,
  medication: toNullableJsonInput(sanitizeMedication(input.medication)),
  observationToolId: input.observationToolId ?? undefined,
  dueAt: input.dueAt,
  timezone: input.timezone ?? undefined,
  recurrence: toNullableJsonInput(buildRecurrence(input.recurrence)),
  reminder: toNullableJsonInput(buildReminder(input.reminder)),
  syncWithCalendar: input.syncWithCalendar ?? false,
  calendarEventId: undefined,
  attachments: toNullableJsonInput(input.attachments ?? []),
  status: "PENDING" as PrismaTaskStatus,
});

type TaskWriteClient = Pick<Prisma.TransactionClient, "task">;

const createTaskRow = async (
  client: TaskWriteClient,
  input: Parameters<typeof buildCreateTaskData>[0],
) => {
  const doc = await client.task.create({
    data: buildCreateTaskData(input),
  });

  return toTaskLike(doc);
};

const updateTaskRow = async (
  taskId: string,
  updates: {
    name?: string;
    description?: string;
    additionalNotes?: string;
    subcategory?: string;
    dueAt?: Date;
    timezone?: string | null;
    assignedTo?: string;
    assignedGroupId?: string | null;
    assignedBy?: string;
    medication?: MedicationInput | null;
    observationToolId?: string | null;
    reminder?: {
      enabled: boolean;
      offsetMinutes: number;
    } | null;
    syncWithCalendar?: boolean;
    attachments?: {
      id: string;
      name: string;
    }[];
    recurrence?: {
      type: "ONCE" | "DAILY" | "WEEKLY" | "CUSTOM";
      endDate?: Date | null;
      cronExpression?: string | null;
    } | null;
  },
  task: TaskRow & {
    recurrence: Prisma.JsonValue | null;
  },
) =>
  prisma.task.update({
    where: { id: taskId },
    data: {
      name: updates.name ?? task.name,
      description:
        updates.description === undefined
          ? (task.description ?? undefined)
          : (updates.description ?? undefined),
      additionalNotes:
        updates.additionalNotes === undefined
          ? (task.additionalNotes ?? undefined)
          : (updates.additionalNotes ?? undefined),
      subcategory:
        updates.subcategory === undefined
          ? (task.subcategory ?? undefined)
          : (updates.subcategory ?? undefined),
      dueAt: updates.dueAt ?? task.dueAt,
      timezone:
        updates.timezone === undefined
          ? (task.timezone ?? undefined)
          : (updates.timezone ?? undefined),
      assignedTo: updates.assignedTo ?? task.assignedTo,
      assignedGroupId:
        updates.assignedGroupId === undefined
          ? (task.assignedGroupId ?? undefined)
          : (updates.assignedGroupId ?? undefined),
      assignedBy:
        updates.assignedBy === undefined
          ? (task.assignedBy ?? undefined)
          : (updates.assignedBy ?? undefined),
      medication:
        updates.medication === undefined
          ? (task.medication ?? undefined)
          : toNullableJsonInput(sanitizeMedication(updates.medication)),
      observationToolId:
        updates.observationToolId === undefined
          ? (task.observationToolId ?? undefined)
          : (updates.observationToolId ?? undefined),
      reminder:
        updates.reminder === undefined
          ? (task.reminder ?? undefined)
          : toNullableJsonInput(buildReminder(updates.reminder)),
      syncWithCalendar:
        updates.syncWithCalendar ?? task.syncWithCalendar ?? undefined,
      attachments:
        updates.attachments === undefined
          ? (task.attachments ?? undefined)
          : toNullableJsonInput(updates.attachments),
      recurrence: mergeRecurrence(task.recurrence, updates.recurrence),
    },
  });

const resolveAppointmentTaskIds = async (params: {
  organisationId?: string;
  appointmentId?: string;
  encounterId?: string;
  episodeOfCareId?: string;
  admissionId?: string;
}): Promise<string[] | undefined> => {
  const appointmentFilters = [
    params.appointmentId,
    params.encounterId,
    params.episodeOfCareId,
    params.admissionId,
  ].some(Boolean);

  if (!appointmentFilters) {
    return undefined;
  }

  let appointmentIds: string[] | undefined = params.appointmentId
    ? [params.appointmentId]
    : undefined;

  if (params.encounterId) {
    const encounterAppointments = await prisma.appointment.findMany({
      where: {
        ...(params.organisationId
          ? { organisationId: params.organisationId }
          : {}),
        encounterId: params.encounterId,
      },
      select: { id: true },
    });
    appointmentIds = intersectStringLists(
      appointmentIds,
      encounterAppointments.map((appointment) => appointment.id),
    );
  }

  if (params.episodeOfCareId) {
    const episodeAppointments = await prisma.appointment.findMany({
      where: {
        ...(params.organisationId
          ? { organisationId: params.organisationId }
          : {}),
        caseId: params.episodeOfCareId,
      },
      select: { id: true },
    });
    appointmentIds = intersectStringLists(
      appointmentIds,
      episodeAppointments.map((appointment) => appointment.id),
    );
  }

  if (params.admissionId) {
    const admissionAppointments = await prisma.appointment.findMany({
      where: {
        ...(params.organisationId
          ? { organisationId: params.organisationId }
          : {}),
        encounterId: params.admissionId,
      },
      select: { id: true },
    });
    appointmentIds = intersectStringLists(
      appointmentIds,
      admissionAppointments.map((appointment) => appointment.id),
    );
  }

  return appointmentIds;
};

const resolveScheduleTaskIds = async (params: {
  organisationId?: string;
  templateInstanceId?: string;
  scheduleId?: string;
}): Promise<string[] | undefined> => {
  const scheduleFilters = [params.templateInstanceId, params.scheduleId].some(
    Boolean,
  );

  if (!scheduleFilters) {
    return undefined;
  }

  const schedules = await prisma.taskSchedule.findMany({
    where: {
      ...(params.organisationId
        ? { organisationId: params.organisationId }
        : {}),
      ...(params.templateInstanceId
        ? { templateInstanceId: params.templateInstanceId }
        : {}),
      ...(params.scheduleId ? { id: params.scheduleId } : {}),
    },
    select: { generatedTaskIds: true },
  });

  if (!schedules.length) {
    return [];
  }

  let taskIds: string[] | undefined;
  for (const schedule of schedules) {
    taskIds = intersectStringLists(
      taskIds,
      asStringArray(schedule.generatedTaskIds),
    );
  }

  return taskIds ?? [];
};

const buildTaskIdWhereForIds = (
  field: "id" | "appointmentId" | "templateId" | "libraryTaskId",
  ids: string[] | undefined,
) => {
  if (!ids) {
    return undefined;
  }

  if (!ids.length) {
    return { id: { in: [] } };
  }

  return { [field]: { in: ids } } as Prisma.TaskWhereInput;
};

const resolveTaskKindSourceWhere = (kind?: PrismaTaskKind) => {
  if (!kind) {
    return undefined;
  }

  if (kind === "CUSTOM") {
    return { source: "CUSTOM" } as Prisma.TaskWhereInput;
  }

  return undefined;
};

const resolveTaskKindDefinitionIds = async (params: {
  organisationId?: string;
  kind?: PrismaTaskKind;
}): Promise<{ templateIds: string[]; libraryIds: string[] } | undefined> => {
  if (!params.kind || params.kind === "CUSTOM") {
    return undefined;
  }

  const [templateIds, libraryIds] = await Promise.all([
    params.organisationId
      ? prisma.taskTemplate
          .findMany({
            where: {
              organisationId: params.organisationId,
              kind: params.kind,
            },
            select: { id: true },
          })
          .then((rows) => rows.map((row) => row.id))
      : Promise.resolve([] as string[]),
    prisma.taskLibraryDefinition
      .findMany({
        where: { kind: params.kind },
        select: { id: true },
      })
      .then((rows) => rows.map((row) => row.id)),
  ]);

  return { templateIds, libraryIds };
};

const resolveTaskKindWhere = async (params: {
  organisationId?: string;
  kind?: PrismaTaskKind;
}): Promise<Prisma.TaskWhereInput | undefined> => {
  const sourceWhere = resolveTaskKindSourceWhere(params.kind);
  if (sourceWhere) {
    return sourceWhere;
  }

  const ids = await resolveTaskKindDefinitionIds(params);
  if (!ids) {
    return undefined;
  }

  const templateWhere = buildTaskIdWhereForIds("templateId", ids.templateIds);
  const libraryWhere = buildTaskIdWhereForIds("libraryTaskId", ids.libraryIds);

  if (templateWhere && isEmptyTaskIdFilter(templateWhere)) {
    return templateWhere;
  }

  if (libraryWhere && isEmptyTaskIdFilter(libraryWhere)) {
    return libraryWhere;
  }

  const conditions = [templateWhere, libraryWhere].filter(
    (value): value is Prisma.TaskWhereInput => Boolean(value),
  );

  if (!conditions.length) {
    return { id: { in: [] } };
  }

  if (conditions.length === 1) {
    return conditions[0];
  }

  return { OR: conditions };
};

const buildTaskListWhere = async (params: {
  organisationId?: string;
  audience?: TaskAudience;
  assignedTo?: string;
  patientId?: string;
  companionId?: string;
  clientId?: string;
  appointmentId?: string;
  encounterId?: string;
  episodeOfCareId?: string;
  admissionId?: string;
  templateInstanceId?: string;
  scheduleId?: string;
  status?: TaskStatus[];
  category?: string;
  subcategory?: string;
  kind?: PrismaTaskKind;
  dueFrom?: Date;
  dueTo?: Date;
  includeCompleted?: boolean;
}): Promise<Prisma.TaskWhereInput> => {
  const organisationId = asNonEmptyString(params.organisationId);
  const patientWhere = buildPatientWhere(params);
  const patientFilter = resolveTaskListPatientWhere(patientWhere);
  if (patientFilter) return patientFilter;

  const baseWhere = buildTaskListBaseWhere(
    params,
    organisationId,
    patientWhere,
  );
  const conditions = await buildTaskListConditions(params, organisationId);
  return resolveTaskListConditionsWhere(baseWhere, conditions);
};

const resolveTaskListPatientWhere = (
  patientWhere: Prisma.TaskWhereInput | null,
) => {
  if (!patientWhere) {
    return null;
  }

  return isEmptyTaskIdFilter(patientWhere) ? patientWhere : null;
};

const resolveTaskListConditionsWhere = (
  baseWhere: Prisma.TaskWhereInput,
  conditions: TaskListWhereResult,
) => {
  if (!Array.isArray(conditions)) {
    return conditions;
  }

  return composeTaskListWhere(baseWhere, conditions);
};

const buildTaskListBaseWhere = (
  params: {
    audience?: TaskAudience;
    assignedTo?: string;
    category?: string;
    subcategory?: string;
    status?: TaskStatus[];
    dueFrom?: Date;
    dueTo?: Date;
    includeCompleted?: boolean;
    patientId?: string;
    companionId?: string;
    clientId?: string;
  },
  organisationId?: string,
  patientWhere?: Prisma.TaskWhereInput | null,
) => {
  const baseWhere: Prisma.TaskWhereInput = {};

  if (organisationId) {
    baseWhere.organisationId = organisationId;
  }

  if (params.audience) {
    baseWhere.audience = params.audience;
  }

  const assignedTo = asNonEmptyString(params.assignedTo);
  if (assignedTo) {
    baseWhere.assignedTo = assignedTo;
  }

  if (patientWhere) {
    Object.assign(baseWhere, patientWhere);
  }

  Object.assign(baseWhere, buildTaskScalarFilters(params));

  return baseWhere;
};

const buildTaskListConditions = async (
  params: {
    appointmentId?: string;
    encounterId?: string;
    episodeOfCareId?: string;
    admissionId?: string;
    templateInstanceId?: string;
    scheduleId?: string;
    kind?: PrismaTaskKind;
  },
  organisationId?: string,
): Promise<TaskListWhereResult> => {
  const conditions: Prisma.TaskWhereInput[] = [];

  const appointmentIds = await resolveAppointmentTaskIds({
    organisationId,
    appointmentId: params.appointmentId,
    encounterId: params.encounterId,
    episodeOfCareId: params.episodeOfCareId,
    admissionId: params.admissionId,
  });
  const appointmentWhere = buildTaskIdWhereForIds(
    "appointmentId",
    appointmentIds,
  );
  if (appointmentWhere && isEmptyTaskIdFilter(appointmentWhere)) {
    return appointmentWhere;
  }
  if (appointmentWhere) {
    conditions.push(appointmentWhere);
  }

  const scheduleTaskIds = await resolveScheduleTaskIds({
    organisationId,
    templateInstanceId: params.templateInstanceId,
    scheduleId: params.scheduleId,
  });
  const scheduleWhere = buildTaskIdWhereForIds("id", scheduleTaskIds);
  if (scheduleWhere && isEmptyTaskIdFilter(scheduleWhere)) {
    return scheduleWhere;
  }
  if (scheduleWhere) {
    conditions.push(scheduleWhere);
  }

  const kindWhere = await resolveTaskKindWhere({
    organisationId,
    kind: params.kind,
  });
  if (kindWhere) {
    if (isEmptyTaskIdFilter(kindWhere)) {
      return kindWhere;
    }
    conditions.push(kindWhere);
  }

  return conditions;
};

const composeTaskListWhere = (
  baseWhere: Prisma.TaskWhereInput,
  conditions: Prisma.TaskWhereInput[],
) => {
  const baseKeys = Object.keys(baseWhere);
  if (!baseKeys.length && !conditions.length) {
    return {};
  }

  if (!conditions.length) {
    return baseWhere;
  }

  const rootConditions: Prisma.TaskWhereInput[] = [];
  if (baseKeys.length) {
    rootConditions.push(baseWhere);
  }
  rootConditions.push(...conditions);

  if (rootConditions.length === 1) {
    return rootConditions[0];
  }

  return { AND: rootConditions };
};

const isEmptyTaskIdFilter = (value: Prisma.TaskWhereInput) => {
  const id = value.id;
  return (
    typeof id === "object" &&
    id !== null &&
    !Array.isArray(id) &&
    "in" in id &&
    Array.isArray((id as { in?: unknown[] }).in) &&
    (id as { in: unknown[] }).in.length === 0
  );
};

const buildPatientWhere = (params: {
  patientId?: string;
  companionId?: string;
  clientId?: string;
}): Prisma.TaskWhereInput | null => {
  const patientIds = [
    asNonEmptyString(params.patientId),
    asNonEmptyString(params.companionId),
    asNonEmptyString(params.clientId),
  ].filter((value): value is string => Boolean(value));

  if (!patientIds.length) {
    return null;
  }

  const uniquePatientIds = [...new Set(patientIds)];
  if (uniquePatientIds.length > 1) {
    return { id: { in: [] } };
  }

  return { patientId: uniquePatientIds[0] };
};

const buildTaskScalarFilters = (params: {
  category?: string;
  subcategory?: string;
  status?: TaskStatus[];
  includeCompleted?: boolean;
  dueFrom?: Date;
  dueTo?: Date;
}) => {
  const baseWhere: Prisma.TaskWhereInput = {};

  const category = sanitizeTaskCategory(params.category);
  if (category) {
    baseWhere.category = category;
  }

  const subcategory = asNonEmptyString(params.subcategory);
  if (subcategory) {
    baseWhere.subcategory = subcategory;
  }

  const status = sanitizeStatusList(params.status);
  if (status) {
    baseWhere.status = { in: status };
  } else if (!params.includeCompleted) {
    baseWhere.status = { not: "COMPLETED" };
  }

  const fromDueAt = isValidDate(params.dueFrom) ? params.dueFrom : undefined;
  const toDueAt = isValidDate(params.dueTo) ? params.dueTo : undefined;
  if (fromDueAt || toDueAt) {
    baseWhere.dueAt = {};
    if (fromDueAt) baseWhere.dueAt.gte = fromDueAt;
    if (toDueAt) baseWhere.dueAt.lte = toDueAt;
  }

  return baseWhere;
};

export interface BaseTaskCreateInput {
  organisationId?: string;
  appointmentId?: string;
  patientId?: string;
  createdBy: string;
  assignedBy?: string;
  assignedTo: string;
  assignedGroupId?: string | null;
  dueAt: Date;
  timezone?: string;
  medication?: MedicationInput;
  observationToolId?: string;
  recurrence?: {
    type: "ONCE" | "DAILY" | "WEEKLY" | "CUSTOM";
    endDate?: Date;
    cronExpression?: string;
  };
  reminder?: {
    enabled: boolean;
    offsetMinutes: number;
  };
  syncWithCalendar?: boolean;
  attachments?: {
    id: string;
    name: string;
  }[];
}

export interface CreateFromLibraryInput extends BaseTaskCreateInput {
  audience: TaskAudience;
  libraryTaskId: string;
  categoryOverride?: string;
  subcategoryOverride?: string;
  nameOverride?: string;
  descriptionOverride?: string;
}

export interface CreateFromTemplateInput extends BaseTaskCreateInput {
  templateId: string;
  categoryOverride?: string;
  subcategoryOverride?: string;
  nameOverride?: string;
  descriptionOverride?: string;
  audienceOverride?: TaskAudience;
}

export interface CreateCustomTaskInput extends BaseTaskCreateInput {
  audience: TaskAudience;
  category: string;
  subcategory?: string;
  name: string;
  description?: string;
  additionalNotes?: string;
}

export interface TaskUpdateInput {
  name?: string;
  description?: string;
  additionalNotes?: string;
  subcategory?: string;
  dueAt?: Date;
  timezone?: string | null;
  assignedTo?: string;
  assignedGroupId?: string | null;
  medication?: MedicationInput | null;
  observationToolId?: string | null;
  reminder?: {
    enabled: boolean;
    offsetMinutes: number;
  } | null;
  syncWithCalendar?: boolean;
  attachments?: {
    id: string;
    name: string;
  }[];
  recurrence?: {
    type: "ONCE" | "DAILY" | "WEEKLY" | "CUSTOM";
    endDate?: Date | null;
    cronExpression?: string | null;
  } | null;
}

export interface CompleteTaskInput {
  filledBy: string;
  answers?: Record<string, unknown>;
  score?: number;
  summary?: string;
}

export const TaskService = {
  async createFromLibrary(input: CreateFromLibraryInput): Promise<TaskLike> {
    const library = await prisma.taskLibraryDefinition.findFirst({
      where: { id: input.libraryTaskId, isActive: true },
    });

    if (!library) {
      throw new TaskServiceError("Library task not found or inactive", 404);
    }

    assertCompanionRequirement({
      audience: input.audience,
      patientId: input.patientId,
      medication: input.medication,
      observationToolId: input.observationToolId,
    });

    const doc = await prisma.task.create({
      data: buildCreateTaskData({
        organisationId: input.organisationId,
        appointmentId: input.appointmentId,
        patientId: input.patientId,
        createdBy: input.createdBy,
        assignedBy: input.assignedBy,
        assignedTo: input.assignedTo,
        assignedGroupId: input.assignedGroupId,
        audience: input.audience,
        source: "YC_LIBRARY",
        libraryTaskId: input.libraryTaskId,
        category: input.categoryOverride ?? library.category,
        subcategory: input.subcategoryOverride,
        name: input.nameOverride ?? library.name,
        description:
          input.descriptionOverride ?? library.defaultDescription ?? undefined,
        medication: input.medication,
        observationToolId: input.observationToolId ?? undefined,
        dueAt: input.dueAt,
        timezone: input.timezone,
        recurrence: input.recurrence,
        reminder: input.reminder,
        syncWithCalendar: input.syncWithCalendar,
        attachments: input.attachments,
      }),
    });

    const mapped = toTaskLike(doc);
    await recordTaskCreatedAudit(mapped);
    void sendTaskAssignmentEmail(mapped);
    return mapped;
  },

  async createFromTemplate(input: CreateFromTemplateInput): Promise<TaskLike> {
    const template = await prisma.taskTemplate.findFirst({
      where: { id: input.templateId, isActive: true },
    });

    if (!template) {
      throw new TaskServiceError("Task template not found or inactive", 404);
    }

    if (template.organisationId !== input.organisationId) {
      throw new TaskServiceError(
        "Template does not belong to organisation",
        400,
      );
    }

    const audience: TaskAudience =
      input.audienceOverride ??
      (template.defaultRole === "PARENT" ? "PARENT_TASK" : "EMPLOYEE_TASK");

    const templateMedication = (template.defaultMedication ?? undefined) as
      | MedicationInput
      | undefined;

    assertCompanionRequirement({
      audience,
      patientId: input.patientId,
      medication: input.medication ?? templateMedication,
      observationToolId:
        input.observationToolId ??
        template.defaultObservationToolId ??
        undefined,
    });

    const recurrence =
      input.recurrence ??
      (template.defaultRecurrence
        ? {
            type: (
              template.defaultRecurrence as {
                type: "ONCE" | "DAILY" | "WEEKLY" | "CUSTOM";
              }
            ).type,
            endDate:
              (template.defaultRecurrence as { defaultEndOffsetDays?: number })
                .defaultEndOffsetDays == null
                ? undefined
                : new Date(
                    input.dueAt.getTime() +
                      ((
                        template.defaultRecurrence as {
                          defaultEndOffsetDays?: number;
                        }
                      ).defaultEndOffsetDays ?? 0) *
                        24 *
                        60 *
                        60 *
                        1000,
                  ),
            cronExpression: (
              template.defaultRecurrence as { customCron?: string }
            ).customCron,
          }
        : undefined);

    const reminder =
      input.reminder ??
      (template.defaultReminderOffsetMinutes == null
        ? undefined
        : {
            enabled: true,
            offsetMinutes: template.defaultReminderOffsetMinutes,
          });

    const doc = await prisma.task.create({
      data: buildCreateTaskData({
        organisationId: input.organisationId,
        appointmentId: input.appointmentId,
        patientId: input.patientId,
        createdBy: input.createdBy,
        assignedBy: input.assignedBy,
        assignedTo: input.assignedTo,
        assignedGroupId: input.assignedGroupId,
        audience,
        source: "ORG_TEMPLATE",
        libraryTaskId: template.libraryTaskId ?? undefined,
        templateId: template.id,
        category: input.categoryOverride ?? template.category,
        subcategory: input.subcategoryOverride,
        name: input.nameOverride ?? template.name,
        description:
          input.descriptionOverride ?? template.description ?? undefined,
        medication: input.medication ?? templateMedication,
        observationToolId:
          input.observationToolId ??
          template.defaultObservationToolId ??
          undefined,
        dueAt: input.dueAt,
        timezone: input.timezone,
        recurrence,
        reminder,
        syncWithCalendar: input.syncWithCalendar,
        attachments: input.attachments,
      }),
    });

    const mapped = toTaskLike(doc);
    await recordTaskCreatedAudit(mapped);
    void sendTaskAssignmentEmail(mapped);
    return mapped;
  },

  async createCustom(input: CreateCustomTaskInput): Promise<TaskLike> {
    if (!input.category || !input.name) {
      throw new TaskServiceError("category and name are required", 400);
    }

    assertCompanionRequirement({
      audience: input.audience,
      patientId: input.patientId,
      medication: input.medication,
      observationToolId: input.observationToolId,
    });

    const doc = await prisma.task.create({
      data: buildCreateTaskData({
        organisationId: input.organisationId,
        appointmentId: input.appointmentId,
        patientId: input.patientId,
        createdBy: input.createdBy,
        assignedBy: input.assignedBy,
        assignedTo: input.assignedTo,
        assignedGroupId: input.assignedGroupId,
        audience: input.audience,
        source: "CUSTOM",
        category: input.category,
        subcategory: input.subcategory,
        name: input.name,
        description: input.description,
        additionalNotes: input.additionalNotes,
        medication: input.medication,
        observationToolId: input.observationToolId,
        dueAt: input.dueAt,
        timezone: input.timezone,
        recurrence: input.recurrence,
        reminder: input.reminder,
        syncWithCalendar: input.syncWithCalendar,
        attachments: input.attachments,
      }),
    });

    const mapped = toTaskLike(doc);
    await recordTaskCreatedAudit(mapped);
    void sendTaskAssignmentEmail(mapped);
    return mapped;
  },

  async createFromWorkflowSeed(
    input: TaskWorkflowSeed,
    options?: { client?: TaskWriteClient; notify?: boolean },
  ): Promise<TaskLike> {
    assertCompanionRequirement({
      audience: input.audience,
      patientId: input.patientId,
      medication: input.medication,
      observationToolId: input.observationToolId,
    });

    const mapped = await createTaskRow(options?.client ?? prisma, {
      organisationId: input.organisationId,
      appointmentId: input.appointmentId,
      patientId: input.patientId,
      createdBy: input.createdBy,
      assignedBy: input.assignedBy,
      assignedTo: input.assignedTo,
      audience: input.audience,
      source: input.source,
      libraryTaskId: input.libraryTaskId,
      templateId: input.templateId,
      category: input.category,
      name: input.name,
      description: input.description,
      additionalNotes: input.additionalNotes,
      medication: input.medication,
      observationToolId: input.observationToolId,
      dueAt: input.dueAt,
      timezone: input.timezone,
      recurrence: input.recurrence
        ? {
            type: input.recurrence.type,
            endDate: input.recurrence.endDate,
            cronExpression: input.recurrence.cronExpression,
          }
        : undefined,
      reminder: input.reminder,
      syncWithCalendar: input.syncWithCalendar,
      attachments: input.attachments,
    });

    if (options?.notify !== false) {
      void sendTaskAssignmentEmail(mapped);
    }

    await recordTaskCreatedAudit(mapped);

    return mapped;
  },

  async updateTask(
    taskId: string,
    updates: TaskUpdateInput,
    actorId: string,
  ): Promise<TaskLike> {
    const task = await prisma.task.findFirst({ where: { id: taskId } });
    if (!task) throw new TaskServiceError("Task not found", 404);

    const isCreator = task.createdBy === actorId;
    const isAssignee = task.assignedTo === actorId;
    assertCanUpdateTask(isCreator, isAssignee);

    if (updates.assignedTo !== undefined) {
      if (!isCreator) {
        throw new TaskServiceError("Only task creator can reassign task", 403);
      }
    }

    if (updates.assignedGroupId !== undefined && !isCreator) {
      throw new TaskServiceError("Only task creator can reassign task", 403);
    }

    const updated = await updateTaskRow(
      taskId,
      {
        name: updates.name,
        description: updates.description,
        additionalNotes: updates.additionalNotes,
        dueAt: updates.dueAt,
        timezone: updates.timezone,
        assignedTo: updates.assignedTo,
        assignedGroupId: updates.assignedGroupId,
        assignedBy:
          updates.assignedTo !== undefined ||
          updates.assignedGroupId !== undefined
            ? actorId
            : undefined,
        medication: updates.medication,
        observationToolId: updates.observationToolId,
        reminder: updates.reminder,
        syncWithCalendar: updates.syncWithCalendar,
        attachments: updates.attachments,
        recurrence: updates.recurrence,
      },
      task,
    );

    const mapped = toTaskLike(updated);

    if (
      updates.assignedTo !== undefined ||
      updates.assignedGroupId !== undefined
    ) {
      await recordTaskAudit({
        organisationId: mapped.organisationId,
        patientId: mapped.patientId,
        actorId,
        eventType: "TASK_REASSIGNED",
        entityId: mapped.id,
        metadata: {
          previousAssignedTo: task.assignedTo,
          previousAssignedGroupId: task.assignedGroupId ?? null,
          assignedTo: mapped.assignedTo,
          assignedGroupId: mapped.assignedGroupId ?? null,
          assignedBy: mapped.assignedBy ?? null,
        },
      });
    }

    return mapped;
  },

  async changeStatus(
    taskId: string,
    newStatus: TaskStatus,
    actorId: string,
    completion?: CompleteTaskInput,
  ): Promise<{ task: TaskLike; completion?: TaskCompletionLike }> {
    const task = await prisma.task.findFirst({ where: { id: taskId } });
    if (!task) throw new TaskServiceError("Task not found", 404);

    if (task.assignedTo !== actorId && task.createdBy !== actorId) {
      throw new TaskServiceError("Not allowed to update this task", 403);
    }

    if (task.status === "CANCELLED" || task.status === "COMPLETED") {
      throw new TaskServiceError("Task already finished", 400);
    }

    const { nextStatus, completedAt, completedBy } = resolveNextTaskStatus({
      currentStatus: task.status,
      requestedStatus: newStatus,
      completedAt: task.completedAt ?? null,
      completedBy: task.completedBy ?? null,
      actorId,
    });

    const completionDoc = await createTaskCompletionIfNeeded({
      task,
      newStatus,
      completion,
      actorId,
    });

    const updated = await prisma.task.update({
      where: { id: task.id },
      data: {
        status: nextStatus,
        completedAt,
        completedBy,
      },
    });

    const mapped = {
      task: toTaskLike(updated),
      completion: completionDoc,
    };

    await recordTaskAudit({
      organisationId: updated.organisationId,
      patientId: updated.patientId,
      actorId,
      eventType: "TASK_STATUS_CHANGED",
      entityId: updated.id,
      metadata: {
        previousStatus: task.status,
        nextStatus,
        completedBy,
      },
    });

    return mapped;
  },

  async getById(taskId: string): Promise<TaskLike | null> {
    const task = await prisma.task.findFirst({
      where: { id: taskId },
    });
    return task ? toTaskLike(task) : null;
  },

  async listForParent(params: {
    parentId: string;
    patientId?: string;
    fromDueAt?: Date;
    toDueAt?: Date;
    status?: TaskStatus[];
  }): Promise<TaskLike[]> {
    const parentId = asNonEmptyString(params.parentId);
    if (!parentId) {
      throw new TaskServiceError("Invalid parentId");
    }

    const where: Prisma.TaskWhereInput = {
      audience: "PARENT_TASK",
      OR: [{ assignedTo: parentId }, { createdBy: parentId }],
    };

    const patientId = asNonEmptyString(params.patientId);
    if (patientId) where.patientId = patientId;

    const status = sanitizeStatusList(params.status);
    if (status) where.status = { in: status };

    const fromDueAt = isValidDate(params.fromDueAt)
      ? params.fromDueAt
      : undefined;
    const toDueAt = isValidDate(params.toDueAt) ? params.toDueAt : undefined;
    if (fromDueAt || toDueAt) {
      where.dueAt = {};
      if (fromDueAt) where.dueAt.gte = fromDueAt;
      if (toDueAt) where.dueAt.lte = toDueAt;
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: { dueAt: "asc" },
    });
    return tasks.map(toTaskLike);
  },

  async listForEmployee(params: {
    organisationId: string;
    userId?: string;
    patientId?: string;
    companionId?: string;
    clientId?: string;
    appointmentId?: string;
    encounterId?: string;
    episodeOfCareId?: string;
    admissionId?: string;
    templateInstanceId?: string;
    scheduleId?: string;
    audience?: TaskAudience;
    assignedTo?: string;
    assignedRole?: TaskAudience;
    status?: TaskStatus[];
    category?: string;
    subcategory?: string;
    kind?: PrismaTaskKind;
    dueFrom?: Date;
    dueTo?: Date;
    includeCompleted?: boolean;
  }): Promise<TaskLike[]> {
    const organisationId = asNonEmptyString(params.organisationId);
    if (!organisationId) {
      throw new TaskServiceError("Invalid organisationId");
    }

    const where = await buildTaskListWhere({
      organisationId,
      audience: params.audience ?? params.assignedRole ?? "EMPLOYEE_TASK",
      assignedTo: params.assignedTo ?? params.userId,
      patientId: params.patientId,
      companionId: params.companionId,
      clientId: params.clientId,
      appointmentId: params.appointmentId,
      encounterId: params.encounterId,
      episodeOfCareId: params.episodeOfCareId,
      admissionId: params.admissionId,
      templateInstanceId: params.templateInstanceId,
      scheduleId: params.scheduleId,
      status: params.status,
      category: params.category,
      subcategory: params.subcategory,
      kind: params.kind,
      dueFrom: params.dueFrom,
      dueTo: params.dueTo,
      includeCompleted: params.includeCompleted,
    });

    const tasks = await prisma.task.findMany({
      where,
      orderBy: { dueAt: "asc" },
    });
    return tasks.map(toTaskLike);
  },

  async listForGroup(params: {
    organisationId: string;
    groupId: string;
    patientId?: string;
    fromDueAt?: Date;
    toDueAt?: Date;
    status?: TaskStatus[];
  }): Promise<TaskLike[]> {
    const organisationId = asNonEmptyString(params.organisationId);
    if (!organisationId) {
      throw new TaskServiceError("Invalid organisationId");
    }

    const groupId = asNonEmptyString(params.groupId);
    if (!groupId) {
      throw new TaskServiceError("Invalid groupId");
    }

    const where: Prisma.TaskWhereInput = {
      organisationId,
      assignedGroupId: groupId,
    };

    const patientId = asNonEmptyString(params.patientId);
    if (patientId) where.patientId = patientId;

    const status = sanitizeStatusList(params.status);
    if (status) where.status = { in: status };

    const fromDueAt = isValidDate(params.fromDueAt)
      ? params.fromDueAt
      : undefined;
    const toDueAt = isValidDate(params.toDueAt) ? params.toDueAt : undefined;
    if (fromDueAt || toDueAt) {
      where.dueAt = {};
      if (fromDueAt) where.dueAt.gte = fromDueAt;
      if (toDueAt) where.dueAt.lte = toDueAt;
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: { dueAt: "asc" },
    });
    return tasks.map(toTaskLike);
  },

  async listForCompanion(params: {
    patientId: string;
    organisationId?: string;
    audience?: TaskAudience;
    companionId?: string;
    clientId?: string;
    assignedTo?: string;
    assignedRole?: TaskAudience;
    appointmentId?: string;
    encounterId?: string;
    episodeOfCareId?: string;
    admissionId?: string;
    templateInstanceId?: string;
    scheduleId?: string;
    status?: TaskStatus[];
    category?: string;
    subcategory?: string;
    kind?: PrismaTaskKind;
    dueFrom?: Date;
    dueTo?: Date;
    includeCompleted?: boolean;
  }): Promise<TaskLike[]> {
    const patientId = asNonEmptyString(params.patientId);
    if (!patientId) {
      throw new TaskServiceError("Invalid patientId");
    }

    const organisationId = asNonEmptyString(params.organisationId);
    const where = await buildTaskListWhere({
      organisationId,
      patientId,
      companionId: params.companionId,
      clientId: params.clientId,
      audience: params.audience ?? params.assignedRole,
      assignedTo: params.assignedTo,
      appointmentId: params.appointmentId,
      encounterId: params.encounterId,
      episodeOfCareId: params.episodeOfCareId,
      admissionId: params.admissionId,
      templateInstanceId: params.templateInstanceId,
      scheduleId: params.scheduleId,
      status: params.status,
      category: params.category,
      subcategory: params.subcategory,
      kind: params.kind,
      dueFrom: params.dueFrom,
      dueTo: params.dueTo,
      includeCompleted: params.includeCompleted,
    });

    const tasks = await prisma.task.findMany({
      where,
      orderBy: { dueAt: "asc" },
    });
    return tasks.map(toTaskLike);
  },

  async linkToAppointment(input: {
    taskId: string;
    appointmentId: string;
    enforceSingleTaskPerAppointment?: boolean;
  }): Promise<TaskLike> {
    const task = await prisma.task.findFirst({
      where: { id: input.taskId },
    });
    if (!task) {
      throw new TaskServiceError("Task not found", 404);
    }

    const updated = await prisma.task.update({
      where: { id: input.taskId },
      data: { appointmentId: input.appointmentId },
    });

    return toTaskLike(updated);
  },
};
