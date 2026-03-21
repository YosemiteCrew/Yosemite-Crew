// FIX: Set AWS Region before imports to prevent Cognito Client initialization error
process.env.AWS_REGION = "us-east-1";

import type { UserDocument } from "../../src/models/user";
import UserModel from "../../src/models/user";
import { UserService } from "../../src/services/user.service";
import { prisma } from "src/config/prisma";

jest.mock("../../src/services/user-organization.service", () => ({
  UserOrganizationService: { deleteById: jest.fn() },
}));
jest.mock("../../src/services/organization.service", () => ({
  OrganizationService: { deleteById: jest.fn() },
}));
jest.mock("../../src/models/user-organization", () => ({
  __esModule: true,
  default: { find: jest.fn() },
}));
jest.mock("../../src/models/user-profile", () => ({
  __esModule: true,
  default: { deleteMany: jest.fn() },
}));
jest.mock("../../src/models/base-availability", () => ({
  __esModule: true,
  default: { deleteMany: jest.fn() },
}));
jest.mock("../../src/models/weekly-availablity-override", () => ({
  __esModule: true,
  default: { deleteMany: jest.fn() },
}));
jest.mock("../../src/models/occupancy", () => ({
  __esModule: true,
  OccupancyModel: { deleteMany: jest.fn() },
}));

jest.mock("../../src/models/user", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    create: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
}));

jest.mock("src/config/prisma", () => ({
  prisma: {
    user: {
      findFirst: jest.fn(),
      upsert: jest.fn(),
    },
    userProfile: {
      deleteMany: jest.fn(),
    },
    baseAvailability: {
      deleteMany: jest.fn(),
    },
    weeklyAvailabilityOverride: {
      deleteMany: jest.fn(),
    },
    occupancy: {
      deleteMany: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/cognito.service", () => ({
  CognitoService: {
    updateUserName: jest.fn(),
  },
}));

import UserOrganizationModel from "../../src/models/user-organization";
import UserProfileModel from "../../src/models/user-profile";
import BaseAvailabilityModel from "../../src/models/base-availability";
import WeeklyAvailabilityOverrideModel from "../../src/models/weekly-availablity-override";
import { OccupancyModel } from "../../src/models/occupancy";
import { UserOrganizationService } from "../../src/services/user-organization.service";
import { OrganizationService } from "../../src/services/organization.service";
import { CognitoService } from "../../src/services/cognito.service";

const mockedUserModel = UserModel as unknown as {
  findOne: jest.Mock;
  create: jest.Mock;
  findOneAndUpdate: jest.Mock;
};
const mockedUserOrganizationModel = UserOrganizationModel as unknown as {
  find: jest.Mock;
};
const mockedUserProfileModel = UserProfileModel as unknown as {
  deleteMany: jest.Mock;
};
const mockedBaseAvailabilityModel = BaseAvailabilityModel as unknown as {
  deleteMany: jest.Mock;
};
const mockedWeeklyAvailabilityOverrideModel =
  WeeklyAvailabilityOverrideModel as unknown as {
    deleteMany: jest.Mock;
  };
const mockedOccupancyModel = OccupancyModel as unknown as {
  deleteMany: jest.Mock;
};

describe("UserService", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("create", () => {
    it("persists a sanitized user when no duplicate exists", async () => {
      mockedUserModel.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const createdDocument = {
        userId: "user-1",
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
        isActive: false,
      } as unknown as UserDocument;
      mockedUserModel.create.mockResolvedValueOnce(createdDocument);

      const result = await UserService.create({
        id: " user-1 ",
        firstName: "Test",
        lastName: "User",
        email: "Test@Example.com ",
        isActive: false,
      });

      expect(mockedUserModel.findOne).toHaveBeenNthCalledWith(
        1,
        { userId: "user-1" },
        null,
        {
          sanitizeFilter: true,
        },
      );
      expect(mockedUserModel.findOne).toHaveBeenNthCalledWith(
        2,
        { email: "test@example.com" },
        null,
        {
          sanitizeFilter: true,
        },
      );
      expect(mockedUserModel.create).toHaveBeenCalledWith({
        userId: "user-1",
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
        isActive: false,
      });
      expect(result).toEqual({
        id: "user-1",
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
        isActive: false,
      });
    });

    it("defaults isActive to true when not provided", async () => {
      mockedUserModel.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const createdDocument = {
        userId: "user-2",
        firstName: "User",
        lastName: "Two",
        email: "user2@example.com",
        isActive: true,
      } as unknown as UserDocument;
      mockedUserModel.create.mockResolvedValueOnce(createdDocument);

      await UserService.create({
        id: "user-2",
        firstName: "User",
        lastName: "Two",
        email: "user2@example.com",
        isActive: undefined as unknown as boolean,
      });

      expect(mockedUserModel.create).toHaveBeenCalledWith({
        userId: "user-2",
        firstName: "User",
        lastName: "Two",
        email: "user2@example.com",
        isActive: true,
      });
    });

    it("throws when email is invalid", async () => {
      await expect(
        UserService.create({
          id: "user-3",
          email: "not-an-email",
          firstName: "First",
          lastName: "Last",
          isActive: true,
        }),
      ).rejects.toMatchObject({
        message: "Invalid email address.",
        statusCode: 400,
      });
    });

    it("throws when duplicate user exists", async () => {
      mockedUserModel.findOne.mockResolvedValueOnce({} as UserDocument);

      await expect(
        UserService.create({
          id: "user-1",
          email: "user@example.com",
          firstName: "First",
          lastName: "Last",
          isActive: true,
        }),
      ).rejects.toMatchObject({
        message: "User with the same id or email already exists.",
        statusCode: 409,
      });
    });

    it("throws when user id contains query operator", async () => {
      await expect(
        UserService.create({
          id: "user$1",
          email: "user@example.com",
          firstName: "First",
          lastName: "Last",
          isActive: true,
        }),
      ).rejects.toMatchObject({
        message: "Invalid character in User id.",
        statusCode: 400,
      });
    });

    it("throws when user id format is invalid", async () => {
      await expect(
        UserService.create({
          id: "bad id",
          email: "user@example.com",
          firstName: "First",
          lastName: "Last",
          isActive: true,
        }),
      ).rejects.toMatchObject({
        message: "Invalid User id format.",
        statusCode: 400,
      });
    });

    it("throws when isActive is not a boolean", async () => {
      await expect(
        UserService.create({
          id: "user-5",
          email: "user5@example.com",
          firstName: "First",
          lastName: "Last",
          isActive: "yes" as unknown as boolean,
        }),
      ).rejects.toMatchObject({
        message: "isActive must be a boolean.",
        statusCode: 400,
      });
    });
  });

  describe("getById", () => {
    it("returns null when no document found", async () => {
      mockedUserModel.findOne.mockResolvedValueOnce(null);

      const result = await UserService.getById("missing");

      expect(result).toBeNull();
    });

    it("returns domain user when document exists", async () => {
      const document = {
        userId: "user-4",
        firstName: "User",
        lastName: "Four",
        email: "user4@example.com",
        isActive: true,
      } as unknown as UserDocument;
      mockedUserModel.findOne.mockResolvedValueOnce(document);

      const result = await UserService.getById("user-4");

      expect(result).toEqual({
        id: "user-4",
        firstName: "User",
        lastName: "Four",
        email: "user4@example.com",
        isActive: true,
      });
    });

    it("throws when id is missing", async () => {
      await expect(UserService.getById("")).rejects.toMatchObject({
        message: "User id cannot be empty.",
        statusCode: 400,
      });
    });
  });

  describe("getById (postgres)", () => {
    const originalReadFromPostgres = process.env.READ_FROM_POSTGRES;

    beforeEach(() => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.user.findFirst as jest.Mock).mockReset();
    });

    afterEach(() => {
      process.env.READ_FROM_POSTGRES = originalReadFromPostgres;
    });

    it("returns null when user missing", async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValueOnce(null);

      const result = await UserService.getById("user-1");
      expect(result).toBeNull();
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { userId: "user-1" },
      });
    });

    it("returns domain user when present", async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValueOnce({
        userId: "user-2",
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
        isActive: true,
      });

      const result = await UserService.getById("user-2");
      expect(result).toEqual({
        id: "user-2",
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
        isActive: true,
      });
    });
  });

  describe("deleteById", () => {
    const mockDeleteMany = (model: { deleteMany: jest.Mock }) => {
      model.deleteMany.mockReturnValueOnce({
        setOptions: jest.fn().mockResolvedValue(true),
      });
    };

    it("soft deletes user and deletes owner organizations", async () => {
      mockedUserModel.findOne.mockReturnValueOnce({
        lean: jest.fn().mockResolvedValueOnce({ userId: "user-1" }),
      });
      mockedUserOrganizationModel.find.mockReturnValueOnce({
        lean: jest.fn().mockResolvedValueOnce([
          {
            _id: "mapping-1",
            roleCode: "OWNER",
            organizationReference: "Organization/org-1",
          },
          {
            _id: "mapping-2",
            roleCode: "MEMBER",
            organizationReference: "Organization/org-2",
          },
        ]),
      });
      mockDeleteMany(mockedUserProfileModel);
      mockDeleteMany(mockedBaseAvailabilityModel);
      mockDeleteMany(mockedWeeklyAvailabilityOverrideModel);
      mockDeleteMany(mockedOccupancyModel);
      mockedUserModel.findOneAndUpdate.mockResolvedValueOnce({
        userId: "user-1",
      } as UserDocument);

      const result = await UserService.deleteById("user-1");

      expect(result).toBe(true);
      expect(UserOrganizationService.deleteById).toHaveBeenCalledTimes(2);
      expect(OrganizationService.deleteById).toHaveBeenCalledWith("org-1");
    });

    it("soft deletes user without deleting organizations when not owner", async () => {
      mockedUserModel.findOne.mockReturnValueOnce({
        lean: jest.fn().mockResolvedValueOnce({ userId: "user-2" }),
      });
      mockedUserOrganizationModel.find.mockReturnValueOnce({
        lean: jest.fn().mockResolvedValueOnce([
          {
            _id: "mapping-1",
            roleCode: "MEMBER",
            organizationReference: "Organization/org-2",
          },
        ]),
      });
      mockDeleteMany(mockedUserProfileModel);
      mockDeleteMany(mockedBaseAvailabilityModel);
      mockDeleteMany(mockedWeeklyAvailabilityOverrideModel);
      mockDeleteMany(mockedOccupancyModel);
      mockedUserModel.findOneAndUpdate.mockResolvedValueOnce({
        userId: "user-2",
      } as UserDocument);

      const result = await UserService.deleteById("user-2");

      expect(result).toBe(true);
      expect(OrganizationService.deleteById).not.toHaveBeenCalled();
    });

    it("returns false when no document found", async () => {
      mockedUserModel.findOne.mockReturnValueOnce({
        lean: jest.fn().mockResolvedValueOnce(null),
      });

      const result = await UserService.deleteById("missing");

      expect(result).toBe(false);
    });

    it("throws when owner mapping has invalid organization reference", async () => {
      mockedUserModel.findOne.mockReturnValueOnce({
        lean: jest.fn().mockResolvedValueOnce({ userId: "user-9" }),
      });
      mockedUserOrganizationModel.find.mockReturnValueOnce({
        lean: jest.fn().mockResolvedValueOnce([
          {
            _id: "mapping-1",
            roleCode: "OWNER",
            organizationReference: "Organization",
          },
        ]),
      });

      await expect(UserService.deleteById("user-9")).rejects.toMatchObject({
        message: "Invalid organization reference format.",
        statusCode: 400,
      });
    });
  });

  describe("updateName", () => {
    const originalUserPoolId = process.env.COGNITO_USER_POOL_ID;

    beforeEach(() => {
      process.env.COGNITO_USER_POOL_ID = "pool-1";
    });

    afterEach(() => {
      process.env.COGNITO_USER_POOL_ID = originalUserPoolId;
    });

    it("throws when user not found", async () => {
      mockedUserModel.findOne.mockResolvedValueOnce(null);

      await expect(
        UserService.updateName({
          userId: "user-10",
          firstName: "First",
          lastName: "Last",
        }),
      ).rejects.toMatchObject({
        message: "User not found.",
        statusCode: 404,
      });
    });

    it("returns existing user when name is unchanged", async () => {
      const userDoc = {
        userId: "user-11",
        firstName: "Same",
        lastName: "Name",
        email: "same@example.com",
        isActive: true,
      } as unknown as UserDocument;
      mockedUserModel.findOne.mockResolvedValueOnce(userDoc);

      const result = await UserService.updateName({
        userId: "user-11",
        firstName: "Same",
        lastName: "Name",
      });

      expect(result).toEqual({
        id: "user-11",
        firstName: "Same",
        lastName: "Name",
        email: "same@example.com",
        isActive: true,
      });
      expect(CognitoService.updateUserName).not.toHaveBeenCalled();
    });

    it("updates name and syncs cognito", async () => {
      const save = jest.fn().mockResolvedValueOnce(undefined);
      const userDoc = {
        userId: "user-12",
        firstName: "Old",
        lastName: "Name",
        email: "old@example.com",
        isActive: true,
        save,
      } as unknown as UserDocument & { save: jest.Mock };
      mockedUserModel.findOne.mockResolvedValueOnce(userDoc);

      const result = await UserService.updateName({
        userId: "user-12",
        firstName: "New",
        lastName: "Name",
      });

      expect(CognitoService.updateUserName).toHaveBeenCalledWith({
        userPoolId: process.env.COGNITO_USER_POOL_ID,
        cognitoUserId: "user-12",
        firstName: "New",
        lastName: "Name",
      });
      expect(save).toHaveBeenCalled();
      expect(result).toEqual({
        id: "user-12",
        firstName: "New",
        lastName: "Name",
        email: "old@example.com",
        isActive: true,
      });
    });

    it("throws when first name is not a string", async () => {
      await expect(
        UserService.updateName({
          userId: "user-13",
          firstName: 123 as unknown as string,
          lastName: "Last",
        }),
      ).rejects.toMatchObject({
        message: "First name must be a string.",
        statusCode: 400,
      });
    });
  });

  describe("dual write", () => {
    const originalDualWrite = process.env.DUAL_WRITE_ENABLED;

    afterEach(() => {
      process.env.DUAL_WRITE_ENABLED = originalDualWrite;
    });

    it("syncs to postgres on create when enabled", async () => {
      process.env.DUAL_WRITE_ENABLED = "true";
      jest.resetModules();
      jest.doMock("src/utils/dual-write", () => ({
        ...jest.requireActual("src/utils/dual-write"),
        shouldDualWrite: true,
      }));

      let UserServiceIsolated!: typeof UserService;
      let UserModelIsolated!: typeof UserModel;
      let prismaIsolated!: typeof prisma;
      let dualWriteEnabled = false;

      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        UserServiceIsolated =
          require("../../src/services/user.service").UserService;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        UserModelIsolated = require("../../src/models/user").default;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        prismaIsolated = require("src/config/prisma").prisma;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        dualWriteEnabled = require("src/utils/dual-write").shouldDualWrite;
      });

      const createdAt = new Date("2024-01-01T00:00:00.000Z");
      const updatedAt = new Date("2024-01-02T00:00:00.000Z");
      const document = {
        userId: "user-14",
        email: "user14@example.com",
        firstName: "First",
        lastName: "Last",
        isActive: true,
        toObject: () => ({
          _id: { toString: () => "mongo-id" },
          userId: "user-14",
          email: "user14@example.com",
          firstName: "First",
          lastName: "Last",
          isActive: true,
          createdAt,
          updatedAt,
        }),
      } as unknown as UserDocument;

      (UserModelIsolated.findOne as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      (UserModelIsolated.create as jest.Mock).mockResolvedValueOnce(document);

      await UserServiceIsolated.create({
        id: "user-14",
        email: "user14@example.com",
        firstName: "First",
        lastName: "Last",
        isActive: true,
      });

      expect(dualWriteEnabled).toBe(true);
      expect(prismaIsolated.user.upsert).toHaveBeenCalledWith({
        where: { id: "mongo-id" },
        create: {
          id: "mongo-id",
          userId: "user-14",
          email: "user14@example.com",
          isActive: true,
          firstName: "First",
          lastName: "Last",
          createdAt,
          updatedAt,
        },
        update: {
          userId: "user-14",
          email: "user14@example.com",
          isActive: true,
          firstName: "First",
          lastName: "Last",
          updatedAt,
        },
      });
    });

    it("runs postgres cleanup during deleteById when enabled", async () => {
      process.env.DUAL_WRITE_ENABLED = "true";
      jest.resetModules();
      jest.doMock("src/utils/dual-write", () => ({
        ...jest.requireActual("src/utils/dual-write"),
        shouldDualWrite: true,
      }));

      let UserServiceIsolated!: typeof UserService;
      let UserModelIsolated!: typeof UserModel;
      let UserOrganizationModelIsolated!: typeof UserOrganizationModel;
      let UserProfileModelIsolated!: typeof UserProfileModel;
      let BaseAvailabilityModelIsolated!: typeof BaseAvailabilityModel;
      let WeeklyAvailabilityOverrideModelIsolated!: typeof WeeklyAvailabilityOverrideModel;
      let OccupancyModelIsolated!: typeof OccupancyModel;
      let prismaIsolated!: typeof prisma;

      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        UserServiceIsolated =
          require("../../src/services/user.service").UserService;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        UserModelIsolated = require("../../src/models/user").default;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        UserOrganizationModelIsolated =
          require("../../src/models/user-organization").default;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        UserProfileModelIsolated =
          require("../../src/models/user-profile").default;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        BaseAvailabilityModelIsolated =
          require("../../src/models/base-availability").default;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        WeeklyAvailabilityOverrideModelIsolated =
          require("../../src/models/weekly-availablity-override").default;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        OccupancyModelIsolated =
          require("../../src/models/occupancy").OccupancyModel;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        prismaIsolated = require("src/config/prisma").prisma;
      });

      const mockDeleteMany = (model: { deleteMany: jest.Mock }) => {
        model.deleteMany.mockReturnValueOnce({
          setOptions: jest.fn().mockResolvedValue(true),
        });
      };

      mockDeleteMany(
        UserProfileModelIsolated as unknown as { deleteMany: jest.Mock },
      );
      mockDeleteMany(
        BaseAvailabilityModelIsolated as unknown as { deleteMany: jest.Mock },
      );
      mockDeleteMany(
        WeeklyAvailabilityOverrideModelIsolated as unknown as {
          deleteMany: jest.Mock;
        },
      );
      mockDeleteMany(
        OccupancyModelIsolated as unknown as { deleteMany: jest.Mock },
      );

      (UserModelIsolated.findOne as jest.Mock).mockReturnValueOnce({
        lean: jest.fn().mockResolvedValueOnce({ userId: "user-15" }),
      });
      (UserOrganizationModelIsolated.find as jest.Mock).mockReturnValueOnce({
        lean: jest.fn().mockResolvedValueOnce([]),
      });
      (UserModelIsolated.findOneAndUpdate as jest.Mock).mockResolvedValueOnce({
        userId: "user-15",
        email: "user15@example.com",
        firstName: "First",
        lastName: "Last",
        isActive: false,
        toObject: () => ({
          _id: { toString: () => "mongo-15" },
          userId: "user-15",
          email: "user15@example.com",
          firstName: "First",
          lastName: "Last",
          isActive: false,
        }),
      } as unknown as UserDocument);

      await UserServiceIsolated.deleteById("user-15");

      expect(prismaIsolated.userProfile.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user-15" },
      });
      expect(prismaIsolated.baseAvailability.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user-15" },
      });
      expect(
        prismaIsolated.weeklyAvailabilityOverride.deleteMany,
      ).toHaveBeenCalledWith({
        where: { userId: "user-15" },
      });
      expect(prismaIsolated.occupancy.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user-15" },
      });
      expect(prismaIsolated.user.upsert).toHaveBeenCalled();
    });
  });
});
