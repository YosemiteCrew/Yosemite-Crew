import TaskTemplateModel from "../../src/models/taskTemplate";
import {
  TaskTemplateService,
  TaskTemplateServiceError,
} from "../../src/services/taskTemplate.service";
import { prisma } from "src/config/prisma";
import { handleDualWriteError } from "src/utils/dual-write";

type MockedTaskTemplateModel = {
  create: jest.Mock;
  findById: jest.Mock;
  find: jest.Mock;
};

jest.mock("../../src/models/taskTemplate", () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
  },
}));

jest.mock("src/config/prisma", () => ({
  prisma: {
    taskTemplate: {
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

const mockedModel = TaskTemplateModel as unknown as MockedTaskTemplateModel;

describe("TaskTemplateService", () => {
  const organisationId = "507f1f77bcf86cd799439031";
  const templateId = "507f1f77bcf86cd799439032";
  const otherTemplateId = "507f1f77bcf86cd799439033";
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.READ_FROM_POSTGRES = "false";
  });

  describe("create", () => {
    it("creates template with defaults", async () => {
      const doc = { _id: templateId };
      mockedModel.create.mockResolvedValueOnce(doc);

      const result = await TaskTemplateService.create({
        organisationId,
        category: "Care",
        name: "Template",
        kind: "CUSTOM",
        defaultRole: "EMPLOYEE_TASK",
        createdBy: "creator-1",
      });

      expect(mockedModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          source: "ORG_TEMPLATE",
          organisationId,
          isActive: true,
          createdBy: "creator-1",
        }),
      );
      expect(result).toBe(doc);
    });

    it("uses prisma when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.taskTemplate.create as jest.Mock).mockResolvedValue({
        id: "pg-1",
      });

      const result = await TaskTemplateService.create({
        organisationId,
        category: "Care",
        name: "Template",
        kind: "CUSTOM",
        defaultRole: "EMPLOYEE_TASK",
        createdBy: "creator-1",
      });

      expect(prisma.taskTemplate.create).toHaveBeenCalled();
      expect(result).toEqual({ id: "pg-1" });
    });

    it("handles dual-write errors", async () => {
      mockedModel.create.mockResolvedValueOnce({
        _id: { toString: () => "mongo-1" },
        organisationId,
        category: "Care",
        name: "Template",
        kind: "CUSTOM",
        defaultRole: "EMPLOYEE_TASK",
        createdBy: "creator-1",
        toObject: jest.fn().mockReturnValue({
          _id: { toString: () => "mongo-1" },
          source: "ORG_TEMPLATE",
          organisationId,
          category: "Care",
          name: "Template",
          kind: "CUSTOM",
          defaultRole: "EMPLOYEE_TASK",
          createdBy: "creator-1",
          isActive: true,
        }),
      });
      (prisma.taskTemplate.upsert as jest.Mock).mockRejectedValue(
        new Error("sync fail"),
      );

      await TaskTemplateService.create({
        organisationId,
        category: "Care",
        name: "Template",
        kind: "CUSTOM",
        defaultRole: "EMPLOYEE_TASK",
        createdBy: "creator-1",
      });

      expect(handleDualWriteError).toHaveBeenCalledWith(
        "TaskTemplate",
        expect.any(Error),
      );
    });
  });

  describe("update", () => {
    it("throws when not found", async () => {
      mockedModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        TaskTemplateService.update(otherTemplateId, { name: "New" }),
      ).rejects.toBeInstanceOf(TaskTemplateServiceError);
    });

    it("applies updates and saves", async () => {
      const save = jest.fn().mockResolvedValue(undefined);
      const doc = {
        category: "Old",
        name: "Old",
        description: "Old",
        defaultRole: "EMPLOYEE",
        defaultMedication: { name: "Old" },
        defaultObservationToolId: "obs-1",
        defaultRecurrence: { type: "ONCE" },
        defaultReminderOffsetMinutes: 10,
        isActive: true,
        save,
      };
      mockedModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(doc),
      });

      await TaskTemplateService.update(templateId, {
        category: "New",
        name: "New name",
        description: "New desc",
        defaultRole: "PARENT",
        defaultMedication: null,
        defaultObservationToolId: null,
        defaultRecurrence: null,
        defaultReminderOffsetMinutes: null,
        isActive: false,
      });

      expect(doc.category).toBe("New");
      expect(doc.name).toBe("New name");
      expect(doc.description).toBe("New desc");
      expect(doc.defaultRole).toBe("PARENT");
      expect(doc.defaultMedication).toEqual({});
      expect(doc.defaultObservationToolId).toBeUndefined();
      expect(doc.defaultRecurrence).toBeUndefined();
      expect(doc.defaultReminderOffsetMinutes).toBeUndefined();
      expect(doc.isActive).toBe(false);
      expect(save).toHaveBeenCalled();
    });

    it("uses prisma when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.taskTemplate.findFirst as jest.Mock).mockResolvedValue({
        id: "pg-1",
        category: "Old",
        name: "Old",
        description: null,
        kind: "CUSTOM",
        defaultRole: "EMPLOYEE_TASK",
        defaultMedication: null,
        defaultObservationToolId: null,
        defaultRecurrence: null,
        defaultReminderOffsetMinutes: null,
        isActive: true,
      });
      (prisma.taskTemplate.update as jest.Mock).mockResolvedValue({
        id: "pg-1",
        name: "New",
      });

      const result = await TaskTemplateService.update("pg-1", {
        name: "New",
        defaultRole: "PARENT",
      });

      expect(prisma.taskTemplate.update).toHaveBeenCalled();
      expect(result).toEqual({ id: "pg-1", name: "New" });
    });

    it("throws for invalid id", async () => {
      await expect(
        TaskTemplateService.update("bad-id", { name: "New" }),
      ).rejects.toThrow("Invalid id");
    });
  });

  describe("archive", () => {
    it("marks document inactive", async () => {
      const save = jest.fn().mockResolvedValue(undefined);
      const doc = { isActive: true, save };
      mockedModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(doc),
      });

      await TaskTemplateService.archive(otherTemplateId);

      expect(doc.isActive).toBe(false);
      expect(save).toHaveBeenCalled();
    });

    it("uses prisma when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.taskTemplate.findFirst as jest.Mock).mockResolvedValue({
        id: "pg-1",
      });

      await TaskTemplateService.archive("pg-1");

      expect(prisma.taskTemplate.update).toHaveBeenCalledWith({
        where: { id: "pg-1" },
        data: { isActive: false },
      });
    });
  });

  describe("listForOrganisation", () => {
    it("filters by organisation and kind", async () => {
      const sort = jest.fn().mockReturnThis();
      const exec = jest.fn().mockResolvedValue([{ _id: "tmpl-3" }]);
      mockedModel.find.mockReturnValueOnce({ sort, exec } as any);

      const result = await TaskTemplateService.listForOrganisation(
        organisationId,
        "MEDICATION",
      );

      expect(mockedModel.find).toHaveBeenCalledWith({
        organisationId,
        isActive: true,
        kind: "MEDICATION",
      });
      expect(sort).toHaveBeenCalledWith({ category: 1, name: 1 });
      expect(result).toEqual([{ _id: "tmpl-3" }]);
    });

    it("throws for invalid kind", async () => {
      await expect(
        TaskTemplateService.listForOrganisation(organisationId, "BAD" as any),
      ).rejects.toThrow("Invalid kind");
    });

    it("uses prisma when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.taskTemplate.findMany as jest.Mock).mockResolvedValue([
        { id: "pg-1" },
      ]);

      const result = await TaskTemplateService.listForOrganisation(
        organisationId,
        "CUSTOM",
      );

      expect(prisma.taskTemplate.findMany).toHaveBeenCalledWith({
        where: { organisationId, isActive: true, kind: "CUSTOM" },
        orderBy: [{ category: "asc" }, { name: "asc" }],
      });
      expect(result).toEqual([{ id: "pg-1" }]);
    });
  });

  describe("getById", () => {
    it("throws when not found", async () => {
      mockedModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        TaskTemplateService.getById(otherTemplateId),
      ).rejects.toBeInstanceOf(TaskTemplateServiceError);
    });

    it("uses prisma when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.taskTemplate.findFirst as jest.Mock).mockResolvedValue({
        id: "pg-1",
      });

      const result = await TaskTemplateService.getById("pg-1");
      expect(result).toEqual({ id: "pg-1" });
    });
  });
});
