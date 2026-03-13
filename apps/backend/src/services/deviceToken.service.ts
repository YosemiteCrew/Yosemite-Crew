import { DeviceTokenModel } from "src/models/deviceToken";
import { prisma } from "src/config/prisma";
import { handleDualWriteError, shouldDualWrite } from "src/utils/dual-write";

export const DeviceTokenService = {
  async registerToken(
    userId: string,
    deviceToken: string,
    platform: "ios" | "android",
  ) {
    if (!deviceToken) return;

    await DeviceTokenModel.updateOne(
      { deviceToken },
      { userId, platform },
      { upsert: true },
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
