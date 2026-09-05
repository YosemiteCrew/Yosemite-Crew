import { existsSync } from "node:fs";
import admin from "firebase-admin";
import { NotificationType } from "@prisma/client";
import logger from "src/utils/logger";
import { NotificationPayload } from "src/utils/notificationTemplates";
import { DeviceTokenService } from "./deviceToken.service";
import { prisma } from "src/config/prisma";

// firebase-admin is used here ONLY for FCM push delivery (device messaging),
// not for authentication. Initialized lazily so environments without push
// credentials (CI, local API-only work) never require them.
const getFirebaseCredentialsPath = () => {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialsPath || !existsSync(credentialsPath)) {
    return null;
  }

  return credentialsPath;
};

const credentialsPath = getFirebaseCredentialsPath();

if (!admin.apps?.length && credentialsPath) {
  admin.initializeApp({
    credential: admin.credential.cert(credentialsPath),
  });
}

const createNotificationRecord = async (input: {
  userId: string;
  title: string;
  body: string;
  type: string;
}) => {
  const record = await prisma.notification.create({
    data: {
      userId: input.userId,
      title: input.title,
      body: input.body,
      type: input.type as NotificationType,
      enabled: true,
      isSeen: false,
    },
    select: { id: true },
  });

  return record.id;
};

export type Platform = "ANDROID" | "IOS" | "WEB";

export interface DeviceTokenRecord {
  userId: string;
  token: string;
  platform: Platform;
  isActive: boolean;
  lastUsedAt?: Date;
}

export type SendOptions = {
  data?: Record<string, string>; // extra payload (non-PII)
  dryRun?: boolean; // for testing
};

export type SendResult = {
  token: string;
  success: boolean;
  error?: string;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const buildFcmMessage = (
  token: string,
  payload: NotificationPayload,
  options?: SendOptions,
): admin.messaging.Message => {
  const msg: admin.messaging.Message = {
    token,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: options?.data ?? {},
    android: {
      priority: "high",
      notification: {
        sound: "default",
      },
    },
    apns: {
      payload: {
        aps: {
          alert: {
            title: payload.title,
            body: payload.body,
          },
          sound: "default",
        },
      },
    },
  };

  return msg;
};

/**
 * A log-safe prefix of a device token. The token is caller-supplied and only
 * type-checked, so the six characters that reach the log are attacker-chosen.
 * Two constraints on the form: no quantifier, and an empty replacement.
 * [\n\r]+ or a non-empty replacement is not a CodeQL log-injection barrier.
 */
const tokenPrefix = (token: string): string =>
  token.slice(0, 6).replace(/[\n\r]/g, "");

export const NotificationService = {
  /**
   * Send a push notification to a single device token.
   * Works for both Android & iOS FCM tokens.
   */
  async sendToDevice(
    token: string,
    payload: NotificationPayload,
    options?: SendOptions,
  ): Promise<SendResult> {
    if (!isNonEmptyString(token)) {
      return {
        token,
        success: false,
        error: "Invalid token",
      };
    }

    const message = buildFcmMessage(token, payload, options);

    try {
      const response = await admin.messaging().send(message, options?.dryRun);
      logger.info(
        `Notification sent to token ${tokenPrefix(token)}…: ${response}`,
      );
      return { token, success: true };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown FCM error";
      logger.error(
        `Failed to send notification to token ${tokenPrefix(token)}…: ${message}`,
      );

      // If token is invalid, ask DeviceTokenService to remove/disable it
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code &&
        [
          "messaging/registration-token-not-registered",
          "messaging/invalid-registration-token",
        ].includes((error as { code: string }).code)
      ) {
        try {
          await DeviceTokenService.removeToken(token);
        } catch (cleanupError) {
          logger.warn(
            `Failed to clean up invalid token ${tokenPrefix(token)}… : ${
              cleanupError instanceof Error
                ? cleanupError.message
                : "Unknown error"
            }`,
          );
        }
      }

      return { token, success: false, error: message };
    }
  },

  /**
   * Send a notification to ALL active devices of a user.
   * If there are multiple tokens (android, ios, web), it sends to all.
   */
  async sendToUser(
    userId: string,
    payload: NotificationPayload,
    options?: SendOptions,
  ): Promise<SendResult[]> {
    if (!isNonEmptyString(userId)) {
      throw new Error("userId is required to send notification");
    }

    const tokens = await DeviceTokenService.getTokensForUser(userId);

    if (!tokens.length) {
      logger.info(`No device tokens found for user ${userId}`);
      return [];
    }

    const results: SendResult[] = [];

    // One row per notification, written before the fan-out rather than inside
    // it. Inside the loop it produced one row per device, so a user with a
    // phone and a tablet saw every notification twice in the list. Awaited
    // because the row's id goes out in the push data: the app keys mark-read
    // and archive by it, and an id minted on the device matches no row.
    let notificationId: string | undefined;
    try {
      notificationId = await createNotificationRecord({
        userId,
        title: payload.title,
        body: payload.body,
        type: payload.type ?? "GENERAL",
      });
    } catch (err) {
      // A failed write must not swallow the push - the user still gets the
      // alert, it just arrives without a row to act on.
      logger.error(
        `Failed to log notification for user ${userId}: ${
          err instanceof Error ? err.message : "Unknown error"
        }`,
      );
    }

    const sendOptions: SendOptions = notificationId
      ? { ...options, data: { ...(options?.data ?? {}), notificationId } }
      : (options ?? {});

    // Use for..of to handle async cleanly
    for (const record of tokens) {
      if (!record) continue;

      const result = await this.sendToDevice(
        record.deviceToken,
        payload,
        sendOptions,
      );
      results.push(result);
    }

    return results;
  },

  /**
   * Broadcast to multiple users (fan-out).
   * Mild helper; you can build higher-level domain-specific methods on top.
   */
  async sendToUsers(
    userIds: string[],
    payload: NotificationPayload,
    options?: SendOptions,
  ): Promise<Record<string, SendResult[]>> {
    const summary: Record<string, SendResult[]> = {};

    for (const userId of userIds) {
      try {
        summary[userId] = await this.sendToUser(userId, payload, options);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        logger.error(
          `Failed to send notification to user ${userId}: ${message}`,
        );
        summary[userId] = [{ token: "", success: false, error: message }];
      }
    }

    return summary;
  },

  async listNotificationsForUser(userId: string) {
    if (!isNonEmptyString(userId)) {
      throw new Error("userId is required to list notifications");
    }

    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  },

  /**
   * Mark one notification seen, scoped to its owner.
   *
   * The userId in the `where` is load-bearing, not belt-and-braces: the
   * notification id arrives from the client, so without it any authenticated
   * caller could mark another user's notification seen by guessing an id.
   * Returns the number of rows changed so the caller can tell "not yours or
   * not there" from "done" - an id that matches nothing updates nothing, which
   * a bare updateMany reports as success.
   */
  async markNotificationAsSeen(notificationId: string, userId: string) {
    if (!isNonEmptyString(notificationId)) {
      throw new Error("notificationId is required to mark as seen");
    }
    if (!isNonEmptyString(userId)) {
      throw new Error("userId is required to mark as seen");
    }

    const { count } = await prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isSeen: true },
    });

    return count;
  },

  /**
   * Archive one notification, scoped to its owner. Owner scoping is required
   * for the same reason as markNotificationAsSeen.
   *
   * Archiving stamps `archivedAt` rather than deleting the row, so the record
   * survives for audit and the client can still list it under its archived
   * filter. `archivedAt: null` in the `where` keeps the first archive time: a
   * second swipe on the same row must not rewrite when the owner archived it.
   *
   * The three outcomes are returned separately because the caller has to map
   * them to different statuses, and "already archived" is a success from the
   * owner's point of view - the notification is where they put it. Collapsing
   * it into the miss case would 404 a swipe that already worked.
   */
  async archiveNotificationForUser(
    notificationId: string,
    userId: string,
  ): Promise<"archived" | "already-archived" | "not-found"> {
    if (!isNonEmptyString(notificationId)) {
      throw new Error("notificationId is required to archive");
    }
    if (!isNonEmptyString(userId)) {
      throw new Error("userId is required to archive");
    }

    const { count } = await prisma.notification.updateMany({
      where: { id: notificationId, userId, archivedAt: null },
      data: { archivedAt: new Date() },
    });

    if (count > 0) {
      return "archived";
    }

    // Nothing updated: either the row is already archived, or it does not
    // exist / belongs to someone else. Only this second query can tell them
    // apart, and it stays scoped to the owner so it cannot confirm the
    // existence of another user's notification.
    const existing = await prisma.notification.findFirst({
      where: { id: notificationId, userId },
      select: { id: true },
    });

    return existing ? "already-archived" : "not-found";
  },
};
