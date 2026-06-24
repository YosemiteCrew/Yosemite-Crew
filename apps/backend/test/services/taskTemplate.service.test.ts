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

    const result = await TaskTemplateService.update("tmpl-1", {
      name: "New",
      defaultRole: "PARENT",
      inpatientOnly: true,
      defaultMedication: null,
      isActive: false,
    });

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

    await TaskTemplateService.archive("tmpl-1");

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

    await expect(TaskTemplateService.getById("tmpl-1")).resolves.toEqual({
      id: "tmpl-1",
    });
  });

  it("throws when a task template is missing", async () => {
    mockedPrisma.taskTemplate.findFirst.mockResolvedValueOnce(null);

    await expect(TaskTemplateService.getById("missing")).rejects.toThrow(
      "Task template not found",
    );
  });
});
