import admin from "firebase-admin";
import { NotificationService } from "../../src/services/notification.service";
import { DeviceTokenService } from "../../src/services/deviceToken.service";
import { NotificationModel } from "../../src/models/notification";
import logger from "../../src/utils/logger";

jest.mock("firebase-admin", () => {
  const send = jest.fn();
  const messaging = jest.fn(() => ({ send }));
  return {
    __esModule: true,
    default: { messaging },
    messaging,
  };
});

jest.mock("../../src/services/deviceToken.service", () => ({
  DeviceTokenService: {
    getTokensForUser: jest.fn(),
    removeToken: jest.fn(),
  },
}));

jest.mock("../../src/models/notification", () => ({
  NotificationModel: {
    find: jest.fn(),
    findById: jest.fn(),
    insertOne: jest.fn(),
  },
}));

jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const mockedAdmin = admin as unknown as { messaging: jest.Mock };
const mockedDeviceTokenService = DeviceTokenService as unknown as {
  getTokensForUser: jest.Mock;
  removeToken: jest.Mock;
};
const mockedNotificationModel = NotificationModel as unknown as {
  find: jest.Mock;
  findById: jest.Mock;
  insertOne: jest.Mock;
};
const mockedLogger = logger as unknown as {
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
};

describe("NotificationService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("sendToDevice", () => {
    it("returns failure when token is invalid", async () => {
      const result = await NotificationService.sendToDevice(
        "",
        { title: "t", body: "b", type: "CHAT_MESSAGE" },
        {},
      );

      expect(result.success).toBe(false);
      expect(mockedAdmin.messaging).not.toHaveBeenCalled();
    });

    it("sends message via FCM", async () => {
      const sendMock = mockedAdmin.messaging().send as jest.Mock;
      sendMock.mockResolvedValueOnce("ok");

      const payload = { title: "Hello", body: "World", type: "CHAT_MESSAGE" };
      const result = await NotificationService.sendToDevice(
        "token-1",
        payload,
      );

      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          token: "token-1",
          notification: { title: "Hello", body: "World" },
        }),
        undefined,
      );
      expect(result).toEqual({ token: "token-1", success: true });
    });

    it("cleans up invalid tokens", async () => {
      const sendMock = mockedAdmin.messaging().send as jest.Mock;
      sendMock.mockRejectedValueOnce({ code: "messaging/invalid-registration-token" });

      const result = await NotificationService.sendToDevice(
        "bad-token",
        { title: "t", body: "b", type: "CHAT_MESSAGE" },
      );

      expect(mockedDeviceTokenService.removeToken).toHaveBeenCalledWith(
        "bad-token",
      );
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("sendToUser", () => {
    it("throws when userId is missing", async () => {
      await expect(
        NotificationService.sendToUser("", { title: "t", body: "b", type: "CHAT_MESSAGE" }),
      ).rejects.toThrow("userId is required");
    });

    it("sends to all user tokens and logs notification", async () => {
      const sendMock = mockedAdmin.messaging().send as jest.Mock;
      sendMock.mockResolvedValue("ok");
      mockedDeviceTokenService.getTokensForUser.mockResolvedValueOnce([
        { deviceToken: "token-1" },
        { deviceToken: "token-2" },
      ]);
      mockedNotificationModel.insertOne.mockResolvedValue(undefined);

      const results = await NotificationService.sendToUser("user-1", {
        title: "Hello",
        body: "World",
        type: "CHAT_MESSAGE",
      });

      expect(mockedDeviceTokenService.getTokensForUser).toHaveBeenCalledWith(
        "user-1",
      );
      expect((mockedAdmin.messaging().send as jest.Mock).mock.calls.length).toBe(
        2,
      );
      expect(mockedNotificationModel.insertOne).toHaveBeenCalledTimes(2);
      expect(results).toHaveLength(2);
      expect(mockedLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Notification sent to token"),
      );
    });
  });

  describe("sendToUsers", () => {
    it("aggregates per-user results", async () => {
      jest
        .spyOn(NotificationService, "sendToUser")
        .mockResolvedValueOnce([{ token: "a", success: true }])
        .mockResolvedValueOnce([{ token: "b", success: false, error: "x" }]);

      const summary = await NotificationService.sendToUsers(
        ["u1", "u2"],
        { title: "t", body: "b", type: "CHAT_MESSAGE" },
      );

      expect(summary).toEqual({
        u1: [{ token: "a", success: true }],
        u2: [{ token: "b", success: false, error: "x" }],
      });
    });
  });

  describe("listNotificationsForUser", () => {
    it("throws on invalid user id", async () => {
      await expect(
        NotificationService.listNotificationsForUser(""),
      ).rejects.toThrow("userId is required");
    });

    it("returns sorted notifications", async () => {
      const lean = jest.fn().mockResolvedValueOnce([{ id: "1" }]);
      const sort = jest.fn().mockReturnValue({ lean });
      mockedNotificationModel.find.mockReturnValueOnce({ sort } as any);

      const result = await NotificationService.listNotificationsForUser("u1");

      expect(mockedNotificationModel.find).toHaveBeenCalledWith({ userId: "u1" });
      expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(result).toEqual([{ id: "1" }]);
    });
  });

  describe("markNotificationAsSeen", () => {
    it("throws when id is empty", async () => {
      await expect(
        NotificationService.markNotificationAsSeen(""),
      ).rejects.toThrow("notificationId is required");
    });

    it("throws when notification not found", async () => {
      mockedNotificationModel.findById.mockResolvedValueOnce(null);

      await expect(
        NotificationService.markNotificationAsSeen("missing"),
      ).rejects.toThrow("Notification not found");
    });

    it("marks notification as seen", async () => {
      const save = jest.fn();
      const doc = { isSeen: false, save } as any;
      mockedNotificationModel.findById.mockResolvedValueOnce(doc);

      await NotificationService.markNotificationAsSeen("notif-1");

      expect(doc.isSeen).toBe(true);
      expect(save).toHaveBeenCalled();
    });
  });
});
