import { DeviceTokenController } from "../../src/controllers/app/deviceToken.controller";
import { DeviceTokenService } from "../../src/services/deviceToken.service";
import { findParentIdForAuthUser } from "../../src/services/shared/parent-identity";
import logger from "../../src/utils/logger";

jest.mock("../../src/services/deviceToken.service", () => ({
  DeviceTokenService: {
    registerToken: jest.fn(),
    removeToken: jest.fn(),
    removeTokenForOwners: jest.fn(),
  },
}));

jest.mock("../../src/services/shared/parent-identity", () => ({
  findParentIdForAuthUser: jest.fn(),
}));

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

const mockedDeviceTokenService = DeviceTokenService as unknown as {
  registerToken: jest.Mock;
  removeToken: jest.Mock;
  removeTokenForOwners: jest.Mock;
};
const mockedFindParent = findParentIdForAuthUser as unknown as jest.Mock;

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

/** A request as the auth middleware leaves it for the signed-in `userId`. */
const signedIn = (body: Record<string, unknown>, userId = "auth-1") => ({
  userId,
  body,
});

describe("DeviceTokenController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedFindParent.mockResolvedValue("parent-1");
  });

  describe("registerDeviceToken", () => {
    it("rejects invalid payloads", async () => {
      const req = signedIn({ deviceToken: "", platform: "web" });
      const res = createResponse();

      await DeviceTokenController.registerDeviceToken(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invalid device token payload.",
      });
      expect(mockedDeviceTokenService.registerToken).not.toHaveBeenCalled();
    });

    it("registers the device for the signed-in parent, whatever userId the body names", async () => {
      const req = signedIn({
        userId: "someone-else",
        deviceToken: "token-1",
        platform: "ios",
      });
      const res = createResponse();

      await DeviceTokenController.registerDeviceToken(req as any, res as any);

      expect(mockedFindParent).toHaveBeenCalledWith("auth-1");
      expect(mockedDeviceTokenService.registerToken).toHaveBeenCalledWith(
        "parent-1",
        "token-1",
        "ios",
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Device token registered successfully.",
      });
    });

    it("registers against the signed-in account before a parent record exists", async () => {
      mockedFindParent.mockResolvedValue(null);
      const req = signedIn({
        userId: "someone-else",
        deviceToken: "token-1",
        platform: "android",
      });
      const res = createResponse();

      await DeviceTokenController.registerDeviceToken(req as any, res as any);

      expect(mockedDeviceTokenService.registerToken).toHaveBeenCalledWith(
        "auth-1",
        "token-1",
        "android",
      );
    });

    it("refuses a request with no signed-in caller", async () => {
      const req = { body: { deviceToken: "token-1", platform: "ios" } };
      const res = createResponse();

      await DeviceTokenController.registerDeviceToken(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(mockedDeviceTokenService.registerToken).not.toHaveBeenCalled();
    });

    it("handles errors from service", async () => {
      mockedDeviceTokenService.registerToken.mockRejectedValueOnce(
        new Error("fail"),
      );
      const req = signedIn({ deviceToken: "token-1", platform: "android" });
      const res = createResponse();

      await DeviceTokenController.registerDeviceToken(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Failed to register device token.",
      });
      expect(mockedLogger.error).toHaveBeenCalled();
    });
  });

  describe("unregisterDeviceToken", () => {
    it("rejects invalid payloads", async () => {
      const req = signedIn({ deviceToken: "   " });
      const res = createResponse();

      await DeviceTokenController.unregisterDeviceToken(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invalid device token payload.",
      });
      expect(
        mockedDeviceTokenService.removeTokenForOwners,
      ).not.toHaveBeenCalled();
    });

    it("removes the device only from the signed-in caller", async () => {
      const req = signedIn({ userId: "someone-else", deviceToken: "token-1" });
      const res = createResponse();

      await DeviceTokenController.unregisterDeviceToken(req as any, res as any);

      expect(
        mockedDeviceTokenService.removeTokenForOwners,
      ).toHaveBeenCalledWith("token-1", ["parent-1", "auth-1"]);
      expect(mockedDeviceTokenService.removeToken).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Device token unregistered successfully.",
      });
    });

    it("refuses a request with no signed-in caller", async () => {
      const req = { body: { deviceToken: "token-1" } };
      const res = createResponse();

      await DeviceTokenController.unregisterDeviceToken(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(
        mockedDeviceTokenService.removeTokenForOwners,
      ).not.toHaveBeenCalled();
    });

    it("handles service errors", async () => {
      mockedDeviceTokenService.removeTokenForOwners.mockRejectedValueOnce(
        new Error("boom"),
      );
      const req = signedIn({ deviceToken: "token-1" });
      const res = createResponse();

      await DeviceTokenController.unregisterDeviceToken(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Failed to unregister device token.",
      });
      expect(mockedLogger.error).toHaveBeenCalled();
    });
  });
});
