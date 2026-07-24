import { DeviceTokenService } from "../../src/services/deviceToken.service";
import { prisma } from "src/config/prisma";

jest.mock("src/config/prisma", () => ({
  prisma: {
    deviceToken: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

describe("DeviceTokenService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("registerToken", () => {
    it("skips when device token is missing", async () => {
      await DeviceTokenService.registerToken("user-1", "", "ios");

      expect(prisma.deviceToken.upsert).not.toHaveBeenCalled();
    });

    it("skips when user id is missing", async () => {
      await DeviceTokenService.registerToken("", "token-123", "ios");

      expect(prisma.deviceToken.upsert).not.toHaveBeenCalled();
    });

    it("skips when token contains unsafe characters", async () => {
      await DeviceTokenService.registerToken("user-1", "tok.en", "ios");

      expect(prisma.deviceToken.upsert).not.toHaveBeenCalled();
    });

    it("upserts token with platform", async () => {
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
          update: expect.objectContaining({
            userId: "user-1",
            platform: "ios",
            isActive: true,
          }),
        }),
      );
    });
  });

  describe("getTokensForUser", () => {
    it("maps postgres tokens to response shape", async () => {
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

      expect(prisma.deviceToken.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
      });
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

      expect(prisma.deviceToken.deleteMany).toHaveBeenCalledWith({
        where: { deviceToken: "token-1" },
      });
    });
  });
});
