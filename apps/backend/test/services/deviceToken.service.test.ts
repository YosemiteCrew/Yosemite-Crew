import { DeviceTokenModel } from "../../src/models/deviceToken";
import { DeviceTokenService } from "../../src/services/deviceToken.service";

jest.mock("../../src/models/deviceToken", () => ({
  DeviceTokenModel: {
    updateOne: jest.fn(),
    find: jest.fn(),
    deleteOne: jest.fn(),
  },
}));

const mockedDeviceTokenModel = DeviceTokenModel as unknown as {
  updateOne: jest.Mock;
  find: jest.Mock;
  deleteOne: jest.Mock;
};

describe("DeviceTokenService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("registerToken", () => {
    it("skips when device token is missing", async () => {
      await DeviceTokenService.registerToken("user-1", "", "ios");

      expect(mockedDeviceTokenModel.updateOne).not.toHaveBeenCalled();
    });

    it("upserts token with platform", async () => {
      await DeviceTokenService.registerToken("user-1", "token-123", "android");

      expect(mockedDeviceTokenModel.updateOne).toHaveBeenCalledWith(
        { deviceToken: "token-123" },
        { userId: "user-1", platform: "android" },
        { upsert: true },
      );
    });
  });

  describe("getTokensForUser", () => {
    it("returns lean documents", async () => {
      const docs = [{ deviceToken: "abc" }];
      const mockLean = jest.fn().mockResolvedValueOnce(docs);
      mockedDeviceTokenModel.find.mockReturnValue({ lean: mockLean } as any);

      const result = await DeviceTokenService.getTokensForUser("user-1");

      expect(mockedDeviceTokenModel.find).toHaveBeenCalledWith({
        userId: "user-1",
      });
      expect(mockLean).toHaveBeenCalled();
      expect(result).toBe(docs);
    });
  });

  describe("removeToken", () => {
    it("removes token by value", async () => {
      await DeviceTokenService.removeToken("token-1");

      expect(mockedDeviceTokenModel.deleteOne).toHaveBeenCalledWith({
        deviceToken: "token-1",
      });
    });
  });
});
