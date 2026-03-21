import { Types } from "mongoose";
import { AuthUserMobileService } from "../../src/services/authUserMobile.service";
import { AuthUserMobileModel } from "../../src/models/authUserMobile";
import { ParentModel } from "../../src/models/parent";
import logger from "src/utils/logger";
import { assertSafeString } from "src/utils/sanitize";
import { prisma } from "src/config/prisma";
import { handleDualWriteError } from "src/utils/dual-write";

// --- Global Mocks Setup (Inline definitions to prevent TDZ issues) ---
jest.mock("../../src/models/authUserMobile", () => ({
  __esModule: true,
  AuthUserMobileModel: {
    findOne: jest.fn(),
    create: jest.fn(),
    updateOne: jest.fn(),
  },
}));

jest.mock("../../src/models/parent", () => ({
  __esModule: true,
  ParentModel: {
    findOne: jest.fn(),
    findById: jest.fn(),
  },
}));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { warn: jest.fn() },
}));

jest.mock("src/utils/sanitize", () => ({
  assertSafeString: jest.fn((val) => val), // Pass-through mock
}));

jest.mock("src/config/prisma", () => ({
  prisma: {
    authUserMobile: {
      upsert: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
    },
    parent: {
      updateMany: jest.fn(),
    },
  },
}));

jest.mock("src/utils/dual-write", () => ({
  shouldDualWrite: true,
  handleDualWriteError: jest.fn(),
}));

// Helper to simulate Mongoose query objects with an .exec() method
const createExecMock = (result: any) => ({
  exec: jest.fn().mockResolvedValue(result),
});

describe("AuthUserMobileService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.READ_FROM_POSTGRES = "false";
  });

  describe("createOrGetAuthUser", () => {
    it("should return existing user if found", async () => {
      const mockExistingUser = {
        _id: "user_1",
        providerUserId: "firebase_123",
        email: "test@test.com",
      };
      (AuthUserMobileModel.findOne as jest.Mock).mockReturnValue(
        createExecMock(mockExistingUser),
      );

      const result = await AuthUserMobileService.createOrGetAuthUser(
        "firebase",
        "firebase_123",
        "test@test.com",
      );

      expect(assertSafeString).toHaveBeenCalledWith(
        "firebase_123",
        "providerUserId",
      );
      expect(assertSafeString).toHaveBeenCalledWith("test@test.com", "email");
      expect(AuthUserMobileModel.findOne).toHaveBeenCalledWith({
        providerUserId: "firebase_123",
      });
      expect(AuthUserMobileModel.create).not.toHaveBeenCalled();
      expect(result).toEqual(mockExistingUser);
    });

    it("should create and return a new user if not found", async () => {
      (AuthUserMobileModel.findOne as jest.Mock).mockReturnValue(
        createExecMock(null),
      );

      const mockNewUser = {
        _id: "user_new",
        providerUserId: "firebase_new",
        email: "new@test.com",
      };
      (AuthUserMobileModel.create as jest.Mock).mockResolvedValue(mockNewUser);

      const result = await AuthUserMobileService.createOrGetAuthUser(
        "firebase",
        "firebase_new",
        "new@test.com",
      );

      expect(AuthUserMobileModel.create).toHaveBeenCalledWith({
        authProvider: "firebase",
        providerUserId: "firebase_new",
        email: "new@test.com",
      });
      expect(result).toEqual(mockNewUser);
    });

    it("handles dual-write errors on create", async () => {
      (AuthUserMobileModel.findOne as jest.Mock).mockReturnValue(
        createExecMock(null),
      );
      (AuthUserMobileModel.create as jest.Mock).mockResolvedValue({
        _id: new Types.ObjectId(),
        authProvider: "firebase",
        providerUserId: "firebase_new",
        email: "new@test.com",
        toObject: jest.fn().mockReturnValue({}),
      });
      (prisma.authUserMobile.upsert as jest.Mock).mockRejectedValue(
        new Error("sync fail"),
      );

      await AuthUserMobileService.createOrGetAuthUser(
        "firebase",
        "firebase_new",
        "new@test.com",
      );

      expect(handleDualWriteError).toHaveBeenCalledWith(
        "AuthUserMobile",
        expect.any(Error),
      );
    });
  });

  describe("linkParent", () => {
    const validParentId = new Types.ObjectId().toString();

    it("should throw an error if parentId is invalid", async () => {
      await expect(
        AuthUserMobileService.linkParent("provider_123", "invalid-id"),
      ).rejects.toThrow("Invalid parent ID");

      expect(assertSafeString).toHaveBeenCalledWith(
        "provider_123",
        "authUserId",
      );
    });

    it("should throw an error if AuthUserMobile is not found", async () => {
      (AuthUserMobileModel.findOne as jest.Mock).mockReturnValue(
        createExecMock(null),
      );

      await expect(
        AuthUserMobileService.linkParent("provider_123", validParentId),
      ).rejects.toThrow("AuthUserMobile not found");
    });

    it("should throw an error if Parent is not found", async () => {
      const mockUser = { save: jest.fn() };
      (AuthUserMobileModel.findOne as jest.Mock).mockReturnValue(
        createExecMock(mockUser),
      );
      (ParentModel.findById as jest.Mock).mockReturnValue(createExecMock(null));

      await expect(
        AuthUserMobileService.linkParent("provider_123", validParentId),
      ).rejects.toThrow("Parent not found");
    });

    it("should successfully link parent and auth user, then save both", async () => {
      const mockUserSave = jest.fn();
      const mockUser = { _id: "user_1", parentId: null, save: mockUserSave };

      const mockParentSave = jest.fn();
      const mockParent = {
        _id: validParentId,
        linkedUserId: null,
        save: mockParentSave,
      };

      (AuthUserMobileModel.findOne as jest.Mock).mockReturnValue(
        createExecMock(mockUser),
      );
      (ParentModel.findById as jest.Mock).mockReturnValue(
        createExecMock(mockParent),
      );

      const result = await AuthUserMobileService.linkParent(
        "provider_123",
        validParentId,
      );

      expect(mockUser.parentId).toBe(validParentId);
      expect(mockUserSave).toHaveBeenCalled();

      expect(mockParent.linkedUserId).toBe("user_1");
      expect(mockParentSave).toHaveBeenCalled();

      expect(result).toEqual(mockUser);
    });
  });

  describe("autoLinkParentByEmail", () => {
    it("should return null if parent is not found by email", async () => {
      (ParentModel.findOne as jest.Mock).mockReturnValue(createExecMock(null));

      const mockAuthUser: any = {
        providerUserId: "prov_123",
        email: "missing@test.com",
      };
      const result =
        await AuthUserMobileService.autoLinkParentByEmail(mockAuthUser);

      expect(assertSafeString).toHaveBeenCalledWith(
        "missing@test.com",
        "email",
      );
      expect(ParentModel.findOne).toHaveBeenCalledWith({
        email: "missing@test.com",
      });
      expect(AuthUserMobileModel.updateOne).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it("should link and return the parent if found by email", async () => {
      const mockParent = { _id: "parent_123", email: "found@test.com" };
      (ParentModel.findOne as jest.Mock).mockReturnValue(
        createExecMock(mockParent),
      );
      (AuthUserMobileModel.updateOne as jest.Mock).mockReturnValue(
        createExecMock({ modifiedCount: 1 }),
      );

      const mockAuthUser: any = {
        providerUserId: "prov_123",
        email: "found@test.com",
      };
      const result =
        await AuthUserMobileService.autoLinkParentByEmail(mockAuthUser);

      expect(AuthUserMobileModel.updateOne).toHaveBeenCalledWith(
        { providerUserId: "prov_123" },
        { parentId: "parent_123" },
      );
      expect(result).toEqual(mockParent);
    });
  });

  describe("getByProviderUserId", () => {
    it("should fetch user by providerUserId", async () => {
      const mockUser = { _id: "u1", providerUserId: "prov_1" };
      (AuthUserMobileModel.findOne as jest.Mock).mockReturnValue(
        createExecMock(mockUser),
      );

      const result = await AuthUserMobileService.getByProviderUserId("prov_1");

      expect(assertSafeString).toHaveBeenCalledWith("prov_1", "providerUserId");
      expect(AuthUserMobileModel.findOne).toHaveBeenCalledWith({
        providerUserId: "prov_1",
      });
      expect(result).toEqual(mockUser);
    });

    it("uses prisma when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.authUserMobile.findFirst as jest.Mock).mockResolvedValue({
        id: "u1",
        authProvider: "firebase",
        providerUserId: "prov_1",
        email: "test@test.com",
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await AuthUserMobileService.getByProviderUserId("prov_1");

      expect(prisma.authUserMobile.findFirst).toHaveBeenCalledWith({
        where: { providerUserId: "prov_1" },
      });
      expect(result).toEqual(
        expect.objectContaining({ providerUserId: "prov_1" }),
      );
    });
  });

  describe("getAuthUserMobileIdByProviderId", () => {
    it("should log a warning and return null if document is not found", async () => {
      (AuthUserMobileModel.findOne as jest.Mock).mockReturnValue(
        createExecMock(null),
      );

      const result =
        await AuthUserMobileService.getAuthUserMobileIdByProviderId(
          "missing_prov",
        );

      expect(assertSafeString).toHaveBeenCalledWith(
        "missing_prov",
        "providerUserId",
      );
      expect(AuthUserMobileModel.findOne).toHaveBeenCalledWith(
        { providerUserId: "missing_prov" },
        { _id: 1 },
      );
      expect(logger.warn).toHaveBeenCalledWith(
        "AuthUserMobile not found for providerUserId: missing_prov",
      );
      expect(result).toBeNull();
    });

    it("should return the document _id if found", async () => {
      const mockId = new Types.ObjectId();
      (AuthUserMobileModel.findOne as jest.Mock).mockReturnValue(
        createExecMock({ _id: mockId }),
      );

      const result =
        await AuthUserMobileService.getAuthUserMobileIdByProviderId(
          "valid_prov",
        );

      expect(result).toEqual(mockId);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("uses prisma when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.authUserMobile.findFirst as jest.Mock).mockResolvedValue({
        id: "auth_1",
      });

      const result =
        await AuthUserMobileService.getAuthUserMobileIdByProviderId("prov_1");

      expect(prisma.authUserMobile.findFirst).toHaveBeenCalledWith({
        where: { providerUserId: "prov_1" },
        select: { id: true },
      });
      expect(result).toEqual("auth_1");
    });

    it("logs warning in prisma path when not found", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.authUserMobile.findFirst as jest.Mock).mockResolvedValue(null);

      const result =
        await AuthUserMobileService.getAuthUserMobileIdByProviderId(
          "missing_prov",
        );

      expect(logger.warn).toHaveBeenCalledWith(
        "AuthUserMobile not found for providerUserId: missing_prov",
      );
      expect(result).toBeNull();
    });
  });
});
