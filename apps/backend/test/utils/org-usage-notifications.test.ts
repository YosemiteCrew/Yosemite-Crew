import { prisma } from "src/config/prisma";
import { sendEmailTemplate } from "../../src/utils/email";
import logger from "../../src/utils/logger";
import * as SutModule from "../../src/utils/org-usage-notifications";

// --- Mocks ---
jest.mock("src/config/prisma", () => ({
  prisma: {
    organization: {
      findFirst: jest.fn(),
    },
    userOrganization: {
      findFirst: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
  },
}));
jest.mock("../../src/utils/email");
jest.mock("../../src/utils/logger");

describe("Org Usage Notifications Utils", () => {
  const mockOrgId = "org-123";

  // Standard Usage object that triggers no limits
  const safeUsage = {
    appointmentsUsed: 1,
    freeAppointmentsLimit: 10,
    toolsUsed: 1,
    freeToolsLimit: 10,
    usersActiveCount: 1,
    freeUsersLimit: 10,
  };

  // Usage object that triggers limits
  const breachedUsage = {
    appointmentsUsed: 10,
    freeAppointmentsLimit: 5,
    toolsUsed: 1,
    freeToolsLimit: 10,
    usersActiveCount: 5,
    freeUsersLimit: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Business Logic", () => {
    it("should return early if organization is not found", async () => {
      (prisma.organization.findFirst as jest.Mock).mockResolvedValue(null);

      await SutModule.sendFreePlanLimitReachedEmail({
        orgId: mockOrgId,
        usage: breachedUsage,
      });

      expect(prisma.organization.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { OR: [{ id: mockOrgId }, { fhirId: mockOrgId }] },
        }),
      );
      expect(prisma.userOrganization.findFirst).not.toHaveBeenCalled();
      expect(sendEmailTemplate).not.toHaveBeenCalled();
    });

    it("should return early if owner mapping is not found", async () => {
      (prisma.organization.findFirst as jest.Mock).mockResolvedValue({
        id: mockOrgId,
        name: "Org",
      });
      (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValue(null);

      await SutModule.sendFreePlanLimitReachedEmail({
        orgId: mockOrgId,
        usage: breachedUsage,
      });

      expect(prisma.userOrganization.findFirst).toHaveBeenCalled();
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
    });

    it("should return early if owner user is not found", async () => {
      (prisma.organization.findFirst as jest.Mock).mockResolvedValue({
        id: mockOrgId,
        name: "Org",
      });
      (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValue({
        practitionerReference: "123",
      });
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

      await SutModule.sendFreePlanLimitReachedEmail({
        orgId: mockOrgId,
        usage: breachedUsage,
      });

      expect(sendEmailTemplate).not.toHaveBeenCalled();
    });

    it("should return early if usage limits are not reached", async () => {
      (prisma.organization.findFirst as jest.Mock).mockResolvedValue({
        id: mockOrgId,
        name: "Org",
      });
      (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValue({
        practitionerReference: "123",
      });
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        email: "test@test.com",
      });

      await SutModule.sendFreePlanLimitReachedEmail({
        orgId: mockOrgId,
        usage: safeUsage,
      });

      expect(sendEmailTemplate).not.toHaveBeenCalled();
    });

    it("should send email when limits are reached", async () => {
      (prisma.organization.findFirst as jest.Mock).mockResolvedValue({
        id: "org-abc",
        name: "Test Org",
        fhirId: "fhir-123",
      });
      // Test reference extraction logic (Practitioner/ID -> ID)
      (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValue({
        practitionerReference: "Practitioner/999",
      });
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        email: "owner@test.com",
        firstName: "John",
        lastName: "Doe",
      });

      await SutModule.sendFreePlanLimitReachedEmail({
        orgId: mockOrgId,
        usage: breachedUsage,
      });

      // Verify Reference Candidates logic (built from the resolved org row)
      expect(prisma.userOrganization.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            roleCode: "OWNER",
            active: true,
            organizationReference: {
              in: expect.arrayContaining([
                "org-abc",
                "Organization/org-abc",
                "fhir-123",
                "Organization/fhir-123",
              ]),
            },
          }),
        }),
      );

      // Verify User ID extraction
      expect(prisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: "999" } }),
      );

      // Verify Email Content
      expect(sendEmailTemplate).toHaveBeenCalledWith({
        to: "owner@test.com",
        templateId: "freePlanLimitReached",
        templateData: expect.objectContaining({
          ownerName: "John Doe",
          organisationName: "Test Org",
          limitItems: [
            { label: "Appointments", used: 10, limit: 5 },
            { label: "Users", used: 5, limit: 1 },
          ],
          ctaUrl: expect.stringContaining("settings/billing"),
        }),
      });
    });

    it("should handle optional usage values as 0 (triggering limits if limit is 0)", async () => {
      (prisma.organization.findFirst as jest.Mock).mockResolvedValue({
        id: mockOrgId,
        name: "Org",
      });
      (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValue({
        practitionerReference: "123",
      });
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        email: "e@e.com",
      });

      // Pass nulls/undefineds
      await SutModule.sendFreePlanLimitReachedEmail({
        orgId: mockOrgId,
        usage: {
          appointmentsUsed: null,
          freeAppointmentsLimit: null,
          toolsUsed: undefined,
          freeToolsLimit: undefined,
          usersActiveCount: 1,
          freeUsersLimit: 0,
        },
      });

      // The logic treats null/undefined as 0.
      // 0 >= 0 is TRUE, so all limits are effectively "reached".
      expect(sendEmailTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          templateData: expect.objectContaining({
            limitItems: expect.arrayContaining([
              { label: "Appointments", used: 0, limit: 0 },
              { label: "Tools", used: 0, limit: 0 },
              { label: "Users", used: 1, limit: 0 },
            ]),
          }),
        }),
      );
    });

    it("should handle organization without fhirId", async () => {
      (prisma.organization.findFirst as jest.Mock).mockResolvedValue({
        id: mockOrgId,
        name: "Org",
      }); // No fhirId
      (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValue({
        practitionerReference: "123",
      });
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        email: "e@e.com",
      });

      await SutModule.sendFreePlanLimitReachedEmail({
        orgId: mockOrgId,
        usage: breachedUsage,
      });

      expect(prisma.userOrganization.findFirst).toHaveBeenCalled();
    });

    it("should handle owner without name parts", async () => {
      (prisma.organization.findFirst as jest.Mock).mockResolvedValue({
        id: mockOrgId,
        name: "Org",
      });
      (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValue({
        practitionerReference: "123",
      });
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        email: "e@e.com",
      }); // No first/last name

      await SutModule.sendFreePlanLimitReachedEmail({
        orgId: mockOrgId,
        usage: breachedUsage,
      });

      expect(sendEmailTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          templateData: expect.objectContaining({
            ownerName: undefined,
          }),
        }),
      );
    });

    it("should log error if email fails", async () => {
      (prisma.organization.findFirst as jest.Mock).mockResolvedValue({
        id: mockOrgId,
        name: "Org",
      });
      (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValue({
        practitionerReference: "123",
      });
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        email: "e@e.com",
      });

      const err = new Error("Mail fail");
      (sendEmailTemplate as jest.Mock).mockRejectedValue(err);

      await SutModule.sendFreePlanLimitReachedEmail({
        orgId: mockOrgId,
        usage: breachedUsage,
      });

      expect(logger.error).toHaveBeenCalledWith(
        "Failed to send free plan limit reached email.",
        err,
      );
    });
  });

  describe("Environment Variable Fallbacks", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules(); // CRITICAL: Reset modules to re-evaluate top-level constants
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it("should use default support email and billing url when env vars are missing", async () => {
      // Clear Env Vars
      delete process.env.SUPPORT_EMAIL;
      delete process.env.SUPPORT_EMAIL_ADDRESS;
      delete process.env.HELP_EMAIL;
      delete process.env.APP_URL;

      // Re-require module AND dependencies to config the correct mock instances
      const DynamicSut = require("../../src/utils/org-usage-notifications");
      const { prisma: dynamicPrisma } = require("src/config/prisma");
      const {
        sendEmailTemplate: dynamicSendEmail,
      } = require("../../src/utils/email");

      // Setup mock on the DYNAMIC instances
      (dynamicPrisma.organization.findFirst as jest.Mock).mockResolvedValue({
        id: mockOrgId,
        name: "Org",
      });
      (dynamicPrisma.userOrganization.findFirst as jest.Mock).mockResolvedValue(
        { practitionerReference: "123" },
      );
      (dynamicPrisma.user.findFirst as jest.Mock).mockResolvedValue({
        email: "e@e.com",
      });

      await DynamicSut.sendFreePlanLimitReachedEmail({
        orgId: mockOrgId,
        usage: breachedUsage,
      });

      expect(dynamicSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          templateData: expect.objectContaining({
            supportEmail: "support@yosemitecrew.com", // Default hardcoded
            ctaUrl: "https://app.yosemitecrew.com/settings/billing", // Default hardcoded
          }),
        }),
      );
    });

    it("should prioritize SUPPORT_EMAIL over others", async () => {
      process.env.SUPPORT_EMAIL = "prio1@test.com";
      process.env.SUPPORT_EMAIL_ADDRESS = "prio2@test.com";

      const DynamicSut = require("../../src/utils/org-usage-notifications");
      const { prisma: dynamicPrisma } = require("src/config/prisma");
      const {
        sendEmailTemplate: dynamicSendEmail,
      } = require("../../src/utils/email");

      (dynamicPrisma.organization.findFirst as jest.Mock).mockResolvedValue({
        id: mockOrgId,
        name: "Org",
      });
      (dynamicPrisma.userOrganization.findFirst as jest.Mock).mockResolvedValue(
        { practitionerReference: "123" },
      );
      (dynamicPrisma.user.findFirst as jest.Mock).mockResolvedValue({
        email: "e@e.com",
      });

      await DynamicSut.sendFreePlanLimitReachedEmail({
        orgId: mockOrgId,
        usage: breachedUsage,
      });

      expect(dynamicSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          templateData: expect.objectContaining({
            supportEmail: "prio1@test.com",
          }),
        }),
      );
    });
  });
});
