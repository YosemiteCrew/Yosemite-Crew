import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request, Response } from "express";

jest.mock("../../src/services/organisation-invite.service", () => {
  class MockOrganisationInviteServiceError extends Error {
    statusCode: number;

    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
      this.name = "OrganisationInviteServiceError";
    }
  }

  return {
    OrganisationInviteService: {
      createInvite: jest.fn(),
      listOrganisationInvites: jest.fn(),
      listPendingInvitesForEmail: jest.fn(),
      acceptInvite: jest.fn(),
      rejectInvite: jest.fn(),
    },
    OrganisationInviteServiceError: MockOrganisationInviteServiceError,
  };
});

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import { OrganisationInviteController } from "../../src/controllers/web/organisation-invite.controller";
import {
  OrganisationInviteService,
  OrganisationInviteServiceError,
} from "../../src/services/organisation-invite.service";
import logger from "../../src/utils/logger";

describe("OrganisationInviteController", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    req = {
      headers: {},
      params: {},
      body: {},
    };

    res = {
      status: statusMock,
      json: jsonMock,
    } as unknown as Response;

    jest.clearAllMocks();
  });

  describe("createInvite", () => {
    it("creates an invite scoped to the organisation in the route", async () => {
      req.params = { organisationId: "org-1" };
      (req as any).userId = "auth-user-id";
      req.body = {
        departmentIds: ["dept-1"],
        inviteeEmail: "vet@yosemitecrew.com",
        inviteeName: "Sam Vet",
        role: "VET",
        employmentType: "FULL_TIME",
      };
      jest
        .mocked(OrganisationInviteService.createInvite)
        .mockResolvedValueOnce({ _id: "invite-1" } as any);

      await OrganisationInviteController.createInvite(
        req as Request,
        res as Response,
      );

      expect(OrganisationInviteService.createInvite).toHaveBeenCalledWith({
        organisationId: "org-1",
        invitedByUserId: "auth-user-id",
        departmentIds: ["dept-1"],
        inviteeEmail: "vet@yosemitecrew.com",
        inviteeName: "Sam Vet",
        role: "VET",
        employmentType: "FULL_TIME",
      });
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({ _id: "invite-1" });
    });

    it("normalises the optional invite fields the client omitted", async () => {
      req.params = { organisationId: "org-1" };
      (req as any).userId = "auth-user-id";
      req.body = { employmentType: "PART_TIME" };
      jest
        .mocked(OrganisationInviteService.createInvite)
        .mockResolvedValueOnce({ _id: "invite-2" } as any);

      await OrganisationInviteController.createInvite(
        req as Request,
        res as Response,
      );

      expect(OrganisationInviteService.createInvite).toHaveBeenCalledWith({
        organisationId: "org-1",
        invitedByUserId: "auth-user-id",
        departmentIds: [],
        inviteeEmail: "",
        inviteeName: undefined,
        role: "",
        employmentType: "PART_TIME",
      });
      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("returns 400 when the organisation identifier is missing", async () => {
      (req as any).userId = "auth-user-id";

      await OrganisationInviteController.createInvite(
        req as Request,
        res as Response,
      );

      expect(OrganisationInviteService.createInvite).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Organisation identifier is required.",
      });
    });

    it("returns 401 when no inviter identity can be resolved", async () => {
      req.params = { organisationId: "org-1" };

      await OrganisationInviteController.createInvite(
        req as Request,
        res as Response,
      );

      expect(OrganisationInviteService.createInvite).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Inviter identity missing.",
      });
    });

    it("maps service errors correctly", async () => {
      req.params = { organisationId: "org-1" };
      (req as any).userId = "auth-user-id";
      req.body = { employmentType: "FULL_TIME" };
      jest
        .mocked(OrganisationInviteService.createInvite)
        .mockRejectedValueOnce(
          new OrganisationInviteServiceError("Invitee already a member.", 409),
        );

      await OrganisationInviteController.createInvite(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Invitee already a member.",
      });
      expect(jest.mocked(logger).error).not.toHaveBeenCalled();
    });

    it("logs and returns 500 for unknown failures", async () => {
      req.params = { organisationId: "org-1" };
      (req as any).userId = "auth-user-id";
      req.body = { employmentType: "FULL_TIME" };
      jest
        .mocked(OrganisationInviteService.createInvite)
        .mockRejectedValueOnce(new Error("boom"));

      await OrganisationInviteController.createInvite(
        req as Request,
        res as Response,
      );

      expect(jest.mocked(logger).error).toHaveBeenCalledWith(
        "Failed to create organisation invite.",
        expect.any(Error),
      );
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Unable to create organisation invite.",
      });
    });
  });

  describe("listOrganisationInvites", () => {
    it("returns the invites for the addressed organisation", async () => {
      req.params = { organisationId: "org-1" };
      jest
        .mocked(OrganisationInviteService.listOrganisationInvites)
        .mockResolvedValueOnce([{ _id: "invite-1" }] as any);

      await OrganisationInviteController.listOrganisationInvites(
        req as Request,
        res as Response,
      );

      expect(
        OrganisationInviteService.listOrganisationInvites,
      ).toHaveBeenCalledWith("org-1");
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith([{ _id: "invite-1" }]);
    });

    it("returns 400 when the organisation identifier is missing", async () => {
      await OrganisationInviteController.listOrganisationInvites(
        req as Request,
        res as Response,
      );

      expect(
        OrganisationInviteService.listOrganisationInvites,
      ).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Organisation identifier is required.",
      });
    });

    it("maps service errors correctly", async () => {
      req.params = { organisationId: "org-1" };
      jest
        .mocked(OrganisationInviteService.listOrganisationInvites)
        .mockRejectedValueOnce(
          new OrganisationInviteServiceError("Organisation not found.", 404),
        );

      await OrganisationInviteController.listOrganisationInvites(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Organisation not found.",
      });
    });

    it("logs and returns 500 for unknown failures", async () => {
      req.params = { organisationId: "org-1" };
      jest
        .mocked(OrganisationInviteService.listOrganisationInvites)
        .mockRejectedValueOnce(new Error("boom"));

      await OrganisationInviteController.listOrganisationInvites(
        req as Request,
        res as Response,
      );

      expect(jest.mocked(logger).error).toHaveBeenCalledWith(
        "Failed to list organisation invites.",
        expect.any(Error),
      );
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Unable to list organisation invites.",
      });
    });
  });

  describe("listMyPendingInvites", () => {
    it("uses authenticated email instead of x-user-email header", async () => {
      req.headers = { "x-user-email": "victim@yosemitecrew.com" };
      (req as any).auth = { email: "actual-user@yosemitecrew.com" };
      jest
        .mocked(OrganisationInviteService.listPendingInvitesForEmail)
        .mockResolvedValue([] as any);

      await OrganisationInviteController.listMyPendingInvites(
        req as Request,
        res as Response,
      );

      expect(
        OrganisationInviteService.listPendingInvitesForEmail,
      ).toHaveBeenCalledWith("actual-user@yosemitecrew.com");
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("falls back to the request email when the auth claim carries none", async () => {
      (req as any).email = "  fallback@yosemitecrew.com  ";
      jest
        .mocked(OrganisationInviteService.listPendingInvitesForEmail)
        .mockResolvedValueOnce([{ _id: "invite-1" }] as any);

      await OrganisationInviteController.listMyPendingInvites(
        req as Request,
        res as Response,
      );

      expect(
        OrganisationInviteService.listPendingInvitesForEmail,
      ).toHaveBeenCalledWith("fallback@yosemitecrew.com");
      expect(jsonMock).toHaveBeenCalledWith([{ _id: "invite-1" }]);
    });

    it("returns 401 when authenticated email is missing", async () => {
      req.headers = { "x-user-email": "victim@yosemitecrew.com" };

      await OrganisationInviteController.listMyPendingInvites(
        req as Request,
        res as Response,
      );

      expect(
        OrganisationInviteService.listPendingInvitesForEmail,
      ).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it.each([
      ["blank", "   "],
      ["not a string", 42],
    ])("returns 401 when the authenticated email is %s", async (_l, email) => {
      (req as any).auth = { email };

      await OrganisationInviteController.listMyPendingInvites(
        req as Request,
        res as Response,
      );

      expect(
        OrganisationInviteService.listPendingInvitesForEmail,
      ).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Authenticated user email is required.",
      });
    });

    it("maps service errors correctly", async () => {
      (req as any).auth = { email: "user@yosemitecrew.com" };
      jest
        .mocked(OrganisationInviteService.listPendingInvitesForEmail)
        .mockRejectedValueOnce(
          new OrganisationInviteServiceError("Invalid email.", 400),
        );

      await OrganisationInviteController.listMyPendingInvites(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ message: "Invalid email." });
    });

    it("logs and returns 500 for unknown failures", async () => {
      (req as any).auth = { email: "user@yosemitecrew.com" };
      jest
        .mocked(OrganisationInviteService.listPendingInvitesForEmail)
        .mockRejectedValueOnce(new Error("boom"));

      await OrganisationInviteController.listMyPendingInvites(
        req as Request,
        res as Response,
      );

      expect(jest.mocked(logger).error).toHaveBeenCalledWith(
        "Failed to list pending organisation invites for user.",
        expect.any(Error),
      );
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Unable to list pending organisation invites.",
      });
    });
  });

  describe("acceptInvite", () => {
    it("uses authenticated user identity instead of spoofable headers", async () => {
      req.params = { token: "invite-token" };
      req.headers = {
        "x-user-id": "spoofed-user-id",
        "x-user-email": "victim@yosemitecrew.com",
      };
      (req as any).userId = "auth-user-id";
      (req as any).auth = {
        sub: "auth-user-id",
        email: "auth-user@yosemitecrew.com",
      };
      jest.mocked(OrganisationInviteService.acceptInvite).mockResolvedValue({
        _id: "invite-id",
      } as any);

      await OrganisationInviteController.acceptInvite(
        req as Request,
        res as Response,
      );

      expect(OrganisationInviteService.acceptInvite).toHaveBeenCalledWith({
        token: "invite-token",
        userId: "auth-user-id",
        userEmail: "auth-user@yosemitecrew.com",
      });
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("falls back to the auth subject when the request carries no userId", async () => {
      req.params = { token: "invite-token" };
      (req as any).auth = {
        sub: "subject-user-id",
        email: "auth-user@yosemitecrew.com",
      };
      jest
        .mocked(OrganisationInviteService.acceptInvite)
        .mockResolvedValueOnce({ _id: "invite-id" } as any);

      await OrganisationInviteController.acceptInvite(
        req as Request,
        res as Response,
      );

      expect(OrganisationInviteService.acceptInvite).toHaveBeenCalledWith({
        token: "invite-token",
        userId: "subject-user-id",
        userEmail: "auth-user@yosemitecrew.com",
      });
    });

    it("returns 400 when the invite token is missing", async () => {
      (req as any).userId = "auth-user-id";
      (req as any).auth = { email: "auth-user@yosemitecrew.com" };

      await OrganisationInviteController.acceptInvite(
        req as Request,
        res as Response,
      );

      expect(OrganisationInviteService.acceptInvite).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Invite token is required.",
      });
    });

    it.each([
      ["the user id is blank", { userId: "   ", email: "u@yosemitecrew.com" }],
      ["the user id is not a string", { userId: 7, email: "u@x.com" }],
      ["the email is missing", { userId: "auth-user-id", email: undefined }],
    ])("returns 401 when %s", async (_label, identity) => {
      req.params = { token: "invite-token" };
      (req as any).userId = identity.userId;
      (req as any).auth = { email: identity.email };

      await OrganisationInviteController.acceptInvite(
        req as Request,
        res as Response,
      );

      expect(OrganisationInviteService.acceptInvite).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Authenticated user information is required.",
      });
    });

    it("maps service errors correctly", async () => {
      req.params = { token: "invite-token" };
      (req as any).userId = "auth-user-id";
      (req as any).auth = { email: "auth-user@yosemitecrew.com" };

      jest
        .mocked(OrganisationInviteService.acceptInvite)
        .mockRejectedValue(
          new OrganisationInviteServiceError("Invalid invite.", 400),
        );

      await OrganisationInviteController.acceptInvite(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ message: "Invalid invite." });
    });

    it("logs and returns 500 for unknown failures", async () => {
      req.params = { token: "invite-token" };
      (req as any).userId = "auth-user-id";
      (req as any).auth = { email: "auth-user@yosemitecrew.com" };

      jest
        .mocked(OrganisationInviteService.acceptInvite)
        .mockRejectedValue(new Error("boom"));

      await OrganisationInviteController.acceptInvite(
        req as Request,
        res as Response,
      );

      expect(jest.mocked(logger).error).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("rejectInvite", () => {
    it("uses authenticated user identity instead of spoofable headers", async () => {
      req.params = { token: "invite-token" };
      req.headers = {
        "x-user-id": "spoofed-user-id",
        "x-user-email": "victim@yosemitecrew.com",
      };
      (req as any).userId = "auth-user-id";
      (req as any).auth = {
        sub: "auth-user-id",
        email: "auth-user@yosemitecrew.com",
      };
      jest.mocked(OrganisationInviteService.rejectInvite).mockResolvedValue({
        _id: "invite-id",
      } as any);

      await OrganisationInviteController.rejectInvite(
        req as Request,
        res as Response,
      );

      expect(OrganisationInviteService.rejectInvite).toHaveBeenCalledWith({
        token: "invite-token",
        userId: "auth-user-id",
        userEmail: "auth-user@yosemitecrew.com",
      });
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("returns 400 when the invite token is missing", async () => {
      (req as any).userId = "auth-user-id";
      (req as any).auth = { email: "auth-user@yosemitecrew.com" };

      await OrganisationInviteController.rejectInvite(
        req as Request,
        res as Response,
      );

      expect(OrganisationInviteService.rejectInvite).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Invite token is required.",
      });
    });

    it("returns 401 when the authenticated identity is incomplete", async () => {
      req.params = { token: "invite-token" };
      (req as any).auth = { email: "auth-user@yosemitecrew.com" };

      await OrganisationInviteController.rejectInvite(
        req as Request,
        res as Response,
      );

      expect(OrganisationInviteService.rejectInvite).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Authenticated user information is required.",
      });
    });

    it("maps service errors correctly", async () => {
      req.params = { token: "invite-token" };
      (req as any).userId = "auth-user-id";
      (req as any).auth = { email: "auth-user@yosemitecrew.com" };
      jest
        .mocked(OrganisationInviteService.rejectInvite)
        .mockRejectedValueOnce(
          new OrganisationInviteServiceError("Invite already used.", 409),
        );

      await OrganisationInviteController.rejectInvite(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Invite already used.",
      });
    });

    it("logs and returns 500 for unknown failures", async () => {
      req.params = { token: "invite-token" };
      (req as any).userId = "auth-user-id";
      (req as any).auth = { email: "auth-user@yosemitecrew.com" };
      jest
        .mocked(OrganisationInviteService.rejectInvite)
        .mockRejectedValueOnce(new Error("boom"));

      await OrganisationInviteController.rejectInvite(
        req as Request,
        res as Response,
      );

      expect(jest.mocked(logger).error).toHaveBeenCalledWith(
        "Failed to accept organisation invite.",
        expect.any(Error),
      );
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Unable to accept organisation invite.",
      });
    });
  });
});
