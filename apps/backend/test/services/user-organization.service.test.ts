import { UserOrganizationService } from "../../src/services/user-organization.service";
import { AvailabilityService } from "../../src/services/availability.service";
import { StripeService } from "../../src/services/stripe.service";
import { ROLE_PERMISSIONS } from "../../src/models/role-permission";
import * as EmailUtils from "../../src/utils/email";
import logger from "../../src/utils/logger";
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

  // jest.clearAllMocks() keeps implementations, so a `mockResolvedValue` set by
  // one test would otherwise still answer the next one's queries. Drop the
  // prisma stubs back to "no implementation" so every test states its own data.
  const resetPrismaMocks = () => {
    for (const delegate of Object.values(
      prisma as unknown as Record<string, unknown>,
    )) {
      if (!delegate || typeof delegate !== "object") continue;
      for (const member of Object.values(delegate)) {
        if (typeof member === "function" && "mockReset" in member) {
          (member as jest.Mock).mockReset();
        }
      }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resetPrismaMocks();
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

  const mockedLogger = logger as unknown as { error: jest.Mock };

  const sparseOrganization = (overrides: Record<string, unknown> = {}) => ({
    id: orgId,
    fhirId: null,
    name: "Org",
    imageUrl: null,
    phoneNo: null,
    type: "HOSPITAL",
    googlePlacesId: null,
    address: null,
    taxId: null,
    dunsNumber: null,
    petNamePreference: null,
    website: null,
    documensoTeamId: null,
    documensoApiKey: null,
    isVerified: null,
    isActive: null,
    typeCoding: null,
    healthAndSafetyCertNo: null,
    animalWelfareComplianceCertNo: null,
    fireAndEmergencyCertNo: null,
    stripeAccountId: null,
    averageRating: null,
    ratingCount: null,
    appointmentCheckInBufferMinutes: null,
    appointmentCheckInRadiusMeters: null,
    crossOrgMessagingEnabled: null,
    createdAt: null,
    updatedAt: null,
    ...overrides,
  });

  /** Wires the happy path for a brand-new, active mapping on a paid plan. */
  const mockCreateSucceeds = (
    document: Record<string, unknown> = prismaMapping,
  ) => {
    (prisma.organization.findFirst as jest.Mock).mockResolvedValue({
      id: orgId,
    });
    (prisma.organizationBilling.findFirst as jest.Mock).mockResolvedValue({
      plan: "pro",
    });
    (prisma.organizationUsageCounter.upsert as jest.Mock).mockResolvedValue({
      orgId,
    });
    (prisma.organizationUsageCounter.update as jest.Mock).mockResolvedValue({
      usersActiveCount: 1,
    });
    (prisma.userOrganization.create as jest.Mock).mockResolvedValue(document);
  };

  const flushMicrotasks = async () => {
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
  };

  describe("payload sanitisation", () => {
    const createWith = (overrides: Record<string, unknown>) =>
      UserOrganizationService.create({ ...payload, ...overrides } as never);

    it.each([
      [
        "a missing practitioner reference",
        { practitionerReference: undefined },
        "Practitioner reference is required.",
      ],
      [
        "a non-string organization reference",
        { organizationReference: 42 },
        "Organization reference must be a string.",
      ],
      ["a blank role code", { roleCode: "   " }, "Role code cannot be empty."],
      [
        "an operator smuggled into the practitioner reference",
        { practitionerReference: "Practitioner/$ne" },
        "Invalid character in Practitioner reference.",
      ],
      [
        "a non-string role display",
        { roleDisplay: 7 },
        "Role display must be a string.",
      ],
      [
        "an operator inside the role display",
        { roleDisplay: "Vet$ne" },
        "Invalid character in Role display.",
      ],
      [
        "a permission list that is not an array",
        { extraPermissions: "labs:view:any" },
        "Extra permissions must be an array of strings.",
      ],
      [
        "an operator inside a revoked permission",
        { revokedPermissions: ["billing:$ne"] },
        "Invalid character in Revoked permissions.",
      ],
      [
        "a malformed FHIR identifier",
        { id: "map 1!" },
        "Invalid identifier format.",
      ],
    ])("rejects %s", async (_label, overrides, message) => {
      await expect(createWith(overrides)).rejects.toEqual(
        expect.objectContaining({ message, statusCode: 400 }),
      );
      expect(prisma.userOrganization.create).not.toHaveBeenCalled();
    });

    it("de-duplicates permission entries and drops blank ones before persisting", async () => {
      mockCreateSucceeds();

      await createWith({
        extraPermissions: ["labs:view:any", "labs:view:any", "   ", null],
        revokedPermissions: ["billing:edit:any"],
      });

      const { data } = (prisma.userOrganization.create as jest.Mock).mock
        .calls[0][0];
      expect(data.extraPermissions).toEqual(["labs:view:any"]);
      expect(data.revokedPermissions).toEqual(["billing:edit:any"]);
      // The revoked entry must actually be subtracted from the role baseline.
      expect(data.effectivePermissions).toContain("labs:view:any");
      expect(data.effectivePermissions).not.toContain("billing:edit:any");
    });

    it("drops a blank role display rather than persisting an empty string", async () => {
      mockCreateSucceeds();

      await createWith({ roleDisplay: "   " });

      const { data } = (prisma.userOrganization.create as jest.Mock).mock
        .calls[0][0];
      expect(data).not.toHaveProperty("roleDisplay");
    });

    it("defaults a non-boolean active flag to an active membership", async () => {
      mockCreateSucceeds();

      await createWith({ active: "yes" });

      const { data } = (prisma.userOrganization.create as jest.Mock).mock
        .calls[0][0];
      expect(data.active).toBe(true);
      // An active membership must consume a seat, so the ambiguous flag has to
      // resolve before the counter is touched.
      expect(prisma.organizationUsageCounter.update).toHaveBeenCalledWith({
        where: { orgId },
        data: { usersActiveCount: { increment: 1 } },
      });
    });
  });

  describe("organisation reference parsing", () => {
    it.each([
      ["with no usable segments", "///"],
      ["that names only the resource type", "Organization/"],
    ])("rejects an organisation reference %s", async (_label, reference) => {
      await expect(
        UserOrganizationService.create({
          ...payload,
          organizationReference: reference,
        } as never),
      ).rejects.toEqual(
        expect.objectContaining({
          message: "Invalid organization reference format.",
          statusCode: 400,
        }),
      );
    });

    it("rejects a blank organisation reference stored on a mapping", async () => {
      (prisma.userOrganization.findMany as jest.Mock).mockResolvedValue([
        { ...prismaMapping, organizationReference: "   " },
      ]);

      await expect(
        UserOrganizationService.listByUserId(userId),
      ).rejects.toEqual(
        expect.objectContaining({
          message: "Organization reference cannot be empty.",
          statusCode: 400,
        }),
      );
    });

    it("returns 404 when the referenced organisation does not exist", async () => {
      (prisma.organization.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(UserOrganizationService.create(payload)).rejects.toEqual(
        expect.objectContaining({
          message: "Organization not found.",
          statusCode: 404,
        }),
      );
      expect(prisma.userOrganization.create).not.toHaveBeenCalled();
    });
  });

  describe("seat transitions on upsert", () => {
    it("reserves a seat and resyncs Stripe when a dormant membership is reactivated", async () => {
      (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValue({
        ...prismaMapping,
        active: null,
      });
      (prisma.organization.findFirst as jest.Mock).mockResolvedValue({
        id: orgId,
      });
      (prisma.organizationBilling.findFirst as jest.Mock).mockResolvedValue({
        plan: "business",
      });
      (prisma.organizationUsageCounter.upsert as jest.Mock).mockResolvedValue({
        orgId,
      });
      (prisma.organizationUsageCounter.update as jest.Mock).mockResolvedValue(
        {},
      );
      (prisma.userOrganization.update as jest.Mock).mockResolvedValue(
        prismaMapping,
      );

      const result = await UserOrganizationService.upsert(payload);

      expect(result.created).toBe(false);
      expect(prisma.organizationUsageCounter.update).toHaveBeenCalledWith({
        where: { orgId },
        data: { usersActiveCount: { increment: 1 } },
      });
      expect(StripeService.syncSubscriptionSeats).toHaveBeenCalledWith(orgId);
      expect(prisma.userOrganization.create).not.toHaveBeenCalled();
    });

    it("releases the seat when an active membership is deactivated", async () => {
      (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValue(
        prismaMapping,
      );
      (prisma.organization.findFirst as jest.Mock).mockResolvedValue({
        id: orgId,
      });
      (prisma.organizationBilling.findFirst as jest.Mock).mockResolvedValue({
        plan: "business",
      });
      (prisma.organizationUsageCounter.update as jest.Mock).mockResolvedValue(
        {},
      );
      (prisma.userOrganization.update as jest.Mock).mockResolvedValue({
        ...prismaMapping,
        active: false,
      });

      await UserOrganizationService.upsert({ ...payload, active: false });

      expect(prisma.organizationUsageCounter.update).toHaveBeenCalledWith({
        where: { orgId },
        data: { usersActiveCount: { decrement: 1 } },
      });
      expect(StripeService.syncSubscriptionSeats).toHaveBeenCalledWith(orgId);
    });

    it("leaves the seat count and the subscription alone when the active flag does not move", async () => {
      (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValue(
        prismaMapping,
      );
      (prisma.organization.findFirst as jest.Mock).mockResolvedValue({
        id: orgId,
      });
      (prisma.userOrganization.update as jest.Mock).mockResolvedValue(
        prismaMapping,
      );

      await UserOrganizationService.upsert(payload);

      expect(prisma.organizationUsageCounter.update).not.toHaveBeenCalled();
      expect(prisma.organizationUsageCounter.upsert).not.toHaveBeenCalled();
      expect(StripeService.syncSubscriptionSeats).not.toHaveBeenCalled();
    });

    it("does not consume a seat for a brand-new inactive mapping", async () => {
      (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.userOrganization.create as jest.Mock).mockResolvedValue({
        ...prismaMapping,
        active: false,
      });

      const result = await UserOrganizationService.upsert({
        ...payload,
        active: false,
      });

      expect(result.created).toBe(true);
      expect(prisma.organization.findFirst).not.toHaveBeenCalled();
      expect(prisma.organizationUsageCounter.upsert).not.toHaveBeenCalled();
      expect(StripeService.syncSubscriptionSeats).not.toHaveBeenCalled();
    });

    it("skips the existing-mapping lookup entirely when the payload carries no identifier", async () => {
      const { id: _ignoredId, ...anonymousPayload } = payload;
      mockCreateSucceeds({ ...prismaMapping, fhirId: null });

      const result = await UserOrganizationService.upsert(
        anonymousPayload as never,
      );

      expect(prisma.userOrganization.findFirst).not.toHaveBeenCalled();
      expect(result.created).toBe(true);
    });

    it("fails with 500 when the write returns no document", async () => {
      (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValue(
        prismaMapping,
      );
      (prisma.organization.findFirst as jest.Mock).mockResolvedValue({
        id: orgId,
      });
      (prisma.userOrganization.update as jest.Mock).mockResolvedValue(null);

      await expect(UserOrganizationService.upsert(payload)).rejects.toEqual(
        expect.objectContaining({
          message: "Unable to persist user-organization mapping.",
          statusCode: 500,
        }),
      );
    });
  });

  describe("create", () => {
    it("syncs the Stripe subscription for a business plan", async () => {
      (prisma.organization.findFirst as jest.Mock).mockResolvedValue({
        id: orgId,
      });
      (prisma.organizationBilling.findFirst as jest.Mock).mockResolvedValue({
        plan: "business",
      });
      (prisma.organizationUsageCounter.upsert as jest.Mock).mockResolvedValue({
        orgId,
      });
      (prisma.organizationUsageCounter.update as jest.Mock).mockResolvedValue(
        {},
      );
      (prisma.userOrganization.create as jest.Mock).mockResolvedValue(
        prismaMapping,
      );

      await UserOrganizationService.create(payload);

      expect(StripeService.syncSubscriptionSeats).toHaveBeenCalledWith(orgId);
    });

    it("skips organisation resolution and seat accounting for an inactive create", async () => {
      (prisma.userOrganization.create as jest.Mock).mockResolvedValue({
        ...prismaMapping,
        active: false,
      });

      const result = await UserOrganizationService.create({
        ...payload,
        active: false,
      });

      expect(result._id).toBe(mappingId);
      expect(prisma.organization.findFirst).not.toHaveBeenCalled();
      expect(prisma.organizationUsageCounter.upsert).not.toHaveBeenCalled();
      expect(StripeService.syncSubscriptionSeats).not.toHaveBeenCalled();
    });
  });

  describe("getById reference fallbacks", () => {
    it("probes both reference fields, prefixed and bare, for an unprefixed id", async () => {
      (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.userOrganization.findMany as jest.Mock).mockResolvedValue([]);

      await expect(
        UserOrganizationService.getById("user-1"),
      ).resolves.toBeNull();
      expect(prisma.userOrganization.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { practitionerReference: "user-1" },
            { organizationReference: "user-1" },
            { practitionerReference: "Practitioner/user-1" },
            { organizationReference: "Organization/user-1" },
          ],
        },
      });
    });

    it("looks up only the organisation field for an Organization/ reference", async () => {
      (prisma.userOrganization.findMany as jest.Mock).mockResolvedValue([
        prismaMapping,
      ]);

      const result = await UserOrganizationService.getById(
        `Organization/${orgId}`,
      );

      expect(prisma.userOrganization.findFirst).not.toHaveBeenCalled();
      expect(prisma.userOrganization.findMany).toHaveBeenCalledWith({
        where: { OR: [{ organizationReference: `Organization/${orgId}` }] },
      });
      expect(result).toMatchObject({ _id: mappingId });
    });

    it("probes both reference fields for an unrecognised resource path", async () => {
      (prisma.userOrganization.findMany as jest.Mock).mockResolvedValue([]);

      await expect(
        UserOrganizationService.getById("Group/abc"),
      ).resolves.toBeNull();
      expect(prisma.userOrganization.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { practitionerReference: "Group/abc" },
            { organizationReference: "Group/abc" },
          ],
        },
      });
    });

    it.each([
      ["a blank identifier", "   ", "Identifier is required."],
      ["a non-string identifier", 7, "Identifier must be a string."],
    ])("rejects %s", async (_label, id, message) => {
      await expect(
        UserOrganizationService.getById(id as never),
      ).rejects.toEqual(expect.objectContaining({ message, statusCode: 400 }));
      expect(prisma.userOrganization.findMany).not.toHaveBeenCalled();
    });
  });

  describe("deleteById", () => {
    it("returns false when no mapping matches the identifier", async () => {
      (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(UserOrganizationService.deleteById(mappingId)).resolves.toBe(
        false,
      );
      expect(prisma.userOrganization.delete).not.toHaveBeenCalled();
    });

    it("deletes an inactive mapping without releasing a seat it never held", async () => {
      (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValue({
        ...prismaMapping,
        active: false,
      });

      await expect(UserOrganizationService.deleteById(mappingId)).resolves.toBe(
        true,
      );
      expect(prisma.organizationUsageCounter.update).not.toHaveBeenCalled();
      expect(StripeService.syncSubscriptionSeats).not.toHaveBeenCalled();
      expect(prisma.userOrganization.delete).toHaveBeenCalledWith({
        where: { id: mappingId },
      });
    });
  });

  describe("update", () => {
    const updatePayload = { ...payload, roleCode: "OWNER" };

    it("returns null when the mapping does not exist", async () => {
      (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        UserOrganizationService.update(mappingId, updatePayload),
      ).resolves.toBeNull();
      expect(prisma.userOrganization.update).not.toHaveBeenCalled();
    });

    it("reserves a seat and resyncs the subscription when reactivating", async () => {
      (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValue({
        ...prismaMapping,
        active: false,
      });
      (prisma.organization.findFirst as jest.Mock).mockResolvedValue({
        id: orgId,
        name: "Org",
      });
      (prisma.organizationBilling.findFirst as jest.Mock).mockResolvedValue({
        plan: "business",
      });
      (prisma.organizationUsageCounter.upsert as jest.Mock).mockResolvedValue({
        orgId,
      });
      (prisma.organizationUsageCounter.update as jest.Mock).mockResolvedValue(
        {},
      );
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.userOrganization.update as jest.Mock).mockResolvedValue({
        ...prismaMapping,
        active: true,
      });

      await UserOrganizationService.update(mappingId, updatePayload);

      expect(prisma.organizationUsageCounter.update).toHaveBeenCalledWith({
        where: { orgId },
        data: { usersActiveCount: { increment: 1 } },
      });
      expect(StripeService.syncSubscriptionSeats).toHaveBeenCalledWith(orgId);
    });

    it("releases the seat and resyncs the subscription when deactivating", async () => {
      (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValue(
        prismaMapping,
      );
      (prisma.organization.findFirst as jest.Mock).mockResolvedValue({
        id: orgId,
        name: "Org",
      });
      (prisma.organizationBilling.findFirst as jest.Mock).mockResolvedValue({
        plan: "business",
      });
      (prisma.organizationUsageCounter.update as jest.Mock).mockResolvedValue(
        {},
      );
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.userOrganization.update as jest.Mock).mockResolvedValue({
        ...prismaMapping,
        active: false,
      });

      await UserOrganizationService.update(mappingId, {
        ...updatePayload,
        active: false,
      });

      expect(prisma.organizationUsageCounter.update).toHaveBeenCalledWith({
        where: { orgId },
        data: { usersActiveCount: { decrement: 1 } },
      });
      expect(StripeService.syncSubscriptionSeats).toHaveBeenCalledWith(orgId);
    });

    it("returns null when the write produces no document", async () => {
      (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValue(
        prismaMapping,
      );
      (prisma.organization.findFirst as jest.Mock).mockResolvedValue({
        id: orgId,
      });
      (prisma.userOrganization.update as jest.Mock).mockResolvedValue(null);

      await expect(
        UserOrganizationService.update(mappingId, updatePayload),
      ).resolves.toBeNull();
    });

    it("sends no email when neither the role nor the permissions moved", async () => {
      // Both permission columns come back null from a legacy row; the change
      // detector must treat that as "no permissions", not as a change.
      const unchanged = {
        ...prismaMapping,
        roleCode: "VETERINARIAN",
        effectivePermissions: null,
      };
      (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValue(
        unchanged,
      );
      (prisma.organization.findFirst as jest.Mock).mockResolvedValue({
        id: orgId,
        name: "Org",
      });
      (prisma.userOrganization.update as jest.Mock).mockResolvedValue(
        unchanged,
      );

      await UserOrganizationService.update(mappingId, payload);
      await flushMicrotasks();

      expect(EmailUtils.sendEmailTemplate).not.toHaveBeenCalled();
      expect(StripeService.syncSubscriptionSeats).not.toHaveBeenCalled();
    });

    it("names the employee and the role display in the permissions email", async () => {
      (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValue(
        prismaMapping,
      );
      (prisma.organization.findFirst as jest.Mock).mockResolvedValue({
        id: orgId,
        name: "Yosemite Vets",
      });
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        email: "jane@example.com",
        firstName: "Jane",
        lastName: "Doe",
      });
      (prisma.userOrganization.update as jest.Mock).mockResolvedValue({
        ...prismaMapping,
        roleCode: "OWNER",
        roleDisplay: "Practice Owner",
      });

      await UserOrganizationService.update(mappingId, updatePayload);
      await flushMicrotasks();

      expect(EmailUtils.sendEmailTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "jane@example.com",
          templateId: "permissionsUpdated",
          templateData: expect.objectContaining({
            employeeName: "Jane Doe",
            organisationName: "Yosemite Vets",
            roleName: "Practice Owner",
          }),
        }),
      );
    });

    it("falls back to the role code and omits an unnamed employee", async () => {
      (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValue(
        prismaMapping,
      );
      (prisma.organization.findFirst as jest.Mock).mockResolvedValue({
        id: orgId,
        name: "Yosemite Vets",
      });
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        email: "jane@example.com",
        firstName: null,
        lastName: null,
      });
      (prisma.userOrganization.update as jest.Mock).mockResolvedValue({
        ...prismaMapping,
        roleCode: "OWNER",
        roleDisplay: null,
      });

      await UserOrganizationService.update(mappingId, updatePayload);
      await flushMicrotasks();

      expect(EmailUtils.sendEmailTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          templateData: expect.objectContaining({
            employeeName: undefined,
            roleName: "OWNER",
          }),
        }),
      );
    });

    it("skips the email when the practitioner has no address on file", async () => {
      (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValue(
        prismaMapping,
      );
      (prisma.organization.findFirst as jest.Mock).mockResolvedValue({
        id: orgId,
        name: "Org",
      });
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.userOrganization.update as jest.Mock).mockResolvedValue({
        ...prismaMapping,
        roleCode: "OWNER",
      });

      await UserOrganizationService.update(mappingId, updatePayload);
      await flushMicrotasks();

      expect(EmailUtils.sendEmailTemplate).not.toHaveBeenCalled();
    });

    it("skips the email when the organisation cannot be named", async () => {
      (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValue(
        prismaMapping,
      );
      (prisma.organization.findFirst as jest.Mock)
        .mockResolvedValueOnce({ id: orgId })
        .mockResolvedValueOnce(null);
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        email: "jane@example.com",
        firstName: "Jane",
        lastName: "Doe",
      });
      (prisma.userOrganization.update as jest.Mock).mockResolvedValue({
        ...prismaMapping,
        roleCode: "OWNER",
      });

      await UserOrganizationService.update(mappingId, updatePayload);
      await flushMicrotasks();

      expect(EmailUtils.sendEmailTemplate).not.toHaveBeenCalled();
    });

    it("logs and swallows a failure raised while sending the permissions email", async () => {
      const failure = new Error("mailer down");
      (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValue(
        prismaMapping,
      );
      (prisma.organization.findFirst as jest.Mock).mockResolvedValue({
        id: orgId,
        name: "Org",
      });
      (prisma.user.findFirst as jest.Mock).mockRejectedValue(failure);
      (prisma.userOrganization.update as jest.Mock).mockResolvedValue({
        ...prismaMapping,
        roleCode: "OWNER",
      });

      const result = await UserOrganizationService.update(
        mappingId,
        updatePayload,
      );
      await flushMicrotasks();

      // The notification is best-effort: the update itself must still succeed.
      expect(result).toMatchObject({ _id: mappingId });
      expect(mockedLogger.error).toHaveBeenCalledWith(
        "Failed to send permissions updated email.",
        failure,
      );
    });
  });

  describe("createUserOrganizationMapping", () => {
    it("throws when the mapping cannot be persisted", async () => {
      (prisma.organization.findFirst as jest.Mock).mockResolvedValue({
        id: orgId,
      });
      (prisma.organizationBilling.findFirst as jest.Mock).mockResolvedValue({
        plan: "pro",
      });
      (prisma.organizationUsageCounter.upsert as jest.Mock).mockResolvedValue({
        orgId,
      });
      (prisma.organizationUsageCounter.update as jest.Mock).mockResolvedValue(
        {},
      );
      (prisma.userOrganization.create as jest.Mock).mockResolvedValue(null);

      await expect(
        UserOrganizationService.createUserOrganizationMapping({
          practitionerReference: `Practitioner/${userId}`,
          organizationReference: `Organization/${orgId}`,
          roleCode: "VETERINARIAN",
          active: true,
        } as never),
      ).rejects.toEqual(
        expect.objectContaining({
          message: "Unable to create user-organization mapping.",
          statusCode: 500,
        }),
      );
    });
  });

  describe("deleteAllByOrganizationId", () => {
    it("rejects a blank organisation identifier instead of deleting every mapping", async () => {
      await expect(
        UserOrganizationService.deleteAllByOrganizationId("   "),
      ).rejects.toEqual(
        expect.objectContaining({
          message: "Organization Identifier cannot be empty.",
          statusCode: 400,
        }),
      );
      expect(prisma.userOrganization.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe("effective permission resolution", () => {
    it("recomputes permissions from the role baseline minus revocations", async () => {
      (prisma.userOrganization.findMany as jest.Mock).mockResolvedValue([
        {
          ...prismaMapping,
          roleCode: "OWNER",
          extraPermissions: ["custom:thing"],
          revokedPermissions: ["org:delete"],
          effectivePermissions: ["stale"],
        },
      ]);

      const [mapping] = (await UserOrganizationService.listAll()) as any[];

      expect(mapping.effectivePermissions).toContain("custom:thing");
      expect(mapping.effectivePermissions).toContain("org:view");
      // A revoked permission must never survive the recomputation, and the
      // stale column value must never be trusted.
      expect(mapping.effectivePermissions).not.toContain("org:delete");
      expect(mapping.effectivePermissions).not.toContain("stale");
    });

    it("defaults every nullable column on a sparse mapping row", async () => {
      (prisma.userOrganization.findMany as jest.Mock).mockResolvedValue([
        {
          id: "map-sparse",
          fhirId: null,
          practitionerReference: `Practitioner/${userId}`,
          organizationReference: `Organization/${orgId}`,
          roleCode: "RECEPTIONIST",
          roleDisplay: null,
          active: null,
          extraPermissions: null,
          revokedPermissions: null,
          effectivePermissions: null,
        },
      ]);

      const [mapping] = (await UserOrganizationService.listAll()) as any[];

      expect(mapping.fhirId).toBeUndefined();
      expect(mapping.roleDisplay).toBeUndefined();
      expect(mapping.active).toBe(true);
      expect(mapping.extraPermissions).toEqual([]);
      expect(mapping.revokedPermissions).toEqual([]);
      expect(mapping.effectivePermissions).toEqual(
        expect.arrayContaining(ROLE_PERMISSIONS.RECEPTIONIST),
      );
    });

    it("treats an unknown role as carrying no baseline permissions", async () => {
      (prisma.userOrganization.findMany as jest.Mock).mockResolvedValue([
        {
          ...prismaMapping,
          roleCode: "GHOST",
          extraPermissions: null,
          revokedPermissions: null,
        },
      ]);

      const [mapping] = (await UserOrganizationService.listAll()) as any[];

      expect(mapping.effectivePermissions).toEqual([]);
    });
  });

  describe("recomputeAllEffectivePermissions", () => {
    it("rewrites only the rows whose stored permissions drifted", async () => {
      (prisma.userOrganization.findMany as jest.Mock).mockResolvedValue([
        {
          id: "in-sync",
          roleCode: "OWNER",
          extraPermissions: [],
          revokedPermissions: [],
          effectivePermissions: [...ROLE_PERMISSIONS.OWNER],
        },
        {
          id: "empty",
          roleCode: "OWNER",
          extraPermissions: [],
          revokedPermissions: [],
          effectivePermissions: [],
        },
        {
          id: "unknown-role",
          roleCode: "GHOST",
          extraPermissions: null,
          revokedPermissions: null,
          effectivePermissions: null,
        },
        {
          id: "same-size-different-content",
          roleCode: "GHOST",
          extraPermissions: ["labs:view:any"],
          revokedPermissions: [],
          effectivePermissions: ["room:view:any"],
        },
      ]);
      (prisma.userOrganization.update as jest.Mock).mockResolvedValue({});

      const result =
        await UserOrganizationService.recomputeAllEffectivePermissions();

      expect(result).toEqual({ scannedCount: 4, updatedCount: 2 });
      expect(prisma.userOrganization.update).toHaveBeenCalledWith({
        where: { id: "empty" },
        data: { effectivePermissions: [...ROLE_PERMISSIONS.OWNER] },
      });
      // Equal length is not equal content — the drifted row must be rewritten.
      expect(prisma.userOrganization.update).toHaveBeenCalledWith({
        where: { id: "same-size-different-content" },
        data: { effectivePermissions: ["labs:view:any"] },
      });
      expect(prisma.userOrganization.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "in-sync" } }),
      );
    });
  });

  describe("listByUserId billing visibility", () => {
    const mappingWithRevocations = (id: string, revoked: string[]) => ({
      ...prismaMapping,
      id,
      fhirId: id,
      roleCode: "OWNER",
      revokedPermissions: revoked,
    });

    it("resolves the billing snapshot through each billing permission and denies when all are revoked", async () => {
      (prisma.userOrganization.findMany as jest.Mock).mockResolvedValue([
        mappingWithRevocations("view-any", []),
        mappingWithRevocations("edit-any", ["billing:view:any"]),
        mappingWithRevocations("edit-limited", [
          "billing:view:any",
          "billing:edit:any",
        ]),
        mappingWithRevocations("denied", [
          "billing:view:any",
          "billing:edit:any",
          "billing:edit:limited",
        ]),
      ]);
      (prisma.organization.findFirst as jest.Mock).mockResolvedValue(
        sparseOrganization(),
      );
      (prisma.organizationBilling.findFirst as jest.Mock).mockResolvedValue({
        id: "bill-1",
        orgId,
      });
      (
        prisma.organizationUsageCounter.findFirst as jest.Mock
      ).mockResolvedValue({ id: "usage-1", orgId });

      const results = await UserOrganizationService.listByUserId(userId);

      expect(results.map((entry) => Boolean(entry.orgBilling))).toEqual([
        true,
        true,
        true,
        false,
      ]);
      expect(results[3].orgUsage).toBeNull();
      expect(results[0].orgUsage).toMatchObject({ _id: "usage-1" });
      // The denied member must not cause a billing read at all.
      expect(prisma.organizationBilling.findFirst).toHaveBeenCalledTimes(3);
    });

    it("falls back to the raw organisation identifier when the organisation row is missing", async () => {
      (prisma.userOrganization.findMany as jest.Mock).mockResolvedValue([
        mappingWithRevocations("view-any", []),
      ]);
      (prisma.organization.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.organizationBilling.findFirst as jest.Mock).mockResolvedValue(
        null,
      );
      (
        prisma.organizationUsageCounter.findFirst as jest.Mock
      ).mockResolvedValue(null);

      const [entry] = await UserOrganizationService.listByUserId(userId);

      expect(entry.organization).toBeNull();
      expect(entry.orgBilling).toBeNull();
      expect(entry.orgUsage).toBeNull();
      expect(prisma.organizationBilling.findFirst).toHaveBeenCalledWith({
        where: { orgId },
      });
    });

    it("maps a fully populated organisation and defaults a sparse one", async () => {
      (prisma.userOrganization.findMany as jest.Mock).mockResolvedValue([
        mappingWithRevocations("full", []),
        mappingWithRevocations("sparse", []),
      ]);
      (prisma.organization.findFirst as jest.Mock)
        .mockResolvedValueOnce(
          sparseOrganization({
            fhirId: "org-fhir",
            imageUrl: "https://cdn/logo.png",
            phoneNo: "+1-555",
            googlePlacesId: "places-1",
            dunsNumber: "duns-1",
            petNamePreference: "Companion",
            website: "https://vets.example",
            documensoTeamId: "team-1",
            documensoApiKey: "key-1",
            typeCoding: [{ code: "prov" }],
            healthAndSafetyCertNo: "hs-1",
            animalWelfareComplianceCertNo: "aw-1",
            fireAndEmergencyCertNo: "fe-1",
            stripeAccountId: "acct_1",
            averageRating: 4.5,
            ratingCount: 12,
            appointmentCheckInBufferMinutes: 15,
            appointmentCheckInRadiusMeters: 500,
            crossOrgMessagingEnabled: true,
            taxId: "tax-1",
            isVerified: true,
            isActive: true,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-02T00:00:00.000Z"),
            address: {
              addressLine: "1 Valley Rd",
              country: "US",
              city: "Yosemite",
              state: "CA",
              postalCode: "95389",
              latitude: 37.8,
              longitude: -119.5,
              location: { type: "Point", coordinates: [-119.5, 37.8] },
            },
          }),
        )
        .mockResolvedValueOnce(
          sparseOrganization({
            address: {
              addressLine: null,
              country: null,
              city: null,
              state: null,
              postalCode: null,
              latitude: null,
              longitude: null,
              location: null,
            },
          }),
        );
      (prisma.organizationBilling.findFirst as jest.Mock).mockResolvedValue({
        id: "bill-1",
        orgId,
      });
      (
        prisma.organizationUsageCounter.findFirst as jest.Mock
      ).mockResolvedValue({ id: "usage-1", orgId });

      const [full, sparse] = await UserOrganizationService.listByUserId(userId);

      expect(full.organization).toMatchObject({
        fhirId: "org-fhir",
        imageURL: "https://cdn/logo.png",
        DUNSNumber: "duns-1",
        stripeAccountId: "acct_1",
        taxId: "tax-1",
        phoneNo: "+1-555",
        isVerified: true,
        isActive: true,
        appointmentCheckInBufferMinutes: 15,
        appointmentCheckInRadiusMeters: 500,
        crossOrgMessagingEnabled: true,
      });
      expect(full.organization?.address).toMatchObject({
        city: "Yosemite",
        latitude: 37.8,
        longitude: -119.5,
      });
      // A row with every optional column null must still produce the documented
      // defaults rather than nulls leaking to the client.
      expect(sparse.organization).toMatchObject({
        appointmentCheckInBufferMinutes: 5,
        appointmentCheckInRadiusMeters: 200,
        crossOrgMessagingEnabled: false,
      });
      expect(sparse.organization?.fhirId).toBeUndefined();
      expect(sparse.organization?.taxId).toBeUndefined();
      expect(sparse.organization?.phoneNo).toBeUndefined();
      expect(sparse.organization?.isVerified).toBeUndefined();
      expect(sparse.organization?.isActive).toBeUndefined();
      expect(sparse.organization?.createdAt).toBeUndefined();
      expect(sparse.organization?.updatedAt).toBeUndefined();
      expect(sparse.organization?.address?.city).toBeUndefined();
      expect(sparse.organization?.address?.location).toBeUndefined();
    });
  });

  describe("listByOrganisationId", () => {
    it("returns an empty roster when the organisation has no mappings", async () => {
      (prisma.userOrganization.findMany as jest.Mock).mockResolvedValue([]);

      await expect(
        UserOrganizationService.listByOrganisationId(orgId),
      ).resolves.toEqual([]);
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
    });

    it("rejects a blank organisation identifier", async () => {
      await expect(
        UserOrganizationService.listByOrganisationId("   "),
      ).rejects.toEqual(
        expect.objectContaining({
          message: "User Id cannot be empty.",
          statusCode: 400,
        }),
      );
    });

    it("tolerates members with no user record, name or profile", async () => {
      (prisma.userOrganization.findMany as jest.Mock).mockResolvedValue([
        { ...prismaMapping, id: "no-user" },
        { ...prismaMapping, id: "first-name-only" },
      ]);
      (prisma.user.findFirst as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ firstName: "Jane", lastName: null });
      (prisma.userProfile.findFirst as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ personalDetails: null });
      (prisma.speciality.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.occupancy.count as jest.Mock).mockResolvedValue(0);
      (AvailabilityService.getCurrentStatus as jest.Mock).mockResolvedValue(
        "OFF_DUTY",
      );
      (
        AvailabilityService.getWeeklyWorkingHours as jest.Mock
      ).mockResolvedValue(0);

      const [anonymous, firstNameOnly] =
        await UserOrganizationService.listByOrganisationId(orgId);

      expect(anonymous.name).toBe("");
      expect(anonymous.profileUrl).toBeUndefined();
      expect(anonymous.currentStatus).toBe("OFF_DUTY");
      expect(anonymous.count).toBe(0);
      expect(firstNameOnly.name).toBe("Jane");
      expect(firstNameOnly.profileUrl).toBeUndefined();
      expect(prisma.userOrganization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationReference: {
              in: [orgId, `Organization/${orgId}`],
            },
          },
        }),
      );
    });
  });
});
