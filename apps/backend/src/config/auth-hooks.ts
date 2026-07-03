import type { AuthHooks } from "@yosemite-crew/auth";
import { prisma } from "src/config/prisma";
import logger from "src/utils/logger";

// Application-side hooks for the auth boundary. They give the provider layer
// access to app data (which product a user belongs to) and record identity
// mappings, without the auth package depending on the database.

export const authHooks: AuthHooks = {
  // Staff records key off the stable app user id (User.userId) with the unique
  // email as fallback (migrated staff signing in via the OTP first-login path
  // may not resolve by id until the identity mapping settles).
  async resolveAuthProfile({ appUserId, email }) {
    const staff = await prisma.user.findFirst({
      where: email
        ? { OR: [{ userId: appUserId }, { email }] }
        : { userId: appUserId },
      select: { id: true },
    });
    if (staff) {
      return "pims_web";
    }

    const mobileUser = await prisma.authUserMobile.findFirst({
      where: { providerUserId: appUserId },
      select: { id: true },
    });
    if (mobileUser) {
      return "pet_parent_mobile";
    }

    // Unknown user (fresh sign-up): fall back to the login-method default.
    return undefined;
  },

  async onUserCreated({
    appUserId,
    providerUserId,
    provider,
    authProfile,
    email,
  }) {
    if (provider !== "supertokens") {
      return;
    }
    try {
      await prisma.authIdentity.upsert({
        where: {
          provider_providerUserId: { provider, providerUserId },
        },
        update: { appUserId, email, authProfile },
        create: { provider, providerUserId, appUserId, email, authProfile },
      });
    } catch (error) {
      // Never block a successful sign-up on bookkeeping; the mapping row is
      // recoverable from provider data.
      logger.error("Failed to record auth identity mapping", error);
    }
  },
};
