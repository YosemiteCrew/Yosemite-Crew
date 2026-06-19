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

  it("rejects invalid task definition inputs and schema rules", async () => {
    await expect(
      TaskLibraryService.create({
        kind: "CUSTOM",
        category: "Care",
        name: "Hydration.",
        schema: {},
      } as never),
    ).rejects.toMatchObject({
      message: "name contains invalid characters",
      statusCode: 400,
    } satisfies Partial<TaskLibraryServiceError>);

    await expect(
      TaskLibraryService.create({
        kind: "INVALID" as never,
        category: "Care",
        name: "Hydration",
        schema: {},
      } as never),
    ).rejects.toMatchObject({
      message: "Invalid kind",
      statusCode: 400,
    } satisfies Partial<TaskLibraryServiceError>);

    await expect(
      TaskLibraryService.create({
        kind: "MEDICATION",
        category: "Care",
        name: "Medication",
        schema: {},
      } as never),
    ).rejects.toMatchObject({
      message: "medicationFields required for MEDICATION task",
      statusCode: 400,
    } satisfies Partial<TaskLibraryServiceError>);

    await expect(
      TaskLibraryService.create({
        kind: "OBSERVATION_TOOL",
        category: "Care",
        name: "Observation",
        schema: { requiresObservationTool: false },
      } as never),
    ).rejects.toMatchObject({
      message: "requiresObservationTool must be true for OBSERVATION_TOOL task",
      statusCode: 400,
    } satisfies Partial<TaskLibraryServiceError>);

    await expect(
      TaskLibraryService.create({
        kind: "CUSTOM",
        category: "Care",
        name: "Recurring",
        schema: { recurrence: { default: { type: "CUSTOM" } } },
      } as never),
    ).rejects.toMatchObject({
      message: "cronExpression required for CUSTOM recurrence",
      statusCode: 400,
    } satisfies Partial<TaskLibraryServiceError>);
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

  it("rejects invalid list and lookup filters", async () => {
    await expect(
      TaskLibraryService.listActive("INVALID" as never),
    ).rejects.toMatchObject({
      message: "Invalid kind",
      statusCode: 400,
    } satisfies Partial<TaskLibraryServiceError>);

    await expect(TaskLibraryService.getById("   ")).rejects.toMatchObject({
      message: "Invalid id",
      statusCode: 400,
    } satisfies Partial<TaskLibraryServiceError>);

    await expect(
      TaskLibraryService.listForSpecies({
        species: "dog",
        kind: "INVALID" as never,
      }),
    ).rejects.toMatchObject({
      message: "Invalid kind",
      statusCode: 400,
    } satisfies Partial<TaskLibraryServiceError>);
  });

  it("gets a library definition by id", async () => {
    mockedPrisma.taskLibraryDefinition.findFirst.mockResolvedValueOnce({
      id: "lib-1",
    });

    await expect(TaskLibraryService.getById("lib-1")).resolves.toEqual({
      id: "lib-1",
    });
  });

  it("throws when a library definition is missing on lookup or update", async () => {
    mockedPrisma.taskLibraryDefinition.findFirst.mockResolvedValueOnce(null);

    await expect(
      TaskLibraryService.getById("lib-missing"),
    ).rejects.toMatchObject({
      message: "Library task not found",
      statusCode: 404,
    } satisfies Partial<TaskLibraryServiceError>);

    mockedPrisma.taskLibraryDefinition.findFirst.mockResolvedValueOnce(null);

    await expect(
      TaskLibraryService.update("lib-missing", {
        name: "New",
      }),
    ).rejects.toMatchObject({
      message: "Library task not found",
      statusCode: 404,
    } satisfies Partial<TaskLibraryServiceError>);
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
