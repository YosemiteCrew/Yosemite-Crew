import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import { prisma } from "../../src/config/prisma";
import { OrganisationInviteService } from "../../src/services/organisation-invite.service";
import { UserOrganizationService } from "../../src/services/user-organization.service";
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
      update: jest.fn(),
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

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const mockedPrisma = prisma as any;
const mockedUserOrganizationService = UserOrganizationService as any;
const mockedLogger = logger as any;

describe("OrganisationInviteService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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
    mockedPrisma.speciality.findFirst.mockResolvedValue({ _id: "dept-db" });
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
});
