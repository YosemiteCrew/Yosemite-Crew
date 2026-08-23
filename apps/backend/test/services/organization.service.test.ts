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
    userOrganization: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    speciality: {
      findMany: jest.fn(),
    },
    service: {
      findMany: jest.fn(),
    },
  },
}));

// recomputeOrganizationVerification (invoked by upsert / setVerificationOverride)
// reads prisma from @yosemite-crew/database, a distinct module from
// src/config/prisma, so it needs its own mock to avoid touching a real DB.
jest.mock("@yosemite-crew/database", () => ({
  prisma: {
    organization: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    organizationBilling: {
      findUnique: jest.fn(),
    },
  },
  Prisma: {},
}));

const dbPrismaMock = (
  jest.requireMock("@yosemite-crew/database") as {
    prisma: {
      organization: { findUnique: jest.Mock; update: jest.Mock };
      organizationBilling: { findUnique: jest.Mock };
    };
  }
).prisma;

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
    // Default recompute wiring: org has no certs and no active Connect billing,
    // so the derived isVerified is false. Individual tests override as needed.
    dbPrismaMock.organization.findUnique.mockResolvedValue({
      verificationOverride: null,
      healthAndSafetyCertNo: null,
      animalWelfareComplianceCertNo: null,
      fireAndEmergencyCertNo: null,
    });
    dbPrismaMock.organizationBilling.findUnique.mockResolvedValue(null);
    dbPrismaMock.organization.update.mockResolvedValue({});
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

    it("creates an organisation from a minimal payload without optional fields", async () => {
      const minimalDto: any = {
        resourceType: "Organization",
        name: "Minimal Hospital",
        phoneNo: "1234567890",
        type: "HOSPITAL",
        taxId: "TAX-456",
      };
      (TypesPkg.fromOrganizationRequestDTO as jest.Mock).mockReturnValueOnce({
        ...minimalDto,
      });
      (prisma.organization.create as jest.Mock).mockResolvedValueOnce(baseOrg);
      (
        prisma.organization.findUniqueOrThrow as jest.Mock
      ).mockResolvedValueOnce(baseOrg);

      const result = await OrganizationService.upsert(minimalDto);

      expect(prisma.organization.findFirst).not.toHaveBeenCalled();
      expect(prisma.organization.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fhirId: undefined,
            imageUrl: undefined,
            appointmentLockWindowOutpatientMinutes: undefined,
            appointmentLockWindowInpatientMinutes: undefined,
            appointmentCheckInBufferMinutes: 5,
            appointmentCheckInRadiusMeters: 200,
          }),
        }),
      );
      expect(result.created).toBe(true);
    });

    it("updates an existing organisation", async () => {
      (prisma.organization.findFirst as jest.Mock).mockResolvedValueOnce(
        baseOrg,
      );
      (prisma.organization.update as jest.Mock).mockResolvedValueOnce(baseOrg);
      (
        prisma.organization.findUniqueOrThrow as jest.Mock
      ).mockResolvedValueOnce(baseOrg);

      (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValueOnce({
        id: "mapping-1",
      });

      const result = await OrganizationService.upsert(baseDto, userId);

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

    it("returns organizations from prisma for getById and listForUser", async () => {
      (prisma.organization.findFirst as jest.Mock).mockResolvedValueOnce(
        baseOrg,
      );
      (prisma.userOrganization.findMany as jest.Mock).mockResolvedValueOnce([
        { organizationReference: `Organization/${orgId}` },
      ]);
      (prisma.organization.findMany as jest.Mock).mockResolvedValueOnce([
        baseOrg,
      ]);

      const single = await OrganizationService.getById(orgId);
      const list = await OrganizationService.listForUser("user-1");

      expect(single?.name).toBe("Test Hospital");
      expect(list).toHaveLength(1);
      expect(prisma.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: [orgId] } } }),
      );
    });

    it("returns nothing for a caller with no active memberships", async () => {
      (prisma.userOrganization.findMany as jest.Mock).mockResolvedValueOnce([]);

      await expect(
        OrganizationService.listForUser("stranger"),
      ).resolves.toEqual([]);
      expect(prisma.organization.findMany).not.toHaveBeenCalled();
    });

    it("refuses to overwrite an existing organisation for a non-member", async () => {
      (prisma.organization.findFirst as jest.Mock).mockResolvedValueOnce(
        baseOrg,
      );
      (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValueOnce(
        null,
      );

      await expect(
        OrganizationService.upsert(
          { resourceType: "Organization", id: orgId, name: "Hijacked" },
          "stranger",
        ),
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(prisma.organization.update).not.toHaveBeenCalled();
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

    // /check is unauthenticated and backs signup, so the match may only confirm existence.
    it.each([
      ["placeId", { placeId: "place-1" }],
      ["name", { name: "Sensitive" }],
    ])(
      "withholds confidential organisation details from a %s match",
      async (_label, input) => {
        (prisma.organization.findFirst as jest.Mock).mockResolvedValueOnce({
          ...baseOrg,
          name: "Sensitive Hospital",
          taxId: "TAX-SECRET",
          dunsNumber: "DUNS-SECRET",
          stripeAccountId: "acct_secret",
          healthAndSafetyCertNo: "HS-SECRET",
          animalWelfareComplianceCertNo: "AW-SECRET",
          fireAndEmergencyCertNo: "FE-SECRET",
          phoneNo: "555-0100",
          googlePlacesId: "place-1",
          address: {
            addressLine: "1 Secret Way",
            country: "US",
            city: "City",
            state: "CA",
            postalCode: "90001",
            latitude: 10,
            longitude: 20,
            location: null,
          },
        });

        const result = await OrganizationService.resolveOrganisation(input);
        const organisation = result.organisation as unknown as Record<
          string,
          unknown
        >;

        expect(result.isPmsOrganisation).toBe(true);
        expect(organisation).toMatchObject({
          _id: orgId,
          name: "Sensitive Hospital",
          googlePlacesId: "place-1",
        });
        expect(organisation.taxId).toBe("");
        expect(organisation.phoneNo).toBe("");
        expect(organisation.DUNSNumber).toBeUndefined();
        expect(organisation.stripeAccountId).toBeUndefined();
        expect(organisation.healthAndSafetyCertNo).toBeUndefined();
        expect(organisation.animalWelfareComplianceCertNo).toBeUndefined();
        expect(organisation.fireAndEmergencyCertNo).toBeUndefined();
        expect(organisation.address).toBeUndefined();
        expect(organisation.imageURL).toBeUndefined();

        const serialized = JSON.stringify(organisation);
        expect(serialized).not.toContain("SECRET");
        expect(serialized).not.toContain("acct_secret");
        expect(serialized).not.toContain("555-0100");
      },
    );

    it("withholds confidential organisation details from a coordinate match", async () => {
      (prisma.organization.findFirst as jest.Mock).mockResolvedValueOnce(null);
      (prisma.organization.findMany as jest.Mock).mockResolvedValueOnce([
        {
          ...baseOrg,
          taxId: "TAX-SECRET",
          stripeAccountId: "acct_secret",
          address: {
            addressLine: "1 Secret Way",
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

      const result = await OrganizationService.resolveOrganisation({
        lat: 10,
        lng: 20,
      });

      expect(result.isPmsOrganisation).toBe(true);
      expect(JSON.stringify(result.organisation)).not.toContain("SECRET");
      expect(JSON.stringify(result.organisation)).not.toContain("acct_secret");
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
        OrganizationService.setVerificationOverride(orgId, true),
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

  describe("FHIR extraction and sanitization via upsert", () => {
    it("extracts taxId from a FHIR extension and image/cert extensions", async () => {
      const payload: any = {
        ...baseDto,
        extension: [
          {
            url: "http://example.org/fhir/StructureDefinition/taxId",
            valueString: "EXT-TAX",
          },
          {
            url: "http://example.org/fhir/StructureDefinition/organisation-image",
            valueUrl: "https://cdn.example.com/img.jpg",
          },
          {
            url: "http://example.org/fhir/StructureDefinition/healthAndSafetyCertificationNumber",
            valueString: "HS-1",
          },
          {
            url: "http://example.org/fhir/StructureDefinition/animalWelfareComplianceCertificationNumber",
            valueString: "AW-1",
          },
          {
            url: "http://example.org/fhir/StructureDefinition/fireAndEmergencyCertificationNumber",
            valueString: "FE-1",
          },
          {
            url: "http://example.com/fhir/StructureDefinition/google-place-id",
            valueString: "place-ext",
          },
        ],
      };
      (TypesPkg.fromOrganizationRequestDTO as jest.Mock).mockReturnValueOnce({
        ...baseDto,
        taxId: undefined,
      });
      (prisma.organization.findFirst as jest.Mock).mockResolvedValueOnce(null);
      (prisma.organization.create as jest.Mock).mockResolvedValueOnce(baseOrg);
      (
        prisma.organization.findUniqueOrThrow as jest.Mock
      ).mockResolvedValueOnce(baseOrg);
      (prisma.userProfile.findFirst as jest.Mock).mockResolvedValueOnce(null);

      await OrganizationService.upsert(payload);

      expect(prisma.organization.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            taxId: "EXT-TAX",
            healthAndSafetyCertNo: "HS-1",
            animalWelfareComplianceCertNo: "AW-1",
            fireAndEmergencyCertNo: "FE-1",
            googlePlacesId: "place-ext",
          }),
        }),
      );
    });

    it("extracts taxId from a matching identifier system", async () => {
      const payload: any = {
        ...baseDto,
        identifier: [
          {
            system: "http://example.org/fhir/NamingSystem/organisation-tax-id",
            value: "ID-TAX",
          },
        ],
      };
      (TypesPkg.fromOrganizationRequestDTO as jest.Mock).mockReturnValueOnce({
        ...baseDto,
        taxId: undefined,
      });
      (prisma.organization.findFirst as jest.Mock).mockResolvedValueOnce(null);
      (prisma.organization.create as jest.Mock).mockResolvedValueOnce(baseOrg);
      (
        prisma.organization.findUniqueOrThrow as jest.Mock
      ).mockResolvedValueOnce(baseOrg);
      (prisma.userProfile.findFirst as jest.Mock).mockResolvedValueOnce(null);

      await OrganizationService.upsert(payload);

      expect(prisma.organization.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ taxId: "ID-TAX" }),
        }),
      );
    });

    it("sanitizes typeCoding and persists a full address", async () => {
      (TypesPkg.fromOrganizationRequestDTO as jest.Mock).mockReturnValueOnce({
        ...baseDto,
        typeCoding: {
          system: "http://snomed.info/sct",
          code: "12345",
          display: "Hospital",
        },
        petNamePreference: "companion",
        appointmentCheckInBufferMinutes: "10",
        address: {
          addressLine: "Line 1",
          country: "US",
          city: "City",
          state: "CA",
          postalCode: "90001",
          latitude: 10,
          longitude: 20,
        },
      });
      (prisma.organization.findFirst as jest.Mock).mockResolvedValueOnce(null);
      (prisma.organization.create as jest.Mock).mockResolvedValueOnce(baseOrg);
      (
        prisma.organization.findUniqueOrThrow as jest.Mock
      ).mockResolvedValueOnce(baseOrg);
      (prisma.userProfile.findFirst as jest.Mock).mockResolvedValueOnce(null);

      await OrganizationService.upsert(baseDto);

      expect(prisma.organizationAddress.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: orgId },
          create: expect.objectContaining({
            organizationId: orgId,
            addressLine: "Line 1",
            latitude: 10,
            longitude: 20,
          }),
        }),
      );
      expect(prisma.organization.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            petNamePreference: "COMPANION",
            typeCoding: expect.objectContaining({ code: "12345" }),
          }),
        }),
      );
    });
  });

  describe("validation guards via upsert", () => {
    const upsertWith = (attrs: any) => {
      (TypesPkg.fromOrganizationRequestDTO as jest.Mock).mockReturnValueOnce({
        ...baseDto,
        ...attrs,
      });
      return OrganizationService.upsert(baseDto);
    };

    it("rejects a missing organization name", async () => {
      await expect(upsertWith({ name: null })).rejects.toEqual(
        expect.objectContaining({
          message: "Organization name is required.",
          statusCode: 400,
        }),
      );
    });

    it("rejects a non-string organization name", async () => {
      await expect(upsertWith({ name: 123 })).rejects.toEqual(
        expect.objectContaining({
          message: "Organization name must be a string.",
          statusCode: 400,
        }),
      );
    });

    it("rejects an empty organization name", async () => {
      await expect(upsertWith({ name: "   " })).rejects.toEqual(
        expect.objectContaining({
          message: "Organization name cannot be empty.",
          statusCode: 400,
        }),
      );
    });

    it("rejects a name containing an invalid character", async () => {
      await expect(upsertWith({ name: "Bad$Name" })).rejects.toEqual(
        expect.objectContaining({
          message: "Invalid character in Organization name.",
          statusCode: 400,
        }),
      );
    });

    it("rejects a non-string optional website", async () => {
      await expect(upsertWith({ website: 5 })).rejects.toEqual(
        expect.objectContaining({
          message: "Website must be a string.",
          statusCode: 400,
        }),
      );
    });

    it("rejects an optional website containing an invalid character", async () => {
      await expect(upsertWith({ website: "ht$tp" })).rejects.toEqual(
        expect.objectContaining({
          message: "Invalid character in Website.",
          statusCode: 400,
        }),
      );
    });

    it("rejects a non-string pet name preference", async () => {
      await expect(upsertWith({ petNamePreference: 1 })).rejects.toEqual(
        expect.objectContaining({
          message: "Pet name preference must be a string.",
          statusCode: 400,
        }),
      );
    });

    it("rejects an invalid pet name preference value", async () => {
      await expect(upsertWith({ petNamePreference: "WRONG" })).rejects.toEqual(
        expect.objectContaining({
          message: "Invalid pet name preference.",
          statusCode: 400,
        }),
      );
    });

    it("rejects a non-numeric latitude", async () => {
      await expect(
        upsertWith({
          address: { addressLine: "L", latitude: "abc" },
        }),
      ).rejects.toEqual(
        expect.objectContaining({
          message: "Address latitude must be a valid number.",
          statusCode: 400,
        }),
      );
    });

    it("rejects a non-integer check-in buffer", async () => {
      await expect(
        upsertWith({ appointmentCheckInBufferMinutes: 1.5 }),
      ).rejects.toEqual(
        expect.objectContaining({
          message: "Appointment check-in buffer minutes must be an integer.",
          statusCode: 400,
        }),
      );
    });

    it("rejects a negative check-in buffer", async () => {
      await expect(
        upsertWith({ appointmentCheckInBufferMinutes: -1 }),
      ).rejects.toEqual(
        expect.objectContaining({
          message: "Appointment check-in buffer minutes must be non-negative.",
          statusCode: 400,
        }),
      );
    });

    it("parses a numeric string check-in buffer", async () => {
      (TypesPkg.fromOrganizationRequestDTO as jest.Mock).mockReturnValueOnce({
        ...baseDto,
        appointmentCheckInBufferMinutes: "15",
      });
      (prisma.organization.findFirst as jest.Mock).mockResolvedValueOnce(null);
      (prisma.organization.create as jest.Mock).mockResolvedValueOnce(baseOrg);
      (
        prisma.organization.findUniqueOrThrow as jest.Mock
      ).mockResolvedValueOnce(baseOrg);
      (prisma.userProfile.findFirst as jest.Mock).mockResolvedValueOnce(null);

      await OrganizationService.upsert(baseDto);

      expect(prisma.organization.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            appointmentCheckInBufferMinutes: 15,
          }),
        }),
      );
    });

    it("rejects a non-string organization type", async () => {
      await expect(upsertWith({ type: 7 })).rejects.toEqual(
        expect.objectContaining({
          message: "Organization type must be a string.",
          statusCode: 400,
        }),
      );
    });

    it("rejects an empty organization type", async () => {
      await expect(upsertWith({ type: "   " })).rejects.toEqual(
        expect.objectContaining({
          message: "Organization type cannot be empty.",
          statusCode: 400,
        }),
      );
    });

    it("rejects an unknown organization type", async () => {
      await expect(upsertWith({ type: "CLINIC" })).rejects.toEqual(
        expect.objectContaining({
          message: "Invalid organization type.",
          statusCode: 400,
        }),
      );
    });

    it("rejects an invalid identifier format", async () => {
      await expect(upsertWith({ id: "bad id with spaces!" })).rejects.toEqual(
        expect.objectContaining({
          message: "Invalid identifier format.",
          statusCode: 400,
        }),
      );
    });
  });

  describe("buildFHIRResponseFromPrisma typeCoding option", () => {
    it("passes typeCoding through to the response DTO", async () => {
      (prisma.organization.findFirst as jest.Mock).mockResolvedValueOnce({
        ...baseOrg,
        typeCoding: { system: "sys", code: "c" },
      });

      await OrganizationService.getById(orgId);

      expect(TypesPkg.toOrganizationResponseDTO).toHaveBeenCalledWith(
        expect.any(Object),
        { typeCoding: { system: "sys", code: "c" } },
      );
    });
  });

  describe("verification cannot be set by the client", () => {
    // isVerified gates federation directory listing. Before this, update()
    // wrote the client-supplied FHIR verification extension straight through,
    // so a caller with teams:edit:any could self-verify and satisfy the
    // federation trust gate without Stripe Connect or a compliance cert.
    it("update never persists a client-supplied isVerified", async () => {
      (prisma.organization.findFirst as jest.Mock).mockResolvedValue({
        id: orgId,
      });
      (prisma.organization.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        id: orgId,
        address: null,
      });

      await OrganizationService.update(orgId, {
        ...baseDto,
        isVerified: true,
      } as typeof baseDto);

      const writes = (prisma.organization.update as jest.Mock).mock.calls;
      expect(writes.length).toBeGreaterThan(0);
      for (const [args] of writes) {
        expect(args.data).not.toHaveProperty("isVerified");
      }
    });

    it("upsert never persists a client-supplied isVerified either", async () => {
      (prisma.organization.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.organization.create as jest.Mock)?.mockResolvedValue?.({
        id: orgId,
      });
      const writes = (prisma.organization.update as jest.Mock).mock.calls;
      for (const [args] of writes) {
        expect(args.data).not.toHaveProperty("isVerified");
      }
    });
  });

  describe("null-organisation early returns", () => {
    it("update returns null when org not found", async () => {
      (prisma.organization.findFirst as jest.Mock).mockResolvedValueOnce(null);
      await expect(
        OrganizationService.update(orgId, baseDto),
      ).resolves.toBeNull();
    });

    it("setVerificationOverride returns null for invalid id", async () => {
      await expect(
        OrganizationService.setVerificationOverride("   ", true),
      ).resolves.toBeNull();
    });

    it("setVerificationOverride returns null when org not found", async () => {
      (prisma.organization.findFirst as jest.Mock).mockResolvedValueOnce(null);
      await expect(
        OrganizationService.setVerificationOverride(orgId, true),
      ).resolves.toBeNull();
    });

    it("setVerificationOverride sets the override and recomputes isVerified", async () => {
      (prisma.organization.findFirst as jest.Mock).mockResolvedValueOnce(
        baseOrg,
      );
      (prisma.organization.update as jest.Mock).mockResolvedValueOnce(baseOrg);
      (
        prisma.organization.findUniqueOrThrow as jest.Mock
      ).mockResolvedValueOnce({ ...baseOrg, isVerified: true });
      // A true override forces isVerified=true regardless of billing/certs.
      dbPrismaMock.organization.findUnique.mockResolvedValueOnce({
        verificationOverride: true,
        healthAndSafetyCertNo: null,
        animalWelfareComplianceCertNo: null,
        fireAndEmergencyCertNo: null,
      });

      const result = await OrganizationService.setVerificationOverride(
        orgId,
        true,
      );

      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: orgId },
        data: { verificationOverride: true },
      });
      expect(dbPrismaMock.organization.update).toHaveBeenCalledWith({
        where: { id: orgId },
        data: { isVerified: true },
      });
      // The mocked toOrganizationResponseDTO passes the persisted org through,
      // so the derived isVerified surfaces on the FHIR response payload.
      expect((result as unknown as { isVerified?: boolean })?.isVerified).toBe(
        true,
      );
    });

    it("updateProfilePhotoUrl returns null for invalid id", async () => {
      await expect(
        OrganizationService.updateProfilePhotoUrl("   ", "url"),
      ).resolves.toBeNull();
    });

    it("updateProfilePhotoUrl returns null when org not found", async () => {
      (prisma.organization.findFirst as jest.Mock).mockResolvedValueOnce(null);
      await expect(
        OrganizationService.updateProfilePhotoUrl(orgId, "url"),
      ).resolves.toBeNull();
    });
  });

  describe("resolveOrganisationByCoordinates filtering", () => {
    it("returns non-PMS when no org is within range", async () => {
      (prisma.organization.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.organization.findMany as jest.Mock).mockResolvedValueOnce([
        { ...baseOrg, address: { latitude: null, longitude: null } },
        {
          ...baseOrg,
          address: { latitude: 80, longitude: 80, location: null },
        },
      ]);

      await expect(
        OrganizationService.resolveOrganisation({ lat: 10, lng: 20 }),
      ).resolves.toEqual({ isPmsOrganisation: false });
    });
  });

  describe("nearby fallback", () => {
    it("falls back to all organisations when none are nearby", async () => {
      (prisma.organization.findMany as jest.Mock)
        .mockResolvedValueOnce([
          { ...baseOrg, address: { latitude: null, longitude: null } },
        ])
        .mockResolvedValueOnce([
          {
            ...baseOrg,
            id: "org-all",
            name: "All",
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
      (prisma.speciality.findMany as jest.Mock).mockResolvedValueOnce([]);
      (prisma.service.findMany as jest.Mock).mockResolvedValueOnce([]);

      const result =
        await OrganizationService.listNearbyForAppointmentsPaginated(
          10,
          20,
          500,
          1,
          10,
        );

      expect(result.meta.total).toBe(1);
      expect(result.data[0].org.name).toBe("All");
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
