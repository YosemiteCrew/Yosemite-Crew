import TaskTemplateModel from "../../src/models/taskTemplate";
import {
  TaskTemplateService,
  TaskTemplateServiceError,
} from "../../src/services/taskTemplate.service";

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

const mockedModel =
  TaskTemplateModel as unknown as MockedTaskTemplateModel;

describe("TaskTemplateService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("creates template with defaults", async () => {
      const doc = { _id: "tmpl-1" };
      mockedModel.create.mockResolvedValueOnce(doc);

      const result = await TaskTemplateService.create({
        organisationId: "org-1",
        category: "Care",
        name: "Template",
        kind: "CUSTOM",
        defaultRole: "EMPLOYEE",
        createdBy: "creator-1",
      });

      expect(mockedModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          source: "ORG_TEMPLATE",
          organisationId: "org-1",
          isActive: true,
          createdBy: "creator-1",
        }),
      );
      expect(result).toBe(doc);
    });
  });

  describe("update", () => {
    it("throws when not found", async () => {
      mockedModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        TaskTemplateService.update("missing", { name: "New" }),
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

      await TaskTemplateService.update("tmpl-1", {
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
  });

  describe("archive", () => {
    it("marks document inactive", async () => {
      const save = jest.fn().mockResolvedValue(undefined);
      const doc = { isActive: true, save };
      mockedModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(doc),
      });

      await TaskTemplateService.archive("tmpl-2");

      expect(doc.isActive).toBe(false);
      expect(save).toHaveBeenCalled();
    });
  });

  describe("listForOrganisation", () => {
    it("filters by organisation and kind", async () => {
      const sort = jest.fn().mockReturnThis();
      const exec = jest.fn().mockResolvedValue([{ _id: "tmpl-3" }]);
      mockedModel.find.mockReturnValueOnce({ sort, exec } as any);

      const result = await TaskTemplateService.listForOrganisation(
        "org-1",
        "MEDICATION",
      );

      expect(mockedModel.find).toHaveBeenCalledWith({
        organisationId: "org-1",
        isActive: true,
        kind: "MEDICATION",
      });
      expect(sort).toHaveBeenCalledWith({ category: 1, name: 1 });
      expect(result).toEqual([{ _id: "tmpl-3" }]);
    });
  });

  describe("getById", () => {
    it("throws when not found", async () => {
      mockedModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(TaskTemplateService.getById("missing")).rejects.toBeInstanceOf(
        TaskTemplateServiceError,
      );
    });
  });
});
