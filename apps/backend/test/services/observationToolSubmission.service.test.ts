import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { ObservationToolSubmissionService } from "../../src/services/observationToolSubmission.service";
import { TaskService } from "../../src/services/task.service";
import { prisma } from "src/config/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaMock = prisma as any;

// ----------------------------------------------------------------------
// Mocks
// ----------------------------------------------------------------------
jest.mock("../../src/services/task.service");
jest.mock("src/config/prisma", () => ({
  prisma: {
    observationToolDefinition: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    observationToolSubmission: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    task: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    appointment: {
      findFirst: jest.fn(),
    },
    patientOrganisation: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

// Simple id helpers — assertObjectId only requires a non-empty string.
let idCounter = 0;
const newId = () => `id-${(idCounter += 1)}`;

describe("ObservationToolSubmissionService", () => {
  const toolId = newId();
  const taskId = newId();
  const companionId = newId();
  const userId = newId();
  const submissionId = newId();
  const appointmentId = newId();
  const organisationId = newId();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ======================================================================
  // 1. Creation Logic
  // ======================================================================
  describe("createSubmission", () => {
    const validBaseInput = {
      toolId,
      patientId: companionId,
      filledBy: userId,
      answers: { q1: "yes" },
    };

    it("should throw if required fields are missing", async () => {
      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ObservationToolSubmissionService.createSubmission({} as any),
      ).rejects.toThrow("toolId is required");

      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ObservationToolSubmissionService.createSubmission({ toolId } as any),
      ).rejects.toThrow("patientId is required");

      await expect(
        ObservationToolSubmissionService.createSubmission({
          toolId,
          patientId: companionId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any),
      ).rejects.toThrow("filledBy is required");

      await expect(
        ObservationToolSubmissionService.createSubmission({
          toolId,
          patientId: companionId,
          filledBy: userId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any),
      ).rejects.toThrow("answers are required");
    });

    it("throws when the tool is missing or inactive", async () => {
      (prismaMock.observationToolDefinition.findFirst as any).mockResolvedValue(
        null,
      );

      await expect(
        ObservationToolSubmissionService.createSubmission(validBaseInput),
      ).rejects.toThrow("Observation tool not found or inactive");
    });

    it("uses prisma to create the submission", async () => {
      (prismaMock.observationToolDefinition.findFirst as any).mockResolvedValue(
        {
          id: toolId,
          isActive: true,
          fields: [],
        },
      );
      (prismaMock.observationToolSubmission.create as any).mockResolvedValue({
        id: submissionId,
      });

      const res =
        await ObservationToolSubmissionService.createSubmission(validBaseInput);

      expect(prisma.observationToolSubmission.create).toHaveBeenCalled();
      expect(res).toEqual({ id: submissionId });
    });

    it("validates task constraints", async () => {
      (prismaMock.observationToolDefinition.findFirst as any).mockResolvedValue(
        { id: toolId, isActive: true, fields: [] },
      );

      (
        prismaMock.observationToolSubmission.findFirst as any
      ).mockResolvedValueOnce({ id: submissionId });
      await expect(
        ObservationToolSubmissionService.createSubmission({
          ...validBaseInput,
          taskId,
        }),
      ).rejects.toThrow("Observation already submitted for this task");

      (
        prismaMock.observationToolSubmission.findFirst as any
      ).mockResolvedValueOnce(null);
      (prismaMock.task.findFirst as any).mockResolvedValueOnce(null);
      await expect(
        ObservationToolSubmissionService.createSubmission({
          ...validBaseInput,
          taskId,
        }),
      ).rejects.toThrow("Task not found");

      (prismaMock.task.findFirst as any).mockResolvedValueOnce({
        id: taskId,
        assignedTo: "other",
      });
      await expect(
        ObservationToolSubmissionService.createSubmission({
          ...validBaseInput,
          taskId,
        }),
      ).rejects.toThrow("Not allowed to submit this task");

      (prismaMock.task.findFirst as any).mockResolvedValueOnce({
        id: taskId,
        assignedTo: userId,
        patientId: "other",
      });
      await expect(
        ObservationToolSubmissionService.createSubmission({
          ...validBaseInput,
          taskId,
        }),
      ).rejects.toThrow("patientId does not match task");

      (prismaMock.task.findFirst as any).mockResolvedValueOnce({
        id: taskId,
        assignedTo: userId,
        patientId: companionId,
        observationToolId: "other-tool",
      });
      await expect(
        ObservationToolSubmissionService.createSubmission({
          ...validBaseInput,
          taskId,
        }),
      ).rejects.toThrow("toolId does not match task observationToolId");
    });

    it("creates submission and completes the linked task", async () => {
      (prismaMock.observationToolDefinition.findFirst as any).mockResolvedValue(
        {
          id: toolId,
          isActive: true,
          fields: [
            { key: "q1", scoring: { points: 2 } },
            { key: "q2", scoring: { map: { yes: 3 } } },
          ],
        },
      );
      (prismaMock.observationToolSubmission.findFirst as any).mockResolvedValue(
        null,
      );
      (prismaMock.task.findFirst as any).mockResolvedValue({
        id: taskId,
        assignedTo: userId,
        patientId: companionId,
        observationToolId: toolId,
      });
      (prismaMock.observationToolSubmission.create as any).mockResolvedValue({
        id: submissionId,
      });

      const res = await ObservationToolSubmissionService.createSubmission({
        ...validBaseInput,
        taskId,
        answers: { q1: "yes", q2: "yes" }, // q1 (2) + q2 (3) = 5
      });

      expect(res).toEqual({ id: submissionId });
      expect(TaskService.changeStatus).toHaveBeenCalledWith(
        taskId,
        "COMPLETED",
        userId,
        expect.objectContaining({ score: 5 }),
      );
    });

    it("passes an undefined score when no scoring fields match", async () => {
      (prismaMock.observationToolDefinition.findFirst as any).mockResolvedValue(
        {
          id: toolId,
          isActive: true,
          fields: [{ key: "q1", scoring: { points: 10 } }],
        },
      );
      (prismaMock.observationToolSubmission.create as any).mockResolvedValue({
        id: submissionId,
      });

      await ObservationToolSubmissionService.createSubmission({
        ...validBaseInput,
        answers: { q1: "" }, // empty string => no points
      });

      expect(prisma.observationToolSubmission.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ score: undefined }),
        }),
      );
    });
  });

  // ======================================================================
  // 2. Linking Logic
  // ======================================================================
  describe("linkToAppointment", () => {
    it("throws when submission not found", async () => {
      (prismaMock.observationToolSubmission.findFirst as any).mockResolvedValue(
        null,
      );

      await expect(
        ObservationToolSubmissionService.linkToAppointment({
          submissionId,
          appointmentId,
        }),
      ).rejects.toThrow("Submission not found");
    });

    it("throws when the appointment is already linked", async () => {
      (prismaMock.observationToolSubmission.findFirst as any)
        .mockResolvedValueOnce({ id: submissionId })
        .mockResolvedValueOnce({ id: "other" });

      await expect(
        ObservationToolSubmissionService.linkToAppointment({
          submissionId,
          appointmentId,
          enforceSingleSubmissionPerAppointment: true,
        }),
      ).rejects.toThrow(
        "An observation submission is already linked to this appointment",
      );
    });

    it("links the submission to the appointment", async () => {
      (prismaMock.observationToolSubmission.findFirst as any)
        .mockResolvedValueOnce({ id: submissionId, patientId: companionId })
        .mockResolvedValueOnce(null);
      (prismaMock.patientOrganisation.findFirst as any).mockResolvedValue({
        id: "co1",
      });
      (prismaMock.appointment.findFirst as any).mockResolvedValue({
        id: appointmentId,
      });
      (prismaMock.observationToolSubmission.update as any).mockResolvedValue({
        id: submissionId,
        evaluationAppointmentId: appointmentId,
      });

      const res = await ObservationToolSubmissionService.linkToAppointment({
        organisationId: "org1",
        submissionId,
        appointmentId,
        enforceSingleSubmissionPerAppointment: true,
      });

      expect(res).toEqual({
        id: submissionId,
        evaluationAppointmentId: appointmentId,
      });
    });
  });

  describe("createForAppointment", () => {
    const validInput = {
      appointmentId,
      organisationId,
      toolId,
      patientId: companionId,
      filledBy: userId,
      answers: { q1: "yes" },
    };

    it("throws when required fields are missing", async () => {
      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ObservationToolSubmissionService.createForAppointment({} as any),
      ).rejects.toThrow("toolId is required");
    });

    it("throws Forbidden when appointment is not in the organisation", async () => {
      (prismaMock.appointment.findFirst as any).mockResolvedValue(null);

      await expect(
        ObservationToolSubmissionService.createForAppointment(validInput),
      ).rejects.toThrow("Forbidden");
    });

    it("throws when the tool is not found or inactive", async () => {
      (prismaMock.appointment.findFirst as any).mockResolvedValue({
        id: appointmentId,
        patient: { id: companionId },
      });
      (prismaMock.patientOrganisation.findFirst as any).mockResolvedValue({
        id: "co1",
      });
      (prismaMock.observationToolDefinition.findFirst as any).mockResolvedValue(
        { id: toolId, isActive: false },
      );

      await expect(
        ObservationToolSubmissionService.createForAppointment(validInput),
      ).rejects.toThrow("Observation tool not found or inactive");
    });

    it("creates and links the submission to the appointment", async () => {
      (prismaMock.appointment.findFirst as any).mockResolvedValue({
        id: appointmentId,
        patient: { id: companionId },
      });
      (prismaMock.patientOrganisation.findFirst as any).mockResolvedValue({
        id: "co1",
      });
      (prismaMock.observationToolDefinition.findFirst as any).mockResolvedValue(
        {
          id: toolId,
          isActive: true,
          fields: [{ key: "q1", scoring: { points: 3 } }],
        },
      );
      (prismaMock.observationToolSubmission.create as any).mockResolvedValue({
        id: submissionId,
        score: 3,
        evaluationAppointmentId: appointmentId,
      });

      const res =
        await ObservationToolSubmissionService.createForAppointment(validInput);

      expect(prisma.observationToolSubmission.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            evaluationAppointmentId: appointmentId,
            score: 3,
          }),
        }),
      );
      // returns the created object, never an array
      expect(Array.isArray(res)).toBe(false);
      expect(res).toEqual(
        expect.objectContaining({ evaluationAppointmentId: appointmentId }),
      );
    });

    describe("rejects spoofed identifiers", () => {
      const otherCompanionId = newId();
      const spoofTaskId = newId();

      const mockAppointmentAndCompanion = () => {
        (prismaMock.appointment.findFirst as any).mockResolvedValue({
          id: appointmentId,
          patient: { id: companionId },
        });
        (prismaMock.patientOrganisation.findFirst as any).mockResolvedValue({
          id: "link1",
        });
      };

      it("rejects a companion that is not the appointment's patient", async () => {
        mockAppointmentAndCompanion();

        await expect(
          ObservationToolSubmissionService.createForAppointment({
            ...validInput,
            patientId: otherCompanionId,
          }),
        ).rejects.toThrow("patientId does not match appointment");

        expect(prisma.observationToolSubmission.create).not.toHaveBeenCalled();
      });

      it("rejects a taskId owned by another organisation", async () => {
        mockAppointmentAndCompanion();
        (prismaMock.task.findFirst as any).mockResolvedValue({
          id: spoofTaskId,
          organisationId: newId(),
          appointmentId,
          patientId: companionId,
          observationToolId: toolId,
        });

        await expect(
          ObservationToolSubmissionService.createForAppointment({
            ...validInput,
            taskId: spoofTaskId,
          }),
        ).rejects.toThrow("Forbidden");

        expect(prisma.observationToolSubmission.create).not.toHaveBeenCalled();
      });

      it("rejects a taskId belonging to another appointment", async () => {
        mockAppointmentAndCompanion();
        (prismaMock.task.findFirst as any).mockResolvedValue({
          id: spoofTaskId,
          organisationId,
          appointmentId: newId(),
          patientId: companionId,
          observationToolId: toolId,
        });

        await expect(
          ObservationToolSubmissionService.createForAppointment({
            ...validInput,
            taskId: spoofTaskId,
          }),
        ).rejects.toThrow("taskId does not match appointment");
      });

      it("rejects a taskId belonging to another patient", async () => {
        mockAppointmentAndCompanion();
        (prismaMock.task.findFirst as any).mockResolvedValue({
          id: spoofTaskId,
          organisationId,
          appointmentId,
          patientId: otherCompanionId,
          observationToolId: toolId,
        });

        await expect(
          ObservationToolSubmissionService.createForAppointment({
            ...validInput,
            taskId: spoofTaskId,
          }),
        ).rejects.toThrow("patientId does not match task");
      });

      it("rejects a taskId raised for a different observation tool", async () => {
        mockAppointmentAndCompanion();
        (prismaMock.task.findFirst as any).mockResolvedValue({
          id: spoofTaskId,
          organisationId,
          appointmentId,
          patientId: companionId,
          observationToolId: newId(),
        });

        await expect(
          ObservationToolSubmissionService.createForAppointment({
            ...validInput,
            taskId: spoofTaskId,
          }),
        ).rejects.toThrow("toolId does not match task observationToolId");
      });

      it("rejects a taskId that does not exist", async () => {
        mockAppointmentAndCompanion();
        (prismaMock.task.findFirst as any).mockResolvedValue(null);

        await expect(
          ObservationToolSubmissionService.createForAppointment({
            ...validInput,
            taskId: spoofTaskId,
          }),
        ).rejects.toThrow("Task not found");
      });
    });
  });

  // ======================================================================
  // 3. Retrieval & Listing
  // ======================================================================
  describe("Retrieval Methods", () => {
    it("getById: should return doc", async () => {
      (prismaMock.observationToolSubmission.findFirst as any).mockResolvedValue(
        { id: submissionId },
      );
      const res = await ObservationToolSubmissionService.getById(submissionId);
      expect(res).toEqual({ id: submissionId });
    });

    it("getById enforces organisation scoping", async () => {
      (prismaMock.observationToolSubmission.findFirst as any).mockResolvedValue(
        { id: submissionId, patientId: companionId },
      );
      (prismaMock.patientOrganisation.findFirst as any).mockResolvedValue({
        id: "co1",
      });

      await ObservationToolSubmissionService.getById(
        submissionId,
        organisationId,
      );

      expect(prisma.patientOrganisation.findFirst).toHaveBeenCalled();
    });

    it("listSubmissions scopes by organisation when no companion filter is provided", async () => {
      (prismaMock.observationToolSubmission.findMany as any).mockResolvedValue([
        { id: submissionId },
      ]);
      (prismaMock.patientOrganisation.findMany as any).mockResolvedValue([
        { patientId: companionId },
      ]);

      const res = await ObservationToolSubmissionService.listSubmissions({
        organisationId: "org1",
      });

      expect(prisma.patientOrganisation.findMany).toHaveBeenCalled();
      expect(res).toEqual([{ id: submissionId }]);
    });

    it("listSubmissions builds a date range and validates the companion", async () => {
      const from = new Date("2024-01-01");
      const to = new Date("2024-01-02");
      (prismaMock.observationToolSubmission.findMany as any).mockResolvedValue(
        [],
      );
      (prismaMock.patientOrganisation.findFirst as any).mockResolvedValue({
        id: "co1",
      });

      await ObservationToolSubmissionService.listSubmissions({
        organisationId: "org1",
        patientId: companionId,
        toolId,
        fromDate: from,
        toDate: to,
      });

      expect(prisma.patientOrganisation.findFirst).toHaveBeenCalled();
      expect(prisma.observationToolSubmission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            patientId: companionId,
            toolId,
            createdAt: { gte: from, lte: to },
          }),
        }),
      );
    });

    it("listForAppointment queries by evaluationAppointmentId and validates org scope", async () => {
      (prismaMock.observationToolSubmission.findMany as any).mockResolvedValue([
        { id: submissionId },
      ]);
      (prismaMock.appointment.findFirst as any).mockResolvedValue({
        id: appointmentId,
      });

      const res = await ObservationToolSubmissionService.listForAppointment(
        appointmentId,
        "org1",
      );

      expect(prisma.appointment.findFirst).toHaveBeenCalled();
      expect(prisma.observationToolSubmission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { evaluationAppointmentId: appointmentId },
        }),
      );
      expect(res).toEqual([{ id: submissionId }]);
    });

    it("getByTaskId queries by taskId", async () => {
      (prismaMock.observationToolSubmission.findFirst as any).mockResolvedValue(
        { id: submissionId },
      );

      const res = await ObservationToolSubmissionService.getByTaskId(taskId);
      expect(prisma.observationToolSubmission.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { taskId } }),
      );
      expect(res).toEqual({ id: submissionId });
    });
  });

  // ======================================================================
  // 4. Previews & Complex Aggregation
  // ======================================================================
  describe("Previews", () => {
    describe("getPreviewByTaskId", () => {
      it("should throw if task or tool missing", async () => {
        // Task missing
        (prismaMock.task.findFirst as any).mockResolvedValueOnce(null);
        await expect(
          ObservationToolSubmissionService.getPreviewByTaskId(taskId),
        ).rejects.toThrow("Task not found");

        // Task has no observationToolId
        (prismaMock.task.findFirst as any).mockResolvedValueOnce({
          id: taskId,
        });
        await expect(
          ObservationToolSubmissionService.getPreviewByTaskId(taskId),
        ).rejects.toThrow("Task has no observationToolId");

        // Tool missing
        (prismaMock.task.findFirst as any).mockResolvedValueOnce({
          id: taskId,
          observationToolId: toolId,
        });
        (
          prismaMock.observationToolDefinition.findFirst as any
        ).mockResolvedValueOnce(null);
        await expect(
          ObservationToolSubmissionService.getPreviewByTaskId(taskId),
        ).rejects.toThrow("Observation tool not found or inactive");
      });

      it("returns preview data with an answers subset", async () => {
        (prismaMock.task.findFirst as any).mockResolvedValue({
          id: taskId,
          observationToolId: toolId,
        });
        (
          prismaMock.observationToolDefinition.findFirst as any
        ).mockResolvedValue({
          id: toolId,
          name: "Tool",
          category: "Cat",
          isActive: true,
          fields: [{ key: "q1" }, { key: "q2" }],
        });
        (
          prismaMock.observationToolSubmission.findFirst as any
        ).mockResolvedValue({
          id: submissionId,
          taskId,
          answers: { q1: "ans1" },
          createdAt: new Date(),
          score: 3,
          summary: "ok",
        });

        const res =
          await ObservationToolSubmissionService.getPreviewByTaskId(taskId);

        expect(res.taskId).toBe(taskId);
        expect(res.toolName).toBe("Tool");
        expect(res.answersPreview).toEqual({ q1: "ans1" });
      });
    });

    describe("listTaskPreviewsForAppointment", () => {
      it("aggregates tasks, tools, and submissions", async () => {
        (prismaMock.task.findMany as any).mockResolvedValue([
          {
            id: "task-1",
            patientId: "comp-1",
            status: "PENDING",
            dueAt: new Date(),
            observationToolId: toolId,
          },
        ]);
        (
          prismaMock.observationToolDefinition.findMany as any
        ).mockResolvedValue([
          { id: toolId, name: "Tool", category: "Cat", isActive: true },
        ]);
        (
          prismaMock.observationToolSubmission.findMany as any
        ).mockResolvedValue([
          {
            id: submissionId,
            taskId: "task-1",
            toolId,
            score: 5,
            summary: "ok",
            createdAt: new Date(),
            evaluationAppointmentId: appointmentId,
          },
        ]);

        const res =
          await ObservationToolSubmissionService.listTaskPreviewsForAppointment(
            appointmentId,
          );

        expect(res).toHaveLength(1);
        expect(res[0].taskId).toBe("task-1");
      });

      it("returns empty when no tasks", async () => {
        (prismaMock.task.findMany as any).mockResolvedValue([]);

        const res =
          await ObservationToolSubmissionService.listTaskPreviewsForAppointment(
            appointmentId,
          );
        expect(res).toEqual([]);
      });
    });
  });

  // ======================================================================
  // 5. Utils Coverage (assertObjectId)
  // ======================================================================
  describe("Utils", () => {
    it("assertObjectId should throw on non-string input", async () => {
      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ObservationToolSubmissionService.getById(123 as any),
      ).rejects.toThrow("must be a string");
    });
  });
});
