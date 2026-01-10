import { Types } from "mongoose";
import { AuthUserMobileService } from "../../src/services/authUserMobile.service";
import { AuthUserMobileModel } from "../../src/models/authUserMobile";
import { ParentModel } from "../../src/models/parent";
import logger from "../../src/utils/logger";

// --- Mocks ---
jest.mock("../../src/models/authUserMobile");
jest.mock("../../src/models/parent");
jest.mock("../../src/utils/logger");
// We do NOT mock assertSafeString to ensure real validation logic runs,
// assuming it's a pure function that won't block testing if inputs are valid.

describe("AuthUserMobileService", () => {
  const mockProviderId = "google-123";
  const mockEmail = "test@example.com";
  const validObjectId = new Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper to mock mongoose query chains: Model.find().exec()
  const mockExec = (resolvedValue: any) => ({
    exec: jest.fn().mockResolvedValue(resolvedValue),
  });

  // 1. createOrGetAuthUser
  describe("createOrGetAuthUser", () => {
    it("should return existing user if found", async () => {
      const existingUser = { providerUserId: mockProviderId, email: mockEmail };

      (AuthUserMobileModel.findOne as jest.Mock).mockReturnValue(
        mockExec(existingUser),
      );

      const result = await AuthUserMobileService.createOrGetAuthUser(
        "cognito",
        mockProviderId,
        mockEmail,
      );

      expect(AuthUserMobileModel.findOne).toHaveBeenCalledWith({
        providerUserId: mockProviderId,
      });
      expect(AuthUserMobileModel.create).not.toHaveBeenCalled();
      expect(result).toEqual(existingUser);
    });

    it("should create and return new user if not found", async () => {
      const newUser = {
        providerUserId: mockProviderId,
        email: mockEmail,
        authProvider: "cognito",
      };

      // findOne returns null
      (AuthUserMobileModel.findOne as jest.Mock).mockReturnValue(
        mockExec(null),
      );
      // create returns new user
      (AuthUserMobileModel.create as jest.Mock).mockResolvedValue(newUser);

      const result = await AuthUserMobileService.createOrGetAuthUser(
        "cognito",
        mockProviderId,
        mockEmail,
      );

      expect(AuthUserMobileModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          authProvider: "cognito",
          providerUserId: mockProviderId,
          email: mockEmail,
        }),
      );
      expect(result).toEqual(newUser);
    });
  });

  // 2. linkParent
  describe("linkParent", () => {
    it("should throw error if parentId is invalid", async () => {
      await expect(
        AuthUserMobileService.linkParent(mockProviderId, "invalid-id"),
      ).rejects.toThrow("Invalid parent ID");
    });

    it("should throw error if AuthUserMobile not found", async () => {
      (AuthUserMobileModel.findOne as jest.Mock).mockReturnValue(
        mockExec(null),
      );

      await expect(
        AuthUserMobileService.linkParent(mockProviderId, validObjectId),
      ).rejects.toThrow("AuthUserMobile not found");
    });

    it("should throw error if Parent not found", async () => {
      // Mock AuthUser found
      (AuthUserMobileModel.findOne as jest.Mock).mockReturnValue(
        mockExec({ providerUserId: mockProviderId }),
      );
      // Mock Parent NOT found
      (ParentModel.findById as jest.Mock).mockReturnValue(mockExec(null));

      await expect(
        AuthUserMobileService.linkParent(mockProviderId, validObjectId),
      ).rejects.toThrow("Parent not found");
    });

    it("should successfully link user and parent", async () => {
      // Mock User Document with save method
      const mockUserDoc = {
        _id: new Types.ObjectId(),
        providerUserId: mockProviderId,
        parentId: undefined,
        save: jest.fn().mockResolvedValue(true),
      };

      // Mock Parent Document with save method
      const mockParentDoc = {
        _id: new Types.ObjectId(validObjectId),
        linkedUserId: undefined,
        save: jest.fn().mockResolvedValue(true),
      };

      (AuthUserMobileModel.findOne as jest.Mock).mockReturnValue(
        mockExec(mockUserDoc),
      );
      (ParentModel.findById as jest.Mock).mockReturnValue(
        mockExec(mockParentDoc),
      );

      const result = await AuthUserMobileService.linkParent(
        mockProviderId,
        validObjectId,
      );

      // Verify User was updated
      expect(mockUserDoc.parentId).toEqual(mockParentDoc._id);
      expect(mockUserDoc.save).toHaveBeenCalled();

      // Verify Parent was updated
      expect(mockParentDoc.linkedUserId).toEqual(mockUserDoc._id);
      expect(mockParentDoc.save).toHaveBeenCalled();

      expect(result).toEqual(mockUserDoc);
    });
  });

  // 3. autoLinkParentByEmail
  describe("autoLinkParentByEmail", () => {
    const mockAuthUser: any = {
      providerUserId: mockProviderId,
      email: mockEmail,
    };

    it("should return null if no parent found with matching email", async () => {
      (ParentModel.findOne as jest.Mock).mockReturnValue(mockExec(null));

      const result =
        await AuthUserMobileService.autoLinkParentByEmail(mockAuthUser);

      expect(result).toBeNull();
      expect(AuthUserMobileModel.updateOne).not.toHaveBeenCalled();
    });

    it("should update user and return parent if parent found", async () => {
      const mockParent = { _id: new Types.ObjectId(), email: mockEmail };

      (ParentModel.findOne as jest.Mock).mockReturnValue(mockExec(mockParent));
      (AuthUserMobileModel.updateOne as jest.Mock).mockReturnValue(
        mockExec({ modifiedCount: 1 }),
      );

      const result =
        await AuthUserMobileService.autoLinkParentByEmail(mockAuthUser);

      expect(AuthUserMobileModel.updateOne).toHaveBeenCalledWith(
        { providerUserId: mockProviderId },
        { parentId: mockParent._id },
      );
      expect(result).toEqual(mockParent);
    });
  });

  // 4. getByProviderUserId
  describe("getByProviderUserId", () => {
    it("should return the user document", async () => {
      const mockUser = { providerUserId: mockProviderId };
      (AuthUserMobileModel.findOne as jest.Mock).mockReturnValue(
        mockExec(mockUser),
      );

      const result =
        await AuthUserMobileService.getByProviderUserId(mockProviderId);

      expect(AuthUserMobileModel.findOne).toHaveBeenCalledWith({
        providerUserId: mockProviderId,
      });
      expect(result).toEqual(mockUser);
    });
  });

  // 5. getAuthUserMobileIdByProviderId
  describe("getAuthUserMobileIdByProviderId", () => {
    it("should return _id if user found", async () => {
      const mockId = new Types.ObjectId();
      (AuthUserMobileModel.findOne as jest.Mock).mockReturnValue(
        mockExec({ _id: mockId }),
      );

      const result =
        await AuthUserMobileService.getAuthUserMobileIdByProviderId(
          mockProviderId,
        );

      expect(AuthUserMobileModel.findOne).toHaveBeenCalledWith(
        { providerUserId: mockProviderId },
        { _id: 1 },
      );
      expect(result).toEqual(mockId);
    });

    it("should log warning and return null if user not found", async () => {
      (AuthUserMobileModel.findOne as jest.Mock).mockReturnValue(
        mockExec(null),
      );

      const result =
        await AuthUserMobileService.getAuthUserMobileIdByProviderId(
          mockProviderId,
        );

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          `AuthUserMobile not found for providerUserId: ${mockProviderId}`,
        ),
      );
      expect(result).toBeNull();
    });
  });
});
