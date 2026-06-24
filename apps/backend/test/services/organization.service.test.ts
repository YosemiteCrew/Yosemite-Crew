import {
  OrganizationService,
  OrganizationServiceError,
} from "../../src/services/organization.service";
import { UserOrganizationService } from "../../src/services/user-organization.service";
import { SpecialityService } from "../../src/services/speciality.service";
import { OrganisationRoomService } from "../../src/services/organisation-room.service";
import { buildS3Key, moveFile } from "../../src/middlewares/upload";
import * as TypesPkg from "@yosemite-crew/types";
import { prisma } from "src/config/prisma";

jest.mock("../../src/services/user-organization.service", () => ({
  UserOrganizationService: {
    createUserOrganizationMapping: jest.fn(),
    deleteAllByOrganizationId: jest.fn(),
  },
}));

jest.mock("../../src/services/speciality.service", () => ({
  SpecialityService: {
    deleteAllByOrganizationId: jest.fn(),
  },
}));

jest.mock("../../src/services/organisation-room.service", () => ({
  OrganisationRoomService: {
    deleteAllByOrganizationId: jest.fn(),
  },
}));

jest.mock("../../src/middlewares/upload", () => ({
  buildS3Key: jest.fn(() => "org/key"),
  moveFile: jest.fn(),
}));

jest.mock("@yosemite-crew/types", () => ({
  fromOrganizationRequestDTO: jest.fn((dto) => dto),
  toOrganizationResponseDTO: jest.fn((org, options) => ({
    ...org,
    ...options,
  })),
}));

jest.mock("src/utils/logger", () => ({
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock("src/utils/dual-write", () => ({
  shouldDualWrite: false,
  isDualWriteStrict: false,
  handleDualWriteError: jest.fn(),
}));

jest.mock("src/config/prisma", () => ({
  prisma: {
    organization: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    organizationAddress: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    organizationBilling: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    organizationUsageCounter: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      upsert: jest.fn(),
    },
    userProfile: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    speciality: {
      findMany: jest.fn(),
    },
    service: {
      findMany: jest.fn(),
    },
  },
}));

describe("OrganizationService", () => {
  const orgId = "org-1";
  const userId = "user-1";

  const baseDto: any = {
    resourceType: "Organization",
    id: orgId,
    name: "Test Hospital",
    phoneNo: "1234567890",
    type: "HOSPITAL",
    taxId: "TAX-123",
    imageURL: "https://example.com/image.jpg",
    appointmentLockWindowOutpatientMinutes: 30,
    appointmentLockWindowInpatientMinutes: 60,
  };

  const baseOrg = {
    id: orgId,
    fhirId: orgId,
    name: "Test Hospital",
    taxId: "TAX-123",
    dunsNumber: null,
    imageUrl: "https://example.com/image.jpg",
    phoneNo: "1234567890",
    type: "HOSPITAL",
    petNamePreference: null,
    website: null,
    documensoTeamId: null,
    documensoApiKey: null,
    isVerified: true,
    isActive: true,
    typeCoding: null,
    healthAndSafetyCertNo: null,
    animalWelfareComplianceCertNo: null,
    fireAndEmergencyCertNo: null,
    googlePlacesId: null,
    stripeAccountId: null,
    averageRating: null,
    ratingCount: null,
    appointmentCheckInBufferMinutes: 5,
    appointmentCheckInRadiusMeters: 200,
    appointmentLockWindowOutpatientMinutes: 30,
    appointmentLockWindowInpatientMinutes: 60,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    address: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (TypesPkg.fromOrganizationRequestDTO as jest.Mock).mockReturnValue({
      ...baseDto,
    });
  });

  describe("OrganizationServiceError", () => {
    it("keeps message and status code", () => {
      const err = new OrganizationServiceError("Boom", 500);
      expect(err.message).toBe("Boom");
      expect(err.statusCode).toBe(500);
    });
  });

  describe("upsert", () => {
    it("creates a new organisation and related records", async () => {
      (prisma.organization.findFirst as jest.Mock).mockResolvedValueOnce(null);
      (prisma.organization.create as jest.Mock).mockResolvedValueOnce(baseOrg);
      (
        prisma.organization.findUniqueOrThrow as jest.Mock
      ).mockResolvedValueOnce(baseOrg);
      (prisma.userProfile.findFirst as jest.Mock).mockResolvedValueOnce(null);

      const result = await OrganizationService.upsert(baseDto, userId);

      expect(prisma.organizationBilling.create).toHaveBeenCalledWith({
        data: { orgId },
      });
      expect(prisma.organization.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            appointmentLockWindowOutpatientMinutes: 30,
            appointmentLockWindowInpatientMinutes: 60,
          }),
        }),
      );
      expect(prisma.organizationUsageCounter.create).toHaveBeenCalledWith({
        data: { orgId },
      });
      expect(
        UserOrganizationService.createUserOrganizationMapping,
      ).toHaveBeenCalledWith({
        practitionerReference: userId,
        organizationReference: orgId,
        roleCode: "OWNER",
        active: true,
      });
      expect(prisma.userProfile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId,
            organizationId: orgId,
            status: "DRAFT",
          }),
        }),
      );
      expect(result.created).toBe(true);
      expect(result.response.name).toBe("Test Hospital");
      expect(TypesPkg.toOrganizationResponseDTO).toHaveBeenCalledWith(
        expect.objectContaining({
          appointmentLockWindowOutpatientMinutes: 30,
          appointmentLockWindowInpatientMinutes: 60,
        }),
        undefined,
      );
    });

    it("uploads a local image URL during create", async () => {
      (TypesPkg.fromOrganizationRequestDTO as jest.Mock).mockReturnValueOnce({
        ...baseDto,
        imageURL: "http://example.com/image.jpg",
      });
      (prisma.organization.findFirst as jest.Mock).mockResolvedValueOnce(null);
      (prisma.organization.create as jest.Mock).mockResolvedValueOnce(baseOrg);
      (
        prisma.organization.findUniqueOrThrow as jest.Mock
      ).mockResolvedValueOnce({
        ...baseOrg,
        imageUrl: "https://cdn.example.com/org/key",
      });
      (prisma.userProfile.findFirst as jest.Mock).mockResolvedValueOnce(null);
      (moveFile as jest.Mock).mockResolvedValueOnce(
        "https://cdn.example.com/org/key",
      );

      await OrganizationService.upsert(
        {
          ...baseDto,
          imageURL: "http://example.com/image.jpg",
        },
        userId,
      );

      expect(buildS3Key).toHaveBeenCalledWith("org", orgId, "image/jpg");
      expect(moveFile).toHaveBeenCalledWith(
        "http://example.com/image.jpg",
        "org/key",
      );
      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: orgId },
        data: { imageUrl: "https://cdn.example.com/org/key" },
      });
    });

    it("updates an existing organisation", async () => {
      (prisma.organization.findFirst as jest.Mock).mockResolvedValueOnce(
        baseOrg,
      );
      (prisma.organization.update as jest.Mock).mockResolvedValueOnce(baseOrg);
      (
        prisma.organization.findUniqueOrThrow as jest.Mock
      ).mockResolvedValueOnce(baseOrg);

      const result = await OrganizationService.upsert(baseDto);

      expect(prisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: orgId },
          data: expect.objectContaining({
            appointmentLockWindowOutpatientMinutes: 30,
            appointmentLockWindowInpatientMinutes: 60,
          }),
        }),
      );
      expect(result.created).toBe(false);
    });
  });

  describe("lookups", () => {
    it("returns null when getById receives empty input", async () => {
      await expect(OrganizationService.getById("   ")).resolves.toBeNull();
    });

    it("returns null for invalid update identifiers", async () => {
      await expect(
        OrganizationService.update("   ", baseDto),
      ).resolves.toBeNull();
    });

    it("returns organizations from prisma for getById and listAll", async () => {
      (prisma.organization.findFirst as jest.Mock).mockResolvedValueOnce(
        baseOrg,
      );
      (prisma.organization.findMany as jest.Mock).mockResolvedValueOnce([
        baseOrg,
      ]);

      const single = await OrganizationService.getById(orgId);
      const list = await OrganizationService.listAll();

      expect(single?.name).toBe("Test Hospital");
      expect(list).toHaveLength(1);
    });

    it("resolves organisations by place, lat/lng, and name", async () => {
      (prisma.organization.findFirst as jest.Mock)
        .mockResolvedValueOnce({
          ...baseOrg,
          googlePlacesId: "place-1",
        })
        .mockResolvedValueOnce({
          ...baseOrg,
          name: "Hospital One",
        });

      (prisma.organization.findMany as jest.Mock).mockResolvedValueOnce([
        {
          ...baseOrg,
          id: "org-latlng",
          name: "Nearby",
          address: {
            addressLine: "Line 1",
            country: "US",
            city: "City",
            state: "CA",
            postalCode: "90001",
            latitude: 10,
            longitude: 20,
            location: null,
          },
        },
      ]);

      await expect(
        OrganizationService.resolveOrganisation({ placeId: "place-1" }),
      ).resolves.toMatchObject({ isPmsOrganisation: true });
      await expect(
        OrganizationService.resolveOrganisation({ lat: 10, lng: 20 }),
      ).resolves.toMatchObject({ isPmsOrganisation: true });
      await expect(
        OrganizationService.resolveOrganisation({ name: "Hospital" }),
      ).resolves.toMatchObject({ isPmsOrganisation: true });
    });

    it("returns a non-PMS result when no organisation matches", async () => {
      (prisma.organization.findFirst as jest.Mock).mockResolvedValueOnce(null);
      (prisma.organization.findMany as jest.Mock).mockResolvedValueOnce([]);

      await expect(
        OrganizationService.resolveOrganisation({
          placeId: "missing-place",
          lat: 1,
          lng: 2,
          name: "Missing",
        }),
      ).resolves.toEqual({ isPmsOrganisation: false });
    });

    it("rejects invalid search input and bad coordinates", async () => {
      await expect(
        OrganizationService.resolveOrganisation({} as never),
      ).rejects.toEqual(
        expect.objectContaining({
          message: "Invalid search input.",
          statusCode: 400,
        }),
      );

      await expect(
        OrganizationService.listNearbyForAppointmentsPaginated(Number.NaN, 20),
      ).rejects.toThrow("lat/lng are required");
    });
  });

  describe("mutations", () => {
    it("deletes and updates records through prisma", async () => {
      (prisma.organization.findFirst as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(baseOrg)
        .mockResolvedValueOnce(baseOrg)
        .mockResolvedValueOnce(baseOrg)
        .mockResolvedValueOnce(baseOrg);
      (prisma.organization.update as jest.Mock).mockResolvedValue(baseOrg);
      (prisma.organization.findUniqueOrThrow as jest.Mock).mockResolvedValue(
        baseOrg,
      );

      await expect(OrganizationService.deleteById("missing")).resolves.toBe(
        false,
      );
      await expect(OrganizationService.deleteById(orgId)).resolves.toBe(true);
      await expect(
        OrganizationService.update(orgId, baseDto),
      ).resolves.toBeDefined();
      await expect(
        OrganizationService.upadtePofileVerificationStatus(orgId, true),
      ).resolves.toBeDefined();
      await expect(
        OrganizationService.updateProfilePhotoUrl(orgId, "url"),
      ).resolves.toBeDefined();

      expect(
        UserOrganizationService.deleteAllByOrganizationId,
      ).toHaveBeenCalledWith(orgId);
      expect(SpecialityService.deleteAllByOrganizationId).toHaveBeenCalledWith(
        orgId,
      );
      expect(
        OrganisationRoomService.deleteAllByOrganizationId,
      ).toHaveBeenCalledWith(orgId);
    });

    it("returns false for invalid delete identifiers", async () => {
      await expect(OrganizationService.deleteById("   ")).resolves.toBe(false);
    });
  });

  describe("nearby", () => {
    it("returns paginated nearby organizations", async () => {
      (prisma.organization.findMany as jest.Mock)
        .mockResolvedValueOnce([
          {
            ...baseOrg,
            id: "org-near",
            name: "Nearby",
            address: {
              addressLine: "Line 1",
              country: "US",
              city: "City",
              state: "CA",
              postalCode: "90001",
              latitude: 10,
              longitude: 20,
              location: null,
            },
          },
        ])
        .mockResolvedValueOnce([
          {
            ...baseOrg,
            id: "org-near",
            name: "Nearby",
            address: {
              addressLine: "Line 1",
              country: "US",
              city: "City",
              state: "CA",
              postalCode: "90001",
              latitude: 10,
              longitude: 20,
              location: null,
            },
          },
        ]);
      (prisma.speciality.findMany as jest.Mock).mockResolvedValueOnce([
        { id: "spec-1", organisationId: "org-near" },
      ]);
      (prisma.service.findMany as jest.Mock).mockResolvedValueOnce([
        { id: "srv-1", specialityId: "spec-1" },
      ]);

      const result =
        await OrganizationService.listNearbyForAppointmentsPaginated(
          10,
          20,
          500,
          1,
          10,
        );

      expect(result.meta.total).toBe(1);
      expect(result.data[0].specialitiesWithServices).toHaveLength(1);
    });
  });
});
