import { DeviceTokenModel } from "../../src/models/deviceToken";
import { DeviceTokenService } from "../../src/services/deviceToken.service";
import { prisma } from "src/config/prisma";
import { handleDualWriteError } from "src/utils/dual-write";

jest.mock("../../src/models/deviceToken", () => ({
  DeviceTokenModel: {
    updateOne: jest.fn(),
    find: jest.fn(),
    deleteOne: jest.fn(),
  },
}));

jest.mock("src/config/prisma", () => ({
  prisma: {
    deviceToken: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

jest.mock("src/utils/dual-write", () => ({
  shouldDualWrite: true,
  isDualWriteStrict: false,
  handleDualWriteError: jest.fn(),
}));

const mockedDeviceTokenModel = DeviceTokenModel as unknown as {
  updateOne: jest.Mock;
  find: jest.Mock;
  deleteOne: jest.Mock;
};

describe("DeviceTokenService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.READ_FROM_POSTGRES = "false";
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

    it("dual-writes token to postgres", async () => {
      await DeviceTokenService.registerToken("user-1", "token-123", "ios");

      expect(prisma.deviceToken.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deviceToken: "token-123" },
          create: expect.objectContaining({
            userId: "user-1",
            deviceToken: "token-123",
            platform: "ios",
            isActive: true,
          }),
        }),
      );
    });

    it("handles dual-write errors", async () => {
      (prisma.deviceToken.upsert as jest.Mock).mockRejectedValue(
        new Error("fail"),
      );

      await DeviceTokenService.registerToken("user-1", "token-123", "ios");

      expect(handleDualWriteError).toHaveBeenCalledWith(
        "DeviceToken",
        expect.any(Error),
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

    it("maps postgres tokens to response shape", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.deviceToken.findMany as jest.Mock).mockResolvedValue([
        {
          id: "t1",
          userId: "user-1",
          deviceToken: "abc",
          platform: "ios",
          isActive: true,
          createdAt: new Date("2024-01-01T00:00:00Z"),
          updatedAt: new Date("2024-01-02T00:00:00Z"),
        },
      ]);

      const result = await DeviceTokenService.getTokensForUser("user-1");

      expect(result).toEqual([
        expect.objectContaining({
          _id: "t1",
          userId: "user-1",
          deviceToken: "abc",
          platform: "ios",
          isActive: true,
        }),
      ]);
    });
  });

  describe("removeToken", () => {
    it("removes token by value", async () => {
      await DeviceTokenService.removeToken("token-1");

      expect(mockedDeviceTokenModel.deleteOne).toHaveBeenCalledWith({
        deviceToken: "token-1",
      });
    });

    it("dual-writes delete to postgres", async () => {
      await DeviceTokenService.removeToken("token-1");

      expect(prisma.deviceToken.deleteMany).toHaveBeenCalledWith({
        where: { deviceToken: "token-1" },
      });
    });

    it("handles dual-write delete errors", async () => {
      (prisma.deviceToken.deleteMany as jest.Mock).mockRejectedValue(
        new Error("delete fail"),
      );

      await DeviceTokenService.removeToken("token-1");

      expect(handleDualWriteError).toHaveBeenCalledWith(
        "DeviceToken delete",
        expect.any(Error),
      );
    });
  });
});
