import {
  ObservationToolDefinitionService,
  ObservationToolDefinitionServiceError,
} from "../../src/services/observationToolDefinition.service";
import { ObservationToolDefinitionModel } from "../../src/models/observationToolDefinition";
import { Types } from "mongoose";
import { prisma } from "src/config/prisma";
import { handleDualWriteError } from "src/utils/dual-write";

jest.mock("../../src/models/observationToolDefinition", () => {
  const actual = jest.requireActual(
    "../../src/models/observationToolDefinition",
  );
  return {
    ...actual,
    ObservationToolDefinitionModel: {
      create: jest.fn(),
      findById: jest.fn(),
      find: jest.fn(),
    },
  };
});

jest.mock("src/config/prisma", () => ({
  prisma: {
    observationToolDefinition: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
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

const mockedModel = ObservationToolDefinitionModel as unknown as {
  create: jest.Mock;
  findById: jest.Mock;
  find: jest.Mock;
};

describe("ObservationToolDefinitionService", () => {
  const validId = new Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.READ_FROM_POSTGRES = "false";
  });

  describe("create", () => {
    it("validates required fields", async () => {
      await expect(
        ObservationToolDefinitionService.create({
          name: "",
          category: "",
          fields: [],
        }),
      ).rejects.toBeInstanceOf(ObservationToolDefinitionServiceError);
    });

    it("persists sanitized definition", async () => {
      const doc = { id: "tool-1" };
      mockedModel.create.mockResolvedValueOnce(doc);

      const result = await ObservationToolDefinitionService.create({
        name: "Tool",
        description: "Desc",
        category: "Cat",
        fields: [
          {
            key: "a",
            label: "A",
            type: "TEXT",
            required: true,
            options: ["x"],
            scoring: { points: 2 },
          },
        ],
        scoringRules: { sumFields: ["a"] },
      });

      expect(mockedModel.create).toHaveBeenCalledWith({
        name: "Tool",
        description: "Desc",
        category: "Cat",
        fields: [
          {
            key: "a",
            label: "A",
            type: "TEXT",
            required: true,
            options: ["x"],
            scoring: { points: 2 },
          },
        ],
        scoringRules: { sumFields: ["a"] },
        isActive: true,
      });
      expect(result).toBe(doc);
    });

    it("uses prisma when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.observationToolDefinition.create as jest.Mock).mockResolvedValue({
        id: "pg-1",
      });

      const result = await ObservationToolDefinitionService.create({
        name: "Tool",
        category: "Cat",
        fields: [{ key: "a", label: "A", type: "TEXT" }],
      });

      expect(prisma.observationToolDefinition.create).toHaveBeenCalled();
      expect(result).toEqual({ id: "pg-1" });
    });

    it("handles dual-write errors", async () => {
      const doc = {
        _id: { toString: () => "mongo-1" },
        name: "Tool",
        description: undefined,
        category: "Cat",
        fields: [],
        isActive: true,
        toObject: jest.fn().mockReturnValue({
          _id: { toString: () => "mongo-1" },
          name: "Tool",
          category: "Cat",
          fields: [],
          isActive: true,
        }),
      };
      mockedModel.create.mockResolvedValueOnce(doc as any);
      (prisma.observationToolDefinition.upsert as jest.Mock).mockRejectedValue(
        new Error("sync fail"),
      );

      await ObservationToolDefinitionService.create({
        name: "Tool",
        category: "Cat",
        fields: [{ key: "a", label: "A", type: "TEXT" }],
      });

      expect(handleDualWriteError).toHaveBeenCalledWith(
        "ObservationToolDefinition",
        expect.any(Error),
      );
    });
  });

  describe("update", () => {
    it("throws when tool is missing", async () => {
      mockedModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        ObservationToolDefinitionService.update(validId, {
          name: "New",
        }),
      ).rejects.toBeInstanceOf(ObservationToolDefinitionServiceError);
    });

    it("updates definition fields", async () => {
      const save = jest.fn();
      const doc: any = {
        name: "Old",
        description: "Old",
        category: "Old",
        fields: [],
        scoringRules: undefined,
        isActive: true,
        save,
      };
      mockedModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(doc),
      });

      const updated = await ObservationToolDefinitionService.update(validId, {
        name: "New",
        description: "New desc",
        category: "New cat",
        fields: [{ key: "b", label: "B", type: "BOOLEAN", required: false }],
        scoringRules: { sumFields: ["b"] },
        isActive: false,
      });

      expect(doc.name).toBe("New");
      expect(doc.description).toBe("New desc");
      expect(doc.category).toBe("New cat");
      expect(doc.fields).toEqual([
        {
          key: "b",
          label: "B",
          type: "BOOLEAN",
          required: false,
          options: undefined,
          scoring: undefined,
        },
      ]);
      expect(doc.scoringRules).toEqual({ sumFields: ["b"] });
      expect(doc.isActive).toBe(false);
      expect(save).toHaveBeenCalled();
      expect(updated).toBe(doc);
    });

    it("uses prisma when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (
        prisma.observationToolDefinition.findFirst as jest.Mock
      ).mockResolvedValue({
        id: "pg-1",
        name: "Old",
        description: null,
        category: "Old",
        fields: [],
        scoringRules: null,
        isActive: true,
      });
      (prisma.observationToolDefinition.update as jest.Mock).mockResolvedValue({
        id: "pg-1",
        name: "New",
      });

      const result = await ObservationToolDefinitionService.update("pg-1", {
        name: "New",
      });

      expect(prisma.observationToolDefinition.update).toHaveBeenCalled();
      expect(result).toEqual({ id: "pg-1", name: "New" });
    });

    it("throws for invalid id", async () => {
      await expect(
        ObservationToolDefinitionService.update("bad-id", { name: "New" }),
      ).rejects.toThrow("Invalid id");
    });
  });

  describe("archive", () => {
    it("marks definition inactive", async () => {
      const save = jest.fn();
      const doc = { isActive: true, save } as any;
      mockedModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(doc),
      });

      await ObservationToolDefinitionService.archive(validId);

      expect(doc.isActive).toBe(false);
      expect(save).toHaveBeenCalled();
    });

    it("throws when definition is missing", async () => {
      mockedModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        ObservationToolDefinitionService.archive(validId),
      ).rejects.toBeInstanceOf(ObservationToolDefinitionServiceError);
    });

    it("uses prisma when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (
        prisma.observationToolDefinition.findFirst as jest.Mock
      ).mockResolvedValue({ id: "pg-1" });

      await ObservationToolDefinitionService.archive("pg-1");

      expect(prisma.observationToolDefinition.update).toHaveBeenCalledWith({
        where: { id: "pg-1" },
        data: { isActive: false },
      });
    });
  });

  describe("list", () => {
    it("applies filters and sorts results", async () => {
      const exec = jest.fn().mockResolvedValueOnce([{ id: "1" }]);
      const sort = jest.fn().mockReturnValue({ exec });
      mockedModel.find.mockReturnValue({ sort } as any);

      const result = await ObservationToolDefinitionService.list({
        category: "cat",
        onlyActive: true,
      });

      expect(mockedModel.find).toHaveBeenCalledWith({
        category: "cat",
        isActive: true,
      });
      expect(sort).toHaveBeenCalledWith({ category: 1, name: 1 });
      expect(result).toEqual([{ id: "1" }]);
    });

    it("throws for invalid category", async () => {
      await expect(
        ObservationToolDefinitionService.list({ category: "   " }),
      ).rejects.toThrow("Invalid category");
    });

    it("uses prisma when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (
        prisma.observationToolDefinition.findMany as jest.Mock
      ).mockResolvedValue([{ id: "pg-1" }]);

      const result = await ObservationToolDefinitionService.list({
        category: "cat",
        onlyActive: true,
      });

      expect(prisma.observationToolDefinition.findMany).toHaveBeenCalledWith({
        where: { category: "cat", isActive: true },
        orderBy: [{ category: "asc" }, { name: "asc" }],
      });
      expect(result).toEqual([{ id: "pg-1" }]);
    });
  });

  describe("getById", () => {
    it("returns definition when found", async () => {
      const doc = { id: "1" };
      mockedModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(doc),
      });

      const result = await ObservationToolDefinitionService.getById(validId);

      expect(result).toBe(doc);
    });

    it("throws when not found", async () => {
      mockedModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        ObservationToolDefinitionService.getById(validId),
      ).rejects.toBeInstanceOf(ObservationToolDefinitionServiceError);
    });

    it("uses prisma when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (
        prisma.observationToolDefinition.findFirst as jest.Mock
      ).mockResolvedValue({ id: "pg-1" });

      const result = await ObservationToolDefinitionService.getById("pg-1");
      expect(result).toEqual({ id: "pg-1" });
    });
  });
});
