import { prisma } from "src/config/prisma";
import {
  TaskTemplateService,
  TaskTemplateServiceError,
} from "../../src/services/taskTemplate.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    taskTemplate: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

const mockedPrisma = prisma as unknown as {
  taskTemplate: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
};

describe("TaskTemplateService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a task template", async () => {
    mockedPrisma.taskTemplate.create.mockResolvedValueOnce({
      id: "tmpl-1",
    });

    const result = await TaskTemplateService.create({
      organisationId: "org-1",
      category: "Care",
      name: "Template",
      kind: "CUSTOM",
      defaultRole: "EMPLOYEE",
      createdBy: "creator-1",
    });

    expect(mockedPrisma.taskTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: "ORG_TEMPLATE",
          organisationId: "org-1",
          defaultRole: "EMPLOYEE",
          kind: "CUSTOM",
          inpatientOnly: false,
        }),
      }),
    );
    expect(result).toEqual({ id: "tmpl-1" });
  });

  it("rejects invalid template kind", async () => {
    await expect(
      TaskTemplateService.create({
        organisationId: "org-1",
        category: "Care",
        name: "Template",
        kind: "BAD" as never,
        defaultRole: "EMPLOYEE",
        createdBy: "creator-1",
      }),
    ).rejects.toBeInstanceOf(TaskTemplateServiceError);
  });

  it("accepts expanded task kinds", async () => {
    mockedPrisma.taskTemplate.create.mockResolvedValueOnce({
      id: "tmpl-2",
    });

    await expect(
      TaskTemplateService.create({
        organisationId: "org-1",
        category: "Care",
        name: "Rounds",
        kind: "CARE",
        defaultRole: "EMPLOYEE",
        createdBy: "creator-1",
      }),
    ).resolves.toEqual({ id: "tmpl-2" });
  });

  it("updates a task template", async () => {
    mockedPrisma.taskTemplate.findFirst.mockResolvedValueOnce({
      id: "tmpl-1",
      category: "Old",
      name: "Old",
      description: null,
      defaultRole: "EMPLOYEE",
      defaultMedication: null,
      defaultObservationToolId: null,
      defaultRecurrence: null,
      defaultReminderOffsetMinutes: null,
      isActive: true,
    });
    mockedPrisma.taskTemplate.update.mockResolvedValueOnce({
      id: "tmpl-1",
      name: "New",
    });

    const result = await TaskTemplateService.update(
      "tmpl-1",
      {
        name: "New",
        defaultRole: "PARENT",
        inpatientOnly: true,
        defaultMedication: null,
        isActive: false,
      },
      "org-1",
    );

    expect(mockedPrisma.taskTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tmpl-1" },
        data: expect.objectContaining({
          name: "New",
          defaultRole: "PARENT",
          inpatientOnly: true,
          isActive: false,
        }),
      }),
    );
    expect(result).toEqual({ id: "tmpl-1", name: "New" });
  });

  it("archives a task template", async () => {
    mockedPrisma.taskTemplate.findFirst.mockResolvedValueOnce({ id: "tmpl-1" });

    await TaskTemplateService.archive("tmpl-1", "org-1");

    expect(mockedPrisma.taskTemplate.update).toHaveBeenCalledWith({
      where: { id: "tmpl-1" },
      data: { isActive: false },
    });
  });

  it("lists organisation templates by kind", async () => {
    mockedPrisma.taskTemplate.findMany.mockResolvedValueOnce([
      { id: "tmpl-1" },
    ]);

    const result = await TaskTemplateService.listForOrganisation(
      "org-1",
      "CUSTOM",
      { inpatientOnly: true, search: "care" },
    );

    expect(mockedPrisma.taskTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organisationId: "org-1",
          kind: "CUSTOM",
          isActive: true,
          inpatientOnly: true,
          OR: [
            {
              category: {
                contains: "care",
                mode: "insensitive",
              },
            },
            {
              name: {
                contains: "care",
                mode: "insensitive",
              },
            },
            {
              description: {
                contains: "care",
                mode: "insensitive",
              },
            },
          ],
        }),
      }),
    );
    expect(result).toEqual([{ id: "tmpl-1" }]);
  });

  it("gets a task template by id", async () => {
    mockedPrisma.taskTemplate.findFirst.mockResolvedValueOnce({ id: "tmpl-1" });

    await expect(
      TaskTemplateService.getById("tmpl-1", "org-1"),
    ).resolves.toEqual({
      id: "tmpl-1",
    });
  });

  it("throws when a task template is missing", async () => {
    mockedPrisma.taskTemplate.findFirst.mockResolvedValueOnce(null);

    await expect(
      TaskTemplateService.getById("missing", "org-1"),
    ).rejects.toThrow("Task template not found");
  });
});

describe("TaskTemplateService organisation scope", () => {
  const TEMPLATES = [
    { id: "tmpl-a", organisationId: "org-a", name: "A" },
    { id: "tmpl-b", organisationId: "org-b", name: "B" },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.taskTemplate.findFirst.mockImplementation(
      async ({ where }: { where: Record<string, unknown> }) =>
        TEMPLATES.find((row) =>
          Object.entries(where).every(
            ([key, value]) => (row as Record<string, unknown>)[key] === value,
          ),
        ) ?? null,
    );
    mockedPrisma.taskTemplate.update.mockResolvedValue({ id: "tmpl-a" });
  });

  it("reads, updates and archives a template of the caller's organisation", async () => {
    await expect(
      TaskTemplateService.getById("tmpl-a", "org-a"),
    ).resolves.toMatchObject({ id: "tmpl-a" });
    await TaskTemplateService.update("tmpl-a", { name: "New" }, "org-a");
    await TaskTemplateService.archive("tmpl-a", "org-a");

    expect(mockedPrisma.taskTemplate.update).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["getById", () => TaskTemplateService.getById("tmpl-b", "org-a")],
    [
      "update",
      () => TaskTemplateService.update("tmpl-b", { name: "Taken" }, "org-a"),
    ],
    ["archive", () => TaskTemplateService.archive("tmpl-b", "org-a")],
  ])(
    "%s answers another organisation's template as not found",
    async (_label, run) => {
      const error = await run().catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(TaskTemplateServiceError);
      expect(error).toMatchObject({ statusCode: 404 });
      expect(mockedPrisma.taskTemplate.update).not.toHaveBeenCalled();
    },
  );

  it("refuses a lookup with no organisation", async () => {
    await expect(
      TaskTemplateService.getById("tmpl-a", "  "),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mockedPrisma.taskTemplate.findFirst).not.toHaveBeenCalled();
  });
});
