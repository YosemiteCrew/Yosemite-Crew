import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { Types } from "mongoose";
import { ObservationToolSubmissionService } from "../../src/services/observationToolSubmission.service";
import {
  ObservationToolDefinitionModel,
  ObservationToolSubmissionModel,
} from "../../src/models/observationToolDefinition";
import TaskModel from "../../src/models/task";
import { TaskService } from "../../src/services/task.service";
import { handleDualWriteError } from "src/utils/dual-write";
import { prisma } from "src/config/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaMock = prisma as any;

// ----------------------------------------------------------------------
// Mocks
// ----------------------------------------------------------------------
jest.mock("../../src/models/observationToolDefinition");
jest.mock("../../src/models/task");
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
  },
}));
jest.mock("src/utils/dual-write", () => ({
  shouldDualWrite: true,
  isDualWriteStrict: false,
  handleDualWriteError: jest.fn(),
}));

// Helper to mock Mongoose query chains
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockChain = (resolvedValue: any) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {};

  // Cast jest.fn() to any to avoid "Argument ... not assignable to never" errors
  chain.setOptions = (jest.fn() as any).mockReturnValue(chain);
  chain.sort = (jest.fn() as any).mockReturnValue(chain);
  chain.select = (jest.fn() as any).mockReturnValue(chain);

  // Cast resolvedValue to any to allow returning arbitrary test data
  chain.lean = (jest.fn() as any).mockResolvedValue(resolvedValue as any);
  chain.exec = (jest.fn() as any).mockResolvedValue(resolvedValue as any);

  // Allow awaiting the chain directly
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chain.then = (resolve: any, reject: any) =>
    Promise.resolve(resolvedValue).then(resolve, reject);

  return chain;
};

// Helper for ObjectIds
const newId = () => new Types.ObjectId().toString();

describe("ObservationToolSubmissionService", () => {
  const toolId = newId();
  const taskId = newId();
  const companionId = newId();
  const userId = newId();
  const submissionId = newId();
  const appointmentId = newId();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.READ_FROM_POSTGRES = "false";
  });

  // ======================================================================
  // 1. Creation Logic
  // ======================================================================
  describe("createSubmission", () => {
    const validBaseInput = {
      toolId,
      companionId,
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
      ).rejects.toThrow("companionId is required");

      await expect(
        ObservationToolSubmissionService.createSubmission({
          toolId,
          companionId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any),
      ).rejects.toThrow("filledBy is required");

      await expect(
        ObservationToolSubmissionService.createSubmission({
          toolId,
          companionId,
          filledBy: userId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any),
      ).rejects.toThrow("answers are required");
    });

    it("should throw if tool not found or inactive", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ObservationToolDefinitionModel.findById as any).mockReturnValue(
        mockChain(null),
      );
      await expect(
        ObservationToolSubmissionService.createSubmission(validBaseInput),
      ).rejects.toThrow("Observation tool not found or inactive");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ObservationToolDefinitionModel.findById as any).mockReturnValue(
        mockChain({ isActive: false }),
      );
      await expect(
        ObservationToolSubmissionService.createSubmission(validBaseInput),
      ).rejects.toThrow("Observation tool not found or inactive");
    });

    it("should validate Task constraints if taskId is provided", async () => {
      // Setup valid tool
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ObservationToolDefinitionModel.findById as any).mockReturnValue(
        mockChain({ isActive: true, fields: [] }),
      );

      const inputWithTask = { ...validBaseInput, taskId };

      // Case 1: Duplicate submission
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ObservationToolSubmissionModel.findOne as any).mockReturnValue(
        mockChain({ _id: "exists" }),
      );
      await expect(
        ObservationToolSubmissionService.createSubmission(inputWithTask),
      ).rejects.toThrow("Observation already submitted for this task");

      // Case 2: Task not found
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ObservationToolSubmissionModel.findOne as any).mockReturnValue(
        mockChain(null),
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (TaskModel.findById as any).mockReturnValue(mockChain(null));
      await expect(
        ObservationToolSubmissionService.createSubmission(inputWithTask),
      ).rejects.toThrow("Task not found");

      // Case 3: Forbidden user
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (TaskModel.findById as any).mockReturnValue(
        mockChain({ assignedTo: "other-user" }),
      );
      await expect(
        ObservationToolSubmissionService.createSubmission(inputWithTask),
      ).rejects.toThrow("Not allowed to submit this task");

      // Case 4: Mismatched companion
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (TaskModel.findById as any).mockReturnValue(
        mockChain({ assignedTo: userId, companionId: "other-companion" }),
      );
      await expect(
        ObservationToolSubmissionService.createSubmission(inputWithTask),
      ).rejects.toThrow("companionId does not match task");

      // Case 5: Mismatched toolId
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (TaskModel.findById as any).mockReturnValue(
        mockChain({
          assignedTo: userId,
          companionId: companionId,
          observationToolId: "other-tool",
        }),
      );
      await expect(
        ObservationToolSubmissionService.createSubmission(inputWithTask),
      ).rejects.toThrow("toolId does not match task observationToolId");
    });

    it("should create submission and complete task (if linked)", async () => {
      // Mock valid tool with scoring logic
      const toolMock = {
        isActive: true,
        fields: [
          { key: "q1", scoring: { points: 10 } }, // simple points
          { key: "q2", scoring: { map: { yes: 5, no: 0 } } }, // map scoring
        ],
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ObservationToolDefinitionModel.findById as any).mockReturnValue(
        mockChain(toolMock),
      );

      // Mock no existing submission
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ObservationToolSubmissionModel.findOne as any).mockReturnValue(
        mockChain(null),
      );

      // Mock valid task
      const taskMock = {
        assignedTo: userId,
        companionId: companionId,
        observationToolId: toolId,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (TaskModel.findById as any).mockReturnValue(mockChain(taskMock));

      // Mock creation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ObservationToolSubmissionModel.create as any).mockResolvedValue({
        _id: submissionId,
        score: 15,
      } as any);

      const input = {
        ...validBaseInput,
        taskId,
        answers: { q1: "val", q2: "yes" }, // q1 (10) + q2 (5) = 15
        summary: "Done",
      };

      const result =
        await ObservationToolSubmissionService.createSubmission(input);

      expect(result._id).toBe(submissionId);
      // Verify scoring logic passed correct score (15) to create
      expect(ObservationToolSubmissionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ score: 15 }),
      );

      // Verify task completion called
      expect(TaskService.changeStatus).toHaveBeenCalledWith(
        taskId,
        "COMPLETED",
        userId,
        expect.objectContaining({ score: 15 }),
      );
    });

    it("uses prisma when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
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

    it("validates task constraints in postgres path", async () => {
      process.env.READ_FROM_POSTGRES = "true";
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
        companionId: "other",
      });
      await expect(
        ObservationToolSubmissionService.createSubmission({
          ...validBaseInput,
          taskId,
        }),
      ).rejects.toThrow("companionId does not match task");

      (prismaMock.task.findFirst as any).mockResolvedValueOnce({
        id: taskId,
        assignedTo: userId,
        companionId,
        observationToolId: "other-tool",
      });
      await expect(
        ObservationToolSubmissionService.createSubmission({
          ...validBaseInput,
          taskId,
        }),
      ).rejects.toThrow("toolId does not match task observationToolId");
    });

    it("creates submission and completes task in postgres path", async () => {
      process.env.READ_FROM_POSTGRES = "true";
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
        companionId,
        observationToolId: toolId,
      });
      (prismaMock.observationToolSubmission.create as any).mockResolvedValue({
        id: submissionId,
      });

      const res = await ObservationToolSubmissionService.createSubmission({
        ...validBaseInput,
        taskId,
        answers: { q1: "yes", q2: "yes" },
      });

      expect(res).toEqual({ id: submissionId });
      expect(TaskService.changeStatus).toHaveBeenCalledWith(
        taskId,
        "COMPLETED",
        userId,
        expect.objectContaining({ score: 5 }),
      );
    });

    it("throws when postgres tool is missing or inactive", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prismaMock.observationToolDefinition.findFirst as any).mockResolvedValue(
        null,
      );

      await expect(
        ObservationToolSubmissionService.createSubmission(validBaseInput),
      ).rejects.toThrow("Observation tool not found or inactive");
    });

    it("handles dual-write errors on mongo create", async () => {
      (ObservationToolDefinitionModel.findById as any).mockReturnValue(
        mockChain({ isActive: true, fields: [] }),
      );
      (ObservationToolSubmissionModel.create as any).mockResolvedValue({
        _id: submissionId,
        toolId,
        companionId,
        filledBy: userId,
        answers: { q1: "yes" },
        toObject: jest.fn().mockReturnValue({
          _id: { toString: () => submissionId },
          toolId,
          companionId,
          filledBy: userId,
          answers: { q1: "yes" },
        }),
      });
      (prismaMock.observationToolSubmission.upsert as any).mockRejectedValue(
        new Error("sync fail"),
      );

      await ObservationToolSubmissionService.createSubmission(validBaseInput);

      expect(handleDualWriteError).toHaveBeenCalledWith(
        "ObservationToolSubmission",
        expect.any(Error),
      );
    });

    it("should handle undefined score when no scoring fields match", async () => {
      // Tool with scoring definition but answers don't match criteria
      const toolMock = {
        isActive: true,
        fields: [{ key: "q1", scoring: { points: 10 } }],
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ObservationToolDefinitionModel.findById as any).mockReturnValue(
        mockChain(toolMock),
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ObservationToolSubmissionModel.create as any).mockResolvedValue(
        {} as any,
      );

      const input = {
        ...validBaseInput,
        answers: { q1: "" }, // empty string => no points
      };

      await ObservationToolSubmissionService.createSubmission(input);

      expect(ObservationToolSubmissionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ score: undefined }),
      );
    });
  });

  // ======================================================================
  // 2. Linking Logic
  // ======================================================================
  describe("linkToAppointment", () => {
    it("should link submission if found", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockDoc: any = {
        _id: submissionId,
        save: (jest.fn() as any).mockResolvedValue(true),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ObservationToolSubmissionModel.findById as any).mockReturnValue(
        mockChain(mockDoc),
      );

      await ObservationToolSubmissionService.linkToAppointment({
        submissionId,
        appointmentId,
      });

      expect(mockDoc.evaluationAppointmentId).toBe(appointmentId);
      expect(mockDoc.save).toHaveBeenCalled();
    });

    it("should throw if submission not found", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ObservationToolSubmissionModel.findById as any).mockReturnValue(
        mockChain(null),
      );
      await expect(
        ObservationToolSubmissionService.linkToAppointment({
          submissionId,
          appointmentId,
        }),
      ).rejects.toThrow("Submission not found");
    });

    it("should enforce single submission constraint", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockDoc: any = { _id: submissionId, save: jest.fn() };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ObservationToolSubmissionModel.findById as any).mockReturnValue(
        mockChain(mockDoc),
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ObservationToolSubmissionModel.findOne as any).mockReturnValue(
        mockChain({ _id: "other" }),
      );

      await expect(
        ObservationToolSubmissionService.linkToAppointment({
          submissionId,
          appointmentId,
          enforceSingleSubmissionPerAppointment: true,
        }),
      ).rejects.toThrow("already linked");
    });

    it("throws in postgres path when submission not found", async () => {
      process.env.READ_FROM_POSTGRES = "true";
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

    it("throws in postgres path when appointment already linked", async () => {
      process.env.READ_FROM_POSTGRES = "true";
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

    it("uses prisma when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prismaMock.observationToolSubmission.findFirst as any)
        .mockResolvedValueOnce({ id: submissionId })
        .mockResolvedValueOnce(null);
      (prismaMock.observationToolSubmission.update as any).mockResolvedValue({
        id: submissionId,
        evaluationAppointmentId: appointmentId,
      });

      const res = await ObservationToolSubmissionService.linkToAppointment({
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

  // ======================================================================
  // 3. Retrieval & Listing
  // ======================================================================
  describe("Retrieval Methods", () => {
    it("getById: should return doc", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ObservationToolSubmissionModel.findById as any).mockReturnValue(
        mockChain({ _id: submissionId }),
      );
      const res = await ObservationToolSubmissionService.getById(submissionId);
      expect(res).toEqual({ _id: submissionId });
    });

    it("listSubmissions: should apply filters", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ObservationToolSubmissionModel.find as any).mockReturnValue(
        mockChain([]),
      );
      const from = new Date();
      await ObservationToolSubmissionService.listSubmissions({
        companionId,
        toolId,
        fromDate: from,
      });

      expect(ObservationToolSubmissionModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          companionId,
          toolId,
          createdAt: { $gte: from },
        }),
      );
    });

    it("listForAppointment: should query by evaluationAppointmentId", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ObservationToolSubmissionModel.find as any).mockReturnValue(
        mockChain([]),
      );
      await ObservationToolSubmissionService.listForAppointment(appointmentId);
      expect(ObservationToolSubmissionModel.find).toHaveBeenCalledWith({
        evaluationAppointmentId: appointmentId,
      });
    });

    it("getByTaskId: should query by taskId", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ObservationToolSubmissionModel.findOne as any).mockReturnValue(
        mockChain({}),
      );
      await ObservationToolSubmissionService.getByTaskId(taskId);
      expect(ObservationToolSubmissionModel.findOne).toHaveBeenCalledWith({
        taskId,
      });
    });

    it("listSubmissions throws for invalid dates", async () => {
      await expect(
        ObservationToolSubmissionService.listSubmissions({
          companionId,
          fromDate: "bad" as any,
        }),
      ).rejects.toThrow("Invalid fromDate");
    });

    it("listSubmissions throws for invalid filters", async () => {
      await expect(
        ObservationToolSubmissionService.listSubmissions({
          companionId: "   ",
        }),
      ).rejects.toThrow("Invalid companionId");

      await expect(
        ObservationToolSubmissionService.listSubmissions({
          toolId: 123 as any,
        }),
      ).rejects.toThrow("Invalid toolId");
    });

    it("listSubmissions uses prisma when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prismaMock.observationToolSubmission.findMany as any).mockResolvedValue([
        { id: submissionId },
      ]);

      const res = await ObservationToolSubmissionService.listSubmissions({
        companionId,
      });

      expect(res).toEqual([{ id: submissionId }]);
    });

    it("listSubmissions builds date range in prisma path", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      const from = new Date("2024-01-01");
      const to = new Date("2024-01-02");
      (prismaMock.observationToolSubmission.findMany as any).mockResolvedValue(
        [],
      );

      await ObservationToolSubmissionService.listSubmissions({
        companionId,
        toolId,
        fromDate: from,
        toDate: to,
      });

      expect(prisma.observationToolSubmission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companionId,
            toolId,
            createdAt: { gte: from, lte: to },
          }),
        }),
      );
    });

    it("listForAppointment uses prisma when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prismaMock.observationToolSubmission.findMany as any).mockResolvedValue([
        { id: submissionId },
      ]);

      const res =
        await ObservationToolSubmissionService.listForAppointment(
          appointmentId,
        );
      expect(res).toEqual([{ id: submissionId }]);
    });

    it("getByTaskId uses prisma when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prismaMock.observationToolSubmission.findFirst as any).mockResolvedValue(
        {
          id: submissionId,
        },
      );

      const res = await ObservationToolSubmissionService.getByTaskId(taskId);
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (TaskModel.findById as any).mockReturnValue(mockChain(null));
        await expect(
          ObservationToolSubmissionService.getPreviewByTaskId(taskId),
        ).rejects.toThrow("Task not found");

        // Task has no toolId
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (TaskModel.findById as any).mockReturnValue(mockChain({}));
        await expect(
          ObservationToolSubmissionService.getPreviewByTaskId(taskId),
        ).rejects.toThrow("Task has no observationToolId");

        // Tool missing
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (TaskModel.findById as any).mockReturnValue(
          mockChain({ observationToolId: toolId }),
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ObservationToolDefinitionModel.findById as any).mockReturnValue(
          mockChain(null),
        );
        await expect(
          ObservationToolSubmissionService.getPreviewByTaskId(taskId),
        ).rejects.toThrow("Observation tool not found or inactive");
      });

      it("should return preview data with answers subset", async () => {
        // Mock Task
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (TaskModel.findById as any).mockReturnValue(
          mockChain({ observationToolId: toolId }),
        );
        // Mock Tool
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ObservationToolDefinitionModel.findById as any).mockReturnValue(
          mockChain({
            _id: toolId,
            name: "Tool",
            category: "Cat",
            isActive: true,
            fields: [{ key: "q1" }, { key: "q2" }],
          }),
        );
        // Mock Submission
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ObservationToolSubmissionModel.findOne as any).mockReturnValue(
          mockChain({
            _id: submissionId,
            answers: { q1: "ans1", q2: "ans2" },
          }),
        );

        const res =
          await ObservationToolSubmissionService.getPreviewByTaskId(taskId);

        expect(res.taskId).toBe(taskId);
        expect(res.toolName).toBe("Tool");
        expect(res.answersPreview).toEqual({ q1: "ans1", q2: "ans2" });
      });

      it("uses prisma when READ_FROM_POSTGRES is true", async () => {
        process.env.READ_FROM_POSTGRES = "true";
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

        expect(res.toolName).toBe("Tool");
        expect(res.answersPreview).toEqual({ q1: "ans1" });
      });
    });

    describe("listTaskPreviewsForAppointment", () => {
      it("should aggregate tasks, tools, and submissions", async () => {
        const tId = newId();
        const taskObjectId = { toString: () => tId } as any;
        const toolObjectId = { toString: () => toolId } as any;
        const taskChain = {
          setOptions: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          lean: (jest.fn() as any).mockResolvedValue([
            {
              _id: taskObjectId,
              observationToolId: toolObjectId,
              status: "PENDING",
              dueAt: new Date(),
            },
          ]),
        };
        const toolChain = {
          select: jest.fn().mockReturnThis(),
          lean: (jest.fn() as any).mockResolvedValue([
            {
              _id: toolObjectId,
              name: "ToolName",
              category: "Cat",
            },
          ]),
        };
        const submissionChain = {
          select: jest.fn().mockReturnThis(),
          lean: (jest.fn() as any).mockResolvedValue([
            {
              _id: { toString: () => submissionId },
              taskId: taskObjectId,
              score: 10,
              summary: "ok",
              evaluationAppointmentId: appointmentId,
            },
          ]),
        };
        // 1. Mock Tasks
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (TaskModel.find as any).mockReturnValue(taskChain);

        // 2. Mock Tools lookup
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ObservationToolDefinitionModel.find as any).mockReturnValue(toolChain);

        // 3. Mock Submissions lookup
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ObservationToolSubmissionModel.find as any).mockReturnValue(
          submissionChain,
        );

        const res =
          await ObservationToolSubmissionService.listTaskPreviewsForAppointment(
            appointmentId,
          );

        expect(TaskModel.find).toHaveBeenCalled();
        expect(ObservationToolDefinitionModel.find).toHaveBeenCalled();
        expect(ObservationToolSubmissionModel.find).toHaveBeenCalled();
        expect(Array.isArray(res)).toBe(true);
      });

      it("should return empty if no tasks found", async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (TaskModel.find as any).mockReturnValue(mockChain([]));
        const res =
          await ObservationToolSubmissionService.listTaskPreviewsForAppointment(
            appointmentId,
          );
        expect(res).toEqual([]);
      });

      it("uses prisma when READ_FROM_POSTGRES is true", async () => {
        process.env.READ_FROM_POSTGRES = "true";
        (prismaMock.task.findMany as any).mockResolvedValue([
          {
            id: "task-1",
            companionId: "comp-1",
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

      it("returns empty in postgres path when no tasks", async () => {
        process.env.READ_FROM_POSTGRES = "true";
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
    it("assertObjectId should throw on invalid input", async () => {
      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ObservationToolSubmissionService.getById(123 as any),
      ).rejects.toThrow("must be a string");

      await expect(
        ObservationToolSubmissionService.getById("invalid-id$"),
      ).rejects.toThrow("Invalid id");
    });
  });
});
