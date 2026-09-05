import { NotificationController } from "../../src/controllers/app/notification.controller";
import { AuthUserMobileService } from "../../src/services/authUserMobile.service";
import { NotificationService } from "../../src/services/notification.service";

jest.mock("../../src/services/authUserMobile.service", () => ({
  AuthUserMobileService: {
    getByProviderUserId: jest.fn(),
  },
}));

jest.mock("../../src/services/notification.service", () => ({
  NotificationService: {
    listNotificationsForUser: jest.fn(),
    markNotificationAsSeen: jest.fn(),
    archiveNotificationForUser: jest.fn(),
  },
}));

const mockedAuthUserMobileService = AuthUserMobileService as unknown as {
  getByProviderUserId: jest.Mock;
};

const mockedNotificationService = NotificationService as unknown as {
  listNotificationsForUser: jest.Mock;
  markNotificationAsSeen: jest.Mock;
  archiveNotificationForUser: jest.Mock;
};

const createResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

// The mobile middleware puts the provider user id on the request; parentId is
// the id notification rows are actually keyed by.
const authedRequest = (overrides: Record<string, unknown> = {}) => ({
  userId: "provider-user-1",
  params: { notificationId: "notif-1" },
  ...overrides,
});

describe("NotificationController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAuthUserMobileService.getByProviderUserId.mockResolvedValue({
      parentId: "owner-1",
    });
  });

  describe("owner resolution", () => {
    it.each([
      ["listNotifications", () => NotificationController.listNotifications],
      ["markAsSeen", () => NotificationController.markAsSeen],
      ["archive", () => NotificationController.archive],
    ])("401s %s when the request is not authenticated", async (_name, get) => {
      const res = createResponse();

      await get()(authedRequest({ userId: undefined }) as any, res as any);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: "Not authenticated: userId is missing.",
      });
    });

    it.each([
      ["listNotifications", () => NotificationController.listNotifications],
      ["markAsSeen", () => NotificationController.markAsSeen],
      ["archive", () => NotificationController.archive],
    ])("404s %s when the mobile user has no parent", async (_name, get) => {
      mockedAuthUserMobileService.getByProviderUserId.mockResolvedValueOnce(
        null,
      );
      const res = createResponse();

      await get()(authedRequest() as any, res as any);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "User not found." });
    });
  });

  describe("listNotifications", () => {
    it("lists the resolved owner's notifications", async () => {
      mockedNotificationService.listNotificationsForUser.mockResolvedValueOnce([
        { id: "notif-1" },
      ]);
      const res = createResponse();

      await NotificationController.listNotifications(
        authedRequest() as any,
        res as any,
      );

      expect(
        mockedNotificationService.listNotificationsForUser,
      ).toHaveBeenCalledWith("owner-1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        notifications: [{ id: "notif-1" }],
      });
    });

    it("500s when the service throws", async () => {
      mockedNotificationService.listNotificationsForUser.mockRejectedValueOnce(
        new Error("boom"),
      );
      const res = createResponse();

      await NotificationController.listNotifications(
        authedRequest() as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("markAsSeen", () => {
    it("400s without a notificationId", async () => {
      const res = createResponse();

      await NotificationController.markAsSeen(
        authedRequest({ params: {} }) as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(
        mockedNotificationService.markNotificationAsSeen,
      ).not.toHaveBeenCalled();
    });

    it("passes the resolved owner, so the update cannot cross users", async () => {
      mockedNotificationService.markNotificationAsSeen.mockResolvedValueOnce(1);
      const res = createResponse();

      await NotificationController.markAsSeen(
        authedRequest() as any,
        res as any,
      );

      expect(
        mockedNotificationService.markNotificationAsSeen,
      ).toHaveBeenCalledWith("notif-1", "owner-1");
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("404s an id that belongs to nobody, rather than reporting success", async () => {
      mockedNotificationService.markNotificationAsSeen.mockResolvedValueOnce(0);
      const res = createResponse();

      await NotificationController.markAsSeen(
        authedRequest({ params: { notificationId: "someone-elses" } }) as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Notification not found.",
      });
    });

    it("500s when the service throws", async () => {
      mockedNotificationService.markNotificationAsSeen.mockRejectedValueOnce(
        new Error("boom"),
      );
      const res = createResponse();

      await NotificationController.markAsSeen(
        authedRequest() as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("archive", () => {
    it("400s without a notificationId", async () => {
      const res = createResponse();

      await NotificationController.archive(
        authedRequest({ params: {} }) as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(
        mockedNotificationService.archiveNotificationForUser,
      ).not.toHaveBeenCalled();
    });

    it.each(["archived", "already-archived"])(
      "200s a %s notification",
      async (outcome) => {
        mockedNotificationService.archiveNotificationForUser.mockResolvedValueOnce(
          outcome,
        );
        const res = createResponse();

        await NotificationController.archive(
          authedRequest() as any,
          res as any,
        );

        expect(
          mockedNotificationService.archiveNotificationForUser,
        ).toHaveBeenCalledWith("notif-1", "owner-1");
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
          message: "Notification archived.",
        });
      },
    );

    it("404s an id that is not the caller's", async () => {
      mockedNotificationService.archiveNotificationForUser.mockResolvedValueOnce(
        "not-found",
      );
      const res = createResponse();

      await NotificationController.archive(
        authedRequest({ params: { notificationId: "someone-elses" } }) as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("500s when the service throws", async () => {
      mockedNotificationService.archiveNotificationForUser.mockRejectedValueOnce(
        new Error("boom"),
      );
      const res = createResponse();

      await NotificationController.archive(authedRequest() as any, res as any);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
