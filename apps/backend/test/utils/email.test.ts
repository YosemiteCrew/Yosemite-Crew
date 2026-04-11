import logger from "../../src/utils/logger";

// --- Static Mocks ---
jest.mock("../../src/utils/logger", () => ({
  error: jest.fn(),
}));

jest.mock("../../src/utils/email-templates", () => ({
  renderEmailTemplate: jest.fn((id, data) => ({
    subject: `Rendered Subject for ${id}`,
    htmlBody: `<p>HTML for ${id}</p>`,
    textBody: `Text for ${id}`,
  })),
}));

describe("Email Utils", () => {
  const ORIGINAL_ENV = process.env;

  // Variables to hold fresh mocks for each test
  let mockSend: jest.Mock;
  let MockSESClient: jest.Mock;
  let MockSendEmailCommand: jest.Mock;
  let emailModule: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules(); // Force require to reload the module
    process.env = { ...ORIGINAL_ENV };

    // SET DEFAULT VALID CONFIGURATION
    // This ensures the module loads with a valid region by default,
    // fixing the "AWS region is not configured" errors in logic tests.
    process.env.AWS_SES_REGION = "us-east-1";

    // 1. Create fresh mock functions
    mockSend = jest.fn();
    MockSESClient = jest.fn(() => ({
      send: mockSend,
    }));
    MockSendEmailCommand = jest.fn();

    // 2. Use doMock to inject these specific instances
    jest.doMock("@aws-sdk/client-ses", () => ({
      SESClient: MockSESClient,
      SendEmailCommand: MockSendEmailCommand,
    }));

    // 3. Re-require the module under test so it picks up the ENV vars set above
    emailModule = require("../../src/utils/email");
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  describe("Configuration & Client Initialization", () => {
    it("should throw error if no AWS region is configured", async () => {
      // Isolate this test: clear vars and re-require
      jest.resetModules();
      delete process.env.AWS_SES_REGION;
      delete process.env.AWS_REGION;
      delete process.env.AWS_DEFAULT_REGION;

      // Re-require specifically for this negative test
      const localModule = require("../../src/utils/email");

      await expect(
        localModule.sendEmail({
          to: "test@example.com",
          subject: "test",
          textBody: "test",
          sourceEmail: "source@example.com",
        }),
      ).rejects.toThrow("AWS region is not configured for SES.");
    });

    it("should resolve region from AWS_SES_REGION and init client", async () => {
      // AWS_SES_REGION is already set in beforeEach
      delete process.env.AWS_ACCESS_KEY_ID;

      mockSend.mockResolvedValue({});
      await emailModule.sendEmail({
        to: "test@test.com",
        subject: "s",
        textBody: "b",
        sourceEmail: "src@test.com",
      });

      expect(MockSESClient).toHaveBeenCalledWith(
        expect.objectContaining({
          region: "us-east-1",
          credentials: undefined,
        }),
      );
    });

    it("should resolve region from AWS_REGION if SES specific is missing", async () => {
      // Re-configure env and re-require
      jest.resetModules();
      delete process.env.AWS_SES_REGION;
      process.env.AWS_REGION = "eu-central-1";
      const localModule = require("../../src/utils/email");

      mockSend.mockResolvedValue({});
      await localModule.sendEmail({
        to: "test@test.com",
        subject: "s",
        textBody: "b",
        sourceEmail: "src@test.com",
      });

      expect(MockSESClient).toHaveBeenCalledWith(
        expect.objectContaining({
          region: "eu-central-1",
        }),
      );
    });

    it("should resolve region from AWS_DEFAULT_REGION as fallback", async () => {
      jest.resetModules();
      delete process.env.AWS_SES_REGION;
      delete process.env.AWS_REGION;
      process.env.AWS_DEFAULT_REGION = "us-west-2";
      const localModule = require("../../src/utils/email");

      mockSend.mockResolvedValue({});
      await localModule.sendEmail({
        to: "test@test.com",
        subject: "s",
        textBody: "b",
        sourceEmail: "src@test.com",
      });

      expect(MockSESClient).toHaveBeenCalledWith(
        expect.objectContaining({
          region: "us-west-2",
        }),
      );
    });

    it("should initialize client with explicit credentials if provided", async () => {
      // Re-configure env and re-require
      jest.resetModules();
      process.env.AWS_SES_REGION = "us-east-1";
      process.env.AWS_ACCESS_KEY_ID = "test-key";
      process.env.AWS_SECRET_ACCESS_KEY = "test-secret";
      const localModule = require("../../src/utils/email");

      mockSend.mockResolvedValue({});
      await localModule.sendEmail({
        to: "test@test.com",
        subject: "s",
        textBody: "b",
        sourceEmail: "src@test.com",
      });

      expect(MockSESClient).toHaveBeenCalledWith(
        expect.objectContaining({
          credentials: {
            accessKeyId: "test-key",
            secretAccessKey: "test-secret",
          },
        }),
      );
    });

    it("should use cached client on subsequent calls", async () => {
      mockSend.mockResolvedValue({});

      await emailModule.sendEmail({
        to: "t1@t.com",
        subject: "s",
        textBody: "b",
        sourceEmail: "src@t.com",
      });
      await emailModule.sendEmail({
        to: "t2@t.com",
        subject: "s",
        textBody: "b",
        sourceEmail: "src@t.com",
      });

      expect(MockSESClient).toHaveBeenCalledTimes(1);
    });
  });

  describe("sendEmail Validation", () => {
    it('should throw if "to" addresses are empty', async () => {
      await expect(
        emailModule.sendEmail({
          to: [],
          subject: "s",
          textBody: "b",
          sourceEmail: "s@s.com",
        }),
      ).rejects.toThrow("At least one recipient is required");

      await expect(
        emailModule.sendEmail({ to: undefined, subject: "s", textBody: "b" }),
      ).rejects.toThrow("At least one recipient is required");
    });

    it("should throw if source email is missing and not in env", async () => {
      jest.resetModules();
      delete process.env.INVITE_EMAIL_FROM;
      delete process.env.SES_FROM_ADDRESS;
      delete process.env.EMAIL_FROM_ADDRESS;
      // We must keep region valid though
      process.env.AWS_SES_REGION = "us-east-1";

      const localModule = require("../../src/utils/email");

      await expect(
        localModule.sendEmail({ to: "t@t.com", subject: "s", textBody: "b" }),
      ).rejects.toThrow("Source email address is not configured");
    });

    it("should resolve source email from Env vars (Priority check)", async () => {
      // Re-configure env and re-require to pick up source email vars
      jest.resetModules();
      process.env.AWS_SES_REGION = "us-east-1";
      process.env.INVITE_EMAIL_FROM = "invite@test.com";
      process.env.SES_FROM_ADDRESS = "ses@test.com";
      const localModule = require("../../src/utils/email");

      mockSend.mockResolvedValue({});
      await localModule.sendEmail({
        to: "t@t.com",
        subject: "s",
        textBody: "b",
      });

      expect(MockSendEmailCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Source: "invite@test.com",
        }),
      );
    });

    it("should throw if subject is empty", async () => {
      await expect(
        emailModule.sendEmail({
          to: "t@t.com",
          subject: "  ",
          textBody: "b",
          sourceEmail: "s@s.com",
        }),
      ).rejects.toThrow("Email subject cannot be empty");
    });

    it("should throw if both htmlBody and textBody are missing", async () => {
      await expect(
        emailModule.sendEmail({
          to: "t@t.com",
          subject: "sub",
          sourceEmail: "s@s.com",
        }),
      ).rejects.toThrow("Either htmlBody or textBody must be provided");
    });
  });

  describe("sendEmail Logic", () => {
    it("should normalize single string address to array", async () => {
      mockSend.mockResolvedValue({});

      await emailModule.sendEmail({
        to: "  user@example.com  ", // whitespace check
        subject: "Subject",
        textBody: "Body",
        sourceEmail: "source@example.com",
      });

      expect(MockSendEmailCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Destination: { ToAddresses: ["user@example.com"] },
        }),
      );
    });

    it("should handle configuration set name", async () => {
      mockSend.mockResolvedValue({});

      await emailModule.sendEmail({
        to: "u@e.com",
        subject: "S",
        textBody: "B",
        sourceEmail: "s@e.com",
        configurationSetName: "MyConfigSet",
      });

      expect(MockSendEmailCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          ConfigurationSetName: "MyConfigSet",
        }),
      );
    });

    it("should construct body with Text only", async () => {
      mockSend.mockResolvedValue({});

      await emailModule.sendEmail({
        to: "u@e.com",
        subject: "S",
        textBody: "TextContent",
        sourceEmail: "s@e.com",
      });

      const callArgs = MockSendEmailCommand.mock.calls[0][0];
      expect(callArgs.Message.Body).toEqual({
        Text: { Data: "TextContent", Charset: "UTF-8" },
      });
    });

    it("should construct body with HTML only", async () => {
      mockSend.mockResolvedValue({});

      await emailModule.sendEmail({
        to: "u@e.com",
        subject: "S",
        htmlBody: "<p>HtmlContent</p>",
        sourceEmail: "s@e.com",
      });

      const callArgs = MockSendEmailCommand.mock.calls[0][0];
      expect(callArgs.Message.Body).toEqual({
        Html: { Data: "<p>HtmlContent</p>", Charset: "UTF-8" },
      });
    });

    it("should handle ReplyTo addresses", async () => {
      mockSend.mockResolvedValue({});

      await emailModule.sendEmail({
        to: "u@e.com",
        subject: "S",
        textBody: "B",
        sourceEmail: "s@e.com",
        replyTo: ["reply@e.com"],
      });

      expect(MockSendEmailCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          ReplyToAddresses: ["reply@e.com"],
        }),
      );
    });

    it("should handle undefined ReplyTo addresses", async () => {
      mockSend.mockResolvedValue({});

      await emailModule.sendEmail({
        to: "u@e.com",
        subject: "S",
        textBody: "B",
        sourceEmail: "s@e.com",
        replyTo: undefined,
      });

      expect(MockSendEmailCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          ReplyToAddresses: undefined,
        }),
      );
    });

    it("should log and rethrow error on SES failure", async () => {
      const error = new Error("AWS Error");
      mockSend.mockRejectedValue(error);

      await expect(
        emailModule.sendEmail({
          to: "u@e.com",
          subject: "S",
          textBody: "B",
          sourceEmail: "s@e.com",
        }),
      ).rejects.toThrow("AWS Error");
    });
  });

  describe("sendEmailTemplate", () => {
    it("should render template and call sendEmail", async () => {
      mockSend.mockResolvedValue({});

      await emailModule.sendEmailTemplate({
        to: "user@example.com",
        templateId: "organisationInvite",
        templateData: { some: "data" },
        sourceEmail: "source@example.com",
        replyTo: ["reply@example.com"],
        configurationSetName: "ConfigSet",
      });

      // Verify Template Renderer called
      const {
        renderEmailTemplate,
      } = require("../../src/utils/email-templates");
      expect(renderEmailTemplate).toHaveBeenCalledWith("organisationInvite", {
        some: "data",
      });

      // Verify SES Command constructed with rendered data
      expect(MockSendEmailCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Destination: { ToAddresses: ["user@example.com"] },
          Message: expect.objectContaining({
            Subject: {
              Data: "Rendered Subject for organisationInvite",
              Charset: "UTF-8",
            },
            Body: {
              Html: {
                Data: "<p>HTML for organisationInvite</p>",
                Charset: "UTF-8",
              },
              Text: { Data: "Text for organisationInvite", Charset: "UTF-8" },
            },
          }),
          ReplyToAddresses: ["reply@example.com"],
          ConfigurationSetName: "ConfigSet",
        }),
      );
    });
  });
});
