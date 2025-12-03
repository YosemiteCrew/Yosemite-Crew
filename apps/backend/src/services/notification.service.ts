import admin from "firebase-admin";
import logger from "src/utils/logger";
import { NotificationPayload } from "src/utils/notificationTemplates";
import { DeviceTokenService } from "./deviceToken.service";

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
  dryRun?: boolean;              // for testing
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
        `Notification sent to token ${token.slice(0, 6)}…: ${response}`,
      );
      return { token, success: true };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown FCM error";
      logger.error(
        `Failed to send notification to token ${token.slice(0, 6)}…: ${message}`,
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
            `Failed to clean up invalid token ${token.slice(0, 6)}… : ${
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

    // Use for..of to handle async cleanly
    for (const record of tokens) {
      if (!record) continue;

      const result = await this.sendToDevice(record.deviceToken, payload, options);
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
        summary[userId] = [
          { token: "", success: false, error: message },
        ];
      }
    }

    return summary;
  },
};