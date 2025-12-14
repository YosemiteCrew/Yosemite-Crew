import {
  ObservationToolDefinitionService,
  ObservationToolDefinitionServiceError,
} from "../../src/services/observationToolDefinition.service";
import { ObservationToolDefinitionModel } from "../../src/models/observationToolDefinition";

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

const mockedModel = ObservationToolDefinitionModel as unknown as {
  create: jest.Mock;
  findById: jest.Mock;
  find: jest.Mock;
};

describe("ObservationToolDefinitionService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
  });

  describe("update", () => {
    it("throws when tool is missing", async () => {
      mockedModel.findById.mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(null) });

      await expect(
        ObservationToolDefinitionService.update("missing", {
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

      const updated = await ObservationToolDefinitionService.update("id-1", {
        name: "New",
        description: "New desc",
        category: "New cat",
        fields: [
          { key: "b", label: "B", type: "BOOLEAN", required: false },
        ],
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
  });

  describe("archive", () => {
    it("marks definition inactive", async () => {
      const save = jest.fn();
      const doc = { isActive: true, save } as any;
      mockedModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(doc),
      });

      await ObservationToolDefinitionService.archive("id-1");

      expect(doc.isActive).toBe(false);
      expect(save).toHaveBeenCalled();
    });

    it("throws when definition is missing", async () => {
      mockedModel.findById.mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(null) });

      await expect(
        ObservationToolDefinitionService.archive("missing"),
      ).rejects.toBeInstanceOf(ObservationToolDefinitionServiceError);
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
  });

  describe("getById", () => {
    it("returns definition when found", async () => {
      const doc = { id: "1" };
      mockedModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(doc),
      });

      const result = await ObservationToolDefinitionService.getById("1");

      expect(result).toBe(doc);
    });

    it("throws when not found", async () => {
      mockedModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        ObservationToolDefinitionService.getById("missing"),
      ).rejects.toBeInstanceOf(ObservationToolDefinitionServiceError);
    });
  });
});
