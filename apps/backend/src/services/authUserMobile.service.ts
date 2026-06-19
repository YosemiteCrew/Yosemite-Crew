import { prisma } from "src/config/prisma";
import logger from "src/utils/logger";
import { assertSafeString } from "src/utils/sanitize";

type AuthUserMobileRecord = {
  id: string;
  authProvider: "cognito" | "firebase";
  providerUserId: string;
  email: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const mapAuthUserMobile = (authUser: {
  id: string;
  authProvider: "cognito" | "firebase";
  providerUserId: string;
  email: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): AuthUserMobileRecord => ({
  id: authUser.id,
  authProvider: authUser.authProvider,
  providerUserId: authUser.providerUserId,
  email: authUser.email,
  parentId: authUser.parentId,
  createdAt: authUser.createdAt,
  updatedAt: authUser.updatedAt,
});

const linkParentIds = async (authUserId: string, parentId: string) => {
  await prisma.$transaction(async (tx) => {
    const authUser = await tx.authUserMobile.findFirst({
      where: { providerUserId: authUserId },
      select: { id: true, parentId: true },
    });
    if (!authUser) {
      throw new Error("AuthUserMobile not found");
    }

    const parent = await tx.parent.findUnique({
      where: { id: parentId },
      select: { id: true, linkedUserId: true },
    });
    if (!parent) {
      throw new Error("Parent not found");
    }

    if (authUser.parentId && authUser.parentId !== parent.id) {
      await tx.parent.updateMany({
        where: { id: authUser.parentId },
        data: { linkedUserId: null },
      });
    }

    if (parent.linkedUserId && parent.linkedUserId !== authUser.id) {
      await tx.authUserMobile.updateMany({
        where: { id: parent.linkedUserId },
        data: { parentId: null },
      });
    }

    await tx.authUserMobile.update({
      where: { id: authUser.id },
      data: { parentId: parent.id },
    });

    await tx.parent.update({
      where: { id: parent.id },
      data: { linkedUserId: authUser.id },
    });
  });

  return prisma.authUserMobile.findFirst({
    where: { providerUserId: authUserId },
  });
};

export const AuthUserMobileService = {
  async createOrGetAuthUser(
    authProvider: "cognito" | "firebase",
    providerUserId: string,
    email: string,
  ): Promise<AuthUserMobileRecord> {
    providerUserId = assertSafeString(providerUserId, "providerUserId");
    email = assertSafeString(email, "email");

    const existing = await prisma.authUserMobile.findFirst({
      where: { providerUserId },
    });
    if (existing) {
      return mapAuthUserMobile(existing);
    }

    const created = await prisma.authUserMobile.create({
      data: {
        authProvider,
        providerUserId,
        email,
      },
    });

    return mapAuthUserMobile(created);
  },

  async linkParent(
    authUserId: string,
    parentId: string,
  ): Promise<AuthUserMobileRecord> {
    authUserId = assertSafeString(authUserId, "authUserId");
    parentId = assertSafeString(parentId, "parentId");

    const linked = await linkParentIds(authUserId, parentId);
    if (!linked) {
      throw new Error("AuthUserMobile not found");
    }

    return mapAuthUserMobile(linked);
  },

  async autoLinkParentByEmail(
    authUser: AuthUserMobileRecord,
  ): Promise<{
    id: string;
    firstName: string;
    lastName: string | null;
    email: string;
  } | null> {
    const safeEmail = assertSafeString(authUser.email, "email");

    const parent = await prisma.parent.findFirst({
      where: { email: safeEmail },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    });

    if (!parent) {
      return null;
    }

    await prisma.$transaction(async (tx) => {
      await tx.authUserMobile.updateMany({
        where: { providerUserId: authUser.providerUserId },
        data: { parentId: parent.id },
      });
      await tx.parent.update({
        where: { id: parent.id },
        data: { linkedUserId: authUser.id },
      });
    });

    return parent;
  },

  async getByProviderUserId(
    providerUserId: string,
  ): Promise<AuthUserMobileRecord | null> {
    providerUserId = assertSafeString(providerUserId, "providerUserId");

    const authUser = await prisma.authUserMobile.findFirst({
      where: { providerUserId },
    });

    return authUser ? mapAuthUserMobile(authUser) : null;
  },

  async getAuthUserMobileIdByProviderId(
    providerUserId: string,
  ): Promise<string | null> {
    providerUserId = assertSafeString(providerUserId, "providerUserId");

    const authUser = await prisma.authUserMobile.findFirst({
      where: { providerUserId },
      select: { id: true },
    });

    if (!authUser) {
      logger.warn(
        `AuthUserMobile not found for providerUserId: ${providerUserId}`,
      );
      return null;
    }

    return authUser.id;
  },
};
