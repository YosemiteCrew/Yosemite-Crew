import { DeviceTokenModel } from "src/models/deviceToken";

export const DeviceTokenService = {

  async registerToken(userId: string, deviceToken: string, platform: "ios" | "android") {
      if (!deviceToken) return;
  
      await DeviceTokenModel.updateOne(
        { deviceToken },
        { userId, platform },
        { upsert: true }
      );
    },
  
    async getTokensForUser(userId: string) {
      const docs = await DeviceTokenModel.find({ userId }).lean();
      return docs;
    },
  
    async removeToken(deviceToken: string) {
      await DeviceTokenModel.deleteOne({ deviceToken });
    },

};