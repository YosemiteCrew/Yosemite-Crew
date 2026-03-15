import { DeviceTokenModel } from "src/models/deviceToken";
import { prisma } from "src/config/prisma";
import { handleDualWriteError, shouldDualWrite } from "src/utils/dual-write";
import { isReadFromPostgres } from "src/config/read-switch";

export const DeviceTokenService = {
  async registerToken(
    userId: string,
    deviceToken: string,
    platform: "ios" | "android",
  ) {
    if (!deviceToken) return;
    if (!userId) return;

    await DeviceTokenModel.updateOne(
      { deviceToken },
      { userId, platform },
      { upsert: true, sanitizeFilter: true },
    );

    if (shouldDualWrite) {
      try {
        await prisma.deviceToken.upsert({
          where: { deviceToken },
          create: {
            userId,
            deviceToken,
            platform,
            isActive: true,
          },
          update: {
            userId,
            platform,
            isActive: true,
          },
        });
      } catch (err) {
        handleDualWriteError("DeviceToken", err);
      }
    }
  },

  async getTokensForUser(userId: string) {
    if (isReadFromPostgres()) {
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
    }

    const docs = await DeviceTokenModel.find({ userId }).lean();
    return docs;
  },

  async removeToken(deviceToken: string) {
    await DeviceTokenModel.deleteOne({ deviceToken });

    if (shouldDualWrite) {
      try {
        await prisma.deviceToken.deleteMany({ where: { deviceToken } });
      } catch (err) {
        handleDualWriteError("DeviceToken delete", err);
      }
    }
  },
};
