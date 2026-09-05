import { NotificationService } from "../../src/services/notification.service";
import { DeviceTokenService } from "../../src/services/deviceToken.service";
import logger from "../../src/utils/logger";
import { NotificationPayload } from "../../src/utils/notificationTemplates";
import { prisma } from "src/config/prisma";

// 1. Mock External Dependencies
const mockSend = jest.fn();
jest.mock("firebase-admin", () => ({
  __esModule: true,
  default: {
    messaging: jest.fn(() => ({
      send: mockSend,
    })),
  },
}));

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock("../../src/services/deviceToken.service", () => ({
  DeviceTokenService: {
    removeToken: jest.fn(),
    getTokensForUser: jest.fn(),
  },
}));

jest.mock("src/config/prisma", () => ({
  prisma: {
    notification: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

describe("NotificationService", () => {
  const payload: NotificationPayload = {
    title: "Test Title",
    body: "Test Body",
    type: "TEST_TYPE" as any,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.notification.create as jest.Mock).mockResolvedValue({
      id: "notif-row-1",
    });
    (prisma.notification.updateMany as jest.Mock).mockResolvedValue({
      count: 1,
    });
  });

  describe("sendToDevice", () => {
    it("returns error if token is missing or empty", async () => {
      const res = await NotificationService.sendToDevice("   ", payload);
      expect(res).toEqual({
        token: "   ",
        success: false,
        error: "Invalid token",
      });
    });

    it("successfully sends a push notification", async () => {
      mockSend.mockResolvedValueOnce("message-id-123");

      const res = await NotificationService.sendToDevice(
        "valid-token",
        payload,
        {
          data: { custom: "data" },
          dryRun: true,
        },
      );

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          token: "valid-token",
          notification: { title: "Test Title", body: "Test Body" },
          data: { custom: "data" },
          android: expect.any(Object),
          apns: expect.any(Object),
        }),
        true, // dryRun
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("Notification sent"),
      );
      expect(res).toEqual({ token: "valid-token", success: true });
    });

    it("strips line breaks from the token prefix before logging it", async () => {
      mockSend.mockResolvedValueOnce("msg-id");

      // The token is caller-supplied and only type-checked, so the six
      // characters that reach the log are attacker-chosen.
      await NotificationService.sendToDevice("ab\r\ncd-rest-of-token", payload);

      const logged = (logger.info as jest.Mock).mock.calls
        .flat()
        .filter((c): c is string => typeof c === "string")
        .join(" ");
      expect(logged).toContain("abcd");
      expect(logged).not.toContain("\n");
      expect(logged).not.toContain("\r");
    });

    it("uses default empty object for data if not provided", async () => {
      mockSend.mockResolvedValueOnce("msg-id");
      await NotificationService.sendToDevice("token", payload);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ data: {} }),
        undefined,
      );
    });

    it("handles generic send errors", async () => {
      mockSend.mockRejectedValueOnce(new Error("FCM Timeout"));

      const res = await NotificationService.sendToDevice("token", payload);

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("FCM Timeout"),
      );
      expect(res).toEqual({
        token: "token",
        success: false,
        error: "FCM Timeout",
      });
    });

    it("handles non-Error objects thrown by FCM", async () => {
      mockSend.mockRejectedValueOnce("String error thrown");

      const res = await NotificationService.sendToDevice("token", payload);

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Unknown FCM error"),
      );
      expect(res.error).toBe("Unknown FCM error");
    });

    it("removes invalid registration tokens", async () => {
      mockSend.mockRejectedValueOnce({
        code: "messaging/invalid-registration-token",
      });
      (DeviceTokenService.removeToken as jest.Mock).mockResolvedValueOnce(true);

      const res = await NotificationService.sendToDevice("bad-token", payload);

      expect(DeviceTokenService.removeToken).toHaveBeenCalledWith("bad-token");
      expect(res.success).toBe(false);
    });

    it("handles errors during token cleanup (instance of Error)", async () => {
      mockSend.mockRejectedValueOnce({
        code: "messaging/registration-token-not-registered",
      });
      (DeviceTokenService.removeToken as jest.Mock).mockRejectedValueOnce(
        new Error("Cleanup Failed"),
      );

      await NotificationService.sendToDevice("bad-token", payload);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Cleanup Failed"),
      );
    });

    it("handles errors during token cleanup (non-Error fallback)", async () => {
      mockSend.mockRejectedValueOnce({
        code: "messaging/invalid-registration-token",
      });
      (DeviceTokenService.removeToken as jest.Mock).mockRejectedValueOnce(
        "Weird error",
      );

      await NotificationService.sendToDevice("bad-token", payload);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Unknown error"),
      );
    });
  });

  describe("sendToUser", () => {
    it("throws if userId is missing", async () => {
      await expect(NotificationService.sendToUser("", payload)).rejects.toThrow(
        "userId is required",
      );
    });

    it("returns empty array and logs if no tokens found", async () => {
      (DeviceTokenService.getTokensForUser as jest.Mock).mockResolvedValueOnce(
        [],
      );

      const res = await NotificationService.sendToUser("user1", payload);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("No device tokens found"),
      );
      expect(res).toEqual([]);
    });

    it("stores one notification row per notification, not per device", async () => {
      (DeviceTokenService.getTokensForUser as jest.Mock).mockResolvedValueOnce([
        { deviceToken: "token-1" },
        { deviceToken: "token-2" },
      ]);
      mockSend.mockResolvedValue("msg-id");

      const res = await NotificationService.sendToUser("user1", payload);

      expect(res).toHaveLength(2);
      expect(prisma.notification.create).toHaveBeenCalledTimes(1);
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "user1",
            title: payload.title,
          }),
        }),
      );
    });

    it("sends the stored row id to every device so the app can act on it", async () => {
      (DeviceTokenService.getTokensForUser as jest.Mock).mockResolvedValueOnce([
        { deviceToken: "token-1" },
        { deviceToken: "token-2" },
      ]);
      mockSend.mockResolvedValue("msg-id");

      await NotificationService.sendToUser("user1", payload, {
        data: { deepLink: "/appointments/1" },
      });

      expect(mockSend).toHaveBeenCalledTimes(2);
      for (const call of mockSend.mock.calls) {
        expect(call[0].data).toEqual({
          deepLink: "/appointments/1",
          notificationId: "notif-row-1",
        });
      }
    });

    it("still delivers the push when the row cannot be written", async () => {
      (DeviceTokenService.getTokensForUser as jest.Mock).mockResolvedValueOnce([
        { deviceToken: "token-1" },
      ]);
      mockSend.mockResolvedValue("msg-id");
      (prisma.notification.create as jest.Mock).mockRejectedValueOnce(
        new Error("DB Insert Failed"),
      );

      const res = await NotificationService.sendToUser("user1", payload);

      expect(res).toHaveLength(1);
      expect(res[0].success).toBe(true);
      expect(mockSend.mock.calls[0][0].data).toEqual({});
    });

    it("loops through tokens, skips invalid records, and logs DB errors", async () => {
      // Notice: we mock `deviceToken` here because the source code accesses `record.deviceToken`
      const mockTokens = [
        null, // Should hit `if (!record) continue;`
        { deviceToken: "token-1" },
      ];
      (DeviceTokenService.getTokensForUser as jest.Mock).mockResolvedValueOnce(
        mockTokens,
      );
      mockSend.mockResolvedValue("msg-id");

      // Force prisma create to throw to test the catch block
      (prisma.notification.create as jest.Mock).mockRejectedValueOnce(
        new Error("DB Insert Failed"),
      );

      const res = await NotificationService.sendToUser("user1", payload);

      expect(res).toHaveLength(1);
      expect(res[0].token).toBe("token-1");
      expect(prisma.notification.create).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("DB Insert Failed"),
      );
    });

    it("handles non-Error objects in DB insert catch block", async () => {
      (DeviceTokenService.getTokensForUser as jest.Mock).mockResolvedValueOnce([
        { deviceToken: "token-2" },
      ]);
      mockSend.mockResolvedValue("msg-id");
      (prisma.notification.create as jest.Mock).mockRejectedValueOnce(
        "String DB Error",
      );

      await NotificationService.sendToUser("user1", payload);

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Unknown error"),
      );
    });
  });

  describe("sendToUsers", () => {
    it("returns a mapped summary of successful and failed user sends", async () => {
      // We spy on the class method to easily trigger a success and a failure
      const sendToUserSpy = jest
        .spyOn(NotificationService, "sendToUser")
        .mockResolvedValueOnce([{ token: "t1", success: true }]) // User 1 succeeds
        .mockRejectedValueOnce(new Error("User processing failed")); // User 2 fails

      const res = await NotificationService.sendToUsers(["u1", "u2"], payload);

      expect(res["u1"]).toEqual([{ token: "t1", success: true }]);
      expect(res["u2"]).toEqual([
        { token: "", success: false, error: "User processing failed" },
      ]);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("User processing failed"),
      );

      sendToUserSpy.mockRestore();
    });

    it("handles non-Error objects thrown during user fan-out", async () => {
      const sendToUserSpy = jest
        .spyOn(NotificationService, "sendToUser")
        .mockRejectedValueOnce("Generic string error");

      const res = await NotificationService.sendToUsers(["u1"], payload);

      expect(res["u1"][0].error).toBe("Unknown error");
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Unknown error"),
      );

      sendToUserSpy.mockRestore();
    });
  });

  describe("listNotificationsForUser", () => {
    it("throws if userId is missing", async () => {
      await expect(
        NotificationService.listNotificationsForUser(""),
      ).rejects.toThrow("userId is required");
    });

    it("returns notifications from prisma", async () => {
      (prisma.notification.findMany as jest.Mock).mockResolvedValueOnce([
        { id: "notif1", userId: "user1" },
      ]);

      const res = await NotificationService.listNotificationsForUser("user1");
      expect(res).toHaveLength(1);
      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: "user1" },
        orderBy: { createdAt: "desc" },
      });
    });
  });

  describe("markNotificationAsSeen", () => {
    it("throws if notificationId is missing", async () => {
      await expect(
        NotificationService.markNotificationAsSeen("", "user1"),
      ).rejects.toThrow("notificationId is required");
    });

    it("throws if userId is missing", async () => {
      await expect(
        NotificationService.markNotificationAsSeen("notif-1", ""),
      ).rejects.toThrow("userId is required");
    });

    it("scopes the update to the owner, so another user's id matches nothing", async () => {
      const count = await NotificationService.markNotificationAsSeen(
        "notif-1",
        "user1",
      );

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { id: "notif-1", userId: "user1" },
        data: { isSeen: true },
      });
      expect(count).toBe(1);
    });

    it("reports zero when the notification is not this user's", async () => {
      (prisma.notification.updateMany as jest.Mock).mockResolvedValueOnce({
        count: 0,
      });

      const count = await NotificationService.markNotificationAsSeen(
        "someone-elses",
        "user1",
      );

      expect(count).toBe(0);
    });
  });

  describe("archiveNotificationForUser", () => {
    it("throws if notificationId is missing", async () => {
      await expect(
        NotificationService.archiveNotificationForUser("", "user1"),
      ).rejects.toThrow("notificationId is required");
    });

    it("throws if userId is missing", async () => {
      await expect(
        NotificationService.archiveNotificationForUser("notif-1", ""),
      ).rejects.toThrow("userId is required");
    });

    it("stamps archivedAt for the owner's un-archived notification", async () => {
      const res = await NotificationService.archiveNotificationForUser(
        "notif-1",
        "user1",
      );

      expect(res).toBe("archived");
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { id: "notif-1", userId: "user1", archivedAt: null },
        data: { archivedAt: expect.any(Date) },
      });
      expect(prisma.notification.findFirst).not.toHaveBeenCalled();
    });

    it("treats a second archive as success and keeps the original timestamp", async () => {
      (prisma.notification.updateMany as jest.Mock).mockResolvedValueOnce({
        count: 0,
      });
      (prisma.notification.findFirst as jest.Mock).mockResolvedValueOnce({
        id: "notif-1",
      });

      const res = await NotificationService.archiveNotificationForUser(
        "notif-1",
        "user1",
      );

      expect(res).toBe("already-archived");
    });

    it("reports not-found for an id that is not this user's", async () => {
      (prisma.notification.updateMany as jest.Mock).mockResolvedValueOnce({
        count: 0,
      });
      (prisma.notification.findFirst as jest.Mock).mockResolvedValueOnce(null);

      const res = await NotificationService.archiveNotificationForUser(
        "someone-elses",
        "user1",
      );

      expect(res).toBe("not-found");
      expect(prisma.notification.findFirst).toHaveBeenCalledWith({
        where: { id: "someone-elses", userId: "user1" },
        select: { id: true },
      });
    });
  });
});
