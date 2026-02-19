import { Types } from "mongoose";
import {
  AuthUserMobileModel,
  AuthUserMobile,
  type AuthUserMobileDocumet,
} from "../models/authUserMobile";
import { ParentModel, type ParentDocument } from "../models/parent";
import { prisma } from "src/config/prisma";
import { handleDualWriteError, shouldDualWrite } from "src/utils/dual-write";
import logger from "src/utils/logger";
import { assertSafeString } from "src/utils/sanitize";

const toPrismaAuthUserMobileData = (doc: AuthUserMobileDocumet) => ({
  id: doc._id.toString(),
  authProvider: doc.authProvider,
  providerUserId: doc.providerUserId,
  email: doc.email,
  parentId: doc.parentId ? doc.parentId.toString() : undefined,
  createdAt: doc.createdAt ?? undefined,
  updatedAt: doc.updatedAt ?? undefined,
});

const syncAuthUserMobileToPostgres = async (doc: AuthUserMobileDocumet) => {
  if (!shouldDualWrite) return;
  try {
    const data = toPrismaAuthUserMobileData(doc);
    await prisma.authUserMobile.upsert({
      where: { id: data.id },
      create: data,
      update: data,
    });
  } catch (err) {
    handleDualWriteError("AuthUserMobile", err);
  }
};

export const AuthUserMobileService = {
  async createOrGetAuthUser(
    authProvider: "cognito" | "firebase",
    providerUserId: string,
    email: string,
  ): Promise<AuthUserMobile> {
    providerUserId = assertSafeString(providerUserId, "providerUserId");
    email = assertSafeString(email, "email");

    const existing = await AuthUserMobileModel.findOne({
      providerUserId,
    }).exec();
    if (existing) return existing;

    const doc: AuthUserMobileDocumet = await AuthUserMobileModel.create({
      authProvider,
      providerUserId,
      email,
    });
    await syncAuthUserMobileToPostgres(doc);
    return doc;
  },

  async linkParent(
    authUserId: string,
    parentId: string,
  ): Promise<AuthUserMobile> {
    authUserId = assertSafeString(authUserId, "authUserId");

    if (!Types.ObjectId.isValid(parentId)) {
      throw new Error("Invalid parent ID");
    }

    const user = await AuthUserMobileModel.findOne({
      providerUserId: authUserId,
    }).exec();
    if (!user) throw new Error("AuthUserMobile not found");

    const parent = await ParentModel.findById(parentId).exec();
    if (!parent) throw new Error("Parent not found");

    user.parentId = parent._id;
    await user.save();

    parent.linkedUserId = user._id;
    await parent.save();

    if (shouldDualWrite) {
      try {
        await prisma.authUserMobile.updateMany({
          where: { id: user._id.toString() },
          data: { parentId: parent._id.toString() },
        });
      } catch (err) {
        handleDualWriteError("AuthUserMobile linkParent", err);
      }

      try {
        await prisma.parent.updateMany({
          where: { id: parent._id.toString() },
          data: { linkedUserId: user._id.toString() },
        });
      } catch (err) {
        handleDualWriteError("Parent linkParent", err);
      }
    }

    return user;
  },

  async autoLinkParentByEmail(
    authUser: AuthUserMobile,
  ): Promise<ParentDocument | null> {
    const safeEmail = assertSafeString(authUser.email, "email");

    const parent = await ParentModel.findOne({ email: safeEmail }).exec();
    if (!parent) return null;

    await AuthUserMobileModel.updateOne(
      { providerUserId: authUser.providerUserId },
      { parentId: parent._id },
    ).exec();

    if (shouldDualWrite) {
      try {
        await prisma.authUserMobile.updateMany({
          where: { providerUserId: authUser.providerUserId },
          data: { parentId: parent._id.toString() },
        });
      } catch (err) {
        handleDualWriteError("AuthUserMobile autoLinkParentByEmail", err);
      }
    }

    return parent;
  },

  async getByProviderUserId(
    providerUserId: string,
  ): Promise<AuthUserMobile | null> {
    providerUserId = assertSafeString(providerUserId, "providerUserId");

    return AuthUserMobileModel.findOne({ providerUserId }).exec();
  },

  async getAuthUserMobileIdByProviderId(
    providerUserId: string,
  ): Promise<Types.ObjectId | null> {
    providerUserId = assertSafeString(providerUserId, "providerUserId");

    const doc = await AuthUserMobileModel.findOne(
      { providerUserId },
      { _id: 1 },
    ).exec();

    if (!doc) {
      logger.warn(
        `AuthUserMobile not found for providerUserId: ${providerUserId}`,
      );
      return null;
    }

    return doc._id;
  },
};
