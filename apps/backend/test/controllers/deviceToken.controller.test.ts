import { DeviceTokenController } from "../../src/controllers/app/deviceToken.controller";
import { DeviceTokenService } from "../../src/services/deviceToken.service";
import logger from "../../src/utils/logger";

jest.mock("../../src/services/deviceToken.service", () => ({
  DeviceTokenService: {
    registerToken: jest.fn(),
    removeToken: jest.fn(),
  },
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

describe("DeviceTokenController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("registerDeviceToken", () => {
    it("rejects invalid payloads", async () => {
      const req = { body: { userId: "u1", deviceToken: "", platform: "web" } };
      const res = createResponse();

      await DeviceTokenController.registerDeviceToken(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invalid device token payload.",
      });
      expect(mockedDeviceTokenService.registerToken).not.toHaveBeenCalled();
    });

    it("registers device token successfully", async () => {
      const req = {
        body: { userId: "u1", deviceToken: "token-1", platform: "ios" },
      };
      const res = createResponse();

      await DeviceTokenController.registerDeviceToken(req as any, res as any);

      expect(mockedDeviceTokenService.registerToken).toHaveBeenCalledWith(
        "u1",
        "token-1",
        "ios",
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Device token registered successfully.",
      });
    });

    it("handles errors from service", async () => {
      mockedDeviceTokenService.registerToken.mockRejectedValueOnce(
        new Error("fail"),
      );
      const req = {
        body: { userId: "u1", deviceToken: "token-1", platform: "android" },
      };
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
      const req = { body: { deviceToken: "   " } };
      const res = createResponse();

      await DeviceTokenController.unregisterDeviceToken(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invalid device token payload.",
      });
      expect(mockedDeviceTokenService.removeToken).not.toHaveBeenCalled();
    });

    it("unregisters device token", async () => {
      const req = { body: { deviceToken: "token-1" } };
      const res = createResponse();

      await DeviceTokenController.unregisterDeviceToken(req as any, res as any);

      expect(mockedDeviceTokenService.removeToken).toHaveBeenCalledWith(
        "token-1",
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Device token unregistered successfully.",
      });
    });

    it("handles service errors", async () => {
      mockedDeviceTokenService.removeToken.mockRejectedValueOnce(
        new Error("boom"),
      );
      const req = { body: { deviceToken: "token-1" } };
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
