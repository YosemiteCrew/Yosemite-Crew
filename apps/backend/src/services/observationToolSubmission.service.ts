import { TaskService } from "src/services/task.service";
import {
  ObservationToolSubmissionDocument,
  ObservationToolDefinitionDocument,
  ObservationToolAnswers,
} from "src/models/observationToolDefinition";
import { prisma } from "src/config/prisma";
import { Prisma } from "@prisma/client";

export class ObservationToolSubmissionServiceError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "ObservationToolSubmissionServiceError";
  }
}

const asNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const assertObjectId = (value: unknown, field: string): string => {
  if (typeof value !== "string") {
    throw new ObservationToolSubmissionServiceError(
      `${field} must be a string`,
      400,
    );
  }

  const trimmed = value.trim();

  if (!trimmed) {
    throw new ObservationToolSubmissionServiceError(`Invalid ${field}`, 400);
  }

  return trimmed;
};

export interface CreateObservationToolSubmissionInput {
  toolId: string;
  taskId?: string;

  patientId: string;
  filledBy: string;

  answers: ObservationToolAnswers;
  summary?: string;
}

export interface CreateAppointmentSubmissionInput extends CreateObservationToolSubmissionInput {
  appointmentId: string;
  organisationId: string;
}

export interface LinkSubmissionToAppointmentInput {
  organisationId?: string;
  submissionId: string;
  appointmentId: string;
  // Optional enforcement: block multiple submissions linked to same appointment
  enforceSingleSubmissionPerAppointment?: boolean;
}

export interface ListSubmissionsFilter {
  organisationId?: string;
  patientId?: string;
  toolId?: string;
  fromDate?: Date;
  toDate?: Date;
}

type AppointmentTaskPreview = {
  taskId: string;
  patientId?: string;
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
  if (!input.patientId) {
    throw new ObservationToolSubmissionServiceError(
      "patientId is required",
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

const ensureCompanionInOrganisation = async (
  patientId: string,
  organisationId: string,
): Promise<void> => {
  const link = await prisma.patientOrganisation.findFirst({
    where: {
      patientId: patientId,
      organisationId,
      status: "ACTIVE",
    },
    select: { id: true },
  });

  if (!link) {
    throw new ObservationToolSubmissionServiceError("Forbidden", 403);
  }
};

const ensureAppointmentInOrganisation = async (
  appointmentId: string,
  organisationId: string,
): Promise<void> => {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, organisationId },
    select: { id: true },
  });

  if (!appointment) {
    throw new ObservationToolSubmissionServiceError("Forbidden", 403);
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

    const tool = await prisma.observationToolDefinition.findFirst({
      where: { id: input.toolId },
    });

    if (!tool?.isActive) {
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
        throw new ObservationToolSubmissionServiceError("Task not found", 404);
      }

      if (task.assignedTo !== input.filledBy) {
        throw new ObservationToolSubmissionServiceError(
          "Not allowed to submit this task",
          403,
        );
      }

      if (task.patientId !== input.patientId) {
        throw new ObservationToolSubmissionServiceError(
          "patientId does not match task",
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
        patientId: input.patientId,
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
  },

  /**
   * PMS — clinician records an observation-tool submission directly against an
   * appointment. The score is computed from the tool definition (never trusted
   * from the client) and the submission is linked to the appointment via
   * evaluationAppointmentId so it surfaces in the appointment workspace.
   */
  async createForAppointment(
    input: CreateAppointmentSubmissionInput,
  ): Promise<ObservationToolSubmissionDocument> {
    assertSubmissionInput(input);

    const appointmentId = assertObjectId(input.appointmentId, "appointmentId");
    const organisationId = assertObjectId(
      input.organisationId,
      "organisationId",
    );
    const taskId = input.taskId
      ? assertObjectId(input.taskId, "taskId")
      : undefined;

    await ensureAppointmentInOrganisation(appointmentId, organisationId);
    await ensureCompanionInOrganisation(input.patientId, organisationId);

    const tool = await prisma.observationToolDefinition.findFirst({
      where: { id: input.toolId },
    });

    if (!tool?.isActive) {
      throw new ObservationToolSubmissionServiceError(
        "Observation tool not found or inactive",
        404,
      );
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
        patientId: input.patientId,
        filledBy: input.filledBy,
        answers: input.answers as Prisma.InputJsonValue,
        score: score ?? undefined,
        summary: input.summary ?? undefined,
        evaluationAppointmentId: appointmentId,
      },
    });

    return doc as unknown as ObservationToolSubmissionDocument;
  },

  async linkToAppointment(
    input: LinkSubmissionToAppointmentInput,
  ): Promise<ObservationToolSubmissionDocument> {
    const organisationId = asNonEmptyString(input.organisationId);
    const submissionId = assertObjectId(input.submissionId, "submissionId");
    const appointmentId = assertObjectId(input.appointmentId, "appointmentId");

    const doc = await prisma.observationToolSubmission.findFirst({
      where: { id: submissionId },
    });

    if (!doc) {
      throw new ObservationToolSubmissionServiceError(
        "Submission not found",
        404,
      );
    }
    if (organisationId) {
      await ensureCompanionInOrganisation(doc.patientId, organisationId);
      await ensureAppointmentInOrganisation(appointmentId, organisationId);
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
  },

  async getById(
    id: string,
    organisationId?: string,
  ): Promise<ObservationToolSubmissionDocument | null> {
    const safeOrganisationId = asNonEmptyString(organisationId);
    const safeId = assertObjectId(id, "id");
    const doc = await prisma.observationToolSubmission.findFirst({
      where: { id: safeId },
    });
    if (doc && safeOrganisationId) {
      await ensureCompanionInOrganisation(doc.patientId, safeOrganisationId);
    }
    return (doc ?? null) as unknown as ObservationToolSubmissionDocument | null;
  },

  async listSubmissions(
    filter: ListSubmissionsFilter,
  ): Promise<ObservationToolSubmissionDocument[]> {
    const organisationId = asNonEmptyString(filter.organisationId);

    const where: Prisma.ObservationToolSubmissionWhereInput = {};

    if (filter.patientId) where.patientId = filter.patientId;
    if (filter.toolId) where.toolId = filter.toolId;
    if (filter.fromDate || filter.toDate) {
      where.createdAt = {};
      if (filter.fromDate) where.createdAt.gte = filter.fromDate;
      if (filter.toDate) where.createdAt.lte = filter.toDate;
    }
    if (organisationId) {
      if (filter.patientId) {
        await ensureCompanionInOrganisation(filter.patientId, organisationId);
      } else {
        const scopedCompanions = await prisma.patientOrganisation.findMany({
          where: { organisationId, status: "ACTIVE" },
          select: { patientId: true },
        });
        where.patientId = {
          in: scopedCompanions.map((item) => item.patientId),
        };
      }
    }

    const docs = await prisma.observationToolSubmission.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return docs as unknown as ObservationToolSubmissionDocument[];
  },

  async listForAppointment(
    appointmentId: string,
    organisationId?: string,
  ): Promise<ObservationToolSubmissionDocument[]> {
    const safeAppointmentId = assertObjectId(appointmentId, "appointmentId");
    const safeOrganisationId = asNonEmptyString(organisationId);
    if (safeOrganisationId) {
      await ensureAppointmentInOrganisation(
        safeAppointmentId,
        safeOrganisationId,
      );
    }
    const docs = await prisma.observationToolSubmission.findMany({
      where: { evaluationAppointmentId: safeAppointmentId },
      orderBy: { createdAt: "desc" },
    });
    return docs as unknown as ObservationToolSubmissionDocument[];
  },

  async getByTaskId(taskId: string) {
    const safeTaskId = assertObjectId(taskId, "taskId");

    const doc = await prisma.observationToolSubmission.findFirst({
      where: { taskId: safeTaskId },
    });
    return (doc ?? null) as unknown as ObservationToolSubmissionDocument | null;
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

    if (!tool?.isActive) {
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
              .map<[string, unknown]>((f) => [f.key, submissionAnswers[f.key]])
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
  },

  /**
   * Used by AppointmentView — give OT cards for all OT tasks in an appointment.
   * This is the “backend hook” frontend is asking for.
   */
  async listTaskPreviewsForAppointment(
    appointmentId: string,
  ): Promise<AppointmentTaskPreview[]> {
    const safeAppointmentId = assertObjectId(appointmentId, "appointmentId");

    const tasks = await prisma.task.findMany({
      where: {
        appointmentId: safeAppointmentId,
        observationToolId: { not: null },
      },
      select: {
        id: true,
        patientId: true,
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
          patientId: t.patientId ?? undefined,
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
  },
};
