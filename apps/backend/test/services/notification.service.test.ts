import { NotificationService } from "../../src/services/notification.service";
import { DeviceTokenService } from "../../src/services/deviceToken.service";
import { NotificationModel } from "../../src/models/notification";
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

// Mongoose query chain helper
const mockLean = jest.fn();
const mockSort = jest.fn().mockReturnValue({ lean: mockLean });

jest.mock("../../src/models/notification", () => ({
  NotificationModel: {
    create: jest.fn(),
    find: jest.fn(() => ({ sort: mockSort })),
    findById: jest.fn(),
  },
}));

jest.mock("src/config/prisma", () => ({
  prisma: {
    notification: {
      create: jest.fn(),
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

    it("loops through tokens, skips invalid records, and logs DB errors asynchronously", async () => {
      // Notice: we mock `deviceToken` here because the source code accesses `record.deviceToken`
      const mockTokens = [
        null, // Should hit `if (!record) continue;`
        { deviceToken: "token-1" },
      ];
      (DeviceTokenService.getTokensForUser as jest.Mock).mockResolvedValueOnce(
        mockTokens,
      );
      mockSend.mockResolvedValue("msg-id");

      // Force NotificationModel.create to throw to test the catch block
      (NotificationModel.create as jest.Mock).mockRejectedValueOnce(
        new Error("DB Insert Failed"),
      );

      const res = await NotificationService.sendToUser("user1", payload);

      // We must wait a tick for the dangling .catch() on insertOne to execute
      await new Promise(process.nextTick);

      expect(res).toHaveLength(1);
      expect(res[0].token).toBe("token-1");
      expect(NotificationModel.create).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("DB Insert Failed"),
      );
    });

    it("handles non-Error objects in DB insert catch block", async () => {
      (DeviceTokenService.getTokensForUser as jest.Mock).mockResolvedValueOnce([
        { deviceToken: "token-2" },
      ]);
      mockSend.mockResolvedValue("msg-id");
      (NotificationModel.create as jest.Mock).mockRejectedValueOnce(
        "String DB Error",
      );

      await NotificationService.sendToUser("user1", payload);
      await new Promise(process.nextTick); // flush dangling promises

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Unknown error"),
      );
    });
  });

  describe("sendToUser (postgres)", () => {
    const originalReadFromPostgres = process.env.READ_FROM_POSTGRES;

    beforeEach(() => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.notification.create as jest.Mock).mockReset();
    });

    afterEach(() => {
      process.env.READ_FROM_POSTGRES = originalReadFromPostgres;
    });

    it("stores notifications via prisma", async () => {
      (DeviceTokenService.getTokensForUser as jest.Mock).mockResolvedValueOnce([
        { deviceToken: "token-1" },
      ]);
      mockSend.mockResolvedValue("msg-id");

      await NotificationService.sendToUser("user1", payload);
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "user1",
            title: payload.title,
          }),
        }),
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

  describe("listNotificationsForUser (postgres)", () => {
    const originalReadFromPostgres = process.env.READ_FROM_POSTGRES;

    beforeEach(() => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.notification.findMany as jest.Mock).mockReset();
    });

    afterEach(() => {
      process.env.READ_FROM_POSTGRES = originalReadFromPostgres;
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

  describe("listNotificationsForUser", () => {
    it("throws if userId is missing", async () => {
      await expect(
        NotificationService.listNotificationsForUser(""),
      ).rejects.toThrow("userId is required");
    });

    it("returns leaned and sorted notifications", async () => {
      mockLean.mockResolvedValueOnce([{ id: "notif1" }]);

      const res = await NotificationService.listNotificationsForUser("user1");

      expect(NotificationModel.find).toHaveBeenCalledWith({ userId: "user1" });
      expect(mockSort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(mockLean).toHaveBeenCalled();
      expect(res).toEqual([{ id: "notif1" }]);
    });
  });

  describe("markNotificationAsSeen", () => {
    it("throws if notificationId is missing", async () => {
      await expect(
        NotificationService.markNotificationAsSeen(""),
      ).rejects.toThrow("notificationId is required");
    });

    it("throws if notification is not found", async () => {
      (NotificationModel.findById as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        NotificationService.markNotificationAsSeen("notif-123"),
      ).rejects.toThrow("Notification not found");
    });

    it("marks notification as seen and saves it", async () => {
      const mockDoc = {
        isSeen: false,
        save: jest.fn().mockResolvedValue(true),
      };
      (NotificationModel.findById as jest.Mock).mockResolvedValueOnce(mockDoc);

      await NotificationService.markNotificationAsSeen("notif-123");

      expect(mockDoc.isSeen).toBe(true);
      expect(mockDoc.save).toHaveBeenCalled();
    });
  });

  describe("markNotificationAsSeen (postgres)", () => {
    const originalReadFromPostgres = process.env.READ_FROM_POSTGRES;

    beforeEach(() => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.notification.updateMany as jest.Mock).mockReset();
    });

    afterEach(() => {
      process.env.READ_FROM_POSTGRES = originalReadFromPostgres;
    });

    it("updates notification via prisma", async () => {
      await NotificationService.markNotificationAsSeen("notif-1");
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { id: "notif-1" },
        data: { isSeen: true },
      });
    });
  });
});
