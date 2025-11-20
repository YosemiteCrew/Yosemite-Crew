import { CoParentInviteController } from "../../src/controllers/app/coparentInvite.controller";
import {
  CoParentInviteService,
  CoParentInviteServiceError,
} from "../../src/services/coparentInvite.service";
import { ParentService } from "../../src/services/parent.service";
import { AuthUserMobileService } from "../../src/services/authUserMobile.service";
import logger from "../../src/utils/logger";

jest.mock("../../src/services/coparentInvite.service", () => {
  const actual = jest.requireActual(
    "../../src/services/coparentInvite.service",
  );
  return {
    ...actual,
    CoParentInviteService: {
      sendInvite: jest.fn(),
      validateInvite: jest.fn(),
      acceptInvite: jest.fn(),
      declineInvite: jest.fn(),
      getPendingInvitesForEmail: jest.fn(),
    },
  };
});

jest.mock("../../src/services/parent.service", () => {
  const actual = jest.requireActual("../../src/services/parent.service");
  return {
    ...actual,
    ParentService: {
      findByLinkedUserId: jest.fn(),
    },
  };
});

jest.mock("../../src/services/authUserMobile.service", () => {
  const actual = jest.requireActual(
    "../../src/services/authUserMobile.service",
  );
  return {
    ...actual,
    AuthUserMobileService: {
      getByProviderUserId: jest.fn(),
    },
  };
});

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

const mockedCoParentInviteService = CoParentInviteService as unknown as {
  sendInvite: jest.Mock;
  validateInvite: jest.Mock;
  acceptInvite: jest.Mock;
  declineInvite: jest.Mock;
  getPendingInvitesForEmail: jest.Mock;
};

const mockedParentService = ParentService as unknown as {
  findByLinkedUserId: jest.Mock;
};

const mockedAuthUserMobileService = AuthUserMobileService as unknown as {
  getByProviderUserId: jest.Mock;
};

const mockedLogger = logger as unknown as {
  error: jest.Mock;
};

const createResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res;
};

describe("CoParentInviteController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("sendInvite", () => {
    it("requires auth user id", async () => {
      const req = { headers: {}, body: {} } as any;
      const res = createResponse();

      await CoParentInviteController.sendInvite(req, res as any);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: "Authentication required.",
      });
      expect(mockedCoParentInviteService.sendInvite).not.toHaveBeenCalled();
    });

    it("validates request body", async () => {
      const req = { headers: { "x-user-id": "user-1" }, body: {} } as any;
      const res = createResponse();

      await CoParentInviteController.sendInvite(req, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Email and companionId and InviteeName are required.",
      });
      expect(mockedCoParentInviteService.sendInvite).not.toHaveBeenCalled();
    });

    it("creates invite", async () => {
      const req = {
        headers: { "x-user-id": "user-1" },
        body: {
          email: "test@example.com",
          companionId: "cmp-1",
          inviteeName: "Alex",
        },
      } as any;
      const res = createResponse();
      mockedParentService.findByLinkedUserId.mockResolvedValueOnce({
        _id: { toString: () => "parent-1" },
      });
      mockedCoParentInviteService.sendInvite.mockResolvedValueOnce({});

      await CoParentInviteController.sendInvite(req, res as any);

      expect(mockedParentService.findByLinkedUserId).toHaveBeenCalledWith(
        "user-1",
      );
      expect(mockedCoParentInviteService.sendInvite).toHaveBeenCalledWith({
        email: "test@example.com",
        companionId: "cmp-1",
        invitedByParentId: "parent-1",
        inviteeName: "Alex",
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invite created successfully.",
      });
    });

    it("maps service errors", async () => {
      const req = {
        headers: { "x-user-id": "user-1" },
        body: {
          email: "test@example.com",
          companionId: "cmp-1",
          inviteeName: "Alex",
        },
      } as any;
      const res = createResponse();
      mockedParentService.findByLinkedUserId.mockResolvedValueOnce({
        _id: { toString: () => "parent-1" },
      });
      mockedCoParentInviteService.sendInvite.mockRejectedValueOnce(
        new CoParentInviteServiceError("nope", 422),
      );

      await CoParentInviteController.sendInvite(req, res as any);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith({ message: "nope" });
    });

    it("handles unexpected errors", async () => {
      const req = {
        headers: { "x-user-id": "user-1" },
        body: {
          email: "test@example.com",
          companionId: "cmp-1",
          inviteeName: "Alex",
        },
      } as any;
      const res = createResponse();
      mockedParentService.findByLinkedUserId.mockResolvedValueOnce({
        _id: { toString: () => "parent-1" },
      });
      mockedCoParentInviteService.sendInvite.mockRejectedValueOnce(
        new Error("boom"),
      );

      await CoParentInviteController.sendInvite(req, res as any);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Unable to send invite.",
      });
      expect(mockedLogger.error).toHaveBeenCalled();
    });
  });

  describe("validateInvite", () => {
    it("requires token", async () => {
      const req = { query: {} } as any;
      const res = createResponse();

      await CoParentInviteController.validateInvite(req, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invite token is required.",
      });
    });

    it("returns validation result", async () => {
      const req = { query: { token: "token-1" } } as any;
      const res = createResponse();
      const validationResult = { id: "invite-id" };
      mockedCoParentInviteService.validateInvite.mockResolvedValueOnce(
        validationResult,
      );

      await CoParentInviteController.validateInvite(req, res as any);

      expect(mockedCoParentInviteService.validateInvite).toHaveBeenCalledWith(
        "token-1",
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(validationResult);
    });

    it("maps service errors", async () => {
      const req = { query: { token: "token-1" } } as any;
      const res = createResponse();
      mockedCoParentInviteService.validateInvite.mockRejectedValueOnce(
        new CoParentInviteServiceError("bad", 404),
      );

      await CoParentInviteController.validateInvite(req, res as any);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "bad" });
    });
  });

  describe("acceptInvite", () => {
    it("requires auth user id", async () => {
      const req = { headers: {}, body: { token: "token-1" } } as any;
      const res = createResponse();

      await CoParentInviteController.acceptInvite(req, res as any);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: "Authentication required.",
      });
    });

    it("requires token", async () => {
      const req = { headers: { "x-user-id": "user-1" }, body: {} } as any;
      const res = createResponse();

      await CoParentInviteController.acceptInvite(req, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invite token is required.",
      });
    });

    it("accepts invite", async () => {
      const req = {
        headers: { "x-user-id": "user-1" },
        body: { token: "token-1" },
      } as any;
      const res = createResponse();
      const acceptResult = { ok: true };
      mockedCoParentInviteService.acceptInvite.mockResolvedValueOnce(
        acceptResult,
      );

      await CoParentInviteController.acceptInvite(req, res as any);

      expect(mockedCoParentInviteService.acceptInvite).toHaveBeenCalledWith(
        "token-1",
        "user-1",
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(acceptResult);
    });

    it("maps service errors", async () => {
      const req = {
        headers: { "x-user-id": "user-1" },
        body: { token: "token-1" },
      } as any;
      const res = createResponse();
      mockedCoParentInviteService.acceptInvite.mockRejectedValueOnce(
        new CoParentInviteServiceError("fail", 403),
      );

      await CoParentInviteController.acceptInvite(req, res as any);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: "fail" });
    });
  });

  describe("declineInvite", () => {
    it("requires token", async () => {
      const req = { body: {} } as any;
      const res = createResponse();

      await CoParentInviteController.declineInvite(req, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invite token is required.",
      });
    });

    it("declines invite", async () => {
      const req = { body: { token: "token-1" } } as any;
      const res = createResponse();
      const declineResult = { ok: true };
      mockedCoParentInviteService.declineInvite.mockResolvedValueOnce(
        declineResult,
      );

      await CoParentInviteController.declineInvite(req, res as any);

      expect(mockedCoParentInviteService.declineInvite).toHaveBeenCalledWith(
        "token-1",
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(declineResult);
    });

    it("maps service errors", async () => {
      const req = { body: { token: "token-1" } } as any;
      const res = createResponse();
      mockedCoParentInviteService.declineInvite.mockRejectedValueOnce(
        new CoParentInviteServiceError("bad", 404),
      );

      await CoParentInviteController.declineInvite(req, res as any);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "bad" });
    });
  });

  describe("getPendingInvites", () => {
    it("requires auth user id", async () => {
      const req = { headers: {} } as any;
      const res = createResponse();

      await CoParentInviteController.getPendingInvites(req, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Authentication required.",
      });
    });

    it("returns 404 when user email missing", async () => {
      const req = { headers: { "x-user-id": "user-1" } } as any;
      const res = createResponse();
      mockedAuthUserMobileService.getByProviderUserId.mockResolvedValueOnce(
        null,
      );

      await CoParentInviteController.getPendingInvites(req, res as any);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "User email not found.",
      });
    });

    it("returns pending invites", async () => {
      const req = { headers: { "x-user-id": "user-1" } } as any;
      const res = createResponse();
      const authUser = { email: "user@example.com" };
      const invites = { pendingInvites: [] };
      mockedAuthUserMobileService.getByProviderUserId.mockResolvedValueOnce(
        authUser,
      );
      mockedCoParentInviteService.getPendingInvitesForEmail.mockResolvedValueOnce(
        invites,
      );

      await CoParentInviteController.getPendingInvites(req, res as any);

      expect(
        mockedAuthUserMobileService.getByProviderUserId,
      ).toHaveBeenCalledWith("user-1");
      expect(
        mockedCoParentInviteService.getPendingInvitesForEmail,
      ).toHaveBeenCalledWith("user@example.com");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(invites);
    });

    it("maps service errors", async () => {
      const req = { headers: { "x-user-id": "user-1" } } as any;
      const res = createResponse();
      mockedAuthUserMobileService.getByProviderUserId.mockResolvedValueOnce({
        email: "user@example.com",
      });
      mockedCoParentInviteService.getPendingInvitesForEmail.mockRejectedValueOnce(
        new CoParentInviteServiceError("fail", 500),
      );

      await CoParentInviteController.getPendingInvites(req, res as any);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: "fail" });
    });
  });
});
