import { Types } from "mongoose";
import {
  CompanionService,
  CompanionServiceError,
} from "../../src/services/companion.service";
import CompanionModel from "../../src/models/companion";
import CompanionOrganisationModel from "../../src/models/companion-organisation";
import { ParentService } from "../../src/services/parent.service";
import {
  ParentCompanionService,
  ParentCompanionServiceError,
} from "../../src/services/parent-companion.service";
import * as UploadMiddleware from "../../src/middlewares/upload";
import { fromCompanionRequestDTO } from "@yosemite-crew/types";

// --- Mocks ---
jest.mock("../../src/models/companion");
jest.mock("../../src/models/companion-organisation");
jest.mock("../../src/services/parent.service");
jest.mock("../../src/middlewares/upload");

// Partial Mock for ParentCompanionService to keep the Error class real
jest.mock("../../src/services/parent-companion.service", () => {
  const actual = jest.requireActual(
    "../../src/services/parent-companion.service",
  );
  return {
    ...actual,
    ParentCompanionService: {
      linkParent: jest.fn(),
      getActiveCompanionIdsForParent: jest.fn(),
      ensurePrimaryOwnership: jest.fn(),
      deleteLinksForCompanion: jest.fn(),
    },
  };
});

// Mock DTO mappers
jest.mock("@yosemite-crew/types", () => ({
  fromCompanionRequestDTO: jest.fn(),
  toCompanionResponseDTO: jest.fn((data) => ({
    resourceType: "Companion",
    ...data,
  })),
}));

describe("CompanionService", () => {
  const validObjectId = new Types.ObjectId().toString();
  const validParentId = new Types.ObjectId().toString();
  const validCompanionId = new Types.ObjectId().toString();

  // Base persistable object returned by fromCompanionRequestDTO
  const mockPersistableBase = {
    name: "Buddy",
    type: "DOG",
    breed: "Labrador",
    dateOfBirth: "2020-01-01",
    gender: "MALE",
    status: "ACTIVE",
    photoUrl: null,
    isInsured: false,
    insurance: null,
  };

  // Helper to create a mock Mongoose document
  const createMockDoc = (overrides = {}) => {
    const data = {
      _id: new Types.ObjectId(validCompanionId),
      ...mockPersistableBase,
      ...overrides,
    };
    return {
      ...data,
      toObject: () => ({ ...data, _id: data._id }), // Ensure _id is present in plain obj
      save: jest.fn().mockResolvedValue(true),
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    const payload: any = { resourceType: "Patient", name: [{ text: "Buddy" }] };

    it("should throw if context is missing", async () => {
      await expect(CompanionService.create(payload, undefined)).rejects.toThrow(
        "Parent context is required",
      );
    });

    it("should throw if parent not found for authUserId (Mobile Flow)", async () => {
      (ParentService.findByLinkedUserId as jest.Mock).mockResolvedValue(null);

      await expect(
        CompanionService.create(payload, { authUserId: "user123" }),
      ).rejects.toThrow("Parent record not found");
    });

    it("should throw if parentMongoId cannot be determined", async () => {
      await expect(CompanionService.create(payload, {})).rejects.toThrow(
        "Unable to determine parent",
      );
    });

    it("should successfully create companion and link to parent", async () => {
      (fromCompanionRequestDTO as jest.Mock).mockReturnValue({
        ...mockPersistableBase,
      });
      (ParentService.findByLinkedUserId as jest.Mock).mockResolvedValue({
        _id: validParentId,
      });

      const mockDoc = createMockDoc();
      (CompanionModel.create as jest.Mock).mockResolvedValue(mockDoc);
      (ParentCompanionService.linkParent as jest.Mock).mockResolvedValue(true);

      const result = await CompanionService.create(payload, {
        authUserId: "user123",
      });

      expect(CompanionModel.create).toHaveBeenCalled();
      expect(ParentCompanionService.linkParent).toHaveBeenCalledWith({
        parentId: validParentId,
        companionId: mockDoc._id,
        role: "PRIMARY",
      });
      expect(result.response.name).toBe("Buddy");
    });

    it("should handle photo upload if photoUrl is present", async () => {
      (fromCompanionRequestDTO as jest.Mock).mockReturnValue({
        ...mockPersistableBase,
        photoUrl: "temp/path.jpg",
      });

      const mockDoc = createMockDoc({ photoUrl: "temp/path.jpg" });
      (CompanionModel.create as jest.Mock).mockResolvedValue(mockDoc);

      (UploadMiddleware.buildS3Key as jest.Mock).mockReturnValue("s3-key");
      (UploadMiddleware.moveFile as jest.Mock).mockResolvedValue(
        "https://s3.url/img.jpg",
      );

      await CompanionService.create(payload, {
        parentMongoId: new Types.ObjectId(validParentId),
      });

      expect(UploadMiddleware.moveFile).toHaveBeenCalled();
      expect(mockDoc.photoUrl).toBe("https://s3.url/img.jpg");
      expect(mockDoc.save).toHaveBeenCalled();
    });

    it("should rollback (delete companion) if linking fails", async () => {
      (fromCompanionRequestDTO as jest.Mock).mockReturnValue({
        ...mockPersistableBase,
      });

      const mockDoc = createMockDoc();
      (CompanionModel.create as jest.Mock).mockResolvedValue(mockDoc);

      // Simulate generic error
      (ParentCompanionService.linkParent as jest.Mock).mockRejectedValue(
        new Error("Link Failed"),
      );

      await expect(
        CompanionService.create(payload, {
          parentMongoId: new Types.ObjectId(validParentId),
        }),
      ).rejects.toThrow("Link Failed");

      expect(CompanionModel.deleteOne).toHaveBeenCalledWith({
        _id: mockDoc._id,
      });
    });

    it("should rethrow ParentCompanionServiceError correctly", async () => {
      (fromCompanionRequestDTO as jest.Mock).mockReturnValue({
        ...mockPersistableBase,
      });
      const mockDoc = createMockDoc();
      (CompanionModel.create as jest.Mock).mockResolvedValue(mockDoc);

      // Since we used requireActual, this error will be an instance of the real class
      const pcError = new ParentCompanionServiceError("PC Error", 409);
      (ParentCompanionService.linkParent as jest.Mock).mockRejectedValue(
        pcError,
      );

      await expect(
        CompanionService.create(payload, {
          parentMongoId: new Types.ObjectId(validParentId),
        }),
      ).rejects.toThrow("PC Error");
    });
  });

  describe("listByParent", () => {
    it("should throw if parentId is invalid", async () => {
      await expect(CompanionService.listByParent("invalid")).rejects.toThrow(
        "Invalid Parent Document Id",
      );
    });

    it("should return empty list if parent has no active companions", async () => {
      (
        ParentCompanionService.getActiveCompanionIdsForParent as jest.Mock
      ).mockResolvedValue([]);

      const result = await CompanionService.listByParent(validParentId);
      expect(result.responses).toEqual([]);
    });

    it("should return mapped companions", async () => {
      (
        ParentCompanionService.getActiveCompanionIdsForParent as jest.Mock
      ).mockResolvedValue([validCompanionId]);
      (CompanionModel.find as jest.Mock).mockResolvedValue([createMockDoc()]);

      const result = await CompanionService.listByParent(validParentId);
      expect(result.responses).toHaveLength(1);
      expect(result.responses[0].name).toBe("Buddy");
    });
  });

  describe("listByParentNotInOrganisation", () => {
    const validOrgId = new Types.ObjectId().toString();

    it("should throw if parentId is invalid", async () => {
      await expect(
        CompanionService.listByParentNotInOrganisation("inv", validOrgId),
      ).rejects.toThrow("Invalid Parent Document Id");
    });

    it("should throw if organisationId is invalid", async () => {
      await expect(
        CompanionService.listByParentNotInOrganisation(validParentId, "inv"),
      ).rejects.toThrow("Invalid Organisation Document Id");
    });

    it("should return empty if parent has no active companions", async () => {
      (
        ParentCompanionService.getActiveCompanionIdsForParent as jest.Mock
      ).mockResolvedValue([]);
      const res = await CompanionService.listByParentNotInOrganisation(
        validParentId,
        validOrgId,
      );
      expect(res.responses).toEqual([]);
    });

    it("should filter out companions already linked to the org", async () => {
      const c1 = new Types.ObjectId(); // Linked
      const c2 = new Types.ObjectId(); // Unlinked

      (
        ParentCompanionService.getActiveCompanionIdsForParent as jest.Mock
      ).mockResolvedValue([c1, c2]);

      // Mock finding existing links
      (CompanionOrganisationModel.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ companionId: c1 }]),
      });

      (CompanionModel.find as jest.Mock).mockResolvedValue([
        createMockDoc({ _id: c2, name: "Unlinked" }),
      ]);

      const res = await CompanionService.listByParentNotInOrganisation(
        validParentId,
        validOrgId,
      );

      expect(CompanionModel.find).toHaveBeenCalledWith({ _id: { $in: [c2] } });
      expect(res.responses).toHaveLength(1);
      expect(res.responses[0].name).toBe("Unlinked");
    });

    it("should return empty if all companions are already linked", async () => {
      const c1 = new Types.ObjectId();
      (
        ParentCompanionService.getActiveCompanionIdsForParent as jest.Mock
      ).mockResolvedValue([c1]);
      (CompanionOrganisationModel.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ companionId: c1 }]),
      });

      const res = await CompanionService.listByParentNotInOrganisation(
        validParentId,
        validOrgId,
      );
      expect(res.responses).toEqual([]);
    });
  });

  describe("getById", () => {
    it("should return null if ID is invalid", async () => {
      expect(await CompanionService.getById("invalid")).toBeNull();
    });

    it("should return null if document not found", async () => {
      (CompanionModel.findById as jest.Mock).mockResolvedValue(null);
      expect(await CompanionService.getById(validObjectId)).toBeNull();
    });

    it("should return mapped DTO if found", async () => {
      (CompanionModel.findById as jest.Mock).mockResolvedValue(createMockDoc());
      const res = await CompanionService.getById(validObjectId);
      expect(res?.response.name).toBe("Buddy");
    });
  });

  describe("getByName", () => {
    it("should throw if name is empty", async () => {
      await expect(CompanionService.getByName("")).rejects.toThrow(
        "Name is required",
      );
    });

    it("should return list of matching companions", async () => {
      (CompanionModel.find as jest.Mock).mockResolvedValue([createMockDoc()]);
      const res = await CompanionService.getByName("Buddy");
      expect(res.responses).toHaveLength(1);
    });
  });

  describe("update", () => {
    const payload: any = { resourceType: "Companion" };

    it("should return null if ID is invalid", async () => {
      expect(await CompanionService.update("invalid", payload)).toBeNull();
    });

    it("should update and return doc if found", async () => {
      (fromCompanionRequestDTO as jest.Mock).mockReturnValue({
        ...mockPersistableBase,
        name: "Updated",
      });
      const updatedDoc = createMockDoc({ name: "Updated" });

      (CompanionModel.findByIdAndUpdate as jest.Mock).mockResolvedValue(
        updatedDoc,
      );

      const res = await CompanionService.update(validObjectId, payload);

      expect(res?.response.name).toBe("Updated");
      expect(CompanionModel.findByIdAndUpdate).toHaveBeenCalledWith(
        validObjectId,
        { $set: expect.objectContaining({ name: "Updated" }) },
        expect.anything(),
      );
    });

    it("should return null if document not found during update", async () => {
      (fromCompanionRequestDTO as jest.Mock).mockReturnValue({
        ...mockPersistableBase,
      });
      (CompanionModel.findByIdAndUpdate as jest.Mock).mockResolvedValue(null);
      expect(await CompanionService.update(validObjectId, payload)).toBeNull();
    });
  });

  describe("delete", () => {
    const context = { authUserId: "user123" };

    it("should throw if ID is invalid", async () => {
      await expect(CompanionService.delete("invalid", context)).rejects.toThrow(
        "Invalid companion identifier",
      );
    });

    it("should throw if authUserId is missing (security check)", async () => {
      await expect(CompanionService.delete(validObjectId, {})).rejects.toThrow(
        "Authenticated user is required",
      );
    });

    it("should throw if parent record not found for user", async () => {
      (ParentService.findByLinkedUserId as jest.Mock).mockResolvedValue(null);
      await expect(
        CompanionService.delete(validObjectId, context),
      ).rejects.toThrow("Parent record not found");
    });

    it("should throw if companion not found", async () => {
      (ParentService.findByLinkedUserId as jest.Mock).mockResolvedValue({
        _id: validParentId,
      });
      (CompanionModel.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        CompanionService.delete(validObjectId, context),
      ).rejects.toThrow("Companion not found");
    });

    it("should successfully delete companion and links", async () => {
      (ParentService.findByLinkedUserId as jest.Mock).mockResolvedValue({
        _id: validParentId,
      });
      const mockDoc = createMockDoc();
      (CompanionModel.findById as jest.Mock).mockResolvedValue(mockDoc);
      (
        ParentCompanionService.ensurePrimaryOwnership as jest.Mock
      ).mockResolvedValue(true);

      await CompanionService.delete(validObjectId, context);

      expect(ParentCompanionService.ensurePrimaryOwnership).toHaveBeenCalled();
      expect(
        ParentCompanionService.deleteLinksForCompanion,
      ).toHaveBeenCalledWith(mockDoc._id);
      expect(CompanionModel.deleteOne).toHaveBeenCalledWith({
        _id: mockDoc._id,
      });
    });

    it("should rethrow ParentCompanionServiceError (e.g. ownership check)", async () => {
      (ParentService.findByLinkedUserId as jest.Mock).mockResolvedValue({
        _id: validParentId,
      });
      (CompanionModel.findById as jest.Mock).mockResolvedValue(createMockDoc());

      const error = new ParentCompanionServiceError("Not Owner", 403);
      (
        ParentCompanionService.ensurePrimaryOwnership as jest.Mock
      ).mockRejectedValue(error);

      await expect(
        CompanionService.delete(validObjectId, context),
      ).rejects.toThrow("Not Owner");
    });

    it("should rethrow generic errors", async () => {
      (ParentService.findByLinkedUserId as jest.Mock).mockResolvedValue({
        _id: validParentId,
      });
      (CompanionModel.findById as jest.Mock).mockRejectedValue(
        new Error("DB Error"),
      );

      await expect(
        CompanionService.delete(validObjectId, context),
      ).rejects.toThrow("DB Error");
    });
  });

  describe("Logic: computeIsProfileComplete", () => {
    it("should calculate isProfileComplete = false if required fields missing", async () => {
      const incomplete = {
        ...mockPersistableBase,
        breed: undefined,
        gender: undefined,
      };
      (fromCompanionRequestDTO as jest.Mock).mockReturnValue(incomplete);

      const spy = jest.fn().mockResolvedValue(createMockDoc());
      (CompanionModel.findByIdAndUpdate as jest.Mock).mockImplementation(spy);

      await CompanionService.update(validObjectId, {} as any);

      const updateCall = spy.mock.calls[0];
      const updatePayload = updateCall[1].$set;

      expect(updatePayload.isProfileComplete).toBe(false);
    });

    it("should calculate isProfileComplete = true if all fields present", async () => {
      const complete = {
        ...mockPersistableBase,
        breed: "Mix",
        gender: "MALE",
        status: "ACTIVE",
      };
      (fromCompanionRequestDTO as jest.Mock).mockReturnValue(complete);

      const spy = jest.fn().mockResolvedValue(createMockDoc());
      (CompanionModel.findByIdAndUpdate as jest.Mock).mockImplementation(spy);

      await CompanionService.update(validObjectId, {} as any);

      const updatePayload = spy.mock.calls[0][1].$set;
      expect(updatePayload.isProfileComplete).toBe(true);
    });
  });
});
