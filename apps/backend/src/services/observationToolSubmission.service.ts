import {
  ObservationToolDefinitionModel,
  ObservationToolSubmissionModel,
  ObservationToolSubmissionDocument,
  ObservationToolDefinitionDocument,
  ObservationToolAnswers,
} from "src/models/observationToolDefinition";

export class ObservationToolSubmissionServiceError extends Error {
  constructor(message: string, public statusCode = 400) {
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

  // Per-field scoring
  for (const field of tool.fields) {
    const answer = answers[field.key];

    if (!field.scoring) continue;

    // map-based scoring (e.g. CHOICE)
    if (field.scoring.map && answer != null) {
      const mapped = field.scoring.map[String(answer)];
      if (typeof mapped === "number") {
        total += mapped;
        usedScoring = true;
        continue;
      }
    }

    // points-based scoring (e.g. boolean / yes-no)
    if (typeof field.scoring.points === "number") {
      // very simple heuristic: add points if truthy / non-empty
      if (
        answer === true ||
        (typeof answer === "string" && answer.trim() !== "") ||
        (typeof answer === "number" && !isNaN(answer))
      ) {
        total += field.scoring.points;
        usedScoring = true;
      }
    }
  }

  if (!usedScoring) {
    return undefined;
  }

  return total;
};

export const ObservationToolSubmissionService = {
  async createSubmission(
    input: CreateObservationToolSubmissionInput,
  ): Promise<ObservationToolSubmissionDocument> {
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

    const tool = await ObservationToolDefinitionModel.findById(
      input.toolId,
    ).exec();
    if (!tool || !tool.isActive) {
      throw new ObservationToolSubmissionServiceError(
        "Observation tool not found or inactive",
        404,
      );
    }

    const score = computeScore(tool, input.answers);

    const doc = await ObservationToolSubmissionModel.create({
      toolId: input.toolId,
      taskId: input.taskId,
      companionId: input.companionId,
      filledBy: input.filledBy,
      answers: input.answers,
      score,
      summary: input.summary,
    });

    return doc;
  },

  async linkToAppointment(
    input: LinkSubmissionToAppointmentInput,
  ): Promise<ObservationToolSubmissionDocument> {
    const doc = await ObservationToolSubmissionModel.findById(
      input.submissionId,
    ).exec();
    if (!doc) {
      throw new ObservationToolSubmissionServiceError(
        "Submission not found",
        404,
      );
    }

    doc.evaluationAppointmentId = input.appointmentId;
    await doc.save();
    return doc;
  },

  async getById(
    id: string,
  ): Promise<ObservationToolSubmissionDocument | null> {
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
