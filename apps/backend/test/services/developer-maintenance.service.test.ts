import { DeveloperMaintenanceService } from "../../src/services/developer-maintenance.service";
import { DeveloperRequestLogService } from "../../src/services/developer-request-log.service";
import { resolveOrgOwnerContact } from "../../src/services/developer-usage-alert.service";
import { prisma } from "../../src/config/prisma";
import { sendEmail } from "../../src/utils/email";
import logger from "../../src/utils/logger";

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    developerApiKey: { findMany: jest.fn() },
  },
}));

jest.mock("../../src/services/developer-request-log.service", () => ({
  DeveloperRequestLogService: { deleteOlderThan: jest.fn() },
  REQUEST_LOG_RETENTION_DAYS: 30,
}));

jest.mock("../../src/services/developer-usage-alert.service", () => ({
  resolveOrgOwnerContact: jest.fn(),
}));

jest.mock("../../src/utils/email", () => ({
  sendEmail: jest.fn(),
}));

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), info: jest.fn() },
}));

const mockPrisma = prisma as unknown as {
  developerApiKey: { findMany: jest.Mock };
};
const deleteOlderThanMock =
  DeveloperRequestLogService.deleteOlderThan as jest.Mock;
const resolveOwnerMock = resolveOrgOwnerContact as jest.Mock;
const sendEmailMock = sendEmail as jest.Mock;
const loggerErrorMock = logger.error as jest.Mock;

const DAY_MS = 24 * 60 * 60 * 1000;

const expiringKey = (id: string, organisationId = "org-1") => ({
  id,
  organisationId,
  name: "CI key",
  prefix: "yc_live_abc123",
  last4: "wxyz",
  expiresAt: new Date(Date.now() + 6.8 * DAY_MS),
});

const owner = {
  email: "owner@example.com",
  name: "Ada Vet",
  organisationName: "Sunny Paws",
};

describe("DeveloperMaintenanceService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    deleteOlderThanMock.mockResolvedValue(0);
    mockPrisma.developerApiKey.findMany.mockResolvedValue([]);
    resolveOwnerMock.mockResolvedValue(owner);
    sendEmailMock.mockResolvedValue({});
  });

  describe("purgeRequestLogs", () => {
    it("prunes request logs with the 30-day retention window", async () => {
      deleteOlderThanMock.mockResolvedValue(42);
      const deleted = await DeveloperMaintenanceService.purgeRequestLogs();
      expect(deleted).toBe(42);
      expect(deleteOlderThanMock).toHaveBeenCalledWith(30);
    });
  });

  describe("sendKeyExpiryReminders", () => {
    it("queries only active, non-rotated keys expiring in the (6.5d, 7d] window", async () => {
      const before = Date.now();
      await DeveloperMaintenanceService.sendKeyExpiryReminders();

      const arg = mockPrisma.developerApiKey.findMany.mock.calls[0][0];
      expect(arg.where.status).toBe("active");
      expect(arg.where.rotationGraceUntil).toBeNull();
      const { gt, lte } = arg.where.expiresAt as { gt: Date; lte: Date };
      expect(gt.getTime()).toBeGreaterThanOrEqual(before + 6.5 * DAY_MS - 1000);
      expect(gt.getTime()).toBeLessThanOrEqual(Date.now() + 6.5 * DAY_MS);
      expect(lte.getTime() - gt.getTime()).toBeCloseTo(0.5 * DAY_MS, -4);
    });

    it("emails the org owner once per expiring key", async () => {
      mockPrisma.developerApiKey.findMany.mockResolvedValue([
        expiringKey("k1"),
        expiringKey("k2", "org-2"),
      ]);

      const sent = await DeveloperMaintenanceService.sendKeyExpiryReminders();

      expect(sent).toBe(2);
      expect(sendEmailMock).toHaveBeenCalledTimes(2);
      expect(sendEmailMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "owner@example.com",
          subject: "Your Yosemite Crew API key expires in 7 days",
          textBody: expect.stringContaining("CI key (yc_live_abc123...wxyz)"),
        }),
      );
    });

    it("escapes user-controlled key and org names in the HTML body", async () => {
      mockPrisma.developerApiKey.findMany.mockResolvedValue([
        {
          ...expiringKey("k1"),
          name: '<script>alert("k")</script>',
        },
      ]);
      resolveOwnerMock.mockResolvedValue({
        email: "owner@example.com",
        name: "<a>Ada</a>",
        organisationName: "Sunny <Paws>",
      });

      await DeveloperMaintenanceService.sendKeyExpiryReminders();

      const email = sendEmailMock.mock.calls[0][0];
      expect(email.htmlBody).not.toContain("<script>");
      expect(email.htmlBody).not.toContain("<a>Ada</a>");
      expect(email.htmlBody).toContain(
        "&lt;script&gt;alert(&quot;k&quot;)&lt;/script&gt;",
      );
      expect(email.htmlBody).toContain("Sunny &lt;Paws&gt;");
      expect(email.htmlBody).toContain("&lt;a&gt;Ada&lt;/a&gt;");
      // Plaintext stays raw - it is never rendered as markup.
      expect(email.textBody).toContain('<script>alert("k")</script>');
    });

    it("skips (and logs) keys whose org has no resolvable owner", async () => {
      mockPrisma.developerApiKey.findMany.mockResolvedValue([
        expiringKey("k1"),
      ]);
      resolveOwnerMock.mockResolvedValue(null);

      const sent = await DeveloperMaintenanceService.sendKeyExpiryReminders();

      expect(sent).toBe(0);
      expect(sendEmailMock).not.toHaveBeenCalled();
      expect(loggerErrorMock).toHaveBeenCalledWith(
        "Key expiry reminder: no owner contact",
        expect.objectContaining({ keyId: "k1" }),
      );
    });

    it("a per-key failure never aborts the rest of the batch", async () => {
      mockPrisma.developerApiKey.findMany.mockResolvedValue([
        expiringKey("k1"),
        expiringKey("k2"),
      ]);
      sendEmailMock
        .mockRejectedValueOnce(new Error("ses down"))
        .mockResolvedValueOnce({});

      const sent = await DeveloperMaintenanceService.sendKeyExpiryReminders();

      expect(sent).toBe(1);
      expect(loggerErrorMock).toHaveBeenCalledWith(
        "Failed to send API key expiry reminder",
        expect.objectContaining({ keyId: "k1" }),
      );
    });
  });

  describe("run", () => {
    it("runs both passes", async () => {
      await DeveloperMaintenanceService.run();
      expect(deleteOlderThanMock).toHaveBeenCalledWith(30);
      expect(mockPrisma.developerApiKey.findMany).toHaveBeenCalled();
    });

    it("a retention failure never starves the expiry reminders", async () => {
      deleteOlderThanMock.mockRejectedValue(new Error("db down"));
      await expect(DeveloperMaintenanceService.run()).resolves.toBeUndefined();
      expect(mockPrisma.developerApiKey.findMany).toHaveBeenCalled();
      expect(loggerErrorMock).toHaveBeenCalledWith(
        "Developer request-log retention failed",
        expect.objectContaining({ error: expect.any(Error) }),
      );
    });

    it("an expiry-reminder failure is contained and logged", async () => {
      mockPrisma.developerApiKey.findMany.mockRejectedValue(
        new Error("db down"),
      );
      await expect(DeveloperMaintenanceService.run()).resolves.toBeUndefined();
      expect(loggerErrorMock).toHaveBeenCalledWith(
        "Developer key expiry reminders failed",
        expect.objectContaining({ error: expect.any(Error) }),
      );
    });
  });
});
