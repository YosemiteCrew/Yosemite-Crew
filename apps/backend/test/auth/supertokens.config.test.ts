const mockPasswordlessInit = jest.fn((config: unknown) => ({
  name: "passwordless",
  config,
}));

jest.mock("supertokens-node/recipe/passwordless", () => ({
  __esModule: true,
  default: {
    init: mockPasswordlessInit,
  },
}));

const ORIGINAL_ENV = {
  AUTH_API_DOMAIN: process.env.AUTH_API_DOMAIN,
  AUTH_WEBSITE_DOMAIN: process.env.AUTH_WEBSITE_DOMAIN,
  SUPERTOKENS_CONNECTION_URI: process.env.SUPERTOKENS_CONNECTION_URI,
  DEMO_LOGIN_EMAIL: process.env.DEMO_LOGIN_EMAIL,
  DEMO_LOGIN_PASSWORD: process.env.DEMO_LOGIN_PASSWORD,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_SECURE: process.env.SMTP_SECURE,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASSWORD: process.env.SMTP_PASSWORD,
  SMTP_FROM_NAME: process.env.SMTP_FROM_NAME,
  SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL,
};

const restoreEnv = () => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
};

describe("@yosemite-crew/auth supertokens config", () => {
  beforeEach(() => {
    jest.resetModules();
    mockPasswordlessInit.mockClear();
    process.env.AUTH_API_DOMAIN = "https://api.example.com";
    process.env.AUTH_WEBSITE_DOMAIN = "https://app.example.com";
    process.env.SUPERTOKENS_CONNECTION_URI = "http://localhost:3567";
    process.env.DEMO_LOGIN_EMAIL = "";
    process.env.DEMO_LOGIN_PASSWORD = "";
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_SECURE;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
    delete process.env.SMTP_FROM_NAME;
    delete process.env.SMTP_FROM_EMAIL;
  });

  afterEach(() => {
    restoreEnv();
  });

  it("can be imported without SMTP env vars present", () => {
    expect(() => {
      require("@yosemite-crew/auth");
    }).not.toThrow();
  });

  it("throws when SMTP env vars are missing at config build time", () => {
    const { getSuperTokensConfig } = require("@yosemite-crew/auth");

    expect(() => getSuperTokensConfig()).toThrow(
      "[auth] Missing required environment variable: SMTP_HOST",
    );
  });

  it("configures the demo password and suppresses demo email delivery when the review account is enabled", async () => {
    process.env.SMTP_HOST = "smtp.example.test";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_SECURE = "true";
    process.env.SMTP_USER = "smtp-user";
    process.env.SMTP_PASSWORD = "smtp-password";
    process.env.SMTP_FROM_NAME = "Yosemite Crew";
    process.env.SMTP_FROM_EMAIL = "[email protected]";
    process.env.DEMO_LOGIN_EMAIL = "test@yosemitecrew.com";
    process.env.DEMO_LOGIN_PASSWORD = "review-password";

    const { getSuperTokensConfig } = require("@yosemite-crew/auth");
    const config = getSuperTokensConfig();
    const passwordlessRecipe = config.recipeList.find(
      (recipe: { name?: string }) => recipe.name === "passwordless",
    ) as any;

    expect(passwordlessRecipe).toBeDefined();

    const originalCreateCode = jest.fn(async (input: unknown) => input);
    const overriddenFunctions = passwordlessRecipe.config.override.functions({
      createCode: originalCreateCode,
    });

    await overriddenFunctions.createCode({ email: "test@yosemitecrew.com" });
    await overriddenFunctions.createCode({ email: "someone@example.com" });

    expect(originalCreateCode).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "test@yosemitecrew.com",
        userInputCode: "review-password",
      }),
    );
    expect(originalCreateCode).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "someone@example.com",
      }),
    );
    const secondCreateCodeCall = originalCreateCode.mock.calls[1]?.[0] as {
      userInputCode?: string;
    };
    expect(secondCreateCodeCall.userInputCode).toBeUndefined();

    const originalSendEmail = jest.fn(async (input: unknown) => input);
    const overriddenEmailDelivery =
      passwordlessRecipe.config.emailDelivery.override({
        sendEmail: originalSendEmail,
      });

    await overriddenEmailDelivery.sendEmail({
      email: "test@yosemitecrew.com",
    });
    await overriddenEmailDelivery.sendEmail({
      email: "someone@example.com",
    });

    expect(originalSendEmail).toHaveBeenCalledTimes(1);
    expect(originalSendEmail).toHaveBeenCalledWith({
      email: "someone@example.com",
    });
  });
});
