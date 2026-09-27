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

  /** Drops a token the push provider reported as no longer valid. */
  async removeToken(deviceToken: string) {
    await prisma.deviceToken.deleteMany({ where: { deviceToken } });
  },

  /** A signed-in caller removes their own device; anyone else's stays. */
  async removeTokenForOwners(deviceToken: string, ownerIds: string[]) {
    const owners = ownerIds.filter((id) => typeof id === "string" && id);
    if (!owners.length) return;
    await prisma.deviceToken.deleteMany({
      where: { deviceToken, userId: { in: owners } },
    });
  },
};
