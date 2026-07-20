import { prisma } from "src/config/prisma";

export const DeviceTokenService = {
  async registerToken(
    userId: string,
    deviceToken: string,
    platform: "ios" | "android",
  ) {
    const safeUserId =
      typeof userId === "string" && userId.trim() ? userId.trim() : "";
    const safeDeviceToken =
      typeof deviceToken === "string" && deviceToken.trim()
        ? deviceToken.trim()
        : "";
    if (!safeDeviceToken || !safeUserId) return;
    if (/[.$]/.test(safeDeviceToken) || /[.$]/.test(safeUserId)) {
      return;
    }

    await prisma.deviceToken.upsert({
      where: { deviceToken: safeDeviceToken },
      create: {
        userId: safeUserId,
        deviceToken: safeDeviceToken,
        platform,
        isActive: true,
      },
      update: {
        userId: safeUserId,
        platform,
        isActive: true,
      },
    });
  },

  async getTokensForUser(userId: string) {
    const tokens = await prisma.deviceToken.findMany({
      where: { userId },
    });
    return tokens.map((token) => ({
      _id: token.id,
      userId: token.userId,
      deviceToken: token.deviceToken,
      platform: token.platform,
      isActive: token.isActive,
      createdAt: token.createdAt,
      updatedAt: token.updatedAt,
    }));
  },

  async removeToken(deviceToken: string) {
    await prisma.deviceToken.deleteMany({ where: { deviceToken } });
  },
};
