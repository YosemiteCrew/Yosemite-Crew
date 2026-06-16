import { prisma } from "src/config/prisma";
import {
  TaskLibraryService,
  TaskLibraryServiceError,
} from "../../src/services/taskLibrary.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    taskLibraryDefinition: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

const mockedPrisma = prisma as unknown as {
  taskLibraryDefinition: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
};

describe("TaskLibraryService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a library task definition", async () => {
    mockedPrisma.taskLibraryDefinition.findFirst.mockResolvedValueOnce(null);
    mockedPrisma.taskLibraryDefinition.create.mockResolvedValueOnce({
      id: "lib-1",
    });

    const result = await TaskLibraryService.create({
      kind: "CUSTOM",
      category: "Care",
      name: "Hydration",
      schema: {},
    });

    expect(mockedPrisma.taskLibraryDefinition.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: "YC_LIBRARY",
          kind: "CUSTOM",
          isActive: true,
        }),
      }),
    );
    expect(result).toEqual({ id: "lib-1" });
  });

  it("rejects duplicate definitions", async () => {
    mockedPrisma.taskLibraryDefinition.findFirst.mockResolvedValueOnce({
      id: "lib-1",
    });

    await expect(
      TaskLibraryService.create({
        kind: "CUSTOM",
        category: "Care",
        name: "Hydration",
        schema: {},
      }),
    ).rejects.toBeInstanceOf(TaskLibraryServiceError);
  });

  it("lists active definitions", async () => {
    mockedPrisma.taskLibraryDefinition.findMany.mockResolvedValueOnce([
      { id: "lib-1" },
    ]);

    const result = await TaskLibraryService.listActive("CUSTOM");

    expect(mockedPrisma.taskLibraryDefinition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          kind: "CUSTOM",
        }),
      }),
    );
    expect(result).toEqual([{ id: "lib-1" }]);
  });

  it("gets a library definition by id", async () => {
    mockedPrisma.taskLibraryDefinition.findFirst.mockResolvedValueOnce({
      id: "lib-1",
    });

    await expect(TaskLibraryService.getById("lib-1")).resolves.toEqual({
      id: "lib-1",
    });
  });

  it("updates a library definition", async () => {
    mockedPrisma.taskLibraryDefinition.findFirst.mockResolvedValueOnce({
      id: "lib-1",
      category: "Old",
      name: "Old",
      defaultDescription: null,
      applicableSpecies: [],
      schema: {},
      isActive: true,
    });
    mockedPrisma.taskLibraryDefinition.update.mockResolvedValueOnce({
      id: "lib-1",
      name: "New",
    });

    const result = await TaskLibraryService.update("lib-1", {
      name: "New",
      isActive: false,
    });

    expect(mockedPrisma.taskLibraryDefinition.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "lib-1" },
        data: expect.objectContaining({
          name: "New",
          isActive: false,
        }),
      }),
    );
    expect(result).toEqual({ id: "lib-1", name: "New" });
  });

  it("filters species-specific library definitions", async () => {
    mockedPrisma.taskLibraryDefinition.findMany.mockResolvedValueOnce([
      { id: "lib-1" },
    ]);

    const result = await TaskLibraryService.listForSpecies({
      species: "dog",
      kind: "CUSTOM",
    });

    expect(mockedPrisma.taskLibraryDefinition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          kind: "CUSTOM",
        }),
      }),
    );
    expect(result).toEqual([{ id: "lib-1" }]);
  });

  it("throws on invalid species", async () => {
    await expect(
      TaskLibraryService.listForSpecies({ species: "lizard" }),
    ).rejects.toBeInstanceOf(TaskLibraryServiceError);
  });
});
