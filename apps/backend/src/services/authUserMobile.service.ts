import { Types } from "mongoose";
import { AuthUserMobileModel, AuthUserMobile } from "../models/authUserMobile"
import { ParentModel, type ParentDocument } from "../models/parent";
import logger from "src/utils/logger";

export const AuthUserMobileService = {

  async createOrGetAuthUser(
    authProvider: "cognito" | "firebase",
    providerUserId: string,
    email: string
  ): Promise<AuthUserMobile> {
    const existing = await AuthUserMobileModel.findOne({ providerUserId }).exec();
    if (existing) return existing;

    const newUser = await AuthUserMobileModel.create({
      authProvider,
      providerUserId,
      email,
    });

    return newUser;
  },

  async linkParent(authUserId: string, parentId: string): Promise<AuthUserMobile> {
    if (!Types.ObjectId.isValid(parentId)) throw new Error("Invalid parent ID");

    const user = await AuthUserMobileModel.findOne({providerUserId: authUserId}).exec();
    if (!user) throw new Error("AuthUserMobile not found");

    const parent = await ParentModel.findById(parentId).exec();
    if (!parent) throw new Error("Parent not found");

    user.parentId = parent._id;
    await user.save();

    parent.linkedUserId = user._id
    await parent.save();

    return user;
  },

  async autoLinkParentByEmail(authUser: AuthUserMobile): Promise<ParentDocument | null> {
    const parent = await ParentModel.findOne({ email: authUser.email }).exec();
    if (!parent) return null;

    await AuthUserMobileModel.updateOne(
      { providerUserId: authUser.providerUserId },
      { parentId: parent._id }
    ).exec();

    return parent;
  },

  async getByProviderUserId(providerUserId: string): Promise<AuthUserMobile | null> {
    return AuthUserMobileModel.findOne({ providerUserId }).exec();
  },

  async getAuthUserMobileIdByProviderId(providerUserId: string): Promise<Types.ObjectId | null> {
    const doc = await AuthUserMobileModel.findOne(
      { providerUserId },
      { _id: 1 }
    ).exec();

    if (!doc) {
      logger.warn(`AuthUserMobile not found for providerUserId: ${providerUserId}`);
      return null;
    }

    return doc._id
  }
}
