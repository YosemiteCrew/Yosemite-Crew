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
      throw new ObservationToolSubmissionServiceError("answers are required", 400);
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
    if (input.taskId) {
      // 1) prevent duplicate OT submission for same task
      const existing = await ObservationToolSubmissionModel.findOne({
        taskId: input.taskId,
      }).lean();

      if (existing) {
        throw new ObservationToolSubmissionServiceError(
          "Observation already submitted for this task",
          409,
        );
      }

      // 2) ensure task exists
      const task = await TaskModel.findById(input.taskId).lean();
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
      taskId: input.taskId,
      companionId: input.companionId,
      filledBy: input.filledBy,
      answers: input.answers,
      score,
      summary: input.summary,
    });

    // ✅ If this submission came from a task → complete the task
    if (input.taskId) {
      // Mark task completed + store completion payload in TaskCompletion
      await TaskService.changeStatus(
        input.taskId,
        "COMPLETED",
        input.filledBy,
        {
          filledBy: input.filledBy,
          answers: input.answers,
          score,
          summary: input.summary,
        },
      );
    }

    return doc;
  },

  async linkToAppointment(
    input: LinkSubmissionToAppointmentInput,
  ): Promise<ObservationToolSubmissionDocument> {
    const doc = await ObservationToolSubmissionModel.findById(
      input.submissionId,
    ).exec();

    if (!doc) {
      throw new ObservationToolSubmissionServiceError("Submission not found", 404);
    }

    // ✅ Optional enforcement: only 1 submission linked to an appointment
    if (input.enforceSingleSubmissionPerAppointment) {
      const alreadyLinked = await ObservationToolSubmissionModel.findOne({
        evaluationAppointmentId: input.appointmentId,
      }).lean();

      if (alreadyLinked) {
        throw new ObservationToolSubmissionServiceError(
          "An observation submission is already linked to this appointment",
          409,
        );
      }
    }

    doc.evaluationAppointmentId = input.appointmentId;
    await doc.save();
    return doc;
  },

  async getById(id: string): Promise<ObservationToolSubmissionDocument | null> {
    return ObservationToolSubmissionModel.findById(id).exec();
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
      .sort({ createdAt: -1 })
      .exec();
  },

  async listForAppointment(
    appointmentId: string,
  ): Promise<ObservationToolSubmissionDocument[]> {
    return ObservationToolSubmissionModel.find({
      evaluationAppointmentId: appointmentId,
    })
      .sort({ createdAt: -1 })
      .exec();
  },
};