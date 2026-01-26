import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { Types } from "mongoose";
import { ParentService } from "../../src/services/parent.service";
import { ParentModel } from "../../src/models/parent";
import { AuthUserMobileService } from "../../src/services/authUserMobile.service";
import * as UploadMiddleware from "../../src/middlewares/upload";

// ----------------------------------------------------------------------
// 1. MOCKS
// ----------------------------------------------------------------------
jest.mock("../../src/models/parent");
jest.mock("../../src/services/authUserMobile.service");
jest.mock("../../src/middlewares/upload");

// Mock DTO mappers to return the data as-is for easier assertion
jest.mock("@yosemite-crew/types", () => ({
  __esModule: true,
  toParentResponseDTO: jest.fn((obj) => obj),
  fromParentRequestDTO: jest.fn((obj) => obj),
}));

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

// Helper to mock mongoose chaining
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockMongooseChain = (resolvedValue: any) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {};
  chain.lean = (jest.fn() as any).mockResolvedValue(resolvedValue);
  chain.exec = (jest.fn() as any).mockResolvedValue(resolvedValue);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chain.then = (resolve: any) => Promise.resolve(resolvedValue).then(resolve);
  return chain;
};

// Helper for Mock Docs
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockDoc = (data: any) => {
  const _id = data._id || new Types.ObjectId();
  const plain = { ...data, _id };
  return {
    ...plain,
    save: (jest.fn() as any).mockResolvedValue(plain),
    toObject: (jest.fn() as any).mockReturnValue(plain),
  };
};

describe("ParentService", () => {
  const parentId = new Types.ObjectId().toString();
  const authUserId = "auth-user-123";
  const mobileId = new Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ======================================================================
  // 1. CREATE
  // ======================================================================
  describe("create", () => {
    // Because we mocked fromParentRequestDTO to be identity, we pass flat props
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baseDto: any = {
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      phoneNumber: "123",
      // DTO fields that would normally be mapped
      telecom: [{ system: "email", value: "john@example.com" }],
    };

    it("should create a parent for mobile user", async () => {
      (
        AuthUserMobileService.getAuthUserMobileIdByProviderId as any
      ).mockResolvedValue(mobileId);
      (ParentModel.findOne as any).mockResolvedValue(null);

      const createdDoc = mockDoc({
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        phoneNumber: "123",
        birthDate: new Date(),
        address: "123 St",
        profileImageUrl: "final-url",
        isProfileComplete: true,
      });

      (ParentModel.create as any).mockResolvedValue(createdDoc);
      (UploadMiddleware.buildS3Key as any).mockReturnValue("key");
      (UploadMiddleware.moveFile as any).mockResolvedValue("final-url");

      const inputDto = { ...baseDto, profileImageUrl: "temp-url" };

      const result = await ParentService.create(inputDto, {
        source: "mobile",
        authUserId,
      });

      expect(
        AuthUserMobileService.getAuthUserMobileIdByProviderId,
      ).toHaveBeenCalledWith(authUserId);
      expect(ParentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: "John",
          linkedUserId: mobileId,
          createdFrom: "mobile",
        }),
      );
      expect(UploadMiddleware.moveFile).toHaveBeenCalledWith("temp-url", "key");
      expect(AuthUserMobileService.linkParent).toHaveBeenCalledWith(
        authUserId,
        createdDoc._id.toString(),
      );
      expect(result.isProfileComplete).toBe(true);
    });

    it("should create a parent for pms (no auth user)", async () => {
      const createdDoc = mockDoc({
        firstName: "John",
        email: "john@example.com",
      });
      (ParentModel.create as any).mockResolvedValue(createdDoc);

      const result = await ParentService.create(baseDto, { source: "pms" });

      expect(ParentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          linkedUserId: null,
          createdFrom: "pms",
        }),
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result.response as any).firstName).toBe("John");
    });

    it("should throw if mobile user missing authUserId", async () => {
      await expect(
        ParentService.create(baseDto, { source: "mobile" }),
      ).rejects.toThrow("Authenticated user ID required");
    });

    it("should throw if parent already exists for user", async () => {
      (
        AuthUserMobileService.getAuthUserMobileIdByProviderId as any
      ).mockResolvedValue(mobileId);
      (ParentModel.findOne as any).mockResolvedValue({ _id: "exists" });

      await expect(
        ParentService.create(baseDto, { source: "mobile", authUserId }),
      ).rejects.toThrow("Parent already exists for this user");
    });

    it("should throw if email is missing in DTO", async () => {
      const invalidDto = { ...baseDto, email: null };
      await expect(
        ParentService.create(invalidDto, { source: "pms" }),
      ).rejects.toThrow("Parent email is required");
    });

    it("should handle image upload failure gracefully", async () => {
      const createdDoc = mockDoc({
        firstName: "John",
        profileImageUrl: "temp-url",
      });
      (ParentModel.create as any).mockResolvedValue(createdDoc);
      (UploadMiddleware.moveFile as any).mockRejectedValue(
        new Error("S3 Error"),
      );

      const inputDto = { ...baseDto, profileImageUrl: "temp-url" };

      // Should not throw
      await ParentService.create(inputDto, { source: "pms" });

      expect(createdDoc.save).toHaveBeenCalled();
    });
  });

  // ======================================================================
  // 2. GET
  // ======================================================================
  describe("get", () => {
    it("should return parent by ID", async () => {
      const doc = mockDoc({ firstName: "Found" });
      (ParentModel.findOne as any).mockResolvedValue(doc);

      const result = await ParentService.get(parentId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result?.response as any).firstName).toBe("Found");
      expect(ParentModel.findOne).toHaveBeenCalledWith({
        _id: new Types.ObjectId(parentId),
      });
    });

    it("should enforce ownership for mobile users", async () => {
      (
        AuthUserMobileService.getAuthUserMobileIdByProviderId as any
      ).mockResolvedValue(mobileId);
      const doc = mockDoc({ firstName: "Mobile Parent" });
      (ParentModel.findOne as any).mockResolvedValue(doc);

      await ParentService.get(parentId, { source: "mobile", authUserId });

      expect(ParentModel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: new Types.ObjectId(parentId),
          linkedUserId: mobileId,
        }),
      );
    });

    it("should return null if not found", async () => {
      (ParentModel.findOne as any).mockResolvedValue(null);
      const result = await ParentService.get(parentId);
      expect(result).toBeNull();
    });

    it("should throw on invalid ID", async () => {
      await expect(ParentService.get("invalid")).rejects.toThrow(
        "Invalid identifier",
      );
    });
  });

  // ======================================================================
  // 3. UPDATE
  // ======================================================================
  describe("update", () => {
    const updateDto: any = {
      firstName: "Updated",
      email: "up@test.com",
    };

    it("should update parent", async () => {
      const doc = mockDoc({ firstName: "Updated" });
      (ParentModel.findOneAndUpdate as any).mockResolvedValue(doc);

      const result = await ParentService.update(parentId, updateDto);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result?.response as any).firstName).toBe("Updated");
      expect(doc.isProfileComplete).toBeDefined(); // Recalc trigger
      expect(doc.save).toHaveBeenCalled();
    });

    it("should enforce ownership for mobile update", async () => {
      (
        AuthUserMobileService.getAuthUserMobileIdByProviderId as any
      ).mockResolvedValue(mobileId);
      const doc = mockDoc({ firstName: "Updated" });
      (ParentModel.findOneAndUpdate as any).mockResolvedValue(doc);

      await ParentService.update(parentId, updateDto, {
        source: "mobile",
        authUserId,
      });

      expect(ParentModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ linkedUserId: mobileId }),
        expect.anything(),
        expect.anything(),
      );
    });

    it("should return null if not found during update", async () => {
      (ParentModel.findOneAndUpdate as any).mockResolvedValue(null);
      const result = await ParentService.update(parentId, updateDto);
      expect(result).toBeNull();
    });
  });

  // ======================================================================
  // 4. DELETE & HELPERS
  // ======================================================================
  describe("delete", () => {
    it("should delete parent", async () => {
      (ParentModel.findOneAndDelete as any).mockResolvedValue(mockDoc({}));
      const res = await ParentService.delete(parentId, { source: "pms" });
      expect(res).toBeDefined();
    });

    it("should enforce ownership for mobile delete", async () => {
      (
        AuthUserMobileService.getAuthUserMobileIdByProviderId as any
      ).mockResolvedValue(mobileId);
      (ParentModel.findOneAndDelete as any).mockResolvedValue(mockDoc({}));

      await ParentService.delete(parentId, { source: "mobile", authUserId });

      expect(ParentModel.findOneAndDelete).toHaveBeenCalledWith(
        expect.objectContaining({
          linkedUserId: mobileId,
        }),
      );
    });

    it("should throw if mobile auth missing on delete", async () => {
      await expect(
        ParentService.delete(parentId, { source: "mobile" }),
      ).rejects.toThrow("Authenticated user ID required");
    });

    it("should return null if not found", async () => {
      (ParentModel.findOneAndDelete as any).mockResolvedValue(null);
      const res = await ParentService.delete(parentId, { source: "pms" });
      expect(res).toBeNull();
    });
  });

  describe("Helpers", () => {
    it("findByLinkedUserId: success", async () => {
      (
        AuthUserMobileService.getAuthUserMobileIdByProviderId as any
      ).mockResolvedValue(mobileId);
      (ParentModel.findOne as any).mockResolvedValue(mockDoc({}));
      await ParentService.findByLinkedUserId(authUserId);
      expect(ParentModel.findOne).toHaveBeenCalledWith({
        linkedUserId: mobileId,
      });
    });

    it("findByLinkedUserId: throw if invalid input", async () => {
      await expect(ParentService.findByLinkedUserId("")).rejects.toThrow(
        "Invalid AuthUser ID",
      );
    });

    it("findByMongoId: success", async () => {
      (ParentModel.findById as any).mockResolvedValue(mockDoc({}));
      await ParentService.findByMongoId(parentId);
      expect(ParentModel.findById).toHaveBeenCalled();
    });

    it("getByName: should search regex", async () => {
      (ParentModel.find as any).mockResolvedValue([
        mockDoc({ firstName: "John" }),
      ]);
      const res = await ParentService.getByName("John");
      expect(res.responses).toHaveLength(1);
      expect(ParentModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ $or: expect.any(Array) }),
      );
    });

    it("getByName: throw if empty", async () => {
      await expect(ParentService.getByName("")).rejects.toThrow(
        "Name is required",
      );
    });
  });
});
