import type { AuthHooks } from "@yosemite-crew/auth";
import { prisma } from "src/config/prisma";
import logger from "src/utils/logger";

// Application-side hooks for the auth boundary. They give the provider layer
// access to app data (which product a user belongs to) and record identity
// mappings, without the auth package depending on the database.

export const authHooks: AuthHooks = {
  // Product profile is derived from HOW the user authenticates, never from
  // their email address: one person can be both clinic staff and a pet owner
  // under the same address, and each product must resolve to its own profile
  // for the current session. Email and password is a staff-web first factor
  // (only staff hold a password; migrated staff set one via the password-reset
  // link); email OTP and social are the pet-parent mobile product. This
  // deliberately mirrors the package default - the earlier email lookup let a
  // pet-parent's mobile OTP session be stamped pims_web whenever the address
  // matched a staff row, 403-locking dual-role users out of the mobile app.
  resolveAuthProfile({ loginMethod }) {
    if (loginMethod === "emailpassword") {
      return Promise.resolve("pims_web");
    }
    if (loginMethod === "otp-email" || loginMethod.startsWith("thirdparty")) {
      return Promise.resolve("pet_parent_mobile");
    }
    // Unknown method: defer to the package default.
    return Promise.resolve(undefined);
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
