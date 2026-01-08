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

  for (const field of tool.fields) {
    const answer = answers[field.key];
    if (!field.scoring) continue;

    if (
      field.scoring.map &&
      (typeof answer === "string" ||
        typeof answer === "number" ||
        typeof answer === "boolean")
    ) {
      const mapped = field.scoring.map[String(answer)];
      if (typeof mapped === "number") {
        total += mapped;
        usedScoring = true;
        continue;
      }
    }

    if (typeof field.scoring.points === "number") {
      if (
        answer === true ||
        (typeof answer === "string" && answer.trim() !== "") ||
        (typeof answer === "number" && !Number.isNaN(answer))
      ) {
        total += field.scoring.points;
        usedScoring = true;
      }
    }
  }

  return usedScoring ? total : undefined;
};

export const ObservationToolSubmissionService = {
  async createSubmission(
    input: CreateObservationToolSubmissionInput,
  ): Promise<ObservationToolSubmissionDocument> {
    const taskId = input.taskId
      ? assertObjectId(input.taskId, "taskId")
      : undefined;

    if (!input.toolId) {
      throw new ObservationToolSubmissionServiceError(
        "toolId is required",
        400,
      );
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
      // 1) prevent duplicate OT submission for same task
      const existing = await ObservationToolSubmissionModel.findOne({
        taskId,
      })
        .setOptions({ sanitizeFilter: true })
        .lean();

      if (existing) {
        throw new ObservationToolSubmissionServiceError(
          "Observation already submitted for this task",
          409,
        );
      }

      // 2) ensure task exists
      const task = await TaskModel.findById(taskId).lean();
      if (!task) {
        throw new ObservationToolSubmissionServiceError("Task not found", 404);
      }

      // 3) parent can only submit their own assigned tasks
      if (task.assignedTo !== input.filledBy) {
        throw new ObservationToolSubmissionServiceError(
          "Not allowed to submit this task",
          403,
        );
      }

      // 4) ensure submission matches task context
      if (task.companionId !== input.companionId) {
        throw new ObservationToolSubmissionServiceError(
          "companionId does not match task",
          400,
        );
      }

      // If you store observationToolId on task, enforce it:
      // (Your Task schema already has observationToolId.)
      if (task.observationToolId && task.observationToolId !== input.toolId) {
        throw new ObservationToolSubmissionServiceError(
          "toolId does not match task observationToolId",
          400,
        );
      }
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
    return doc;
  },

  async getById(id: string): Promise<ObservationToolSubmissionDocument | null> {
    const safeId = assertObjectId(id, "id");
    return ObservationToolSubmissionModel.findById(safeId).exec();
  },

  async listSubmissions(
    filter: ListSubmissionsFilter,
  ): Promise<ObservationToolSubmissionDocument[]> {
    const q: Record<string, unknown> = {};

    if (filter.companionId) q.companionId = filter.companionId;
    if (filter.toolId) q.toolId = filter.toolId;

    if (filter.fromDate || filter.toDate) {
      const createdAt: { $gte?: Date; $lte?: Date } = {};
      if (filter.fromDate) createdAt.$gte = filter.fromDate;
      if (filter.toDate) createdAt.$lte = filter.toDate;
      q.createdAt = createdAt;
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
    return ObservationToolSubmissionModel.find({
      evaluationAppointmentId: safeAppointmentId,
    })
      .setOptions({ sanitizeFilter: true })
      .sort({ createdAt: -1 })
      .exec();
  },

  async getByTaskId(taskId: string) {
    const safeTaskId = assertObjectId(taskId, "taskId");

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
