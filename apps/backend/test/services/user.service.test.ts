import type { UserDocument } from "../../src/models/user";
import UserModel from "../../src/models/user";
import { UserService } from "../../src/services/user.service";

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

import UserOrganizationModel from "../../src/models/user-organization";
import UserProfileModel from "../../src/models/user-profile";
import BaseAvailabilityModel from "../../src/models/base-availability";
import WeeklyAvailabilityOverrideModel from "../../src/models/weekly-availablity-override";
import { OccupancyModel } from "../../src/models/occupancy";
import { UserOrganizationService } from "../../src/services/user-organization.service";
import { OrganizationService } from "../../src/services/organization.service";

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
  });
});
