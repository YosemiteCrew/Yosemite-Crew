import { AuthUserMobileController } from "../../src/controllers/app/authUserMobile.controller";
import { AuthUserMobileService } from "../../src/services/authUserMobile.service";
import logger from "../../src/utils/logger";

jest.mock("../../src/services/authUserMobile.service", () => {
  const actual = jest.requireActual(
    "../../src/services/authUserMobile.service",
  );
  return {
    ...actual,
    AuthUserMobileService: {
      createOrGetAuthUser: jest.fn(),
      autoLinkParentByEmail: jest.fn(),
      linkParent: jest.fn(),
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

const mockedAuthUserMobileService = AuthUserMobileService as unknown as {
  createOrGetAuthUser: jest.Mock;
  autoLinkParentByEmail: jest.Mock;
  linkParent: jest.Mock;
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

describe("AuthUserMobileController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("signup", () => {
    it("creates auth user and links parent by email", async () => {
      const req = {
        userId: "provider-1",
        provider: "congito",
        email: "user@example.com",
      } as any;
      const res = createResponse();
      const authUser = { id: "auth-1" };
      const parent = { id: "parent-1" };
      mockedAuthUserMobileService.createOrGetAuthUser.mockResolvedValueOnce(
        authUser,
      );
      mockedAuthUserMobileService.autoLinkParentByEmail.mockResolvedValueOnce(
        parent,
      );

      await AuthUserMobileController.signup(req, res as any);

      expect(
        mockedAuthUserMobileService.createOrGetAuthUser,
      ).toHaveBeenCalledWith("cognito", "provider-1", "user@example.com");
      expect(
        mockedAuthUserMobileService.autoLinkParentByEmail,
      ).toHaveBeenCalledWith(authUser);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        authUser,
        parentLinked: true,
        parent,
      });
    });

    it("handles errors", async () => {
      const req = {
        userId: "provider-1",
        provider: "firebase",
        email: "user@example.com",
      } as any;
      const res = createResponse();
      mockedAuthUserMobileService.createOrGetAuthUser.mockRejectedValueOnce(
        new Error("boom"),
      );

      await AuthUserMobileController.signup(req, res as any);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "boom",
      });
      expect(mockedLogger.error).toHaveBeenCalled();
    });
  });

  describe("linkParent", () => {
    it("requires parentId", async () => {
      const req = { body: {} } as any;
      const res = createResponse();

      await AuthUserMobileController.linkParent(req, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Parent ID is required",
      });
    });

    it("links parent using header user id", async () => {
      const req = {
        headers: { "x-user-id": "user-1" },
        body: { parentId: "parent-1" },
      } as any;
      const res = createResponse();
      const user = { id: "auth-1" };
      mockedAuthUserMobileService.linkParent.mockResolvedValueOnce(user);

      await AuthUserMobileController.linkParent(req, res as any);

      expect(mockedAuthUserMobileService.linkParent).toHaveBeenCalledWith(
        "user-1",
        "parent-1",
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, user });
    });

    it("handles errors", async () => {
      const req = {
        headers: { "x-user-id": "user-1" },
        body: { parentId: "parent-1" },
      } as any;
      const res = createResponse();
      mockedAuthUserMobileService.linkParent.mockRejectedValueOnce(
        new Error("fail"),
      );

      await AuthUserMobileController.linkParent(req, res as any);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "fail",
      });
    });
  });

  describe("getByProvider", () => {
    it("returns 404 when not found", async () => {
      const req = { params: { providerUserId: "provider-1" } } as any;
      const res = createResponse();
      mockedAuthUserMobileService.getByProviderUserId.mockResolvedValueOnce(
        null,
      );

      await AuthUserMobileController.getByProvider(req, res as any);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "User not found",
      });
    });

    it("returns user", async () => {
      const req = { params: { providerUserId: "provider-1" } } as any;
      const res = createResponse();
      const user = { id: "auth-1" };
      mockedAuthUserMobileService.getByProviderUserId.mockResolvedValueOnce(
        user,
      );

      await AuthUserMobileController.getByProvider(req, res as any);

      expect(
        mockedAuthUserMobileService.getByProviderUserId,
      ).toHaveBeenCalledWith("provider-1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, user });
    });

    it("handles errors", async () => {
      const req = { params: { providerUserId: "provider-1" } } as any;
      const res = createResponse();
      mockedAuthUserMobileService.getByProviderUserId.mockRejectedValueOnce(
        new Error("boom"),
      );

      await AuthUserMobileController.getByProvider(req, res as any);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "boom",
      });
    });
  });
});
