import {
  ObservationToolDefinitionService,
  ObservationToolDefinitionServiceError,
} from "../../src/services/observationToolDefinition.service";
import { prisma } from "src/config/prisma";

jest.mock("src/config/prisma", () => ({
  prisma: {
    observationToolDefinition: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe("ObservationToolDefinitionService", () => {
  const validId = "tool-1";

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
      (prisma.observationToolDefinition.create as jest.Mock).mockResolvedValue(
        doc,
      );

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

      expect(prisma.observationToolDefinition.create).toHaveBeenCalledWith({
        data: {
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
        },
      });
      expect(result).toBe(doc);
    });
  });

  describe("update", () => {
    it("throws when tool is missing", async () => {
      (
        prisma.observationToolDefinition.findFirst as jest.Mock
      ).mockResolvedValue(null);

      await expect(
        ObservationToolDefinitionService.update(validId, {
          name: "New",
        }),
      ).rejects.toBeInstanceOf(ObservationToolDefinitionServiceError);
    });

    it("updates definition fields", async () => {
      (
        prisma.observationToolDefinition.findFirst as jest.Mock
      ).mockResolvedValue({
        id: validId,
        name: "Old",
        description: "Old",
        category: "Old",
        fields: [],
        scoringRules: null,
        isActive: true,
      });
      const updatedDoc = { id: validId, name: "New" };
      (prisma.observationToolDefinition.update as jest.Mock).mockResolvedValue(
        updatedDoc,
      );

      const updated = await ObservationToolDefinitionService.update(validId, {
        name: "New",
        description: "New desc",
        category: "New cat",
        fields: [{ key: "b", label: "B", type: "BOOLEAN", required: false }],
        scoringRules: { sumFields: ["b"] },
        isActive: false,
      });

      expect(prisma.observationToolDefinition.update).toHaveBeenCalledWith({
        where: { id: validId },
        data: {
          name: "New",
          description: "New desc",
          category: "New cat",
          fields: [
            {
              key: "b",
              label: "B",
              type: "BOOLEAN",
              required: false,
              options: undefined,
              scoring: undefined,
            },
          ],
          scoringRules: { sumFields: ["b"] },
          isActive: false,
        },
      });
      expect(updated).toBe(updatedDoc);
    });

    it("throws for invalid id", async () => {
      await expect(
        ObservationToolDefinitionService.update("   ", { name: "New" }),
      ).rejects.toThrow("Invalid id");
    });
  });

  describe("archive", () => {
    it("marks definition inactive", async () => {
      (
        prisma.observationToolDefinition.findFirst as jest.Mock
      ).mockResolvedValue({ id: validId });

      await ObservationToolDefinitionService.archive(validId);

      expect(prisma.observationToolDefinition.update).toHaveBeenCalledWith({
        where: { id: validId },
        data: { isActive: false },
      });
    });

    it("throws when definition is missing", async () => {
      (
        prisma.observationToolDefinition.findFirst as jest.Mock
      ).mockResolvedValue(null);

      await expect(
        ObservationToolDefinitionService.archive(validId),
      ).rejects.toBeInstanceOf(ObservationToolDefinitionServiceError);
    });
  });

  describe("list", () => {
    it("applies filters and sorts results", async () => {
      (
        prisma.observationToolDefinition.findMany as jest.Mock
      ).mockResolvedValue([{ id: "1" }]);

      const result = await ObservationToolDefinitionService.list({
        category: "cat",
        onlyActive: true,
      });

      expect(prisma.observationToolDefinition.findMany).toHaveBeenCalledWith({
        where: { category: "cat", isActive: true },
        orderBy: [{ category: "asc" }, { name: "asc" }],
      });
      expect(result).toEqual([{ id: "1" }]);
    });

    it("throws for invalid category", async () => {
      await expect(
        ObservationToolDefinitionService.list({ category: "   " }),
      ).rejects.toThrow("Invalid category");
    });
  });

  describe("getById", () => {
    it("returns definition when found", async () => {
      const doc = { id: "1" };
      (
        prisma.observationToolDefinition.findFirst as jest.Mock
      ).mockResolvedValue(doc);

      const result = await ObservationToolDefinitionService.getById(validId);

      expect(result).toBe(doc);
    });

    it("throws when not found", async () => {
      (
        prisma.observationToolDefinition.findFirst as jest.Mock
      ).mockResolvedValue(null);

      await expect(
        ObservationToolDefinitionService.getById(validId),
      ).rejects.toBeInstanceOf(ObservationToolDefinitionServiceError);
    });
  });
});
