import {
  UserProfileService,
  UserProfileServiceError,
} from "../../src/services/user-profile.service";
import {
  BaseAvailabilityService,
  BaseAvailabilityServiceError,
} from "../../src/services/base-availability.service";
import { getURLForKey } from "src/middlewares/upload";
import { prisma } from "src/config/prisma";

jest.mock("src/middlewares/upload", () => ({
  __esModule: true,
  getURLForKey: jest.fn((key) => `https://s3.example.com/${key}`),
}));

jest.mock("../../src/services/base-availability.service", () => ({
  BaseAvailabilityServiceError: class BaseAvailabilityServiceError extends Error {
    constructor(
      message: string,
      public statusCode: number,
    ) {
      super(message);
      this.name = "BaseAvailabilityServiceError";
    }
  },
  BaseAvailabilityService: {
    getByUserId: jest.fn(),
  },
}));

jest.mock("src/config/prisma", () => ({
  prisma: {
    userProfile: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    userProfileAddress: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    baseAvailability: {
      findMany: jest.fn(),
    },
    userOrganization: {
      findFirst: jest.fn(),
    },
  },
}));

describe("UserProfileService", () => {
  const userId = "user-1";
  const organizationId = "org-1";
  const createdId = "profile-1";

  const completeProfile = {
    userId,
    organizationId,
    personalDetails: {
      gender: "MALE",
      employmentType: "FULL_TIME",
      phoneNumber: "123",
      address: {
        addressLine: "Line 1",
        city: "City",
        state: "State",
        postalCode: "12345",
        country: "US",
      },
      profilePictureUrl: "picture.jpg",
    },
    professionalDetails: {
      medicalLicenseNumber: "LIC-1",
      specialization: "Surgery",
      qualification: "BVSc",
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("error type", () => {
    it("keeps status metadata", () => {
      const err = new UserProfileServiceError("Bad", 400);
      expect(err.message).toBe("Bad");
      expect(err.statusCode).toBe(400);
    });
  });

  describe("create", () => {
    it("creates a completed profile and applies default PMS preferences", async () => {
      (prisma.userProfile.findFirst as jest.Mock).mockResolvedValueOnce(null);
      (prisma.userProfile.create as jest.Mock).mockResolvedValueOnce({
        id: createdId,
        userId,
        organizationId,
        personalDetails: {
          ...completeProfile.personalDetails,
          profilePictureUrl: "https://s3.example.com/picture.jpg",
        },
        professionalDetails: completeProfile.professionalDetails,
        status: "DRAFT",
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-01-01T00:00:00.000Z"),
        address: {
          addressLine: "Line 1",
          city: "City",
          state: "State",
          postalCode: "12345",
          country: "US",
          latitude: null,
          longitude: null,
        },
      });
      (prisma.userProfile.findUnique as jest.Mock).mockResolvedValueOnce({
        id: createdId,
        userId,
        organizationId,
        personalDetails: {
          ...completeProfile.personalDetails,
          profilePictureUrl: "https://s3.example.com/picture.jpg",
        },
        professionalDetails: completeProfile.professionalDetails,
        status: "COMPLETED",
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-01-01T00:00:00.000Z"),
        address: {
          addressLine: "Line 1",
          city: "City",
          state: "State",
          postalCode: "12345",
          country: "US",
          latitude: null,
          longitude: null,
        },
      });
      (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValueOnce({
        roleCode: "OWNER",
      });
      (BaseAvailabilityService.getByUserId as jest.Mock).mockResolvedValueOnce([
        {
          slots: [{ startTime: "09:00", endTime: "10:00", isAvailable: true }],
        },
      ]);

      const result = await UserProfileService.create({
        userId,
        organizationId,
        personalDetails: completeProfile.personalDetails,
        professionalDetails: completeProfile.professionalDetails,
      });

      expect(getURLForKey).toHaveBeenCalledWith("picture.jpg");
      expect(prisma.userProfileAddress.upsert).toHaveBeenCalled();
      expect(prisma.userProfile.update).toHaveBeenCalledWith({
        where: { id: createdId },
        data: { status: "COMPLETED" },
      });
      expect(result.status).toBe("COMPLETED");
      expect(result.personalDetails?.pmsPreferences?.defaultOpenScreen).toBe(
        "DASHBOARD",
      );
    });

    it("maps availability failures from the base availability service", async () => {
      (prisma.userProfile.findFirst as jest.Mock).mockResolvedValueOnce(null);
      (prisma.userProfile.create as jest.Mock).mockResolvedValueOnce({
        id: createdId,
        userId,
        organizationId,
        personalDetails: null,
        professionalDetails: null,
        status: "DRAFT",
        createdAt: new Date(),
        updatedAt: new Date(),
        address: null,
      });
      (BaseAvailabilityService.getByUserId as jest.Mock).mockRejectedValueOnce(
        new BaseAvailabilityServiceError("Avail error", 503),
      );

      await expect(
        UserProfileService.create({ userId, organizationId }),
      ).rejects.toThrow(new UserProfileServiceError("Avail error", 503));
    });

    it("returns conflict when profile already exists", async () => {
      (prisma.userProfile.findFirst as jest.Mock).mockResolvedValueOnce({
        id: createdId,
      });

      await expect(
        UserProfileService.create({ userId, organizationId }),
      ).rejects.toThrow(
        new UserProfileServiceError(
          "Profile already exists for this user in this organization.",
          409,
        ),
      );
    });
  });

  describe("update", () => {
    it("returns null when profile is missing", async () => {
      (prisma.userProfile.findFirst as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        UserProfileService.update(userId, organizationId, {
          personalDetails: { gender: "MALE" },
        }),
      ).resolves.toBeNull();
    });

    it("updates the profile and recomputes status", async () => {
      (prisma.userProfile.findFirst as jest.Mock).mockResolvedValueOnce({
        id: createdId,
        userId,
        organizationId,
        personalDetails: completeProfile.personalDetails,
        professionalDetails: completeProfile.professionalDetails,
        status: "DRAFT",
        createdAt: new Date(),
        updatedAt: new Date(),
        address: {
          addressLine: "Line 1",
          city: "City",
          state: "State",
          postalCode: "12345",
          country: "US",
        },
      });
      (prisma.userProfile.update as jest.Mock)
        .mockResolvedValueOnce({
          id: createdId,
          userId,
          organizationId,
          personalDetails: completeProfile.personalDetails,
          professionalDetails: completeProfile.professionalDetails,
          status: "COMPLETED",
          createdAt: new Date(),
          updatedAt: new Date(),
          address: {
            addressLine: "Line 1",
            city: "City",
            state: "State",
            postalCode: "12345",
            country: "US",
          },
        })
        .mockResolvedValueOnce({
          id: createdId,
          userId,
          organizationId,
          personalDetails: completeProfile.personalDetails,
          professionalDetails: completeProfile.professionalDetails,
          status: "COMPLETED",
          createdAt: new Date(),
          updatedAt: new Date(),
          address: {
            addressLine: "Line 1",
            city: "City",
            state: "State",
            postalCode: "12345",
            country: "US",
          },
        });
      (prisma.userProfile.findUnique as jest.Mock).mockResolvedValueOnce({
        id: createdId,
        userId,
        organizationId,
        personalDetails: completeProfile.personalDetails,
        professionalDetails: completeProfile.professionalDetails,
        status: "COMPLETED",
        createdAt: new Date(),
        updatedAt: new Date(),
        address: {
          addressLine: "Line 1",
          city: "City",
          state: "State",
          postalCode: "12345",
          country: "US",
        },
      });
      (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValueOnce({
        roleCode: "OWNER",
      });
      (BaseAvailabilityService.getByUserId as jest.Mock).mockResolvedValueOnce([
        {
          slots: [{ startTime: "09:00", endTime: "10:00", isAvailable: true }],
        },
      ]);

      const result = await UserProfileService.update(userId, organizationId, {
        personalDetails: completeProfile.personalDetails,
      });

      expect(result?.status).toBe("COMPLETED");
      expect(prisma.userProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: createdId },
        }),
      );
    });
  });

  describe("getByUserId", () => {
    it("returns null when the profile does not exist", async () => {
      (prisma.userProfile.findFirst as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        UserProfileService.getByUserId(userId, organizationId),
      ).resolves.toBeNull();
    });

    it("returns profile, mapping, and availability", async () => {
      (prisma.userProfile.findFirst as jest.Mock).mockResolvedValueOnce({
        id: createdId,
        userId,
        organizationId,
        personalDetails: completeProfile.personalDetails,
        professionalDetails: completeProfile.professionalDetails,
        status: "DRAFT",
        createdAt: new Date(),
        updatedAt: new Date(),
        address: {
          addressLine: "Line 1",
          city: "City",
          state: "State",
          postalCode: "12345",
          country: "US",
        },
      });
      (prisma.baseAvailability.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: "avail-1",
          userId,
          dayOfWeek: "MONDAY",
          slots: [{ startTime: "09:00", endTime: "10:00", isAvailable: true }],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValueOnce({
        id: "mapping-1",
        roleCode: "OWNER",
      });

      const result = await UserProfileService.getByUserId(
        userId,
        organizationId,
      );

      expect(result?.mapping).toMatchObject({
        id: "mapping-1",
        _id: "mapping-1",
        roleCode: "OWNER",
      });
      expect(result?.baseAvailability).toHaveLength(1);
      expect(
        result?.profile.personalDetails?.pmsPreferences?.defaultOpenScreen,
      ).toBe("DASHBOARD");
    });
  });
});
