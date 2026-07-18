import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import { prisma } from "../../src/config/prisma";
import { OrganisationInviteService } from "../../src/services/organisation-invite.service";
import { UserOrganizationService } from "../../src/services/user-organization.service";
import { sendEmailTemplate } from "../../src/utils/email";
import logger from "../../src/utils/logger";

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    organization: {
      findFirst: jest.fn(),
    },
    speciality: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    organisationInvite: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/user-organization.service", () => ({
  UserOrganizationService: {
    createUserOrganizationMapping: jest.fn(),
  },
  UserOrganizationServiceError: class UserOrganizationServiceError extends Error {
    statusCode: number;

    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
      this.name = "UserOrganizationServiceError";
    }
  },
}));

jest.mock("../../src/utils/email", () => ({
  sendEmailTemplate: jest.fn(),
}));

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const mockedPrisma = prisma as any;
const mockedUserOrganizationService = UserOrganizationService as any;
const mockedSendEmail = sendEmailTemplate as any;
const mockedLogger = logger as any;

const { UserOrganizationServiceError } = jest.requireMock(
  "../../src/services/user-organization.service",
) as {
  UserOrganizationServiceError: new (
    message: string,
    statusCode: number,
  ) => Error;
};

const futureDate = () => new Date(Date.now() + 60_000);
const pastDate = () => new Date(Date.now() - 60_000);

const makeInvite = (overrides: Record<string, unknown> = {}) => ({
  id: "invite-1",
  organisationId: "org-1",
  departmentIds: ["dept-1"],
  invitedByUserId: "inviter-1",
  inviteeEmail: "user@example.com",
  inviteeName: "User",
  role: "VET",
  employmentType: "FULL_TIME",
  token: "token-1",
  status: "PENDING",
  expiresAt: futureDate(),
  acceptedAt: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  ...overrides,
});

const validCreatePayload = {
  organisationId: "org-1",
  departmentIds: ["dept-1"],
  invitedByUserId: "inviter-1",
  inviteeEmail: "invitee@example.com",
  inviteeName: "Invitee",
  role: "VET",
  employmentType: "FULL_TIME" as const,
};

const primeCreateHappyPath = () => {
  mockedPrisma.organization.findFirst.mockResolvedValue({
    id: "org-db",
    name: "Acme Vets",
    type: "HOSPITAL",
  });
  mockedPrisma.speciality.findFirst.mockResolvedValue({ id: "dept-db" });
  mockedPrisma.organisationInvite.findFirst.mockResolvedValue(null);
  mockedPrisma.organisationInvite.create.mockResolvedValue(
    makeInvite({
      id: "new-invite",
      inviteeEmail: "invitee@example.com",
      token: "tok-new",
    }),
  );
  mockedPrisma.user.findFirst.mockResolvedValue({
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@example.com",
  });
  mockedSendEmail.mockResolvedValue(undefined);
};

describe("OrganisationInviteService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createInvite", () => {
    it("creates a new invite and sends the invitation email", async () => {
      primeCreateHappyPath();

      const result = await OrganisationInviteService.createInvite({
        ...validCreatePayload,
        inviteeEmail: "Invitee@Example.com",
      });

      // Existing pending invite is looked up with the normalized email.
      expect(mockedPrisma.organisationInvite.findFirst).toHaveBeenCalledWith({
        where: {
          organisationId: "org-1",
          inviteeEmail: "invitee@example.com",
          status: "PENDING",
        },
      });
      expect(mockedPrisma.organisationInvite.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organisationId: "org-1",
            departmentIds: ["dept-1"],
            invitedByUserId: "inviter-1",
            inviteeEmail: "invitee@example.com",
            inviteeName: "Invitee",
            role: "VET",
            employmentType: "FULL_TIME",
            status: "PENDING",
          }),
        }),
      );
      expect(mockedPrisma.organisationInvite.update).not.toHaveBeenCalled();
      expect(mockedSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "invitee@example.com",
          templateId: "organisationInvite",
          templateData: expect.objectContaining({
            organisationName: "Acme Vets",
            inviterName: "Jane Doe",
          }),
        }),
      );
      expect(result._id).toBe("new-invite");
      expect(result.status).toBe("PENDING");
    });

    it("replaces an existing pending invite instead of creating a new one", async () => {
      primeCreateHappyPath();
      mockedPrisma.organisationInvite.findFirst.mockResolvedValue(
        makeInvite({ id: "existing-1" }),
      );
      mockedPrisma.organisationInvite.update.mockResolvedValue(
        makeInvite({ id: "existing-1" }),
      );

      const result =
        await OrganisationInviteService.createInvite(validCreatePayload);

      expect(mockedPrisma.organisationInvite.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "existing-1" },
          data: expect.objectContaining({
            status: "PENDING",
            acceptedAt: null,
          }),
        }),
      );
      expect(mockedPrisma.organisationInvite.create).not.toHaveBeenCalled();
      expect(result._id).toBe("existing-1");
    });

    it("omits optional inviteeName and employmentType when not supplied", async () => {
      primeCreateHappyPath();

      await OrganisationInviteService.createInvite({
        organisationId: "org-1",
        departmentIds: ["dept-1"],
        invitedByUserId: "inviter-1",
        inviteeEmail: "invitee@example.com",
        role: "VET",
      });

      const createData =
        mockedPrisma.organisationInvite.create.mock.calls[0][0].data;
      expect(createData.inviteeName).toBeUndefined();
      expect(createData.employmentType).toBeUndefined();
    });

    it("clears optional fields on the update path and falls back to a default org name", async () => {
      // Organisation without a name exercises the "your organisation" fallback.
      mockedPrisma.organization.findFirst.mockResolvedValue({
        id: "org-db",
        name: null,
        type: "HOSPITAL",
      });
      mockedPrisma.speciality.findFirst.mockResolvedValue({ id: "dept-db" });
      mockedPrisma.organisationInvite.findFirst.mockResolvedValue(
        makeInvite({ id: "existing-2" }),
      );
      mockedPrisma.organisationInvite.update.mockResolvedValue(
        makeInvite({ id: "existing-2", inviteeName: null }),
      );
      mockedPrisma.user.findFirst.mockResolvedValue({
        firstName: "Jane",
        lastName: "Doe",
      });
      mockedSendEmail.mockResolvedValue(undefined);

      await OrganisationInviteService.createInvite({
        organisationId: "org-1",
        departmentIds: ["dept-1"],
        invitedByUserId: "inviter-1",
        inviteeEmail: "invitee@example.com",
        role: "VET",
      });

      const updateData =
        mockedPrisma.organisationInvite.update.mock.calls[0][0].data;
      expect(updateData.inviteeName).toBeUndefined();
      expect(updateData.employmentType).toBeUndefined();
      expect(mockedSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          templateData: expect.objectContaining({
            organisationName: "your organisation",
          }),
        }),
      );
    });

    it("falls back to a placeholder inviter name when the inviter is not found", async () => {
      primeCreateHappyPath();
      mockedPrisma.user.findFirst.mockResolvedValue(null);

      await OrganisationInviteService.createInvite(validCreatePayload);

      expect(mockedSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          templateData: expect.objectContaining({
            inviterName: "undefined undefined",
          }),
        }),
      );
    });

    it("throws 400 when no departments are specified", async () => {
      await expect(
        OrganisationInviteService.createInvite({
          ...validCreatePayload,
          departmentIds: [],
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "At least one department must be specified.",
      });
    });

    it("throws 400 when departmentIds is not an array", async () => {
      await expect(
        OrganisationInviteService.createInvite({
          ...validCreatePayload,
          departmentIds: "dept-1" as unknown as string[],
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("throws 400 for an invalid organisation identifier format", async () => {
      await expect(
        OrganisationInviteService.createInvite({
          ...validCreatePayload,
          organisationId: "invalid id!",
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Invalid organisation identifier format.",
      });
    });

    it("throws 400 for an invalid invitee email", async () => {
      await expect(
        OrganisationInviteService.createInvite({
          ...validCreatePayload,
          inviteeEmail: "not-an-email",
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Invalid invitee email address.",
      });
    });

    it("throws 400 for an invalid employment type", async () => {
      await expect(
        OrganisationInviteService.createInvite({
          ...validCreatePayload,
          employmentType: "TEMP" as never,
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Invalid employment type supplied.",
      });
    });

    it("throws 400 when the inviter identifier is missing", async () => {
      await expect(
        OrganisationInviteService.createInvite({
          ...validCreatePayload,
          invitedByUserId: null as unknown as string,
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Inviter identifier is required.",
      });
    });

    it("throws 400 when the inviter identifier is not a string", async () => {
      await expect(
        OrganisationInviteService.createInvite({
          ...validCreatePayload,
          invitedByUserId: 123 as unknown as string,
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Inviter identifier must be a string.",
      });
    });

    it("throws 400 when the inviter identifier is blank", async () => {
      await expect(
        OrganisationInviteService.createInvite({
          ...validCreatePayload,
          invitedByUserId: "   ",
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Inviter identifier cannot be empty.",
      });
    });

    it("throws 400 when the inviter identifier contains a forbidden character", async () => {
      await expect(
        OrganisationInviteService.createInvite({
          ...validCreatePayload,
          invitedByUserId: "user$1",
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Invalid character in Inviter identifier.",
      });
    });

    it("throws 404 when the organisation cannot be found", async () => {
      mockedPrisma.organization.findFirst.mockResolvedValue(null);

      await expect(
        OrganisationInviteService.createInvite(validCreatePayload),
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "Organisation not found.",
      });
      expect(mockedPrisma.organisationInvite.create).not.toHaveBeenCalled();
    });

    it("throws 404 when a department does not belong to the organisation", async () => {
      mockedPrisma.organization.findFirst.mockResolvedValue({
        id: "org-db",
        name: "Acme Vets",
        type: "HOSPITAL",
      });
      mockedPrisma.speciality.findFirst.mockResolvedValue(null);

      await expect(
        OrganisationInviteService.createInvite(validCreatePayload),
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "Department not found for the organisation.",
      });
    });

    it("throws 502 and logs when the invitation email fails to send", async () => {
      primeCreateHappyPath();
      mockedSendEmail.mockRejectedValue(new Error("SES unavailable"));

      await expect(
        OrganisationInviteService.createInvite(validCreatePayload),
      ).rejects.toMatchObject({
        statusCode: 502,
        message: "Unable to send organisation invite email.",
      });
      expect(mockedLogger.error).toHaveBeenCalledWith(
        "Failed to send organisation invite email.",
        expect.any(Error),
      );
    });
  });

  describe("listOrganisationInvites", () => {
    it("returns mapped invites ordered by creation date", async () => {
      mockedPrisma.organization.findFirst.mockResolvedValue({
        id: "org-db",
        name: "Org",
        type: "HOSPITAL",
      });
      mockedPrisma.organisationInvite.findMany.mockResolvedValue([
        makeInvite({ id: "i1" }),
        makeInvite({
          id: "i2",
          departmentIds: null,
          inviteeName: null,
          employmentType: null,
        }),
      ]);

      const result =
        await OrganisationInviteService.listOrganisationInvites("org-1");

      expect(mockedPrisma.organisationInvite.findMany).toHaveBeenCalledWith({
        where: { organisationId: "org-1" },
        orderBy: { createdAt: "desc" },
      });
      expect(result).toHaveLength(2);
      expect(result[0]._id).toBe("i1");
      // Null-guard fallbacks in buildInviteResponseFromPrisma.
      expect(result[1].departmentIds).toEqual([]);
      expect(result[1].inviteeName).toBeUndefined();
      expect(result[1].employmentType).toBeUndefined();
    });

    it("throws 404 when the organisation is not found", async () => {
      mockedPrisma.organization.findFirst.mockResolvedValue(null);

      await expect(
        OrganisationInviteService.listOrganisationInvites("org-1"),
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "Organisation not found.",
      });
      expect(mockedPrisma.organisationInvite.findMany).not.toHaveBeenCalled();
    });

    it("throws 400 for an invalid organisation identifier", async () => {
      await expect(
        OrganisationInviteService.listOrganisationInvites("bad id!"),
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe("listPendingInvitesForEmail", () => {
    it("returns an empty array when there are no pending invites", async () => {
      mockedPrisma.organisationInvite.findMany.mockResolvedValue([]);

      const result =
        await OrganisationInviteService.listPendingInvitesForEmail(
          "USER@Example.com",
        );

      expect(result).toEqual([]);
      expect(mockedPrisma.organisationInvite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            inviteeEmail: "user@example.com",
            status: "PENDING",
            expiresAt: expect.objectContaining({ gt: expect.any(Date) }),
          }),
          orderBy: { createdAt: "desc" },
        }),
      );
    });

    it("returns invites enriched with organisation name and type", async () => {
      mockedPrisma.organisationInvite.findMany.mockResolvedValue([
        makeInvite({ id: "p1", organisationId: "org-a" }),
      ]);
      mockedPrisma.organization.findFirst.mockResolvedValue({
        name: "Org A",
        type: "CLINIC",
      });

      const result =
        await OrganisationInviteService.listPendingInvitesForEmail(
          "user@example.com",
        );

      expect(result).toHaveLength(1);
      expect(result[0].invite._id).toBe("p1");
      expect(result[0].organisationName).toBe("Org A");
      expect(result[0].organisationType).toBe("CLINIC");
    });

    it("leaves organisation fields undefined when the organisation is missing", async () => {
      mockedPrisma.organisationInvite.findMany.mockResolvedValue([
        makeInvite({ id: "p2" }),
      ]);
      mockedPrisma.organization.findFirst.mockResolvedValue(null);

      const result =
        await OrganisationInviteService.listPendingInvitesForEmail(
          "user@example.com",
        );

      expect(result[0].organisationName).toBeUndefined();
      expect(result[0].organisationType).toBeUndefined();
    });

    it("throws 400 when the email is missing", async () => {
      await expect(
        OrganisationInviteService.listPendingInvitesForEmail(
          null as unknown as string,
        ),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Invitee email is required.",
      });
    });
  });

  describe("acceptInvite", () => {
    it("masks the accepted user id in logs", async () => {
      mockedPrisma.organisationInvite.findFirst.mockResolvedValue({
        id: "invite-1",
        organisationId: "org-1",
        departmentIds: ["dept-1"],
        inviteeEmail: "user@example.com",
        inviteeName: "User",
        role: "VET",
        status: "PENDING",
        token: "token-1",
        expiresAt: new Date(Date.now() + 60_000),
      });
      mockedPrisma.organization.findFirst.mockResolvedValue({
        id: "org-db",
        name: "Org",
        type: "HOSPITAL",
      });
      mockedPrisma.speciality.findFirst.mockResolvedValue({ id: "dept-db" });
      mockedUserOrganizationService.createUserOrganizationMapping.mockResolvedValue(
        undefined,
      );
      mockedPrisma.organisationInvite.update.mockResolvedValue({
        id: "invite-1",
        organisationId: "org-1",
        departmentIds: ["dept-1"],
        inviteeEmail: "user@example.com",
        role: "VET",
        status: "ACCEPTED",
        acceptedAt: new Date(),
      });

      await OrganisationInviteService.acceptInvite({
        token: "token-1",
        userId: "user-12345",
        userEmail: "user@example.com",
      });

      expect(mockedLogger.info).toHaveBeenCalledWith(
        "Organisation invite accepted.",
        expect.objectContaining({
          userId: "use***45",
        }),
      );
    });

    it("marks the invite accepted and adds the user to each department", async () => {
      mockedPrisma.organisationInvite.findFirst.mockResolvedValue(
        makeInvite({ departmentIds: ["dept-1", "dept-2"] }),
      );
      mockedPrisma.organization.findFirst.mockResolvedValue({
        id: "org-db",
        name: "Org",
        type: "HOSPITAL",
      });
      mockedPrisma.speciality.findFirst.mockResolvedValue({ id: "dept-db" });
      mockedUserOrganizationService.createUserOrganizationMapping.mockResolvedValue(
        undefined,
      );
      mockedPrisma.organisationInvite.update.mockResolvedValue(
        makeInvite({ status: "ACCEPTED", acceptedAt: new Date() }),
      );

      const result = await OrganisationInviteService.acceptInvite({
        token: "token-1",
        userId: "user-98765",
        userEmail: "user@example.com",
      });

      expect(mockedPrisma.organisationInvite.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "invite-1" },
          data: expect.objectContaining({
            status: "ACCEPTED",
            acceptedAt: expect.any(Date),
          }),
        }),
      );
      expect(mockedPrisma.speciality.update).toHaveBeenCalledTimes(2);
      expect(mockedPrisma.speciality.update).toHaveBeenCalledWith({
        where: { id: "dept-db" },
        data: { memberUserIds: { push: "user-98765" } },
      });
      expect(result.status).toBe("ACCEPTED");
    });

    it("throws 404 when the invite token does not match", async () => {
      mockedPrisma.organisationInvite.findFirst.mockResolvedValue(null);

      await expect(
        OrganisationInviteService.acceptInvite({
          token: "missing",
          userId: "user-1",
          userEmail: "user@example.com",
        }),
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "Invitation not found.",
      });
    });

    it("throws 409 when the invite was already accepted", async () => {
      mockedPrisma.organisationInvite.findFirst.mockResolvedValue(
        makeInvite({ status: "ACCEPTED" }),
      );

      await expect(
        OrganisationInviteService.acceptInvite({
          token: "token-1",
          userId: "user-1",
          userEmail: "user@example.com",
        }),
      ).rejects.toMatchObject({
        statusCode: 409,
        message: "Invitation already accepted.",
      });
    });

    it("throws 410 when the invite was cancelled", async () => {
      mockedPrisma.organisationInvite.findFirst.mockResolvedValue(
        makeInvite({ status: "CANCELLED" }),
      );

      await expect(
        OrganisationInviteService.acceptInvite({
          token: "token-1",
          userId: "user-1",
          userEmail: "user@example.com",
        }),
      ).rejects.toMatchObject({
        statusCode: 410,
        message: "Invitation has been cancelled.",
      });
    });

    it("marks a pending-but-past-expiry invite as expired then throws 410", async () => {
      mockedPrisma.organisationInvite.findFirst.mockResolvedValue(
        makeInvite({ status: "PENDING", expiresAt: pastDate() }),
      );
      mockedPrisma.organisationInvite.update.mockResolvedValue(undefined);

      await expect(
        OrganisationInviteService.acceptInvite({
          token: "token-1",
          userId: "user-1",
          userEmail: "user@example.com",
        }),
      ).rejects.toMatchObject({
        statusCode: 410,
        message: "Invitation has expired.",
      });
      expect(mockedPrisma.organisationInvite.update).toHaveBeenCalledWith({
        where: { id: "invite-1" },
        data: { status: "EXPIRED" },
      });
    });

    it("throws 410 for an already-expired invite without re-updating it", async () => {
      mockedPrisma.organisationInvite.findFirst.mockResolvedValue(
        makeInvite({ status: "EXPIRED", expiresAt: futureDate() }),
      );

      await expect(
        OrganisationInviteService.acceptInvite({
          token: "token-1",
          userId: "user-1",
          userEmail: "user@example.com",
        }),
      ).rejects.toMatchObject({
        statusCode: 410,
        message: "Invitation has expired.",
      });
      expect(mockedPrisma.organisationInvite.update).not.toHaveBeenCalled();
    });

    it("throws 403 when the invite email does not match the user", async () => {
      mockedPrisma.organisationInvite.findFirst.mockResolvedValue(
        makeInvite({ inviteeEmail: "other@example.com" }),
      );

      await expect(
        OrganisationInviteService.acceptInvite({
          token: "token-1",
          userId: "user-1",
          userEmail: "user@example.com",
        }),
      ).rejects.toMatchObject({
        statusCode: 403,
        message: "Invite email does not match authenticated user.",
      });
    });

    it("throws 404 when the organisation is missing during acceptance", async () => {
      mockedPrisma.organisationInvite.findFirst.mockResolvedValue(makeInvite());
      mockedPrisma.organization.findFirst.mockResolvedValue(null);

      await expect(
        OrganisationInviteService.acceptInvite({
          token: "token-1",
          userId: "user-1",
          userEmail: "user@example.com",
        }),
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "Organisation not found.",
      });
    });

    it("throws 404 when a department is missing during acceptance", async () => {
      mockedPrisma.organisationInvite.findFirst.mockResolvedValue(makeInvite());
      mockedPrisma.organization.findFirst.mockResolvedValue({
        id: "org-db",
        name: "Org",
        type: "HOSPITAL",
      });
      mockedPrisma.speciality.findFirst.mockResolvedValue(null);

      await expect(
        OrganisationInviteService.acceptInvite({
          token: "token-1",
          userId: "user-1",
          userEmail: "user@example.com",
        }),
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "Department not found for the organisation.",
      });
    });

    it("propagates a UserOrganizationServiceError as a service error", async () => {
      mockedPrisma.organisationInvite.findFirst.mockResolvedValue(makeInvite());
      mockedPrisma.organization.findFirst.mockResolvedValue({
        id: "org-db",
        name: "Org",
        type: "HOSPITAL",
      });
      mockedPrisma.speciality.findFirst.mockResolvedValue({ id: "dept-db" });
      mockedUserOrganizationService.createUserOrganizationMapping.mockRejectedValue(
        new UserOrganizationServiceError("Role not permitted", 422),
      );

      await expect(
        OrganisationInviteService.acceptInvite({
          token: "token-1",
          userId: "user-1",
          userEmail: "user@example.com",
        }),
      ).rejects.toMatchObject({
        statusCode: 422,
        message: "Role not permitted",
      });
    });

    it("wraps an unexpected membership error as a 500", async () => {
      mockedPrisma.organisationInvite.findFirst.mockResolvedValue(makeInvite());
      mockedPrisma.organization.findFirst.mockResolvedValue({
        id: "org-db",
        name: "Org",
        type: "HOSPITAL",
      });
      mockedPrisma.speciality.findFirst.mockResolvedValue({ id: "dept-db" });
      mockedUserOrganizationService.createUserOrganizationMapping.mockRejectedValue(
        new Error("connection reset"),
      );

      await expect(
        OrganisationInviteService.acceptInvite({
          token: "token-1",
          userId: "user-1",
          userEmail: "user@example.com",
        }),
      ).rejects.toMatchObject({
        statusCode: 500,
        message: "Unable to associate user with organisation.",
      });
      expect(mockedLogger.error).toHaveBeenCalledWith(
        "Failed to ensure user-organisation membership during invite acceptance.",
        expect.any(Error),
      );
    });

    it("tolerates a duplicate-key membership error and still accepts", async () => {
      mockedPrisma.organisationInvite.findFirst.mockResolvedValue(makeInvite());
      mockedPrisma.organization.findFirst.mockResolvedValue({
        id: "org-db",
        name: "Org",
        type: "HOSPITAL",
      });
      mockedPrisma.speciality.findFirst.mockResolvedValue({ id: "dept-db" });
      mockedUserOrganizationService.createUserOrganizationMapping.mockRejectedValue(
        { code: 11000 },
      );
      mockedPrisma.organisationInvite.update.mockResolvedValue(
        makeInvite({ status: "ACCEPTED", acceptedAt: new Date() }),
      );

      const result = await OrganisationInviteService.acceptInvite({
        token: "token-1",
        userId: "user-duplicate",
        userEmail: "user@example.com",
      });

      expect(mockedLogger.warn).toHaveBeenCalledWith(
        "User already associated with organisation role; skipping duplicate creation.",
        expect.objectContaining({ organisationId: "org-1", role: "VET" }),
      );
      expect(mockedPrisma.organisationInvite.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "ACCEPTED" }),
        }),
      );
      expect(mockedPrisma.speciality.update).toHaveBeenCalled();
      expect(result.status).toBe("ACCEPTED");
    });
  });

  describe("rejectInvite", () => {
    it("masks the rejected user id in logs", async () => {
      mockedPrisma.organisationInvite.findFirst.mockResolvedValue({
        id: "invite-2",
        organisationId: "org-2",
        departmentIds: [],
        inviteeEmail: "user@example.com",
        role: "VET",
        status: "PENDING",
        token: "token-2",
        expiresAt: new Date(Date.now() + 60_000),
      });
      mockedPrisma.organization.findFirst.mockResolvedValue({
        id: "org-db",
        name: "Org",
        type: "HOSPITAL",
      });
      mockedPrisma.organisationInvite.update.mockResolvedValue({
        id: "invite-2",
        organisationId: "org-2",
        departmentIds: [],
        inviteeEmail: "user@example.com",
        role: "VET",
        status: "CANCELLED",
        acceptedAt: null,
      });

      await OrganisationInviteService.rejectInvite({
        token: "token-2",
        userId: "user-67890",
        userEmail: "user@example.com",
      });

      expect(mockedLogger.info).toHaveBeenCalledWith(
        "Organisation invite rejected.",
        expect.objectContaining({
          userId: "use***90",
        }),
      );
    });

    it("cancels the invite and clears the accepted timestamp", async () => {
      mockedPrisma.organisationInvite.findFirst.mockResolvedValue(makeInvite());
      mockedPrisma.organisationInvite.update.mockResolvedValue(
        makeInvite({ status: "CANCELLED", acceptedAt: null }),
      );

      const result = await OrganisationInviteService.rejectInvite({
        token: "token-1",
        userId: "user-1",
        userEmail: "user@example.com",
      });

      expect(mockedPrisma.organisationInvite.update).toHaveBeenCalledWith({
        where: { id: "invite-1" },
        data: { status: "CANCELLED", acceptedAt: null },
      });
      expect(result.status).toBe("CANCELLED");
    });

    it("masks a short user id using the short-form mask", async () => {
      mockedPrisma.organisationInvite.findFirst.mockResolvedValue(makeInvite());
      mockedPrisma.organisationInvite.update.mockResolvedValue(
        makeInvite({ status: "CANCELLED", acceptedAt: null }),
      );

      await OrganisationInviteService.rejectInvite({
        token: "token-1",
        userId: "abc",
        userEmail: "user@example.com",
      });

      expect(mockedLogger.info).toHaveBeenCalledWith(
        "Organisation invite rejected.",
        expect.objectContaining({ userId: "a***" }),
      );
    });

    it("throws 404 when the invite token does not match", async () => {
      mockedPrisma.organisationInvite.findFirst.mockResolvedValue(null);

      await expect(
        OrganisationInviteService.rejectInvite({
          token: "missing",
          userId: "user-1",
          userEmail: "user@example.com",
        }),
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "Invitation not found.",
      });
    });

    it("marks a pending-but-past-expiry invite as expired then throws 410", async () => {
      mockedPrisma.organisationInvite.findFirst.mockResolvedValue(
        makeInvite({ status: "PENDING", expiresAt: pastDate() }),
      );
      mockedPrisma.organisationInvite.update.mockResolvedValue(undefined);

      await expect(
        OrganisationInviteService.rejectInvite({
          token: "token-1",
          userId: "user-1",
          userEmail: "user@example.com",
        }),
      ).rejects.toMatchObject({
        statusCode: 410,
        message: "Invitation has expired.",
      });
      expect(mockedPrisma.organisationInvite.update).toHaveBeenCalledWith({
        where: { id: "invite-1" },
        data: { status: "EXPIRED" },
      });
    });
  });
});

describe("OrganisationInviteService invite URL construction", () => {
  const ORIGINAL_ENV = process.env;

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.resetModules();
  });

  type IsolatedService = {
    service: typeof OrganisationInviteService;
    prisma: any;
    sendEmail: any;
  };

  const loadIsolated = (env: Record<string, string>): IsolatedService => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV, ...env };

    let service: typeof OrganisationInviteService;
    let isolatedPrisma: any;
    let isolatedSendEmail: any;

    jest.isolateModules(() => {
      isolatedPrisma = require("../../src/config/prisma").prisma;
      isolatedSendEmail = require("../../src/utils/email").sendEmailTemplate;
      service =
        require("../../src/services/organisation-invite.service").OrganisationInviteService;
    });

    return {
      service: service!,
      prisma: isolatedPrisma,
      sendEmail: isolatedSendEmail,
    };
  };

  const primeIsolated = (isolated: IsolatedService) => {
    isolated.prisma.organization.findFirst.mockResolvedValue({
      id: "org-db",
      name: "Org",
      type: "HOSPITAL",
    });
    isolated.prisma.speciality.findFirst.mockResolvedValue({ id: "dept-db" });
    isolated.prisma.organisationInvite.findFirst.mockResolvedValue(null);
    isolated.prisma.organisationInvite.create.mockResolvedValue(
      makeInvite({ token: "tok-url" }),
    );
    isolated.prisma.user.findFirst.mockResolvedValue({
      firstName: "Jane",
      lastName: "Doe",
    });
    isolated.sendEmail.mockResolvedValue(undefined);
  };

  const isolatedPayload = {
    organisationId: "org-1",
    departmentIds: ["dept-1"],
    invitedByUserId: "inviter-1",
    inviteeEmail: "invitee@example.com",
    role: "VET",
  };

  it("appends the token to non-URL bases via the string fallback", async () => {
    const isolated = loadIsolated({
      ORG_INVITE_ACCEPT_BASE_URL: "app.example.com",
      ORG_INVITE_DECLINE_BASE_URL: "app.example.com/d?ref=1",
    });
    primeIsolated(isolated);

    await isolated.service.createInvite(isolatedPayload);

    const templateData = isolated.sendEmail.mock.calls[0][0].templateData;
    expect(templateData.acceptUrl).toBe("app.example.com?token=tok-url");
    expect(templateData.declineUrl).toBe(
      "app.example.com/d?ref=1&token=tok-url&action=decline",
    );
  });

  it("strips a trailing slash in the string fallback", async () => {
    const isolated = loadIsolated({
      ORG_INVITE_ACCEPT_BASE_URL: "app.example.com/",
      ORG_INVITE_DECLINE_BASE_URL: "app.example.com/decline/",
    });
    primeIsolated(isolated);

    await isolated.service.createInvite(isolatedPayload);

    const templateData = isolated.sendEmail.mock.calls[0][0].templateData;
    expect(templateData.acceptUrl).toBe("app.example.com?token=tok-url");
    expect(templateData.declineUrl).toBe(
      "app.example.com/decline?token=tok-url&action=decline",
    );
  });

  it("uses the URL API when the accept base is a valid URL and omits decline when unset", async () => {
    const isolated = loadIsolated({
      ORG_INVITE_ACCEPT_BASE_URL: "https://accept.example.com/invite",
      ORG_INVITE_DECLINE_BASE_URL: "",
    });
    primeIsolated(isolated);

    await isolated.service.createInvite(isolatedPayload);

    const templateData = isolated.sendEmail.mock.calls[0][0].templateData;
    expect(templateData.acceptUrl).toBe("https://accept.example.com/invite");
    expect(templateData.declineUrl).toBeUndefined();
  });

  it("throws (surfaced as 502) when the accept base URL is misconfigured/empty", async () => {
    const isolated = loadIsolated({ ORG_INVITE_ACCEPT_BASE_URL: "" });
    primeIsolated(isolated);

    await expect(
      isolated.service.createInvite(isolatedPayload),
    ).rejects.toMatchObject({ statusCode: 502 });
  });
});
