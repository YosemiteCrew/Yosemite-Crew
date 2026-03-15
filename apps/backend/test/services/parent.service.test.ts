import { Types } from "mongoose";
import {
  ParentService,
  ParentServiceError,
} from "../../src/services/parent.service";
import { ParentModel } from "../../src/models/parent";
import { AuthUserMobileService } from "../../src/services/authUserMobile.service";
import { moveFile } from "../../src/middlewares/upload";
import logger from "../../src/utils/logger";
import { prisma } from "src/config/prisma";

// 1. Mock the Database Model
jest.mock("../../src/models/parent", () => ({
  ParentModel: {
    create: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findOneAndDelete: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
  },
}));

// 2. Mock external services and middlewares
jest.mock("../../src/services/authUserMobile.service", () => ({
  AuthUserMobileService: {
    getAuthUserMobileIdByProviderId: jest.fn(),
    linkParent: jest.fn(),
  },
}));

jest.mock("../../src/middlewares/upload", () => ({
  buildS3Key: jest.fn().mockReturnValue("mock-s3-key"),
  moveFile: jest.fn(),
}));

jest.mock("../../src/utils/logger", () => ({
  warn: jest.fn(),
}));

jest.mock("src/utils/dual-write", () => ({
  shouldDualWrite: false,
  isDualWriteStrict: false,
  handleDualWriteError: jest.fn(),
}));

jest.mock("src/config/prisma", () => ({
  prisma: {
    parent: {
      findUnique: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    },
    parentAddress: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    authUserMobile: {
      findFirst: jest.fn(),
    },
  },
}));

// 3. Mock DTO mappings to pass data through directly
jest.mock("@yosemite-crew/types", () => ({
  fromParentRequestDTO: jest.fn((dto) => dto),
  toParentResponseDTO: jest.fn((dto) => ({ ...dto, isMappedToFHIR: true })),
}));

// Helper to generate a compliant Mongoose Document mock
const makeMockDoc = (overrides: any = {}, toObjectOverrides: any = {}) => {
  const id = new Types.ObjectId();
  return {
    _id: id,
    firstName: "Test",
    lastName: "Parent",
    email: "test@parent.com",
    phoneNumber: "1234567890",
    birthDate: new Date(),
    address: "123 Main St",
    isProfileComplete: true,
    save: jest.fn().mockResolvedValue(true),
    toObject: jest.fn().mockReturnValue({
      _id: id,
      firstName: "Test",
      lastName: "Parent",
      email: "test@parent.com",
      phoneNumber: "1234567890",
      birthDate: new Date(),
      address: "123 Main St",
      profileImageUrl: "img.jpg",
      isProfileComplete: true,
      linkedUserId: new Types.ObjectId(),
      createdFrom: "mobile",
      createdAt: new Date(),
      updatedAt: new Date(),
      ...toObjectOverrides,
    }),
    ...overrides,
  };
};

describe("ParentService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.READ_FROM_POSTGRES = "false";
  });

  describe("ParentServiceError", () => {
    it("should instantiate correctly", () => {
      const error = new ParentServiceError("Test Error", 418);
      expect(error.message).toBe("Test Error");
      expect(error.statusCode).toBe(418);
      expect(error.name).toBe("ParentServiceError");
    });
  });

  describe("Internal Helpers (toPersistable & ensureMongoId)", () => {
    it("throws 400 if email is missing during DTO conversion", async () => {
      await expect(
        ParentService.create({ firstName: "NoEmail" } as any, {
          source: "pms",
        }),
      ).rejects.toThrow(/Parent email is required/);
    });

    it("throws 400 if Mongo ID is invalid format", async () => {
      await expect(ParentService.get("not-an-object-id")).rejects.toThrow(
        /Invalid identifier/,
      );
    });
  });

  describe("create()", () => {
    const validDto = { email: "Test@MAIL.com", firstName: "Test" } as any;

    it("throws 401 if source is mobile but authUserId is missing", async () => {
      await expect(
        ParentService.create(validDto, { source: "mobile" }),
      ).rejects.toThrow(/Authenticated user ID required/);
    });

    it("throws 409 if parent already exists for the linked user", async () => {
      (
        AuthUserMobileService.getAuthUserMobileIdByProviderId as jest.Mock
      ).mockResolvedValue(new Types.ObjectId());
      (ParentModel.findOne as jest.Mock).mockResolvedValue(makeMockDoc());

      await expect(
        ParentService.create(validDto, {
          source: "mobile",
          authUserId: "auth123",
        }),
      ).rejects.toThrow(/Parent already exists/);
    });

    it("creates mobile parent, uploads image, calculates completion, and links mobile user", async () => {
      const mockDoc = makeMockDoc({ address: null }); // address null = incomplete
      (
        AuthUserMobileService.getAuthUserMobileIdByProviderId as jest.Mock
      ).mockResolvedValue(new Types.ObjectId());
      (ParentModel.findOne as jest.Mock).mockResolvedValue(null); // No duplicate
      (ParentModel.create as jest.Mock).mockResolvedValue(mockDoc);
      (moveFile as jest.Mock).mockResolvedValue("https://s3.new-image.url");

      const result = await ParentService.create(
        { ...validDto, profileImageUrl: "temp-url" },
        { source: "mobile", authUserId: "auth123" },
      );

      expect(moveFile).toHaveBeenCalled();
      expect(mockDoc.profileImageUrl).toBe("https://s3.new-image.url");
      expect(mockDoc.isProfileComplete).toBe(false); // Because address was null
      expect(AuthUserMobileService.linkParent).toHaveBeenCalledWith(
        "auth123",
        mockDoc._id.toString(),
      );
      expect(result.isProfileComplete).toBe(false);
      expect(result.response).toHaveProperty("isMappedToFHIR", true);
    });

    it("handles S3 upload failure safely via logger", async () => {
      const mockDoc = makeMockDoc();
      (ParentModel.create as jest.Mock).mockResolvedValue(mockDoc);
      (moveFile as jest.Mock).mockRejectedValue(new Error("S3 Error"));

      await ParentService.create(
        { ...validDto, profileImageUrl: "bad-url" },
        { source: "pms" },
      );

      expect(logger.warn).toHaveBeenCalledWith(
        "Invalid key has been sent",
        expect.any(Error),
      );
      // Failsafe: Create still passes, but image isn't updated
    });

    it("parses linkedUserId from DTO if provided (pms source)", async () => {
      (ParentModel.create as jest.Mock).mockResolvedValue(makeMockDoc());

      await ParentService.create(
        { ...validDto, linkedUserId: new Types.ObjectId().toString() },
        { source: "pms" }, // In pms source, it will forcefully override it to null anyway based on your code
      );

      expect(ParentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ linkedUserId: null, createdFrom: "pms" }),
      );
    });

    it("normalizes combined timezone strings", async () => {
      (ParentModel.create as jest.Mock).mockResolvedValue(makeMockDoc());

      await ParentService.create(
        { ...validDto, timezone: "UTC+05:30 - Asia/Kolkata" },
        { source: "pms" },
      );

      expect(ParentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ timezone: "Asia/Kolkata" }),
      );
    });

    it("throws 400 for invalid timezone", async () => {
      await expect(
        ParentService.create(
          { ...validDto, timezone: "Bad/Timezone" },
          { source: "pms" },
        ),
      ).rejects.toThrow(/Timezone must be a valid IANA timezone/);
    });
  });

  describe("get()", () => {
    const validId = new Types.ObjectId().toString();

    it("returns null if parent not found", async () => {
      (ParentModel.findOne as jest.Mock).mockResolvedValue(null);
      const res = await ParentService.get(validId);
      expect(res).toBeNull();
    });

    it("restricts query to linkedUserId if source is mobile", async () => {
      const mockAuthId = new Types.ObjectId();
      (
        AuthUserMobileService.getAuthUserMobileIdByProviderId as jest.Mock
      ).mockResolvedValue(mockAuthId);
      (ParentModel.findOne as jest.Mock).mockResolvedValue(makeMockDoc());

      await ParentService.get(validId, {
        source: "mobile",
        authUserId: "user1",
      });

      expect(ParentModel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ linkedUserId: mockAuthId }),
      );
    });

    it("safely maps missing optional fields in toFHIR", async () => {
      const docWithMissingFields = makeMockDoc(
        { isProfileComplete: null }, // <--- Added this to override the parent doc!
        {
          birthDate: null,
          isProfileComplete: null,
          linkedUserId: null,
          address: null,
        },
      );
      (ParentModel.findOne as jest.Mock).mockResolvedValue(
        docWithMissingFields,
      );

      const res = await ParentService.get(validId);
      expect(res?.response).toHaveProperty("isMappedToFHIR", true);
      expect(res?.isProfileComplete).toBe(false); // defaults to false
    });

    it("returns null for mobile postgres access when parentId mismatch", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.authUserMobile.findFirst as jest.Mock).mockResolvedValue({
        parentId: "other-id",
      });

      const res = await ParentService.get("parent-1", {
        source: "mobile",
        authUserId: "auth-1",
      });

      expect(res).toBeNull();
    });

    it("returns postgres parent when found", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.parent.findUnique as jest.Mock).mockResolvedValue({
        id: "parent-1",
        firstName: "A",
        lastName: "B",
        birthDate: null,
        email: "a@b.com",
        phoneNumber: null,
        currency: null,
        timezone: null,
        profileImageUrl: null,
        isProfileComplete: true,
        linkedUserId: null,
        createdFrom: "mobile",
        createdAt: new Date(),
        updatedAt: new Date(),
        address: null,
      });

      const res = await ParentService.get("parent-1");
      expect(res?.response).toHaveProperty("isMappedToFHIR", true);
    });
  });

  describe("update()", () => {
    const validId = new Types.ObjectId().toString();
    const validDto = { email: "update@mail.com" } as any;

    it("returns null if document to update is not found", async () => {
      (ParentModel.findOneAndUpdate as jest.Mock).mockResolvedValue(null);
      const res = await ParentService.update(validId, validDto);
      expect(res).toBeNull();
    });

    it("updates successfully and recalculates completion status", async () => {
      const mockDoc = makeMockDoc({ address: "Now has address" });
      (ParentModel.findOneAndUpdate as jest.Mock).mockResolvedValue(mockDoc);

      const res = await ParentService.update(validId, validDto, {
        source: "pms",
      });

      expect(mockDoc.save).toHaveBeenCalled();
      expect(mockDoc.isProfileComplete).toBe(true);
      expect(res?.response).toHaveProperty("isMappedToFHIR", true);
    });

    it("applies mobile context coalescing operators securely", async () => {
      // If auth service returns null, linkedUserId ?? undefined gets triggered
      (
        AuthUserMobileService.getAuthUserMobileIdByProviderId as jest.Mock
      ).mockResolvedValue(null);
      (ParentModel.findOneAndUpdate as jest.Mock).mockResolvedValue(
        makeMockDoc(),
      );

      await ParentService.update(validId, validDto, {
        source: "mobile",
        authUserId: "auth1",
      });

      expect(ParentModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          linkedUserId: undefined, // because ?? undefined
        }),
        expect.objectContaining({
          $set: expect.objectContaining({ linkedUserId: null }), // because ?? null
        }),
        expect.any(Object),
      );
    });

    it("uses postgres update path and recalculates completion", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.parent.update as jest.Mock).mockResolvedValue({});
      (prisma.parent.findUnique as jest.Mock)
        .mockResolvedValueOnce({
          id: "parent-1",
          firstName: "A",
          lastName: "B",
          birthDate: new Date(),
          email: "a@b.com",
          phoneNumber: "123",
          currency: null,
          timezone: null,
          profileImageUrl: null,
          isProfileComplete: false,
          linkedUserId: null,
          createdFrom: "mobile",
          createdAt: new Date(),
          updatedAt: new Date(),
          address: { addressLine: "123" },
        })
        .mockResolvedValueOnce({
          id: "parent-1",
          firstName: "A",
          lastName: "B",
          birthDate: new Date(),
          email: "a@b.com",
          phoneNumber: "123",
          currency: null,
          timezone: null,
          profileImageUrl: null,
          isProfileComplete: false,
          linkedUserId: null,
          createdFrom: "mobile",
          createdAt: new Date(),
          updatedAt: new Date(),
          address: { addressLine: "123" },
        });

      const res = await ParentService.update(
        "parent-1",
        { email: "a@b.com", address: { addressLine: "123" } } as any,
        { source: "pms" },
      );

      expect(prisma.parentAddress.upsert).toHaveBeenCalled();
      expect(prisma.parent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "parent-1" },
          data: expect.objectContaining({ email: "a@b.com" }),
        }),
      );
      expect(res?.isProfileComplete).toBe(true);
    });

    it("throws for invalid timezone on postgres update", async () => {
      process.env.READ_FROM_POSTGRES = "true";

      await expect(
        ParentService.update("parent-1", { timezone: "Bad/Timezone" } as any, {
          source: "pms",
        }),
      ).rejects.toThrow(/Timezone must be a valid IANA timezone/);
    });
  });

  describe("delete()", () => {
    const validId = new Types.ObjectId().toString();

    it("throws 401 if mobile source is missing authUserId", async () => {
      await expect(
        ParentService.delete(validId, { source: "mobile" }),
      ).rejects.toThrow(/Authenticated user ID required/);
    });

    it("restricts deletion query to linked user for mobile source", async () => {
      const mockAuthId = new Types.ObjectId();
      (
        AuthUserMobileService.getAuthUserMobileIdByProviderId as jest.Mock
      ).mockResolvedValue(mockAuthId);
      (ParentModel.findOneAndDelete as jest.Mock).mockResolvedValue(
        makeMockDoc(),
      );

      await ParentService.delete(validId, {
        source: "mobile",
        authUserId: "auth1",
      });

      expect(ParentModel.findOneAndDelete).toHaveBeenCalledWith(
        expect.objectContaining({ linkedUserId: mockAuthId }),
      );
    });

    it("returns null if not found", async () => {
      (ParentModel.findOneAndDelete as jest.Mock).mockResolvedValue(null);
      const res = await ParentService.delete(validId, { source: "pms" });
      expect(res).toBeNull();
    });

    it("uses postgres delete path and returns fhir response", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.parent.findUnique as jest.Mock).mockResolvedValue({
        id: "parent-1",
        firstName: "A",
        lastName: "B",
        birthDate: null,
        email: "a@b.com",
        phoneNumber: null,
        currency: null,
        timezone: null,
        profileImageUrl: null,
        isProfileComplete: true,
        linkedUserId: null,
        createdFrom: "mobile",
        createdAt: new Date(),
        updatedAt: new Date(),
        address: null,
      });

      const res = await ParentService.delete("parent-1", { source: "pms" });

      expect(prisma.parent.deleteMany).toHaveBeenCalledWith({
        where: { id: "parent-1" },
      });
      expect(res).toHaveProperty("isMappedToFHIR", true);
    });

    it("returns null for postgres delete when parent not found", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.parent.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await ParentService.delete("parent-1", { source: "pms" });
      expect(res).toBeNull();
    });
  });

  describe("findByLinkedUserId()", () => {
    it("throws 400 if authUserId is invalid/missing", async () => {
      await expect(ParentService.findByLinkedUserId("")).rejects.toThrow(
        /Invalid AuthUser ID/,
      );
    });

    it("calls findOne with safely parsed object ID", async () => {
      const mockAuthId = new Types.ObjectId();
      (
        AuthUserMobileService.getAuthUserMobileIdByProviderId as jest.Mock
      ).mockResolvedValue(mockAuthId);
      (ParentModel.findOne as jest.Mock).mockResolvedValue(makeMockDoc());

      await ParentService.findByLinkedUserId("auth1");
      expect(ParentModel.findOne).toHaveBeenCalledWith({
        linkedUserId: expect.any(Types.ObjectId),
      });
    });

    it("uses postgres when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.authUserMobile.findFirst as jest.Mock).mockResolvedValue({
        parentId: "parent-1",
      });
      (prisma.parent.findUnique as jest.Mock).mockResolvedValue({
        id: "parent-1",
      });

      const res = await ParentService.findByLinkedUserId("auth-1");
      expect(res).toEqual({ id: "parent-1" });
    });
  });

  describe("findByMongoId()", () => {
    it("returns result directly from findById", async () => {
      const validId = new Types.ObjectId().toString();
      (ParentModel.findById as jest.Mock).mockResolvedValue("mocked-db-res");

      const res = await ParentService.findByMongoId(validId);
      expect(res).toBe("mocked-db-res");
      expect(ParentModel.findById).toHaveBeenCalledWith(
        expect.any(Types.ObjectId),
      );
    });

    it("uses postgres findUnique when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.parent.findUnique as jest.Mock).mockResolvedValue({
        id: "parent-1",
      });

      const res = await ParentService.findByMongoId("parent-1");
      expect(res).toEqual({ id: "parent-1" });
    });
  });

  describe("getByName()", () => {
    it("throws 400 if name is missing or invalid", async () => {
      await expect(ParentService.getByName("")).rejects.toThrow(
        /Name is required/,
      );
      await expect(ParentService.getByName(null as any)).rejects.toThrow(
        /Name is required/,
      );
    });

    it("builds regex and maps responses on success", async () => {
      (ParentModel.find as jest.Mock).mockResolvedValue([makeMockDoc()]);

      const res = await ParentService.getByName(" Test  ");
      expect(res.responses).toHaveLength(1);
      expect(res.responses[0]).toHaveProperty("isMappedToFHIR", true);
    });

    it("uses postgres name search when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.parent.findMany as jest.Mock).mockResolvedValue([
        {
          id: "parent-1",
          firstName: "A",
          lastName: "B",
          birthDate: null,
          email: "a@b.com",
          phoneNumber: null,
          currency: null,
          timezone: null,
          profileImageUrl: null,
          isProfileComplete: true,
          linkedUserId: null,
          createdFrom: "mobile",
          createdAt: new Date(),
          updatedAt: new Date(),
          address: null,
        },
      ]);

      const res = await ParentService.getByName("A");
      expect(res.responses).toHaveLength(1);
      expect(prisma.parent.findMany).toHaveBeenCalled();
    });
  });
});
