import {
  TaskLibraryService,
  TaskLibraryServiceError,
} from "../../src/services/taskLibrary.service";
import TaskLibraryDefinitionModel, {
  TaskKind,
} from "../../src/models/taskLibraryDefinition";
import { Types } from "mongoose";
import { prisma } from "src/config/prisma";
import { handleDualWriteError } from "src/utils/dual-write";

// Mock the Mongoose Model
jest.mock("../../src/models/taskLibraryDefinition");
jest.mock("src/config/prisma", () => ({
  prisma: {
    taskLibraryDefinition: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));
jest.mock("src/utils/dual-write", () => ({
  shouldDualWrite: true,
  isDualWriteStrict: false,
  handleDualWriteError: jest.fn(),
}));

describe("TaskLibraryService", () => {
  const validId = new Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.READ_FROM_POSTGRES = "false";
  });

  describe("TaskLibraryServiceError", () => {
    it("should create an error with default status code", () => {
      const err = new TaskLibraryServiceError("Test Error");
      expect(err.message).toBe("Test Error");
      expect(err.statusCode).toBe(400);
      expect(err.name).toBe("TaskLibraryServiceError");
    });

    it("should create an error with custom status code", () => {
      const err = new TaskLibraryServiceError("Payment Required", 402);
      expect(err.statusCode).toBe(402);
    });
  });

  describe("create", () => {
    const validInput = {
      kind: "HYGIENE" as TaskKind,
      category: "Health",
      name: "Checkup",
      defaultDescription: "Routine check",
      schema: {},
    };

    it("should throw 400 if required fields are missing", async () => {
      await expect(
        TaskLibraryService.create({ ...validInput, name: "" } as any),
      ).rejects.toThrow("kind, category and name are required");
    });

    it("should throw 400 if MEDICATION kind is missing medicationFields", async () => {
      const input = {
        ...validInput,
        kind: "MEDICATION" as TaskKind,
        schema: {},
      };
      await expect(TaskLibraryService.create(input)).rejects.toThrow(
        "medicationFields required for MEDICATION task",
      );
    });

    it("should throw 400 if OBSERVATION_TOOL kind is not set to true", async () => {
      const input = {
        ...validInput,
        kind: "OBSERVATION_TOOL" as TaskKind,
        schema: { requiresObservationTool: false },
      };
      await expect(TaskLibraryService.create(input)).rejects.toThrow(
        "requiresObservationTool must be true for OBSERVATION_TOOL task",
      );
    });

    it("should throw 400 if CUSTOM recurrence is missing cronExpression", async () => {
      const input = {
        ...validInput,
        schema: {
          recurrence: {
            default: { type: "CUSTOM", editable: true },
          },
        } as any,
      };
      await expect(TaskLibraryService.create(input)).rejects.toThrow(
        "cronExpression required for CUSTOM recurrence",
      );
    });

    it("should throw 400 if kind is invalid", async () => {
      await expect(
        TaskLibraryService.create({
          ...validInput,
          kind: "UNKNOWN" as TaskKind,
        }),
      ).rejects.toThrow("Invalid kind");
    });

    it("should throw 400 if name has invalid characters", async () => {
      await expect(
        TaskLibraryService.create({
          ...validInput,
          name: "Bad.Name$",
        }),
      ).rejects.toThrow("name contains invalid characters");
    });

    it("should throw 409 if task definition already exists", async () => {
      // Mock findOne to return an existing document
      (TaskLibraryDefinitionModel.findOne as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: "existing-id" }),
      });

      await expect(TaskLibraryService.create(validInput)).rejects.toThrow(
        "Task definition with same name and kind already exists",
      );
      expect(TaskLibraryDefinitionModel.findOne).toHaveBeenCalledWith({
        source: "YC_LIBRARY",
        name: validInput.name,
        kind: validInput.kind,
      });
    });

    it("should create a new task library definition successfully", async () => {
      // Mock findOne to return null (does not exist)
      (TaskLibraryDefinitionModel.findOne as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      // Mock create
      (TaskLibraryDefinitionModel.create as jest.Mock).mockResolvedValue({
        _id: "new-id",
        ...validInput,
      });

      const result = await TaskLibraryService.create(validInput);

      expect(result).toHaveProperty("_id", "new-id");
      expect(TaskLibraryDefinitionModel.create).toHaveBeenCalledWith({
        source: "YC_LIBRARY",
        kind: validInput.kind,
        category: validInput.category,
        name: validInput.name,
        defaultDescription: validInput.defaultDescription,
        applicableSpecies: undefined,
        schema: {
          medicationFields: {}, // Default empty object
          requiresObservationTool: false, // Default false
          recurrence: undefined,
        },
        isActive: true,
      });
    });

    it("should pass through explicit schema values", async () => {
      (TaskLibraryDefinitionModel.findOne as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      const complexInput = {
        ...validInput,
        schema: {
          medicationFields: { hasDosage: true },
          requiresObservationTool: true,
          recurrence: { default: { type: "DAILY" } },
        } as any,
      };

      await TaskLibraryService.create(complexInput);

      expect(TaskLibraryDefinitionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          schema: {
            medicationFields: { hasDosage: true },
            requiresObservationTool: true,
            recurrence: { default: { type: "DAILY" } },
          },
        }),
      );
    });

    it("creates using prisma when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (TaskLibraryDefinitionModel.findOne as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });
      (prisma.taskLibraryDefinition.create as jest.Mock).mockResolvedValue({
        id: "pg-1",
      });

      const result = await TaskLibraryService.create(validInput);

      expect(prisma.taskLibraryDefinition.create).toHaveBeenCalled();
      expect(result).toEqual({ id: "pg-1" });
    });

    it("handles dual-write errors during mongo create", async () => {
      (TaskLibraryDefinitionModel.findOne as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });
      (TaskLibraryDefinitionModel.create as jest.Mock).mockResolvedValue({
        _id: new Types.ObjectId(),
        source: "YC_LIBRARY",
        kind: validInput.kind,
        category: validInput.category,
        name: validInput.name,
        schema: {},
        toObject: jest.fn().mockReturnValue({
          _id: { toString: () => "mongo-1" },
          source: "YC_LIBRARY",
          kind: validInput.kind,
          category: validInput.category,
          name: validInput.name,
          schema: {},
          applicableSpecies: [],
          isActive: true,
        }),
      });
      (prisma.taskLibraryDefinition.upsert as jest.Mock).mockRejectedValue(
        new Error("sync fail"),
      );

      await TaskLibraryService.create(validInput);

      expect(handleDualWriteError).toHaveBeenCalledWith(
        "TaskLibraryDefinition",
        expect.any(Error),
      );
    });
  });

  describe("listActive", () => {
    it("should list all active tasks", async () => {
      const mockExec = jest.fn().mockResolvedValue(["task1", "task2"]);
      const mockSort = jest.fn().mockReturnValue({ exec: mockExec });
      (TaskLibraryDefinitionModel.find as jest.Mock).mockReturnValue({
        sort: mockSort,
      });

      const result = await TaskLibraryService.listActive();

      expect(TaskLibraryDefinitionModel.find).toHaveBeenCalledWith({
        isActive: true,
      });
      expect(mockSort).toHaveBeenCalledWith({ category: 1, name: 1 });
      expect(result).toEqual(["task1", "task2"]);
    });

    it("should list active tasks filtered by kind", async () => {
      const mockExec = jest.fn().mockResolvedValue(["task1"]);
      const mockSort = jest.fn().mockReturnValue({ exec: mockExec });
      (TaskLibraryDefinitionModel.find as jest.Mock).mockReturnValue({
        sort: mockSort,
      });

      await TaskLibraryService.listActive("MEDICATION" as TaskKind);

      expect(TaskLibraryDefinitionModel.find).toHaveBeenCalledWith({
        isActive: true,
        kind: "MEDICATION",
      });
    });

    it("should throw for invalid kind", async () => {
      await expect(
        TaskLibraryService.listActive("BAD" as TaskKind),
      ).rejects.toThrow("Invalid kind");
    });

    it("uses prisma when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.taskLibraryDefinition.findMany as jest.Mock).mockResolvedValue([
        { id: "pg-1" },
      ]);

      const result = await TaskLibraryService.listActive("HYGIENE" as TaskKind);

      expect(prisma.taskLibraryDefinition.findMany).toHaveBeenCalledWith({
        where: { isActive: true, kind: "HYGIENE" },
        orderBy: [{ category: "asc" }, { name: "asc" }],
      });
      expect(result).toEqual([{ id: "pg-1" }]);
    });
  });

  describe("getById", () => {
    it("should return the document if found", async () => {
      const mockExec = jest.fn().mockResolvedValue({ _id: validId });
      (TaskLibraryDefinitionModel.findById as jest.Mock).mockReturnValue({
        exec: mockExec,
      });

      const result = await TaskLibraryService.getById(validId);
      expect(result).toEqual({ _id: validId });
    });

    it("should throw 404 if not found", async () => {
      const mockExec = jest.fn().mockResolvedValue(null);
      (TaskLibraryDefinitionModel.findById as jest.Mock).mockReturnValue({
        exec: mockExec,
      });

      await expect(TaskLibraryService.getById(validId)).rejects.toThrow(
        "Library task not found",
      );
    });

    it("should throw 400 for invalid id in mongo mode", async () => {
      await expect(TaskLibraryService.getById("bad-id")).rejects.toThrow(
        "Invalid id",
      );
    });

    it("uses prisma when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.taskLibraryDefinition.findFirst as jest.Mock).mockResolvedValue({
        id: "pg-1",
      });

      const result = await TaskLibraryService.getById("pg-1");

      expect(result).toEqual({ id: "pg-1" });
    });
  });

  describe("listForSpecies", () => {
    it("throws for invalid species", async () => {
      await expect(
        TaskLibraryService.listForSpecies({ species: "parrot" }),
      ).rejects.toThrow("Invalid species");
    });

    it("lists for species in mongo", async () => {
      const mockExec = jest.fn().mockResolvedValue(["task"]);
      const mockSort = jest.fn().mockReturnValue({ exec: mockExec });
      (TaskLibraryDefinitionModel.find as jest.Mock).mockReturnValue({
        sort: mockSort,
      });

      const result = await TaskLibraryService.listForSpecies({
        species: "dog",
        kind: "MEDICATION" as TaskKind,
      });

      expect(TaskLibraryDefinitionModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: true,
          kind: "MEDICATION",
        }),
      );
      expect(result).toEqual(["task"]);
    });

    it("uses prisma for species list when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.taskLibraryDefinition.findMany as jest.Mock).mockResolvedValue([
        { id: "pg-1" },
      ]);

      const result = await TaskLibraryService.listForSpecies({
        species: "cat",
      });

      expect(prisma.taskLibraryDefinition.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          OR: [
            { applicableSpecies: { has: "cat" } },
            { applicableSpecies: { isEmpty: true } },
          ],
        },
        orderBy: [{ category: "asc" }, { name: "asc" }],
      });
      expect(result).toEqual([{ id: "pg-1" }]);
    });
  });

  describe("update", () => {
    it("should throw 404 if task not found", async () => {
      (TaskLibraryDefinitionModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(TaskLibraryService.getById(validId)).rejects.toBeInstanceOf(
        TaskLibraryServiceError,
      );
    });

    it("updates fields in mongo and syncs to postgres", async () => {
      const doc = {
        _id: validId,
        category: "Old",
        name: "Old Name",
        defaultDescription: "Old",
        applicableSpecies: ["dog"],
        schema: {},
        isActive: true,
        set: jest.fn(),
        markModified: jest.fn(),
        save: jest.fn().mockResolvedValue(undefined),
        toObject: jest.fn().mockReturnValue({
          _id: { toString: () => validId },
          source: "YC_LIBRARY",
          kind: "HYGIENE",
          category: "New",
          name: "New Name",
          schema: {},
          applicableSpecies: [],
          isActive: false,
        }),
      };
      (TaskLibraryDefinitionModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(doc),
      });

      const result = await TaskLibraryService.update(validId, {
        category: "New",
        name: "New Name",
        defaultDescription: undefined,
        applicableSpecies: undefined,
        schema: { medicationFields: { hasDosage: true } },
        isActive: false,
      });

      expect(doc.save).toHaveBeenCalled();
      expect(prisma.taskLibraryDefinition.upsert).toHaveBeenCalled();
      expect(result).toBe(doc);
    });

    it("uses prisma update when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.taskLibraryDefinition.findFirst as jest.Mock).mockResolvedValue({
        id: "pg-1",
        category: "Health",
        name: "Checkup",
        defaultDescription: null,
        applicableSpecies: [],
        schema: {},
        isActive: true,
      });
      (prisma.taskLibraryDefinition.update as jest.Mock).mockResolvedValue({
        id: "pg-1",
        name: "Updated",
      });

      const result = await TaskLibraryService.update("pg-1", {
        name: "Updated",
      });

      expect(prisma.taskLibraryDefinition.update).toHaveBeenCalled();
      expect(result).toEqual({ id: "pg-1", name: "Updated" });
    });

    it("throws if name has invalid characters on update", async () => {
      (TaskLibraryDefinitionModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: validId,
          save: jest.fn(),
        }),
      });

      await expect(
        TaskLibraryService.update(validId, { name: "Bad$Name" }),
      ).rejects.toThrow("name contains invalid characters");
    });
  });
});
