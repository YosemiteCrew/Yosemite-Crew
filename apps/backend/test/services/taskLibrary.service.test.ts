import TaskLibraryDefinitionModel from "../../src/models/taskLibraryDefinition";
import {
  TaskLibraryService,
  TaskLibraryServiceError,
} from "../../src/services/taskLibrary.service";

type MockedTaskLibraryDefinitionModel = {
  find: jest.Mock;
  findById: jest.Mock;
};

jest.mock("../../src/models/taskLibraryDefinition", () => ({
  __esModule: true,
  default: {
    find: jest.fn(),
    findById: jest.fn(),
  },
}));

const mockedModel =
  TaskLibraryDefinitionModel as unknown as MockedTaskLibraryDefinitionModel;

describe("TaskLibraryService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("listActive", () => {
    it("filters by kind and sorts", async () => {
      const sort = jest.fn().mockReturnThis();
      const exec = jest.fn().mockResolvedValue([{ _id: "lib-1" }]);
      mockedModel.find.mockReturnValueOnce({ sort, exec } as any);

      const result = await TaskLibraryService.listActive("MEDICATION");

      expect(mockedModel.find).toHaveBeenCalledWith({
        isActive: true,
        kind: "MEDICATION",
      });
      expect(sort).toHaveBeenCalledWith({ category: 1, name: 1 });
      expect(result).toEqual([{ _id: "lib-1" }]);
    });
  });

  describe("getById", () => {
    it("returns document when found", async () => {
      mockedModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({ _id: "lib-2" }),
      });

      const result = await TaskLibraryService.getById("lib-2");

      expect(mockedModel.findById).toHaveBeenCalledWith("lib-2");
      expect(result).toEqual({ _id: "lib-2" });
    });

    it("throws when missing", async () => {
      mockedModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        TaskLibraryService.getById("missing"),
      ).rejects.toBeInstanceOf(TaskLibraryServiceError);
    });
  });
});
