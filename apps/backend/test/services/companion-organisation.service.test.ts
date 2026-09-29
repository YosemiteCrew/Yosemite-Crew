import {
  CompanionOrganisationService,
  CompanionOrganisationServiceError,
} from "../../src/services/companion-organisation.service";
import { AuditTrailService } from "../../src/services/audit-trail.service";
import { prisma } from "src/config/prisma";

jest.mock("node:crypto", () => ({
  randomUUID: jest.fn(() => "mock-uuid-1234"),
}));

jest.mock("../../src/utils/sanitize", () => ({
  assertSafeString: jest.fn((value) => value),
}));

jest.mock("../../src/services/companion.service", () => ({
  toFHIRFromPrisma: jest.fn((value) => ({
    id: value.id,
    resourceType: "Patient",
    name: value.name,
  })),
}));

jest.mock("../../src/services/parent.service", () => ({
  toFHIRFromPrisma: jest.fn((value) => ({
    id: value.id,
    resourceType: "RelatedPerson",
    firstName: value.firstName,
    lastName: value.lastName,
    email: value.email,
    phoneNumber: value.phoneNumber,
    address: value.address,
  })),
}));

jest.mock("../../src/services/audit-trail.service", () => ({
  AuditTrailService: {
    recordSafely: jest.fn(),
  },
}));

jest.mock("src/config/prisma", () => ({
  prisma: {
    patientOrganisation: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    organization: {
      findMany: jest.fn(),
    },
    parentPatient: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    patient: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    parent: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

describe("CompanionOrganisationService", () => {
  const patientId = "patient-1";
  const organisationId = "org-1";
  const parentId = "parent-1";
  const linkId = "link-1";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("CompanionOrganisationServiceError", () => {
    it("keeps message and status code", () => {
      const err = new CompanionOrganisationServiceError("Test", 418);
      expect(err.message).toBe("Test");
      expect(err.statusCode).toBe(418);
      expect(err.name).toBe("CompanionOrganisationServiceError");
    });
  });

  describe("linking", () => {
    it("returns an existing active link without creating a new one", async () => {
      (prisma.parentPatient.findFirst as jest.Mock).mockResolvedValueOnce({
        id: "pp-1",
      });
      (prisma.patientOrganisation.findFirst as jest.Mock).mockResolvedValueOnce(
        {
          id: linkId,
          patientId,
          organisationId,
          organisationType: "HOSPITAL",
          status: "ACTIVE",
        },
      );

      const result = await CompanionOrganisationService.linkByParent({
        parentId,
        patientId,
        organisationId,
        organisationType: "HOSPITAL",
      });

      expect(result._id).toBe(linkId);
      expect(prisma.patientOrganisation.create).not.toHaveBeenCalled();
      expect(AuditTrailService.recordSafely).not.toHaveBeenCalled();
    });

    it("rejects a parent without an ACTIVE companion link (e.g. PENDING co-parent)", async () => {
      // Ownership now requires an ACTIVE parent-patient link; a PENDING
      // (not-yet-accepted) link must not confer organisation-link rights.
      (prisma.parentPatient.findFirst as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        CompanionOrganisationService.linkByParent({
          parentId,
          patientId,
          organisationId,
          organisationType: "HOSPITAL",
        }),
      ).rejects.toMatchObject({ statusCode: 403 });

      expect(prisma.parentPatient.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            parentId,
            patientId,
            status: "ACTIVE",
          }),
        }),
      );
      expect(prisma.patientOrganisation.create).not.toHaveBeenCalled();
    });

    it("returns an existing pending PMS link without creating another one", async () => {
      (prisma.patientOrganisation.findFirst as jest.Mock).mockResolvedValueOnce(
        {
          id: linkId,
          patientId,
          organisationId,
          organisationType: "HOSPITAL",
          status: "PENDING",
        },
      );

      const result = await CompanionOrganisationService.linkByPmsUser({
        pmsUserId: "pms-1",
        patientId,
        organisationId,
        organisationType: "HOSPITAL",
      });

      expect(result._id).toBe(linkId);
      expect(prisma.patientOrganisation.create).not.toHaveBeenCalled();
    });

    it("creates a parent link and records audit", async () => {
      (prisma.parentPatient.findFirst as jest.Mock).mockResolvedValueOnce({
        id: "pp-1",
      });
      (prisma.patientOrganisation.findFirst as jest.Mock).mockResolvedValueOnce(
        null,
      );
      (prisma.patientOrganisation.create as jest.Mock).mockResolvedValueOnce({
        id: linkId,
        patientId,
        organisationId,
        organisationType: "HOSPITAL",
        status: "ACTIVE",
      });

      const result = await CompanionOrganisationService.linkByParent({
        parentId,
        patientId,
        organisationId,
        organisationType: "HOSPITAL",
      });

      expect(prisma.patientOrganisation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            patientId,
            organisationId,
            linkedByParentId: parentId,
            status: "ACTIVE",
          }),
        }),
      );
      expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "PATIENT_ORG_LINK_CREATED" }),
      );
      expect(result._id).toBe(linkId);
    });

    it("creates a PMS invite request", async () => {
      (prisma.patientOrganisation.findFirst as jest.Mock).mockResolvedValueOnce(
        null,
      );
      (prisma.patientOrganisation.create as jest.Mock).mockResolvedValueOnce({
        id: linkId,
        patientId,
        organisationId,
        organisationType: "HOSPITAL",
        status: "PENDING",
      });

      const result = await CompanionOrganisationService.linkByPmsUser({
        pmsUserId: "pms-1",
        patientId,
        organisationId,
        organisationType: "HOSPITAL",
      });

      expect(result.status).toBe("PENDING");
      expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "PATIENT_ORG_LINK_REQUESTED" }),
      );
    });

    it("rejects invalid link identifiers", async () => {
      await expect(
        CompanionOrganisationService.linkByParent({
          parentId: "bad$id",
          patientId,
          organisationId,
          organisationType: "HOSPITAL",
        }),
      ).rejects.toEqual(
        expect.objectContaining({
          message: "Invalid parentId",
          statusCode: 400,
        }),
      );
    });
  });

  describe("invites", () => {
    it("rejects invite creation without email or name", async () => {
      await expect(
        CompanionOrganisationService.sendInvite({
          parentId,
          patientId,
          organisationType: "HOSPITAL",
        }),
      ).rejects.toThrow(
        new CompanionOrganisationServiceError("Email required or Name", 400),
      );
    });

    it("validates and accepts an invite", async () => {
      (prisma.patientOrganisation.findFirst as jest.Mock)
        .mockResolvedValueOnce({
          id: linkId,
          patientId,
          organisationId: null,
          organisationType: "HOSPITAL",
          status: "PENDING",
          inviteToken: "token-1",
        })
        .mockResolvedValueOnce({
          id: linkId,
          patientId,
          organisationId: null,
          organisationType: "HOSPITAL",
          status: "PENDING",
          inviteToken: "token-1",
        });
      (prisma.patientOrganisation.update as jest.Mock).mockResolvedValueOnce({
        id: linkId,
        patientId,
        organisationId,
        organisationType: "HOSPITAL",
        status: "ACTIVE",
      });

      const validated =
        await CompanionOrganisationService.validateInvite("token-1");
      expect(validated._id).toBe(linkId);

      const accepted = await CompanionOrganisationService.acceptInvite({
        token: "token-1",
        organisationId,
      });

      expect(prisma.patientOrganisation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: linkId },
          data: expect.objectContaining({
            organisationId,
            status: "ACTIVE",
            inviteToken: null,
          }),
        }),
      );
      expect(accepted.status).toBe("ACTIVE");
    });

    it("rejects invalid invite tokens", async () => {
      (prisma.patientOrganisation.findFirst as jest.Mock).mockResolvedValueOnce(
        null,
      );

      await expect(
        CompanionOrganisationService.validateInvite("missing"),
      ).rejects.toThrow(
        new CompanionOrganisationServiceError("Invalid or expired invite", 404),
      );
    });

    it("rejects rejected invites with missing records", async () => {
      (prisma.patientOrganisation.findFirst as jest.Mock).mockResolvedValueOnce(
        null,
      );

      await expect(
        CompanionOrganisationService.rejectInvite({
          token: "missing",
          organisationId,
        }),
      ).rejects.toThrow(
        new CompanionOrganisationServiceError("Invalid invite token", 404),
      );
    });
  });

  describe("link lifecycle", () => {
    it("revokes, approves, and rejects links", async () => {
      (
        prisma.patientOrganisation.findUnique as jest.Mock
      ).mockResolvedValueOnce({
        id: linkId,
        patientId,
        organisationId,
        organisationType: "HOSPITAL",
        status: "ACTIVE",
      });
      await CompanionOrganisationService.revokeLink(linkId);
      expect(prisma.patientOrganisation.delete).toHaveBeenCalledWith({
        where: { id: linkId },
      });
      expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "PATIENT_ORG_LINK_REVOKED" }),
      );

      (prisma.patientOrganisation.findFirst as jest.Mock).mockResolvedValueOnce(
        {
          id: linkId,
          patientId,
          organisationId: null,
          organisationType: "HOSPITAL",
          status: "PENDING",
        },
      );
      (prisma.parentPatient.findFirst as jest.Mock).mockResolvedValueOnce({
        id: "pp-1",
      });
      (prisma.patientOrganisation.update as jest.Mock).mockResolvedValueOnce({
        id: linkId,
        patientId,
        organisationId,
        organisationType: "HOSPITAL",
        status: "ACTIVE",
      });

      await CompanionOrganisationService.parentApproveLink(parentId, linkId);
      expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "PATIENT_ORG_LINK_APPROVED" }),
      );

      (prisma.patientOrganisation.findFirst as jest.Mock).mockResolvedValueOnce(
        {
          id: linkId,
          patientId,
          organisationId: null,
          organisationType: "HOSPITAL",
          status: "PENDING",
        },
      );
      (prisma.parentPatient.findFirst as jest.Mock).mockResolvedValueOnce({
        id: "pp-1",
      });
      (prisma.patientOrganisation.update as jest.Mock).mockResolvedValueOnce({
        id: linkId,
        patientId,
        organisationId,
        organisationType: "HOSPITAL",
        status: "REVOKED",
      });

      await CompanionOrganisationService.parentRejectLink(parentId, linkId);
      expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "PATIENT_ORG_LINK_REJECTED" }),
      );
    });

    it("throws when trying to revoke a missing link", async () => {
      (
        prisma.patientOrganisation.findUnique as jest.Mock
      ).mockResolvedValueOnce(null);

      await expect(
        CompanionOrganisationService.revokeLink(linkId),
      ).rejects.toEqual(
        expect.objectContaining({
          message: "Link not found",
          statusCode: 404,
        }),
      );
    });
  });

  describe("companion ownership enforcement", () => {
    it("rejects linking a companion the parent does not own", async () => {
      (prisma.parentPatient.findFirst as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        CompanionOrganisationService.linkByParent({
          parentId,
          patientId,
          organisationId,
          organisationType: "HOSPITAL",
        }),
      ).rejects.toEqual(
        expect.objectContaining({
          message: "You are not authorized to manage this companion.",
          statusCode: 403,
        }),
      );

      expect(prisma.parentPatient.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            parentId,
            patientId,
            status: "ACTIVE",
          }),
        }),
      );
      expect(prisma.patientOrganisation.create).not.toHaveBeenCalled();
    });

    it("rejects inviting an organisation for a non-owned companion", async () => {
      (prisma.parentPatient.findFirst as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        CompanionOrganisationService.sendInvite({
          parentId,
          patientId,
          organisationType: "HOSPITAL",
          email: "vet@example.com",
        }),
      ).rejects.toEqual(
        expect.objectContaining({
          message: "You are not authorized to manage this companion.",
          statusCode: 403,
        }),
      );
      expect(prisma.patientOrganisation.create).not.toHaveBeenCalled();
    });

    it("rejects approving a pending link for a non-owned companion", async () => {
      (prisma.patientOrganisation.findFirst as jest.Mock).mockResolvedValueOnce(
        {
          id: linkId,
          patientId,
          organisationId: null,
          organisationType: "HOSPITAL",
          status: "PENDING",
        },
      );
      (prisma.parentPatient.findFirst as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        CompanionOrganisationService.parentApproveLink(parentId, linkId),
      ).rejects.toEqual(
        expect.objectContaining({
          message: "You are not authorized to manage this companion.",
          statusCode: 403,
        }),
      );
      expect(prisma.patientOrganisation.update).not.toHaveBeenCalled();
    });

    it("rejects revoking another owner's link (IDOR) and does not delete", async () => {
      (
        prisma.patientOrganisation.findUnique as jest.Mock
      ).mockResolvedValueOnce({
        id: linkId,
        patientId,
        organisationId,
        organisationType: "HOSPITAL",
        status: "ACTIVE",
      });
      (prisma.parentPatient.findFirst as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        CompanionOrganisationService.revokeLink(linkId, parentId),
      ).rejects.toEqual(
        expect.objectContaining({
          message: "You are not authorized to manage this companion.",
          statusCode: 403,
        }),
      );

      expect(prisma.parentPatient.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            parentId,
            patientId,
            status: "ACTIVE",
          }),
        }),
      );
      expect(prisma.patientOrganisation.delete).not.toHaveBeenCalled();
      expect(AuditTrailService.recordSafely).not.toHaveBeenCalled();
    });

    it("allows the legitimate owner to revoke their own link", async () => {
      (
        prisma.patientOrganisation.findUnique as jest.Mock
      ).mockResolvedValueOnce({
        id: linkId,
        patientId,
        organisationId,
        organisationType: "HOSPITAL",
        status: "ACTIVE",
      });
      (prisma.parentPatient.findFirst as jest.Mock).mockResolvedValueOnce({
        id: "pp-1",
      });

      await CompanionOrganisationService.revokeLink(linkId, parentId);

      expect(prisma.patientOrganisation.delete).toHaveBeenCalledWith({
        where: { id: linkId },
      });
      expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "PATIENT_ORG_LINK_REVOKED" }),
      );
    });

    it("rejects listing another companion's org links (IDOR) and does not query links", async () => {
      (prisma.parentPatient.findFirst as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        CompanionOrganisationService.getLinksForCompanionByOrganisationTye(
          patientId,
          "HOSPITAL",
          parentId,
        ),
      ).rejects.toEqual(
        expect.objectContaining({
          message: "You are not authorized to manage this companion.",
          statusCode: 403,
        }),
      );

      expect(prisma.parentPatient.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            parentId,
            patientId,
            status: "ACTIVE",
          }),
        }),
      );
      expect(prisma.patientOrganisation.findMany).not.toHaveBeenCalled();
    });

    it("allows the legitimate owner to list their companion's org links", async () => {
      (prisma.parentPatient.findFirst as jest.Mock).mockResolvedValueOnce({
        id: "pp-1",
      });
      (prisma.patientOrganisation.findMany as jest.Mock).mockResolvedValueOnce(
        [],
      );

      const result =
        await CompanionOrganisationService.getLinksForCompanionByOrganisationTye(
          patientId,
          "HOSPITAL",
          parentId,
        );

      expect(result).toEqual({ links: [] });
      expect(prisma.patientOrganisation.findMany).toHaveBeenCalled();
    });

    it("rejects denying a pending link for a non-owned companion", async () => {
      (prisma.patientOrganisation.findFirst as jest.Mock).mockResolvedValueOnce(
        {
          id: linkId,
          patientId,
          organisationId: null,
          organisationType: "HOSPITAL",
          status: "PENDING",
        },
      );
      (prisma.parentPatient.findFirst as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        CompanionOrganisationService.parentRejectLink(parentId, linkId),
      ).rejects.toEqual(
        expect.objectContaining({
          message: "You are not authorized to manage this companion.",
          statusCode: 403,
        }),
      );
      expect(prisma.patientOrganisation.update).not.toHaveBeenCalled();
    });
  });

  describe("listing", () => {
    it("maps companion links and organisation links from prisma", async () => {
      (prisma.patientOrganisation.findMany as jest.Mock)
        .mockResolvedValueOnce([
          {
            id: linkId,
            patientId,
            organisationId,
            organisationType: "HOSPITAL",
            status: "ACTIVE",
          },
        ])
        .mockResolvedValueOnce([
          {
            id: linkId,
            patientId,
            organisationId,
            organisationType: "HOSPITAL",
            status: "ACTIVE",
          },
        ]);

      (prisma.parentPatient.findFirst as jest.Mock).mockResolvedValueOnce({
        parentId,
      });
      (prisma.patient.findUnique as jest.Mock).mockResolvedValueOnce({
        id: patientId,
        name: "Buddy",
      });
      (prisma.patient.findMany as jest.Mock).mockResolvedValueOnce([
        { id: patientId, name: "Buddy" },
      ]);
      (prisma.parent.findUnique as jest.Mock).mockResolvedValueOnce({
        id: parentId,
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
        phoneNumber: "123",
      });
      (prisma.organization.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: organisationId,
          name: "Clinic Name",
          phoneNo: "+1234567890",
          email: "clinic@example.com",
          imageUrl: "https://example.com/logo.png",
          googlePlacesId: "ChIJ...",
          address: {
            addressLine: "123 Main St",
            city: "San Francisco",
            state: "CA",
            postalCode: "94105",
            country: "US",
          },
        },
      ]);

      const companionView =
        await CompanionOrganisationService.getLinksForCompanionByOrganisationTye(
          patientId,
          "HOSPITAL",
        );
      expect(companionView).toEqual({
        links: [
          {
            id: linkId,
            patientId,
            organisationType: "HOSPITAL",
            status: "ACTIVE",
            organization: {
              id: organisationId,
              name: "Clinic Name",
              phoneNo: "+1234567890",
              email: "clinic@example.com",
              imageURL: "https://example.com/logo.png",
              googlePlacesId: "ChIJ...",
              address: {
                addressLine: "123 Main St",
                city: "San Francisco",
                state: "CA",
                postalCode: "94105",
                country: "US",
              },
            },
          },
        ],
      });

      (prisma.patient.findMany as jest.Mock).mockResolvedValueOnce([
        { id: patientId, name: "Buddy" },
      ]);
      (prisma.parentPatient.findMany as jest.Mock).mockResolvedValueOnce([
        {
          parentId,
          patientId,
        },
      ]);
      (prisma.parent.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: parentId,
          firstName: "Jane",
          lastName: "Doe",
          email: "jane@example.com",
          phoneNumber: "123",
          birthDate: null,
          currency: null,
          timezone: null,
          profileImageUrl: null,
          isProfileComplete: true,
          linkedUserId: null,
          createdFrom: "MANUAL",
          alerts: null,
          createdAt: new Date("2026-06-14T00:00:00.000Z"),
          updatedAt: new Date("2026-06-14T00:00:00.000Z"),
          address: {
            addressLine: "123 Parent Lane",
            country: "US",
            city: "San Francisco",
            state: "CA",
            postalCode: "94105",
            latitude: null,
            longitude: null,
          },
        },
      ]);

      const orgView =
        await CompanionOrganisationService.getLinksForOrganisation(
          organisationId,
        );
      expect(orgView).toHaveLength(1);
      expect(orgView[0]).toMatchObject({
        linkId,
        organisationId,
        organisationType: "HOSPITAL",
        status: "ACTIVE",
        parent: {
          id: parentId,
          firstName: "Jane",
          lastName: "Doe",
          email: "jane@example.com",
          phoneNumber: "123",
          address: {
            addressLine: "123 Parent Lane",
            country: "US",
            city: "San Francisco",
            state: "CA",
            postalCode: "94105",
            latitude: null,
            longitude: null,
          },
        },
      });
    });

    it("withholds the parent address while the organisation link is PENDING", async () => {
      (prisma.patientOrganisation.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: linkId,
          patientId,
          organisationId,
          organisationType: "HOSPITAL",
          status: "PENDING",
        },
      ]);
      (prisma.patient.findMany as jest.Mock).mockResolvedValueOnce([
        { id: patientId, name: "Buddy" },
      ]);
      (prisma.parentPatient.findMany as jest.Mock).mockResolvedValueOnce([
        { parentId, patientId },
      ]);
      (prisma.parent.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: parentId,
          firstName: "Jane",
          lastName: "Doe",
          email: "jane@example.com",
          phoneNumber: "123",
          address: {
            addressLine: "123 Parent Lane",
            country: "US",
            city: "San Francisco",
            state: "CA",
            postalCode: "94105",
            latitude: 37.77,
            longitude: -122.41,
          },
        },
      ]);

      const orgView =
        await CompanionOrganisationService.getLinksForOrganisation(
          organisationId,
        );

      expect(orgView).toHaveLength(1);
      expect(orgView[0]?.status).toBe("PENDING");
      expect(orgView[0]?.parent?.address).toBeNull();
      expect(JSON.stringify(orgView)).not.toContain("123 Parent Lane");
      expect(JSON.stringify(orgView)).not.toContain("94105");
      expect(JSON.stringify(orgView)).not.toContain("37.77");
    });
  });

  describe("assertOrganisationMayLinkCompanion", () => {
    type Row = Record<string, string | null>;
    // Prisma's matching for the `where` shapes this check uses: plain
    // equality, and `{ in: [...] }`.
    const matches = (row: Row, where: Record<string, unknown>) =>
      Object.entries(where).every(([key, value]) =>
        value && typeof value === "object" && "in" in value
          ? (value as { in: unknown[] }).in.includes(row[key])
          : row[key] === value,
      );
    const given = (world: { orgLinks: Row[]; parentLinks?: Row[] }) => {
      (prisma.patientOrganisation.findFirst as jest.Mock).mockImplementation(
        async ({ where }: { where: Record<string, unknown> }) =>
          world.orgLinks.find((row) => matches(row, where)) ?? null,
      );
      (prisma.parentPatient.findMany as jest.Mock).mockImplementation(
        async ({ where }: { where: Record<string, unknown> }) =>
          (world.parentLinks ?? []).filter((row) => matches(row, where)),
      );
    };
    const orgLink = (
      status: string,
      companion = patientId,
      rejectedAt: string | null = null,
    ): Row => ({
      id: `link-${companion}-${status}`,
      patientId: companion,
      organisationId,
      status,
      rejectedAt,
    });
    // The companion's parent also has a sibling companion ACTIVE here.
    const siblingKnown = [
      { parentId, patientId, status: "ACTIVE" },
      { parentId, patientId: "sibling-companion", status: "ACTIVE" },
    ];
    const assertMayLink = () =>
      CompanionOrganisationService.assertOrganisationMayLinkCompanion(
        patientId,
        organisationId,
      );

    afterEach(() => {
      (prisma.patientOrganisation.findFirst as jest.Mock).mockReset();
      (prisma.parentPatient.findMany as jest.Mock).mockReset();
    });

    it.each(["ACTIVE", "PENDING"])(
      "allows a companion with a %s link here",
      async (status) => {
        given({ orgLinks: [orgLink(status)] });

        await expect(assertMayLink()).resolves.toBeUndefined();
      },
    );

    it("allows a companion whose parent already has another companion active here", async () => {
      given({
        orgLinks: [orgLink("ACTIVE", "sibling-companion")],
        parentLinks: siblingKnown,
      });

      await expect(assertMayLink()).resolves.toBeUndefined();
    });

    it("does not raise again a link the parent turned down, even through a known sibling", async () => {
      given({
        orgLinks: [orgLink("REVOKED"), orgLink("ACTIVE", "sibling-companion")],
        parentLinks: siblingKnown,
      });

      await expect(assertMayLink()).rejects.toMatchObject({
        statusCode: 404,
        message: "Companion not found.",
      });
    });

    it("lets a practice that turned down the parent's emailed invite ask through a known sibling", async () => {
      given({
        orgLinks: [
          orgLink("REVOKED", patientId, "2026-01-01T00:00:00.000Z"),
          orgLink("ACTIVE", "sibling-companion"),
        ],
        parentLinks: siblingKnown,
      });

      await expect(assertMayLink()).resolves.toBeUndefined();
    });

    it("allows a companion linked again after an earlier link was turned down", async () => {
      given({ orgLinks: [orgLink("REVOKED"), orgLink("ACTIVE")] });

      await expect(assertMayLink()).resolves.toBeUndefined();
    });

    it("does not count an invite alone as a relationship", async () => {
      given({ orgLinks: [orgLink("INVITED")], parentLinks: [] });

      await expect(assertMayLink()).rejects.toThrow("Companion not found.");
    });

    it("rejects an arbitrary companion the organisation has no relationship with", async () => {
      given({
        orgLinks: [],
        parentLinks: [{ parentId, patientId, status: "ACTIVE" }],
      });

      await expect(assertMayLink()).rejects.toThrow("Companion not found.");
    });

    it("rejects a companion with no active parent", async () => {
      given({ orgLinks: [], parentLinks: [] });

      await expect(assertMayLink()).rejects.toThrow("Companion not found.");
    });
  });
});
