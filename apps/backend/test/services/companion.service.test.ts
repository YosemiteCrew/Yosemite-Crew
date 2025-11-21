import { Types } from "mongoose";
import CompanionModel from "../../src/models/companion";
import { CompanionService, CompanionServiceError } from "../../src/services/companion.service";
import { ParentService } from "../../src/services/parent.service";
import {
  ParentCompanionService,
  ParentCompanionServiceError,
} from "../../src/services/parent-companion.service";
import { buildS3Key, moveFile } from "src/middlewares/upload";
import {
  fromCompanionRequestDTO,
  toCompanionResponseDTO,
} from "@yosemite-crew/types";

jest.mock("../../src/models/companion", () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    deleteOne: jest.fn(),
  },
}));

jest.mock("../../src/services/parent.service", () => ({
  ParentService: {
    findByLinkedUserId: jest.fn(),
  },
}));

jest.mock("../../src/services/parent-companion.service", () => ({
  ParentCompanionService: {
    linkParent: jest.fn(),
    getActiveCompanionIdsForParent: jest.fn(),
    ensurePrimaryOwnership: jest.fn(),
    deleteLinksForCompanion: jest.fn(),
  },
  ParentCompanionServiceError: class extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

jest.mock("src/middlewares/upload", () => ({
  buildS3Key: jest.fn(),
  moveFile: jest.fn(),
}));

jest.mock("@yosemite-crew/types", () => {
  const companion = {
    name: "Buddy",
    type: "DOG",
    breed: "Beagle",
    dateOfBirth: "2020-01-01",
    gender: "MALE",
    photoUrl: undefined,
    currentWeight: 10,
    colour: "Brown",
    allergy: "",
    bloodGroup: "",
    isneutered: false,
    ageWhenNeutered: undefined,
    microchipNumber: "",
    passportNumber: "",
    isInsured: false,
    insurance: null,
    countryOfOrigin: "USA",
    source: "mobile",
    status: "ACTIVE",
    physicalAttribute: undefined,
    breedingInfo: undefined,
    medicalRecords: undefined,
  };

  return {
    __esModule: true,
    fromCompanionRequestDTO: jest.fn().mockReturnValue(companion),
    toCompanionResponseDTO: jest
      .fn()
      .mockImplementation((value: any) => ({ ...value })),
  };
});

const mockedCompanionModel = CompanionModel as unknown as {
  create: jest.Mock;
  findById: jest.Mock;
  find: jest.Mock;
  findByIdAndUpdate: jest.Mock;
  deleteOne: jest.Mock;
};

const mockedParentService = ParentService as unknown as {
  findByLinkedUserId: jest.Mock;
};

const mockedParentCompanionService = ParentCompanionService as unknown as {
  linkParent: jest.Mock;
  getActiveCompanionIdsForParent: jest.Mock;
  ensurePrimaryOwnership: jest.Mock;
  deleteLinksForCompanion: jest.Mock;
};

const mockedUpload = {
  buildS3Key: buildS3Key as jest.Mock,
  moveFile: moveFile as jest.Mock,
};

const mockedTypes = {
  fromCompanionRequestDTO: fromCompanionRequestDTO as jest.Mock,
  toCompanionResponseDTO: toCompanionResponseDTO as jest.Mock,
};

const makeDoc = (data: Record<string, unknown> = {}) => {
  const _id = new Types.ObjectId();
  return {
    _id,
    toObject: () => ({
      _id,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    save: jest.fn(),
  };
};

describe("CompanionService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    const payload = { resourceType: "Patient" } as any;

    it("requires context", async () => {
      await expect(
        CompanionService.create(payload, undefined),
      ).rejects.toThrow("Parent context is required to create a companion.");
    });

    it("creates companion for authenticated user and links parent", async () => {
      const parentId = new Types.ObjectId();
      mockedParentService.findByLinkedUserId.mockResolvedValueOnce({
        _id: parentId,
      });

      mockedCompanionModel.create.mockImplementation(async (data) =>
        makeDoc(data),
      );

      mockedParentCompanionService.linkParent.mockResolvedValueOnce(undefined);

      const result = await CompanionService.create(payload, {
        authUserId: "user-1",
      });

      expect(mockedParentService.findByLinkedUserId).toHaveBeenCalledWith(
        "user-1",
      );
      expect(mockedCompanionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Buddy",
          isProfileComplete: true,
        }),
      );
      expect(mockedParentCompanionService.linkParent).toHaveBeenCalledWith({
        parentId,
        companionId: expect.any(Types.ObjectId),
        role: "PRIMARY",
      });
      expect(result.response.name).toBe("Buddy");
      expect(mockedTypes.toCompanionResponseDTO).toHaveBeenCalled();
    });

    it("rolls back creation when linking fails", async () => {
      mockedParentService.findByLinkedUserId.mockResolvedValueOnce({
        _id: new Types.ObjectId(),
      });

      mockedCompanionModel.create.mockResolvedValueOnce(makeDoc());
      mockedParentCompanionService.linkParent.mockRejectedValueOnce(
        new ParentCompanionServiceError("link failed", 500),
      );

      await expect(
        CompanionService.create(payload, { authUserId: "user-2" }),
      ).rejects.toThrow("link failed");

      expect(mockedCompanionModel.deleteOne).toHaveBeenCalledTimes(1);
    });
  });

  describe("listByParent", () => {
    it("throws on invalid parent id", async () => {
      await expect(CompanionService.listByParent("bad")).rejects.toThrow(
        "Invalid Parent Document Id",
      );
    });

    it("returns empty when no links exist", async () => {
      mockedParentCompanionService.getActiveCompanionIdsForParent.mockResolvedValueOnce(
        [],
      );

      const result = await CompanionService.listByParent(
        new Types.ObjectId().toHexString(),
      );

      expect(result.responses).toEqual([]);
    });

    it("returns mapped companions", async () => {
      const id = new Types.ObjectId();
      mockedParentCompanionService.getActiveCompanionIdsForParent.mockResolvedValueOnce(
        [id],
      );
      mockedCompanionModel.find.mockResolvedValueOnce([makeDoc({ name: "Buddy" })]);

      const result = await CompanionService.listByParent(
        new Types.ObjectId().toHexString(),
      );

      expect(result.responses[0].name).toBe("Buddy");
      expect(mockedCompanionModel.find).toHaveBeenCalled();
    });
  });

  describe("getById", () => {
    it("returns null for invalid id", async () => {
      const result = await CompanionService.getById("bad");
      expect(result).toBeNull();
    });

    it("returns mapped response when found", async () => {
      mockedCompanionModel.findById.mockResolvedValueOnce(
        makeDoc({ name: "Buddy" }),
      );

      const result = await CompanionService.getById(
        new Types.ObjectId().toHexString(),
      );

      expect(result?.response.name).toBe("Buddy");
    });
  });

  describe("getByName", () => {
    it("throws when name missing", async () => {
      // @ts-expect-error testing invalid input
      await expect(CompanionService.getByName(undefined)).rejects.toThrow(
        "Name is required for searching.",
      );
    });

    it("maps results", async () => {
      mockedCompanionModel.find.mockResolvedValueOnce([
        makeDoc({ name: "Buddy" }),
      ]);

      const result = await CompanionService.getByName("bud");

      expect(result.responses[0].name).toBe("Buddy");
      expect(mockedCompanionModel.find).toHaveBeenCalled();
    });
  });

  describe("update", () => {
    const payload = { resourceType: "Patient" } as any;

    it("returns null when id is invalid", async () => {
      const result = await CompanionService.update("bad", payload);
      expect(result).toBeNull();
    });

    it("updates and maps companion", async () => {
      mockedCompanionModel.findByIdAndUpdate.mockResolvedValueOnce(
        makeDoc({ name: "New Name" }),
      );

      const result = await CompanionService.update(
        new Types.ObjectId().toHexString(),
        payload,
      );

      expect(result?.response.name).toBe("New Name");
      expect(mockedCompanionModel.findByIdAndUpdate).toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("throws on invalid id", async () => {
      await expect(CompanionService.delete("bad")).rejects.toThrow(
        "Invalid companion identifier.",
      );
    });

    it("requires authenticated user", async () => {
      const id = new Types.ObjectId().toHexString();
      await expect(CompanionService.delete(id)).rejects.toThrow(
        "Authenticated user is required to delete a companion.",
      );
    });

    it("throws when parent not found", async () => {
      mockedParentService.findByLinkedUserId.mockResolvedValueOnce(null);
      const id = new Types.ObjectId().toHexString();

      await expect(
        CompanionService.delete(id, { authUserId: "user-3" }),
      ).rejects.toThrow("Parent record not found for authenticated user.");
    });

    it("deletes companion and links when authorized", async () => {
      const parentId = new Types.ObjectId();
      const companionId = new Types.ObjectId();

      mockedParentService.findByLinkedUserId.mockResolvedValueOnce({
        _id: parentId,
      });
      mockedCompanionModel.findById.mockResolvedValueOnce({ _id: companionId });
      mockedParentCompanionService.ensurePrimaryOwnership.mockResolvedValueOnce(
        undefined,
      );
      mockedParentCompanionService.deleteLinksForCompanion.mockResolvedValueOnce(
        undefined,
      );
      mockedCompanionModel.deleteOne.mockResolvedValueOnce(undefined);

      await CompanionService.delete(companionId.toHexString(), {
        authUserId: "user-4",
      });

      expect(
        mockedParentCompanionService.ensurePrimaryOwnership,
      ).toHaveBeenCalledWith(parentId, companionId);
      expect(
        mockedParentCompanionService.deleteLinksForCompanion,
      ).toHaveBeenCalledWith(companionId);
      expect(mockedCompanionModel.deleteOne).toHaveBeenCalledWith({
        _id: companionId,
      });
    });
  });
});
