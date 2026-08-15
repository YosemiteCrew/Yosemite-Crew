import { UserOrganizationService } from "../../src/services/user-organization.service";
import { AvailabilityService } from "../../src/services/availability.service";
import * as EmailUtils from "../../src/utils/email";
import { sendFreePlanLimitReachedEmail } from "../../src/utils/org-usage-notifications";
import { prisma } from "src/config/prisma";

jest.mock("../../src/services/availability.service", () => ({
  AvailabilityService: {
    getCurrentStatus: jest.fn(),
    getWeeklyWorkingHours: jest.fn(),
  },
}));

jest.mock("../../src/services/stripe.service", () => ({
  StripeService: {
    syncSubscriptionSeats: jest.fn(),
  },
}));

jest.mock("../../src/utils/org-usage-notifications", () => ({
  sendFreePlanLimitReachedEmail: jest.fn(),
}));

jest.mock("../../src/utils/email", () => ({
  sendEmailTemplate: jest.fn(),
}));

jest.mock("../../src/utils/logger", () => ({
  error: jest.fn(),
  warn: jest.fn(),
}));

jest.mock("@yosemite-crew/types", () => ({
  fromUserOrganizationRequestDTO: jest.fn((dto) => dto),
  toUserOrganizationResponseDTO: jest.fn((domain) => domain),
}));

jest.mock("src/config/prisma", () => ({
  prisma: {
    userOrganization: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    organization: {
      findFirst: jest.fn(),
    },
    organizationBilling: {
      findFirst: jest.fn(),
    },
    organizationUsageCounter: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      upsert: jest.fn(),
      create: jest.fn(),
      // Prisma exposes column references here so a filter can compare one column
      // against another; the sentinel stands in for the real FieldRef.
      fields: { freeUsersLimit: "FieldRef(freeUsersLimit)" },
    },
    user: {
      findFirst: jest.fn(),
    },
    userProfile: {
      findFirst: jest.fn(),
    },
    speciality: {
      findMany: jest.fn(),
    },
    occupancy: {
      count: jest.fn(),
    },
  },
}));

describe("UserOrganizationService", () => {
  const orgId = "org-1";
  const userId = "user-1";
  const mappingId = "map-1";

  const payload: any = {
    resourceType: "PractitionerRole",
    id: mappingId,
    practitionerReference: `Practitioner/${userId}`,
    organizationReference: `Organization/${orgId}`,
    roleCode: "VETERINARIAN",
    active: true,
  };

  const prismaMapping = {
    id: mappingId,
    fhirId: mappingId,
    practitionerReference: `Practitioner/${userId}`,
    organizationReference: `Organization/${orgId}`,
    roleCode: "VETERINARIAN",
    roleDisplay: null,
    active: true,
    extraPermissions: [],
    revokedPermissions: [],
    effectivePermissions: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DUAL_WRITE_ENABLED = "false";
    process.env.READ_FROM_POSTGRES = "true";
  });

  describe("create and upsert", () => {
    it("creates a new mapping and reserves a seat", async () => {
      (prisma.organization.findFirst as jest.Mock).mockResolvedValueOnce({
        id: orgId,
      });
      (prisma.organizationBilling.findFirst as jest.Mock).mockResolvedValueOnce(
        { plan: "pro" },
      );
      (
        prisma.organizationUsageCounter.upsert as jest.Mock
      ).mockResolvedValueOnce({ orgId });
      (
        prisma.organizationUsageCounter.update as jest.Mock
      ).mockResolvedValueOnce({ usersActiveCount: 1 });
      (prisma.userOrganization.create as jest.Mock).mockResolvedValueOnce(
        prismaMapping,
      );

      const result = await UserOrganizationService.create(payload);

      expect(result._id).toBe(mappingId);
      expect(prisma.organizationUsageCounter.update).toHaveBeenCalled();
    });

    it("reserves a free-plan seat with a single conditional update", async () => {
      (prisma.organization.findFirst as jest.Mock).mockResolvedValueOnce({
        id: orgId,
      });
      (prisma.organizationBilling.findFirst as jest.Mock).mockResolvedValueOnce(
        { plan: "free" },
      );
      (
        prisma.organizationUsageCounter.upsert as jest.Mock
      ).mockResolvedValueOnce({ orgId });
      (
        prisma.organizationUsageCounter.updateMany as jest.Mock
      ).mockResolvedValueOnce({ count: 1 });
      (
        prisma.organizationUsageCounter.findUnique as jest.Mock
      ).mockResolvedValueOnce({
        id: "usage-1",
        orgId,
        usersActiveCount: 1,
        freeUsersLimit: 10,
        appointmentsUsed: 0,
        freeAppointmentsLimit: 120,
        toolsUsed: 0,
        freeToolsLimit: 200,
      });
      (prisma.userOrganization.create as jest.Mock).mockResolvedValueOnce(
        prismaMapping,
      );

      await UserOrganizationService.create(payload);

      // The limit must be enforced by the database in the same statement that
      // increments, never by a separate read the caller can race.
      expect(prisma.organizationUsageCounter.updateMany).toHaveBeenCalledWith({
        where: {
          orgId,
          usersActiveCount: { lt: "FieldRef(freeUsersLimit)" },
        },
        data: { usersActiveCount: { increment: 1 } },
      });
      expect(prisma.organizationUsageCounter.update).not.toHaveBeenCalled();
    });

    it("stamps freeLimitReachedAt by row id and notifies when the seat fills the plan", async () => {
      (prisma.organization.findFirst as jest.Mock).mockResolvedValueOnce({
        id: orgId,
      });
      (prisma.organizationBilling.findFirst as jest.Mock).mockResolvedValueOnce(
        { plan: "free" },
      );
      (
        prisma.organizationUsageCounter.upsert as jest.Mock
      ).mockResolvedValueOnce({ orgId });
      // First updateMany reserves the seat, second stamps the limit.
      (prisma.organizationUsageCounter.updateMany as jest.Mock)
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 1 });
      (
        prisma.organizationUsageCounter.findUnique as jest.Mock
      ).mockResolvedValueOnce({
        id: "usage-1",
        orgId,
        freeLimitReachedAt: null,
        usersActiveCount: 10,
        freeUsersLimit: 10,
        appointmentsUsed: 0,
        freeAppointmentsLimit: 120,
        toolsUsed: 0,
        freeToolsLimit: 200,
      });
      (prisma.userOrganization.create as jest.Mock).mockResolvedValueOnce(
        prismaMapping,
      );

      await UserOrganizationService.create(payload);

      expect(
        prisma.organizationUsageCounter.updateMany,
      ).toHaveBeenLastCalledWith({
        where: { id: "usage-1", freeLimitReachedAt: null },
        data: { freeLimitReachedAt: expect.any(Date) },
      });
      expect(sendFreePlanLimitReachedEmail).toHaveBeenCalledWith(
        expect.objectContaining({ orgId }),
      );
    });

    it("rejects the join when the conditional seat reservation matches no row", async () => {
      (prisma.organization.findFirst as jest.Mock).mockResolvedValueOnce({
        id: orgId,
      });
      (prisma.organizationBilling.findFirst as jest.Mock).mockResolvedValueOnce(
        { plan: "free" },
      );
      (
        prisma.organizationUsageCounter.upsert as jest.Mock
      ).mockResolvedValueOnce({ orgId });
      (
        prisma.organizationUsageCounter.updateMany as jest.Mock
      ).mockResolvedValueOnce({ count: 0 });

      await expect(UserOrganizationService.create(payload)).rejects.toEqual(
        expect.objectContaining({
          message: "Free plan member limit reached.",
          statusCode: 403,
        }),
      );
      expect(prisma.userOrganization.create).not.toHaveBeenCalled();
    });

    it("releases the reserved seat when creating the mapping fails", async () => {
      (prisma.organization.findFirst as jest.Mock).mockResolvedValueOnce({
        id: orgId,
      });
      (prisma.organizationBilling.findFirst as jest.Mock).mockResolvedValueOnce(
        { plan: "pro" },
      );
      (
        prisma.organizationUsageCounter.upsert as jest.Mock
      ).mockResolvedValueOnce({ orgId });
      (
        prisma.organizationUsageCounter.update as jest.Mock
      ).mockResolvedValueOnce({ usersActiveCount: 1 });
      (prisma.userOrganization.create as jest.Mock).mockRejectedValueOnce(
        new Error("write failed"),
      );

      await expect(
        UserOrganizationService.createUserOrganizationMapping({
          practitionerReference: `Practitioner/${userId}`,
          organizationReference: `Organization/${orgId}`,
          roleCode: "VETERINARIAN",
          active: true,
        } as never),
      ).rejects.toThrow("write failed");

      // Without the rollback the seat stays reserved for a mapping that never existed.
      expect(prisma.organizationUsageCounter.update).toHaveBeenLastCalledWith({
        where: { orgId },
        data: { usersActiveCount: { decrement: 1 } },
      });
    });

    it("rejects unsupported resource types before persisting", async () => {
      await expect(
        UserOrganizationService.create({
          ...payload,
          resourceType: "Observation",
        } as never),
      ).rejects.toEqual(
        expect.objectContaining({
          message: "Invalid payload. Expected FHIR PractitionerRole resource.",
          statusCode: 400,
        }),
      );
    });

    it("rejects invalid role codes", async () => {
      await expect(
        UserOrganizationService.create({
          ...payload,
          roleCode: "NOT_A_ROLE",
        } as never),
      ).rejects.toEqual(
        expect.objectContaining({
          message: expect.stringContaining('Invalid roleCode "NOT_A_ROLE"'),
          statusCode: 400,
        }),
      );
    });

    it("creates via upsert and returns created true", async () => {
      (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValueOnce(
        null,
      );
      (prisma.organization.findFirst as jest.Mock).mockResolvedValueOnce({
        id: orgId,
      });
      (prisma.organizationBilling.findFirst as jest.Mock).mockResolvedValueOnce(
        { plan: "pro" },
      );
      (
        prisma.organizationUsageCounter.upsert as jest.Mock
      ).mockResolvedValueOnce({ orgId });
      (
        prisma.organizationUsageCounter.update as jest.Mock
      ).mockResolvedValueOnce({ usersActiveCount: 1 });
      (prisma.userOrganization.create as jest.Mock).mockResolvedValueOnce(
        prismaMapping,
      );

      const result = await UserOrganizationService.upsert(payload);

      expect(result.created).toBe(true);
      expect(result.response._id).toBe(mappingId);
    });

    it("updates an existing mapping and sends permission emails when changed", async () => {
      (prisma.userOrganization.findFirst as jest.Mock)
        .mockResolvedValueOnce(prismaMapping)
        .mockResolvedValueOnce({
          ...prismaMapping,
          roleCode: "RECEPTIONIST",
          effectivePermissions: [],
        });
      (prisma.organization.findFirst as jest.Mock).mockResolvedValue({
        id: orgId,
        name: "Org",
      });
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        email: "user@example.com",
        firstName: "Jane",
        lastName: "Doe",
      });
      (prisma.userOrganization.update as jest.Mock).mockResolvedValue({
        ...prismaMapping,
        roleCode: "OWNER",
      });

      const result = await UserOrganizationService.update(mappingId, {
        ...payload,
        roleCode: "OWNER",
      });

      await new Promise((resolve) => setImmediate(resolve));
      expect(result?._id).toBe(mappingId);
      expect(EmailUtils.sendEmailTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ templateId: "permissionsUpdated" }),
      );
    });
  });

  describe("lookups and deletion", () => {
    it("resolves mapping by id and reference", async () => {
      (prisma.userOrganization.findFirst as jest.Mock)
        .mockResolvedValueOnce(prismaMapping)
        .mockResolvedValueOnce(null);
      (prisma.userOrganization.findMany as jest.Mock).mockResolvedValueOnce([
        prismaMapping,
        {
          ...prismaMapping,
          id: "map-2",
          fhirId: "map-2",
        },
      ]);

      await expect(
        UserOrganizationService.getById(mappingId),
      ).resolves.toMatchObject({ _id: mappingId });
      await expect(
        UserOrganizationService.getById("Practitioner/user-1"),
      ).resolves.toHaveLength(2);
    });

    it("lists and deletes mappings", async () => {
      (prisma.userOrganization.findMany as jest.Mock).mockResolvedValueOnce([
        prismaMapping,
      ]);
      (prisma.userOrganization.findFirst as jest.Mock)
        .mockResolvedValueOnce(prismaMapping)
        .mockResolvedValueOnce(prismaMapping);
      (prisma.organization.findFirst as jest.Mock).mockResolvedValue({
        id: orgId,
      });

      const list = await UserOrganizationService.listAll();
      const deleted = await UserOrganizationService.deleteById(mappingId);

      expect(list).toHaveLength(1);
      expect(deleted).toBe(true);
      expect(prisma.userOrganization.delete).toHaveBeenCalledWith({
        where: { id: mappingId },
      });
    });

    it("returns false for blank delete identifiers", async () => {
      await expect(UserOrganizationService.deleteById("   ")).resolves.toBe(
        false,
      );
    });

    it("removes mappings by organization id", async () => {
      await UserOrganizationService.deleteAllByOrganizationId(orgId);
      expect(prisma.userOrganization.deleteMany).toHaveBeenCalledWith({
        where: { organizationReference: orgId },
      });
    });
  });

  describe("aggregations", () => {
    it("returns an empty list when a user has no mappings", async () => {
      (prisma.userOrganization.findMany as jest.Mock).mockImplementation(
        async () => [],
      );

      await expect(
        UserOrganizationService.listByUserId(userId),
      ).resolves.toEqual([]);
    });

    it("lists by user and organisation ids", async () => {
      (prisma.userOrganization.findMany as jest.Mock)
        .mockResolvedValueOnce([
          {
            ...prismaMapping,
            effectivePermissions: ["billing:view:any"],
          },
        ])
        .mockResolvedValueOnce([
          {
            ...prismaMapping,
            organizationReference: `Organization/${orgId}`,
          },
        ]);
      (prisma.organization.findFirst as jest.Mock).mockResolvedValue({
        id: orgId,
        fhirId: null,
        name: "Org",
        crossOrgMessagingEnabled: true,
        imageUrl: null,
        phoneNo: "",
        type: "HOSPITAL",
        googlePlacesId: null,
        address: null,
        taxId: "",
        dunsNumber: null,
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
        stripeAccountId: null,
        averageRating: null,
        ratingCount: null,
        appointmentCheckInBufferMinutes: null,
        appointmentCheckInRadiusMeters: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      (prisma.organizationBilling.findFirst as jest.Mock).mockResolvedValue({
        id: "bill-1",
        orgId,
      });
      (
        prisma.organizationUsageCounter.findFirst as jest.Mock
      ).mockResolvedValue({ id: "usage-1", orgId });
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        userId,
        firstName: "Jane",
        lastName: "Doe",
      });
      (prisma.userProfile.findFirst as jest.Mock).mockResolvedValue({
        personalDetails: { profilePictureUrl: "http" },
      });
      (prisma.speciality.findMany as jest.Mock).mockResolvedValue([
        { id: "spec-1", organisationId: orgId },
      ]);
      (prisma.occupancy.count as jest.Mock).mockResolvedValue(3);
      (AvailabilityService.getCurrentStatus as jest.Mock).mockResolvedValue(
        "AVAILABLE",
      );
      (
        AvailabilityService.getWeeklyWorkingHours as jest.Mock
      ).mockResolvedValue(40);

      const byUser = await UserOrganizationService.listByUserId(userId);
      const byOrg = await UserOrganizationService.listByOrganisationId(orgId);

      expect(byUser[0].orgBilling).toMatchObject({ _id: "bill-1" });
      expect(byUser[0].organization?.name).toBe("Org");
      // The cross-clinic messaging setting drives a privacy-facing toggle, so
      // it has to survive the mapper rather than read as unset on load.
      expect(byUser[0].organization?.crossOrgMessagingEnabled).toBe(true);
      expect(byOrg[0].name).toBe("Jane Doe");
      expect(byOrg[0].weeklyHours).toBe(40);
    });

    it("matches legacy User/ practitioner references when listing by user", async () => {
      (prisma.userOrganization.findMany as jest.Mock).mockResolvedValueOnce([
        prismaMapping,
      ]);
      (prisma.organization.findFirst as jest.Mock).mockResolvedValue({
        id: orgId,
        fhirId: null,
        name: "Org",
        crossOrgMessagingEnabled: true,
        imageUrl: null,
        phoneNo: "",
        type: "HOSPITAL",
        googlePlacesId: null,
        address: null,
        taxId: "",
        dunsNumber: null,
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
        stripeAccountId: null,
        averageRating: null,
        ratingCount: null,
        appointmentCheckInBufferMinutes: null,
        appointmentCheckInRadiusMeters: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      (prisma.organizationBilling.findFirst as jest.Mock).mockResolvedValue(
        null,
      );
      (
        prisma.organizationUsageCounter.findFirst as jest.Mock
      ).mockResolvedValue(null);

      await UserOrganizationService.listByUserId(userId);

      expect(prisma.userOrganization.findMany).toHaveBeenCalledWith({
        where: {
          practitionerReference: {
            in: [userId, `Practitioner/${userId}`, `User/${userId}`],
          },
        },
      });
    });
  });

  describe("getMappingByUserAndOrganization", () => {
    it("returns null when no mapping exists", async () => {
      (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValueOnce(
        null,
      );

      const result =
        await UserOrganizationService.getMappingByUserAndOrganization(
          userId,
          orgId,
        );

      expect(result).toBeNull();
      expect(prisma.userOrganization.findFirst).toHaveBeenCalledWith({
        where: {
          practitionerReference: {
            in: [userId, `Practitioner/${userId}`, `User/${userId}`],
          },
          organizationReference: { in: [orgId, `Organization/${orgId}`] },
        },
      });
    });

    it("maps an existing mapping to a response DTO", async () => {
      (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValueOnce(
        prismaMapping,
      );

      const result =
        await UserOrganizationService.getMappingByUserAndOrganization(
          userId,
          orgId,
        );

      expect((result as any)?._id).toBe(mappingId);
    });
  });
});
