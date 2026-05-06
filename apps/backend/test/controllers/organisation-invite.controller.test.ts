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
  });
});
