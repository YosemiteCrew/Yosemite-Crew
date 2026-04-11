import { Types } from "mongoose";
import TaskModel from "src/models/task";
import { TaskService } from "src/services/task.service";
import {
  ObservationToolDefinitionModel,
  ObservationToolSubmissionModel,
  ObservationToolSubmissionDocument,
  ObservationToolDefinitionDocument,
  ObservationToolAnswers,
} from "src/models/observationToolDefinition";
import { prisma } from "src/config/prisma";
import { handleDualWriteError, shouldDualWrite } from "src/utils/dual-write";
import { Prisma } from "@prisma/client";
import { isReadFromPostgres } from "src/config/read-switch";

export class ObservationToolSubmissionServiceError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "ObservationToolSubmissionServiceError";
  }
}

const SAFE_ID_FALLBACK = /^[A-Za-z0-9_-]+$/;

const asNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const isValidDate = (value: unknown): value is Date =>
  value instanceof Date && !Number.isNaN(value.getTime());

const assertObjectId = (value: unknown, field: string): string => {
  if (typeof value !== "string") {
    throw new ObservationToolSubmissionServiceError(
      `${field} must be a string`,
      400,
    );
  }

  const trimmed = value.trim();

  if (
    !trimmed ||
    trimmed.includes("$") ||
    trimmed.includes(".") ||
    (!Types.ObjectId.isValid(trimmed) && !SAFE_ID_FALLBACK.test(trimmed))
  ) {
    throw new ObservationToolSubmissionServiceError(`Invalid ${field}`, 400);
  }

  return trimmed;
};

export interface CreateObservationToolSubmissionInput {
  toolId: string;
  taskId?: string;

  companionId: string;
  filledBy: string;

  answers: ObservationToolAnswers;
  summary?: string;
}

export interface LinkSubmissionToAppointmentInput {
  submissionId: string;
  appointmentId: string;
  // Optional enforcement: block multiple submissions linked to same appointment
  enforceSingleSubmissionPerAppointment?: boolean;
}

export interface ListSubmissionsFilter {
  companionId?: string;
  toolId?: string;
  fromDate?: Date;
  toDate?: Date;
}

type AppointmentTaskPreview = {
  taskId: string;
  companionId?: string;
  status: string;
  dueAt: Date;
  toolId: string;
  toolName: string;
  toolCategory: string;
  submissionId?: string;
  submittedAt?: Date;
  score?: number;
  summary?: string;
  evaluationAppointmentId?: string;
};

const computeScore = (
  tool: ObservationToolDefinitionDocument,
  answers: ObservationToolAnswers,
): number | undefined => {
  let total = 0;
  let usedScoring = false;

  const getMappedScore = (
    scoring: ObservationToolDefinitionDocument["fields"][number]["scoring"],
    answer: unknown,
  ): number | undefined => {
    if (
      !scoring?.map ||
      !(
        typeof answer === "string" ||
        typeof answer === "number" ||
        typeof answer === "boolean"
      )
    ) {
      return undefined;
    }

    const mapped = scoring.map[String(answer)];
    return typeof mapped === "number" ? mapped : undefined;
  };

  const isScorableAnswer = (answer: unknown): boolean =>
    answer === true ||
    (typeof answer === "string" && answer.trim() !== "") ||
    (typeof answer === "number" && !Number.isNaN(answer));

  for (const field of tool.fields) {
    const answer = answers[field.key];
    if (!field.scoring) continue;

    const mappedScore = getMappedScore(field.scoring, answer);
    if (typeof mappedScore === "number") {
      total += mappedScore;
      usedScoring = true;
      continue;
    }

    if (typeof field.scoring.points === "number" && isScorableAnswer(answer)) {
      total += field.scoring.points;
      usedScoring = true;
    }
  }

  return usedScoring ? total : undefined;
};

const assertSubmissionInput = (
  input: CreateObservationToolSubmissionInput,
): void => {
  if (!input.toolId) {
    throw new ObservationToolSubmissionServiceError("toolId is required", 400);
  }
  if (!input.companionId) {
    throw new ObservationToolSubmissionServiceError(
      "companionId is required",
      400,
    );
  }
  if (!input.filledBy) {
    throw new ObservationToolSubmissionServiceError(
      "filledBy is required",
      400,
    );
  }
  if (!input.answers || typeof input.answers !== "object") {
    throw new ObservationToolSubmissionServiceError(
      "answers are required",
      400,
    );
  }
};

const assertTaskSubmission = async (
  taskId: string,
  input: CreateObservationToolSubmissionInput,
): Promise<void> => {
  const existing = await ObservationToolSubmissionModel.findOne({ taskId })
    .setOptions({ sanitizeFilter: true })
    .lean();

  if (existing) {
    throw new ObservationToolSubmissionServiceError(
      "Observation already submitted for this task",
      409,
    );
  }

  const task = await TaskModel.findById(taskId).lean();
  if (!task) {
    throw new ObservationToolSubmissionServiceError("Task not found", 404);
  }
  if (task.assignedTo !== input.filledBy) {
    throw new ObservationToolSubmissionServiceError(
      "Not allowed to submit this task",
      403,
    );
  }
  if (task.companionId !== input.companionId) {
    throw new ObservationToolSubmissionServiceError(
      "companionId does not match task",
      400,
    );
  }
  if (task.observationToolId && task.observationToolId !== input.toolId) {
    throw new ObservationToolSubmissionServiceError(
      "toolId does not match task observationToolId",
      400,
    );
  }
};

const applyStringFilter = (
  q: Record<string, unknown>,
  key: "companionId" | "toolId",
  value: unknown,
): void => {
  if (value === undefined) return;
  const normalized = asNonEmptyString(value);
  if (!normalized) {
    throw new ObservationToolSubmissionServiceError(`Invalid ${key}`, 400);
  }
  q[key] = normalized;
};

const applyDateRangeFilter = (
  q: Record<string, unknown>,
  fromDate?: Date,
  toDate?: Date,
): void => {
  if (!fromDate && !toDate) return;
  if (fromDate && !isValidDate(fromDate)) {
    throw new ObservationToolSubmissionServiceError("Invalid fromDate", 400);
  }
  if (toDate && !isValidDate(toDate)) {
    throw new ObservationToolSubmissionServiceError("Invalid toDate", 400);
  }
  const createdAt: { $gte?: Date; $lte?: Date } = {};
  if (fromDate) createdAt.$gte = fromDate;
  if (toDate) createdAt.$lte = toDate;
  q.createdAt = createdAt;
};

const toPrismaObservationToolSubmissionData = (
  doc: ObservationToolSubmissionDocument,
) => {
  const obj = doc.toObject() as {
    _id: { toString(): string };
    toolId: string;
    taskId?: string;
    companionId: string;
    filledBy: string;
    answers: unknown;
    score?: number;
    summary?: string;
    evaluationAppointmentId?: string;
    createdAt?: Date;
    updatedAt?: Date;
  };

  return {
    id: obj._id.toString(),
    toolId: obj.toolId,
    taskId: obj.taskId ?? undefined,
    companionId: obj.companionId,
    filledBy: obj.filledBy,
    answers: obj.answers as Prisma.InputJsonValue,
    score: obj.score ?? undefined,
    summary: obj.summary ?? undefined,
    evaluationAppointmentId: obj.evaluationAppointmentId ?? undefined,
    createdAt: obj.createdAt ?? undefined,
    updatedAt: obj.updatedAt ?? undefined,
  };
};

const syncObservationToolSubmissionToPostgres = async (
  doc: ObservationToolSubmissionDocument,
) => {
  if (!shouldDualWrite) return;
  try {
    const data = toPrismaObservationToolSubmissionData(doc);
    await prisma.observationToolSubmission.upsert({
      where: { id: data.id },
      create: data,
      update: data,
    });
  } catch (err) {
    handleDualWriteError("ObservationToolSubmission", err);
  }
};

export const ObservationToolSubmissionService = {
  async createSubmission(
    input: CreateObservationToolSubmissionInput,
  ): Promise<ObservationToolSubmissionDocument> {
    const taskId = input.taskId
      ? assertObjectId(input.taskId, "taskId")
      : undefined;

    assertSubmissionInput(input);

    if (isReadFromPostgres()) {
      const tool = await prisma.observationToolDefinition.findFirst({
        where: { id: input.toolId },
      });

      if (!tool || !tool.isActive) {
        throw new ObservationToolSubmissionServiceError(
          "Observation tool not found or inactive",
          404,
        );
      }

      if (taskId) {
        const existing = await prisma.observationToolSubmission.findFirst({
          where: { taskId },
        });

        if (existing) {
          throw new ObservationToolSubmissionServiceError(
            "Observation already submitted for this task",
            409,
          );
        }

        const task = await prisma.task.findFirst({
          where: { id: taskId },
        });

        if (!task) {
          throw new ObservationToolSubmissionServiceError(
            "Task not found",
            404,
          );
        }

        if (task.assignedTo !== input.filledBy) {
          throw new ObservationToolSubmissionServiceError(
            "Not allowed to submit this task",
            403,
          );
        }

        if (task.companionId !== input.companionId) {
          throw new ObservationToolSubmissionServiceError(
            "companionId does not match task",
            400,
          );
        }

        if (task.observationToolId && task.observationToolId !== input.toolId) {
          throw new ObservationToolSubmissionServiceError(
            "toolId does not match task observationToolId",
            400,
          );
        }
      }

      const toolForScore = {
        fields: (tool.fields ??
          []) as unknown as ObservationToolDefinitionDocument["fields"],
      } as ObservationToolDefinitionDocument;

      const score = computeScore(toolForScore, input.answers);

      const doc = await prisma.observationToolSubmission.create({
        data: {
          toolId: input.toolId,
          taskId,
          companionId: input.companionId,
          filledBy: input.filledBy,
          answers: input.answers as Prisma.InputJsonValue,
          score: score ?? undefined,
          summary: input.summary ?? undefined,
        },
      });

      // ✅ If this submission came from a task → complete the task
      if (taskId) {
        await TaskService.changeStatus(taskId, "COMPLETED", input.filledBy, {
          filledBy: input.filledBy,
          answers: input.answers,
          score,
          summary: input.summary,
        });
      }

      return doc as unknown as ObservationToolSubmissionDocument;
    }

    const tool = await ObservationToolDefinitionModel.findById(
      input.toolId,
    ).exec();

    if (!tool || !tool.isActive) {
      throw new ObservationToolSubmissionServiceError(
        "Observation tool not found or inactive",
        404,
      );
    }

    // ✅ Task-based validation & authorization
    if (taskId) {
      await assertTaskSubmission(taskId, input);
    }

    const score = computeScore(tool, input.answers);

    // ✅ Create OT submission
    const doc = await ObservationToolSubmissionModel.create({
      toolId: input.toolId,
      taskId,
      companionId: input.companionId,
      filledBy: input.filledBy,
      answers: input.answers,
      score,
      summary: input.summary,
    });

    await syncObservationToolSubmissionToPostgres(doc);

    // ✅ If this submission came from a task → complete the task
    if (taskId) {
      // Mark task completed + store completion payload in TaskCompletion
      await TaskService.changeStatus(taskId, "COMPLETED", input.filledBy, {
        filledBy: input.filledBy,
        answers: input.answers,
        score,
        summary: input.summary,
      });
    }

    return doc;
  },

  async linkToAppointment(
    input: LinkSubmissionToAppointmentInput,
  ): Promise<ObservationToolSubmissionDocument> {
    const submissionId = assertObjectId(input.submissionId, "submissionId");
    const appointmentId = assertObjectId(input.appointmentId, "appointmentId");

    if (isReadFromPostgres()) {
      const doc = await prisma.observationToolSubmission.findFirst({
        where: { id: submissionId },
      });

      if (!doc) {
        throw new ObservationToolSubmissionServiceError(
          "Submission not found",
          404,
        );
      }

      if (input.enforceSingleSubmissionPerAppointment) {
        const alreadyLinked = await prisma.observationToolSubmission.findFirst({
          where: { evaluationAppointmentId: appointmentId },
        });

        if (alreadyLinked) {
          throw new ObservationToolSubmissionServiceError(
            "An observation submission is already linked to this appointment",
            409,
          );
        }
      }

      const updated = await prisma.observationToolSubmission.update({
        where: { id: submissionId },
        data: { evaluationAppointmentId: appointmentId },
      });

      return updated as unknown as ObservationToolSubmissionDocument;
    }

    const doc =
      await ObservationToolSubmissionModel.findById(submissionId).exec();

    if (!doc) {
      throw new ObservationToolSubmissionServiceError(
        "Submission not found",
        404,
      );
    }

    // ✅ Optional enforcement: only 1 submission linked to an appointment
    if (input.enforceSingleSubmissionPerAppointment) {
      const alreadyLinked = await ObservationToolSubmissionModel.findOne({
        evaluationAppointmentId: appointmentId,
      })
        .setOptions({ sanitizeFilter: true })
        .lean();

      if (alreadyLinked) {
        throw new ObservationToolSubmissionServiceError(
          "An observation submission is already linked to this appointment",
          409,
        );
      }
    }

    doc.evaluationAppointmentId = appointmentId;
    await doc.save();
    await syncObservationToolSubmissionToPostgres(doc);
    return doc;
  },

  async getById(id: string): Promise<ObservationToolSubmissionDocument | null> {
    const safeId = assertObjectId(id, "id");
    if (isReadFromPostgres()) {
      const doc = await prisma.observationToolSubmission.findFirst({
        where: { id: safeId },
      });
      return (doc ??
        null) as unknown as ObservationToolSubmissionDocument | null;
    }

    return ObservationToolSubmissionModel.findById(safeId).exec();
  },

  async listSubmissions(
    filter: ListSubmissionsFilter,
  ): Promise<ObservationToolSubmissionDocument[]> {
    const q: Record<string, unknown> = {};

    applyStringFilter(q, "companionId", filter.companionId);
    applyStringFilter(q, "toolId", filter.toolId);
    applyDateRangeFilter(q, filter.fromDate, filter.toDate);

    if (isReadFromPostgres()) {
      const where: Prisma.ObservationToolSubmissionWhereInput = {};

      if (filter.companionId) where.companionId = filter.companionId;
      if (filter.toolId) where.toolId = filter.toolId;
      if (filter.fromDate || filter.toDate) {
        where.createdAt = {};
        if (filter.fromDate) where.createdAt.gte = filter.fromDate;
        if (filter.toDate) where.createdAt.lte = filter.toDate;
      }

      const docs = await prisma.observationToolSubmission.findMany({
        where,
        orderBy: { createdAt: "desc" },
      });
      return docs as unknown as ObservationToolSubmissionDocument[];
    }

    return ObservationToolSubmissionModel.find(q)
      .setOptions({ sanitizeFilter: true })
      .sort({ createdAt: -1 })
      .exec();
  },

  async listForAppointment(
    appointmentId: string,
  ): Promise<ObservationToolSubmissionDocument[]> {
    const safeAppointmentId = assertObjectId(appointmentId, "appointmentId");
    if (isReadFromPostgres()) {
      const docs = await prisma.observationToolSubmission.findMany({
        where: { evaluationAppointmentId: safeAppointmentId },
        orderBy: { createdAt: "desc" },
      });
      return docs as unknown as ObservationToolSubmissionDocument[];
    }
    return ObservationToolSubmissionModel.find({
      evaluationAppointmentId: safeAppointmentId,
    })
      .setOptions({ sanitizeFilter: true })
      .sort({ createdAt: -1 })
      .exec();
  },

  async getByTaskId(taskId: string) {
    const safeTaskId = assertObjectId(taskId, "taskId");

    if (isReadFromPostgres()) {
      const doc = await prisma.observationToolSubmission.findFirst({
        where: { taskId: safeTaskId },
      });
      return (doc ??
        null) as unknown as ObservationToolSubmissionDocument | null;
    }

    return ObservationToolSubmissionModel.findOne({ taskId: safeTaskId })
      .setOptions({ sanitizeFilter: true })
      .exec();
  },

  /**
   * Used by Task cards (TaskView) — return definition + submission for a task.
   */
  async getPreviewByTaskId(taskId: string): Promise<{
    taskId: string;
    toolId: string;
    toolName: string;
    toolCategory: string;
    submissionId?: string;
    submittedAt?: Date;
    score?: number;
    summary?: string;
    answersPreview?: Record<string, unknown>;
  }> {
    const safeTaskId = assertObjectId(taskId, "taskId");
    if (isReadFromPostgres()) {
      const task = await prisma.task.findFirst({
        where: { id: safeTaskId },
      });
      if (!task) {
        throw new ObservationToolSubmissionServiceError("Task not found", 404);
      }

      if (!task.observationToolId) {
        throw new ObservationToolSubmissionServiceError(
          "Task has no observationToolId",
          400,
        );
      }

      const tool = await prisma.observationToolDefinition.findFirst({
        where: { id: task.observationToolId },
      });

      if (!tool || !tool.isActive) {
        throw new ObservationToolSubmissionServiceError(
          "Observation tool not found or inactive",
          404,
        );
      }

      const submission = await prisma.observationToolSubmission.findFirst({
        where: { taskId: safeTaskId },
        orderBy: { createdAt: "desc" },
      });

      const submissionAnswers = submission?.answers as
        | ObservationToolAnswers
        | undefined;

      const toolFields =
        tool.fields as unknown as ObservationToolDefinitionDocument["fields"];

      const answersPreview =
        submissionAnswers && toolFields.length
          ? Object.fromEntries(
              toolFields
                .slice(0, 5)
                .map<[string, unknown]>((f) => [
                  f.key,
                  submissionAnswers[f.key],
                ])
                .filter(([, v]) => v !== undefined),
            )
          : undefined;

      return {
        taskId,
        toolId: tool.id,
        toolName: tool.name,
        toolCategory: tool.category,
        submissionId: submission?.id ?? undefined,
        submittedAt: submission?.createdAt,
        score: submission?.score ?? undefined,
        summary: submission?.summary ?? undefined,
        answersPreview,
      };
    }

    const task = await TaskModel.findById(safeTaskId).lean();
    if (!task) {
      throw new ObservationToolSubmissionServiceError("Task not found", 404);
    }

    if (!task.observationToolId) {
      throw new ObservationToolSubmissionServiceError(
        "Task has no observationToolId",
        400,
      );
    }

    const tool = await ObservationToolDefinitionModel.findById(
      task.observationToolId,
    ).lean();

    if (!tool || !tool.isActive) {
      throw new ObservationToolSubmissionServiceError(
        "Observation tool not found or inactive",
        404,
      );
    }

    const submission = await ObservationToolSubmissionModel.findOne({
      taskId: safeTaskId,
    })
      .sort({ createdAt: -1 })
      .setOptions({ sanitizeFilter: true })
      .lean();

    // small preview: only include answers for first N fields (frontend can expand later)
    const submissionAnswers = submission?.answers as
      | ObservationToolAnswers
      | undefined;

    const answersPreview =
      submissionAnswers && tool.fields.length
        ? Object.fromEntries(
            tool.fields
              .slice(0, 5)
              .map<[string, unknown]>((f) => [f.key, submissionAnswers[f.key]])
              .filter(([, v]) => v !== undefined),
          )
        : undefined;

    return {
      taskId,
      toolId: tool._id.toString(),
      toolName: tool.name,
      toolCategory: tool.category,
      submissionId: submission?._id?.toString(),
      submittedAt: submission?.createdAt,
      score: submission?.score,
      summary: submission?.summary,
      answersPreview,
    };
  },

  /**
   * Used by AppointmentView — give OT cards for all OT tasks in an appointment.
   * This is the “backend hook” frontend is asking for.
   */
  async listTaskPreviewsForAppointment(
    appointmentId: string,
  ): Promise<AppointmentTaskPreview[]> {
    const safeAppointmentId = assertObjectId(appointmentId, "appointmentId");

    if (isReadFromPostgres()) {
      const tasks = await prisma.task.findMany({
        where: {
          appointmentId: safeAppointmentId,
          observationToolId: { not: null },
        },
        select: {
          id: true,
          companionId: true,
          status: true,
          dueAt: true,
          observationToolId: true,
        },
      });

      if (!tasks.length) return [];

      const taskIds = tasks.map((t) => t.id);
      const toolIds = Array.from(
        new Set(tasks.map((t) => String(t.observationToolId))),
      );

      const [tools, submissions] = await Promise.all([
        prisma.observationToolDefinition.findMany({
          where: { id: { in: toolIds } },
          select: { id: true, name: true, category: true, isActive: true },
        }),
        prisma.observationToolSubmission.findMany({
          where: { taskId: { in: taskIds } },
          select: {
            id: true,
            taskId: true,
            toolId: true,
            score: true,
            summary: true,
            createdAt: true,
            evaluationAppointmentId: true,
          },
        }),
      ]);

      const toolById = new Map(tools.map((t) => [t.id, t]));
      const submissionByTaskId = new Map(
        submissions.map((s) => [String(s.taskId), s]),
      );

      return tasks.flatMap<AppointmentTaskPreview>((t) => {
        const tool = toolById.get(String(t.observationToolId));
        if (!tool) return [];
        const submission = submissionByTaskId.get(t.id);

        return [
          {
            taskId: t.id,
            companionId: t.companionId ?? undefined,
            status: String(t.status),
            dueAt: t.dueAt,
            toolId: tool.id,
            toolName: tool.name,
            toolCategory: tool.category,
            submissionId: submission?.id ?? undefined,
            submittedAt: submission?.createdAt,
            score: submission?.score ?? undefined,
            summary: submission?.summary ?? undefined,
            evaluationAppointmentId:
              submission?.evaluationAppointmentId ?? undefined,
          },
        ];
      });
    }

    // find OT tasks under the appointment
    const tasks = await TaskModel.find({
      appointmentId: safeAppointmentId,
      observationToolId: { $exists: true, $ne: null },
    })
      .setOptions({ sanitizeFilter: true })
      .select("_id companionId status dueAt observationToolId")
      .lean();

    if (!tasks.length) return [];

    const taskIds = tasks.map((t) => t._id.toString());
    const toolIds = Array.from(
      new Set(tasks.map((t) => String(t.observationToolId))),
    );

    const [tools, submissions] = await Promise.all([
      ObservationToolDefinitionModel.find({ _id: { $in: toolIds } })
        .select("_id name category isActive")
        .lean(),
      ObservationToolSubmissionModel.find({ taskId: { $in: taskIds } })
        .select("_id taskId toolId score summary createdAt")
        .lean(),
    ]);

    const toolById = new Map(tools.map((t) => [t._id.toString(), t]));
    const submissionByTaskId = new Map(
      submissions.map((s) => [String(s.taskId), s]),
    );

    return tasks.flatMap<AppointmentTaskPreview>((t) => {
      const tool = toolById.get(String(t.observationToolId));
      if (!tool) return [];
      const submission = submissionByTaskId.get(t._id.toString());

      return [
        {
          taskId: t._id.toString(),
          companionId: t.companionId ? String(t.companionId) : undefined,
          status: String(t.status),
          dueAt: t.dueAt,
          toolId: tool._id.toString(),
          toolName: tool.name,
          toolCategory: tool.category,
          submissionId: submission?._id?.toString(),
          submittedAt: submission?.createdAt,
          score: submission?.score,
          summary: submission?.summary,
          evaluationAppointmentId: submission?.evaluationAppointmentId,
        },
      ];
    });
  },
};
