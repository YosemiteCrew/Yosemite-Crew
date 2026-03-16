import { Types } from "mongoose";
import OrganizationModel from "../../src/models/organization";
import UserOrganizationModel from "../../src/models/user-organization";
import UserModel from "../../src/models/user";
import { sendEmailTemplate } from "../../src/utils/email";
import logger from "../../src/utils/logger";
import * as SutModule from "../../src/utils/org-usage-notifications";

// --- Mocks ---
jest.mock("../../src/models/organization");
jest.mock("../../src/models/user-organization");
jest.mock("../../src/models/user");
jest.mock("../../src/utils/email");
jest.mock("../../src/utils/logger");

// Helper to mock chainable mongoose queries: findX().select().lean()
const mockChain = (result: any) => ({
  select: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(result),
});

// Helper for simple chains: findX().lean()
const mockChainSimple = (result: any) => ({
  lean: jest.fn().mockResolvedValue(result),
});

describe("Org Usage Notifications Utils", () => {
  const mockOrgId = new Types.ObjectId();

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
      (OrganizationModel.findById as jest.Mock).mockReturnValue(
        mockChain(null),
      );

      await SutModule.sendFreePlanLimitReachedEmail({
        orgId: mockOrgId,
        usage: breachedUsage,
      });

      expect(OrganizationModel.findById).toHaveBeenCalledWith(mockOrgId);
      expect(UserOrganizationModel.findOne).not.toHaveBeenCalled();
      expect(sendEmailTemplate).not.toHaveBeenCalled();
    });

    it("should return early if owner mapping is not found", async () => {
      (OrganizationModel.findById as jest.Mock).mockReturnValue(
        mockChain({ name: "Org" }),
      );
      (UserOrganizationModel.findOne as jest.Mock).mockReturnValue(
        mockChain(null),
      );

      await SutModule.sendFreePlanLimitReachedEmail({
        orgId: mockOrgId,
        usage: breachedUsage,
      });

      expect(UserOrganizationModel.findOne).toHaveBeenCalled();
      expect(UserModel.findOne).not.toHaveBeenCalled();
    });

    it("should return early if owner user is not found", async () => {
      (OrganizationModel.findById as jest.Mock).mockReturnValue(
        mockChain({ name: "Org" }),
      );
      (UserOrganizationModel.findOne as jest.Mock).mockReturnValue(
        mockChain({ practitionerReference: "123" }),
      );
      (UserModel.findOne as jest.Mock).mockReturnValue(mockChainSimple(null));

      await SutModule.sendFreePlanLimitReachedEmail({
        orgId: mockOrgId,
        usage: breachedUsage,
      });

      expect(sendEmailTemplate).not.toHaveBeenCalled();
    });

    it("should return early if usage limits are not reached", async () => {
      (OrganizationModel.findById as jest.Mock).mockReturnValue(
        mockChain({ name: "Org" }),
      );
      (UserOrganizationModel.findOne as jest.Mock).mockReturnValue(
        mockChain({ practitionerReference: "123" }),
      );
      (UserModel.findOne as jest.Mock).mockReturnValue(
        mockChainSimple({ email: "test@test.com" }),
      );

      await SutModule.sendFreePlanLimitReachedEmail({
        orgId: mockOrgId,
        usage: safeUsage,
      });

      expect(sendEmailTemplate).not.toHaveBeenCalled();
    });

    it("should send email when limits are reached", async () => {
      (OrganizationModel.findById as jest.Mock).mockReturnValue(
        mockChain({ name: "Test Org", fhirId: "fhir-123" }),
      );
      // Test reference extraction logic (Practitioner/ID -> ID)
      (UserOrganizationModel.findOne as jest.Mock).mockReturnValue(
        mockChain({ practitionerReference: "Practitioner/999" }),
      );
      (UserModel.findOne as jest.Mock).mockReturnValue(
        mockChainSimple({
          email: "owner@test.com",
          firstName: "John",
          lastName: "Doe",
        }),
      );

      await SutModule.sendFreePlanLimitReachedEmail({
        orgId: mockOrgId,
        usage: breachedUsage,
      });

      // Verify Reference Candidates logic
      const orgIdStr = mockOrgId.toString();
      expect(UserOrganizationModel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationReference: {
            $in: expect.arrayContaining([
              orgIdStr,
              `Organization/${orgIdStr}`,
              "fhir-123",
              "Organization/fhir-123",
            ]),
          },
        }),
      );

      // Verify User ID extraction
      expect(UserModel.findOne).toHaveBeenCalledWith(
        { userId: "999" },
        expect.anything(),
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
      (OrganizationModel.findById as jest.Mock).mockReturnValue(
        mockChain({ name: "Org" }),
      );
      (UserOrganizationModel.findOne as jest.Mock).mockReturnValue(
        mockChain({ practitionerReference: "123" }),
      );
      (UserModel.findOne as jest.Mock).mockReturnValue(
        mockChainSimple({ email: "e@e.com" }),
      );

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

      // FIX: The logic treats null/undefined as 0.
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
      (OrganizationModel.findById as jest.Mock).mockReturnValue(
        mockChain({ name: "Org" }),
      ); // No fhirId
      (UserOrganizationModel.findOne as jest.Mock).mockReturnValue(
        mockChain({ practitionerReference: "123" }),
      );
      (UserModel.findOne as jest.Mock).mockReturnValue(
        mockChainSimple({ email: "e@e.com" }),
      );

      await SutModule.sendFreePlanLimitReachedEmail({
        orgId: mockOrgId,
        usage: breachedUsage,
      });

      expect(UserOrganizationModel.findOne).toHaveBeenCalled();
    });

    it("should handle owner without name parts", async () => {
      (OrganizationModel.findById as jest.Mock).mockReturnValue(
        mockChain({ name: "Org" }),
      );
      (UserOrganizationModel.findOne as jest.Mock).mockReturnValue(
        mockChain({ practitionerReference: "123" }),
      );
      (UserModel.findOne as jest.Mock).mockReturnValue(
        mockChainSimple({ email: "e@e.com" }),
      ); // No first/last name

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
      (OrganizationModel.findById as jest.Mock).mockReturnValue(
        mockChain({ name: "Org" }),
      );
      (UserOrganizationModel.findOne as jest.Mock).mockReturnValue(
        mockChain({ practitionerReference: "123" }),
      );
      (UserModel.findOne as jest.Mock).mockReturnValue(
        mockChainSimple({ email: "e@e.com" }),
      );

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

      // Re-require module AND dependencies to ensure we config the correct mock instances
      const DynamicSut = require("../../src/utils/org-usage-notifications");
      const DynamicOrgModel = require("../../src/models/organization").default;
      const DynamicUserOrgModel =
        require("../../src/models/user-organization").default;
      const DynamicUserModel = require("../../src/models/user").default;
      const {
        sendEmailTemplate: dynamicSendEmail,
      } = require("../../src/utils/email");

      // Setup mock on the DYNAMIC instances
      (DynamicOrgModel.findById as jest.Mock).mockReturnValue(
        mockChain({ name: "Org" }),
      );
      (DynamicUserOrgModel.findOne as jest.Mock).mockReturnValue(
        mockChain({ practitionerReference: "123" }),
      );
      (DynamicUserModel.findOne as jest.Mock).mockReturnValue(
        mockChainSimple({ email: "e@e.com" }),
      );

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
      const DynamicOrgModel = require("../../src/models/organization").default;
      const DynamicUserOrgModel =
        require("../../src/models/user-organization").default;
      const DynamicUserModel = require("../../src/models/user").default;
      const {
        sendEmailTemplate: dynamicSendEmail,
      } = require("../../src/utils/email");

      (DynamicOrgModel.findById as jest.Mock).mockReturnValue(
        mockChain({ name: "Org" }),
      );
      (DynamicUserOrgModel.findOne as jest.Mock).mockReturnValue(
        mockChain({ practitionerReference: "123" }),
      );
      (DynamicUserModel.findOne as jest.Mock).mockReturnValue(
        mockChainSimple({ email: "e@e.com" }),
      );

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
