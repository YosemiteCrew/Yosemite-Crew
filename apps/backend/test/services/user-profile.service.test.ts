import UserProfileModel from "../../src/models/user-profile";
import {
  UserProfileService,
  UserProfileServiceError,
} from "../../src/services/user-profile.service";
import { BaseAvailabilityService } from "../../src/services/base-availability.service";
import UserOrganizationModel from "src/models/user-organization";
import { getURLForKey } from "src/middlewares/upload";

jest.mock("../../src/models/user-profile", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    create: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
}));

jest.mock("../../src/services/base-availability.service", () => {
  const actual = jest.requireActual(
    "../../src/services/base-availability.service",
  );
  return {
    ...actual,
    BaseAvailabilityService: {
      create: jest.fn(),
      update: jest.fn(),
      getByUserId: jest.fn(),
    },
  };
});

jest.mock("src/models/user-organization", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
  },
}));

jest.mock("src/middlewares/upload", () => ({
  __esModule: true,
  getURLForKey: jest.fn((key: string) => `https://cf-base/${key ?? ""}`),
}));

const mockedModel = UserProfileModel as unknown as {
  findOne: jest.Mock;
  create: jest.Mock;
  findOneAndUpdate: jest.Mock;
};

const mockedAvailabilityService = BaseAvailabilityService as unknown as {
  create: jest.Mock;
  update: jest.Mock;
  getByUserId: jest.Mock;
};

const mockedUserOrganizationModel = UserOrganizationModel as unknown as {
  findOne: jest.Mock;
};

const mockedGetURLForKey = getURLForKey as jest.Mock;

describe("UserProfileService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("creates profile when none exists", async () => {
      mockedModel.findOne.mockResolvedValueOnce(null);

      const createdAt = new Date("2024-01-01T00:00:00.000Z");
      const updatedAt = new Date("2024-01-02T00:00:00.000Z");

      const docData = {
        _id: "profile-id",
        userId: "user-1",
        organizationId: "org-1",
        personalDetails: {
          gender: "MALE",
          employmentType: "FULL_TIME",
          phoneNumber: "+1234567890",
          address: {
            addressLine: "221B Baker Street",
            city: "London",
            state: "Greater London",
            postalCode: "NW1 6XE",
            country: "UK",
          },
          profilePictureUrl: "https://cf-base/avatar.jpg",
        },
        professionalDetails: {
          medicalLicenseNumber: "LIC-123",
          specialization: "Dermatology",
          qualification: "BVetMed",
        },
        status: "DRAFT" as const,
      };

      const document = {
        ...docData,
        toObject: () => ({ ...docData }),
        createdAt,
        updatedAt,
        save: jest.fn().mockImplementation(function (this: any) {
          docData.status = this.status;
          return Promise.resolve();
        }),
      } as any;

      mockedModel.create.mockResolvedValueOnce(document);
      mockedAvailabilityService.getByUserId.mockResolvedValueOnce([
        {
          _id: "avail-1",
          userId: "user-1",
          dayOfWeek: "MONDAY",
          slots: [{ startTime: "09:00", endTime: "17:00", isAvailable: true }],
        },
      ]);

      const result = await UserProfileService.create({
        userId: "user-1",
        organizationId: "org-1",
        personalDetails: {
          gender: "MALE",
          employmentType: "FULL_TIME",
          phoneNumber: "+1234567890",
          address: {
            addressLine: "221B Baker Street",
            city: "London",
            state: "Greater London",
            postalCode: "NW1 6XE",
            country: "UK",
          },
          profilePictureUrl: "avatar.jpg",
        },
        professionalDetails: {
          medicalLicenseNumber: "LIC-123",
          specialization: "Dermatology",
          qualification: "BVetMed",
        },
      });

      expect(mockedModel.findOne).toHaveBeenCalledWith(
        { userId: "user-1", organizationId: "org-1" },
        null,
        { sanitizeFilter: true },
      );
      expect(mockedGetURLForKey).toHaveBeenCalledWith("avatar.jpg");
      expect(mockedModel.create).toHaveBeenCalledTimes(1);
      const createPayload = mockedModel.create.mock.calls[0][0];
      expect(createPayload.personalDetails.profilePictureUrl).toBe(
        "https://cf-base/avatar.jpg",
      );
      expect(createPayload).toMatchObject({
        userId: "user-1",
        organizationId: "org-1",
        personalDetails: {
          gender: "MALE",
          employmentType: "FULL_TIME",
          phoneNumber: "+1234567890",
          address: {
            addressLine: "221B Baker Street",
            city: "London",
            state: "Greater London",
            postalCode: "NW1 6XE",
            country: "UK",
          },
        },
        professionalDetails: {
          medicalLicenseNumber: "LIC-123",
          specialization: "Dermatology",
          qualification: "BVetMed",
        },
      });
      expect(mockedAvailabilityService.getByUserId).toHaveBeenCalledWith(
        "user-1",
      );
      expect(document.save).toHaveBeenCalled();
      expect(result).toEqual({
        _id: "profile-id",
        userId: "user-1",
        organizationId: "org-1",
        personalDetails: {
          gender: "MALE",
          employmentType: "FULL_TIME",
          phoneNumber: "+1234567890",
          address: {
            addressLine: "221B Baker Street",
            city: "London",
            state: "Greater London",
            postalCode: "NW1 6XE",
            country: "UK",
          },
          profilePictureUrl: "https://cf-base/avatar.jpg",
        },
        professionalDetails: {
          medicalLicenseNumber: "LIC-123",
          specialization: "Dermatology",
          qualification: "BVetMed",
        },
        status: "COMPLETED",
        createdAt,
        updatedAt,
      });
    });

    it("throws when profile already exists", async () => {
      mockedModel.findOne.mockResolvedValueOnce({});

      await expect(
        UserProfileService.create({
          userId: "user-1",
          organizationId: "org-1",
        }),
      ).rejects.toMatchObject({
        message: "Profile already exists for this user in this organization.",
        statusCode: 409,
      });
    });

    it("validates payload", async () => {
      await expect(
        UserProfileService.create({
          userId: "",
          organizationId: "org-1",
        }),
      ).rejects.toBeInstanceOf(UserProfileServiceError);
    });
  });

  describe("update", () => {
    it("updates existing profile", async () => {
      const updatedAt = new Date("2024-03-01T00:00:00.000Z");

      const updateDocData = {
        _id: "profile-id",
        userId: "user-1",
        organizationId: "org-1",
        professionalDetails: {
          medicalLicenseNumber: "LIC-123",
          specialization: "Oncology",
          qualification: "MVSc",
        },
        personalDetails: {
          gender: "FEMALE",
          employmentType: "FULL_TIME",
          phoneNumber: "+1234567890",
          address: {
            addressLine: "221B Baker Street",
            city: "London",
            state: "Greater London",
            postalCode: "NW1 6XE",
            country: "UK",
          },
        },
        status: "DRAFT" as const,
      };

      const document = {
        ...updateDocData,
        toObject: () => ({ ...updateDocData }),
        createdAt: new Date("2024-02-01T00:00:00.000Z"),
        updatedAt,
        save: jest.fn().mockImplementation(function (this: any) {
          updateDocData.status = this.status;
          return Promise.resolve();
        }),
      } as any;

      mockedModel.findOneAndUpdate.mockResolvedValueOnce(document);
      mockedAvailabilityService.getByUserId.mockResolvedValueOnce([
        {
          _id: "avail-1",
          userId: "user-1",
          dayOfWeek: "TUESDAY",
          slots: [{ startTime: "10:00", endTime: "18:00", isAvailable: true }],
        },
      ]);

      const result = await UserProfileService.update("user-1", "org-1", {
        professionalDetails: {
          medicalLicenseNumber: "LIC-123",
          specialization: "Oncology",
          qualification: "MVSc",
        },
      });

      expect(mockedModel.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: "user-1", organizationId: "org-1" },
        {
          $set: {
            professionalDetails: {
              medicalLicenseNumber: "LIC-123",
              specialization: "Oncology",
              qualification: "MVSc",
            },
          },
        },
        { new: true, sanitizeFilter: true },
      );
      expect(mockedAvailabilityService.getByUserId).toHaveBeenCalledWith(
        "user-1",
      );
      expect(document.save).toHaveBeenCalled();
      expect(result).toEqual({
        _id: "profile-id",
        userId: "user-1",
        organizationId: "org-1",
        professionalDetails: {
          medicalLicenseNumber: "LIC-123",
          specialization: "Oncology",
          qualification: "MVSc",
        },
        personalDetails: {
          gender: "FEMALE",
          employmentType: "FULL_TIME",
          phoneNumber: "+1234567890",
          address: {
            addressLine: "221B Baker Street",
            city: "London",
            state: "Greater London",
            postalCode: "NW1 6XE",
            country: "UK",
          },
        },
        status: "COMPLETED",
        createdAt: new Date("2024-02-01T00:00:00.000Z"),
        updatedAt,
      });
    });

    it("returns null when profile missing", async () => {
      mockedModel.findOneAndUpdate.mockResolvedValueOnce(null);

      const result = await UserProfileService.update("user-1", "org-1", {
        personalDetails: { gender: "FEMALE" },
      });

      expect(result).toBeNull();
    });

    it("requires updatable fields", async () => {
      await expect(
        UserProfileService.update("user-1", "org-1", {}),
      ).rejects.toMatchObject({
        message: "No updatable fields provided.",
        statusCode: 400,
      });
    });
  });

  describe("getByUserId", () => {
    it("returns profile when found", async () => {
      const createdAt = new Date("2024-01-01T00:00:00.000Z");
      const getDocData = {
        _id: "profile-id",
        userId: "user-1",
        organizationId: "org-1",
        personalDetails: {},
        status: "DRAFT" as const,
      };

      const document = {
        ...getDocData,
        toObject: () => ({ ...getDocData }),
        createdAt,
        updatedAt: createdAt,
        save: jest.fn().mockImplementation(function (this: any) {
          getDocData.status = this.status;
          return Promise.resolve();
        }),
      } as any;

      mockedModel.findOne.mockResolvedValueOnce(document);
      mockedAvailabilityService.getByUserId.mockResolvedValueOnce([
        {
          _id: "avail-1",
          userId: "user-1",
          dayOfWeek: "MONDAY",
          slots: [{ startTime: "09:00", endTime: "17:00", isAvailable: false }],
        },
      ]);
      mockedUserOrganizationModel.findOne.mockResolvedValueOnce({
        practitionerReference: "user-1",
        organizationReference: "org-1",
      });

      const result = await UserProfileService.getByUserId("user-1", "org-1");

      expect(mockedModel.findOne).toHaveBeenCalledWith(
        { userId: "user-1", organizationId: "org-1" },
        null,
        { sanitizeFilter: true },
      );
      expect(mockedAvailabilityService.getByUserId).toHaveBeenCalledWith(
        "user-1",
      );
      expect(mockedUserOrganizationModel.findOne).toHaveBeenCalledWith({
        practitionerReference: "user-1",
        organizationReference: "org-1",
      });
      expect(result).toEqual({
        profile: {
          _id: "profile-id",
          userId: "user-1",
          organizationId: "org-1",
          personalDetails: {},
          status: "DRAFT",
          createdAt,
          updatedAt: createdAt,
        },
        mapping: {
          practitionerReference: "user-1",
          organizationReference: "org-1",
        },
        baseAvailability: [
          {
            _id: "avail-1",
            userId: "user-1",
            dayOfWeek: "MONDAY",
            slots: [
              { startTime: "09:00", endTime: "17:00", isAvailable: false },
            ],
          },
        ],
      });
    });

    it("uses existing availability when only profile fields update", async () => {
      const updateOnlyData = {
        _id: "profile-id",
        userId: "user-1",
        organizationId: "org-1",
        personalDetails: {
          gender: "MALE",
          employmentType: "FULL_TIME",
          phoneNumber: "+1234567890",
          address: {
            addressLine: "221B Baker Street",
            city: "London",
            state: "Greater London",
            postalCode: "NW1 6XE",
            country: "UK",
          },
        },
        professionalDetails: {
          medicalLicenseNumber: "LIC-123",
          specialization: "Derm",
          qualification: "MVSc",
        },
        status: "DRAFT" as const,
      };

      const document = {
        ...updateOnlyData,
        toObject: () => ({ ...updateOnlyData }),
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-01-01T00:00:00.000Z"),
        save: jest.fn().mockImplementation(function (this: any) {
          updateOnlyData.status = this.status;
          return Promise.resolve();
        }),
      } as any;

      mockedModel.findOneAndUpdate.mockResolvedValueOnce(document);
      mockedAvailabilityService.getByUserId.mockResolvedValueOnce([
        {
          _id: "avail-1",
          userId: "user-1",
          dayOfWeek: "MONDAY",
          slots: [{ startTime: "09:00", endTime: "17:00", isAvailable: true }],
        },
      ]);

      const result = await UserProfileService.update("user-1", "org-1", {
        personalDetails: { gender: "MALE" },
      });

      expect(mockedAvailabilityService.getByUserId).toHaveBeenCalledWith(
        "user-1",
      );
      expect(result).not.toBeNull();
      expect((result as NonNullable<typeof result>).status).toBe("COMPLETED");
      expect(document.save).toHaveBeenCalled();
    });

    it("returns null when missing", async () => {
      mockedModel.findOne.mockResolvedValueOnce(null);

      const result = await UserProfileService.getByUserId("user-2", "org-1");

      expect(result).toBeNull();
    });
  });
});
