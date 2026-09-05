const mockEmailPasswordInit = jest.fn((config: unknown) => ({
  name: "emailpassword",
  config,
}));

jest.mock("supertokens-node/recipe/emailpassword", () => ({
  __esModule: true,
  default: {
    init: mockEmailPasswordInit,
  },
}));

const mockGetUserMetadata = jest.fn();

jest.mock("supertokens-node/recipe/usermetadata", () => ({
  __esModule: true,
  default: {
    init: jest.fn(() => ({ name: "usermetadata" })),
    getUserMetadata: mockGetUserMetadata,
  },
}));

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

const mockThirdPartyInit = jest.fn((config: unknown) => ({
  name: "thirdparty",
  config,
}));

jest.mock("supertokens-node/recipe/thirdparty", () => {
  const actual = jest.requireActual("supertokens-node/recipe/thirdparty");

  return {
    ...actual,
    __esModule: true,
    default: { ...actual.default, init: mockThirdPartyInit },
  };
});

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
  AUTH_APPLE_CLIENT_ID: process.env.AUTH_APPLE_CLIENT_ID,
  AUTH_APPLE_SERVICE_ID: process.env.AUTH_APPLE_SERVICE_ID,
  AUTH_APPLE_KEY_ID: process.env.AUTH_APPLE_KEY_ID,
  AUTH_APPLE_PRIVATE_KEY: process.env.AUTH_APPLE_PRIVATE_KEY,
  AUTH_APPLE_TEAM_ID: process.env.AUTH_APPLE_TEAM_ID,
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
    mockEmailPasswordInit.mockClear();
    mockGetUserMetadata.mockReset();
    mockPasswordlessInit.mockClear();
    mockThirdPartyInit.mockClear();
    delete process.env.AUTH_APPLE_CLIENT_ID;
    delete process.env.AUTH_APPLE_SERVICE_ID;
    delete process.env.AUTH_APPLE_KEY_ID;
    delete process.env.AUTH_APPLE_PRIVATE_KEY;
    delete process.env.AUTH_APPLE_TEAM_ID;
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

  it("rejects disabled email-password accounts without disclosing their state", async () => {
    process.env.SMTP_HOST = "smtp.example.test";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_SECURE = "true";
    process.env.SMTP_USER = "smtp-user";
    process.env.SMTP_PASSWORD = "smtp-password";
    process.env.SMTP_FROM_NAME = "Yosemite Crew";
    process.env.SMTP_FROM_EMAIL = "auth@example.test";
    mockGetUserMetadata.mockResolvedValue({
      metadata: { disabledAt: Date.now() },
    });

    const { getSuperTokensConfig } = require("@yosemite-crew/auth");
    getSuperTokensConfig();
    const emailPasswordConfig = mockEmailPasswordInit.mock.calls[0]?.[0] as any;
    const signIn = emailPasswordConfig.override.functions({
      signIn: jest.fn(async () => ({
        status: "OK",
        user: { id: "disabled-business-user" },
      })),
    }).signIn;

    await expect(
      signIn({
        email: "disabled@example.test",
        password: "correct-password",
        userContext: {},
      }),
    ).resolves.toEqual({ status: "WRONG_CREDENTIALS_ERROR" });
    expect(mockGetUserMetadata).toHaveBeenCalledWith("disabled-business-user");
  });

  it("keeps active and failed email-password sign-ins unchanged", async () => {
    process.env.SMTP_HOST = "smtp.example.test";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_SECURE = "true";
    process.env.SMTP_USER = "smtp-user";
    process.env.SMTP_PASSWORD = "smtp-password";
    process.env.SMTP_FROM_NAME = "Yosemite Crew";
    process.env.SMTP_FROM_EMAIL = "auth@example.test";
    mockGetUserMetadata.mockResolvedValue({ metadata: {} });

    const { getSuperTokensConfig } = require("@yosemite-crew/auth");
    getSuperTokensConfig();
    const emailPasswordConfig = mockEmailPasswordInit.mock.calls[0]?.[0] as any;
    const originalSignIn = jest
      .fn()
      .mockResolvedValueOnce({ status: "WRONG_CREDENTIALS_ERROR" })
      .mockResolvedValueOnce({
        status: "OK",
        user: { id: "active-business-user" },
      });
    const signIn = emailPasswordConfig.override.functions({
      signIn: originalSignIn,
    }).signIn;

    await expect(
      signIn({
        email: "unknown@example.test",
        password: "wrong",
        userContext: {},
      }),
    ).resolves.toEqual({ status: "WRONG_CREDENTIALS_ERROR" });
    await expect(
      signIn({
        email: "active@example.test",
        password: "correct",
        userContext: {},
      }),
    ).resolves.toEqual({ status: "OK", user: { id: "active-business-user" } });
    expect(mockGetUserMetadata).toHaveBeenCalledTimes(1);
    expect(mockGetUserMetadata).toHaveBeenCalledWith("active-business-user");
  });
  describe("apple id_token audience selection", () => {
    const BUNDLE_ID = "com.example.mobile";
    const SERVICE_ID = "com.example.mobile.auth";

    const makeIdToken = (aud: unknown): string =>
      [
        "eyJhbGciOiJSUzI1NiJ9",
        Buffer.from(JSON.stringify({ aud })).toString("base64url"),
        "signature",
      ].join(".");

    const buildAppleProvider = (options: { serviceId?: string } = {}) => {
      process.env.SMTP_HOST = "smtp.example.test";
      process.env.SMTP_PORT = "465";
      process.env.SMTP_SECURE = "true";
      process.env.SMTP_USER = "smtp-user";
      process.env.SMTP_PASSWORD = "smtp-password";
      process.env.SMTP_FROM_NAME = "Yosemite Crew";
      process.env.SMTP_FROM_EMAIL = "auth@example.test";
      process.env.AUTH_APPLE_CLIENT_ID = BUNDLE_ID;
      process.env.AUTH_APPLE_KEY_ID = "KEY123";
      process.env.AUTH_APPLE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----";
      process.env.AUTH_APPLE_TEAM_ID = "TEAM123";

      if (options.serviceId) {
        process.env.AUTH_APPLE_SERVICE_ID = options.serviceId;
      }

      const { getSuperTokensConfig } = require("@yosemite-crew/auth");
      getSuperTokensConfig();

      const initArg = mockThirdPartyInit.mock.calls[0]?.[0] as any;

      return initArg.signInAndUpFeature.providers.find(
        (provider: any) => provider.config.thirdPartyId === "apple",
      );
    };

    const runGetUserInfo = async (provider: any, idToken: unknown) => {
      const audiencesVerifiedAgainst: string[] = [];
      const implementation: any = {
        type: "oauth2",
        config: { clientId: BUNDLE_ID },
        getUserInfo: jest.fn(async () => {
          audiencesVerifiedAgainst.push(implementation.config.clientId);
          return { thirdPartyUserId: "apple-user" };
        }),
      };

      const overridden = provider.override(implementation);

      await overridden.getUserInfo({ oAuthTokens: { id_token: idToken } });

      return {
        audiencesVerifiedAgainst,
        clientIdAfterCall: implementation.config.clientId,
      };
    };

    it("registers exactly one client so requests without a clientType still resolve", () => {
      const provider = buildAppleProvider({ serviceId: SERVICE_ID });

      expect(provider.config.clients).toHaveLength(1);
      expect(provider.config.clients[0].clientId).toBe(BUNDLE_ID);
    });

    it("verifies an android token against the apple service id", async () => {
      const provider = buildAppleProvider({ serviceId: SERVICE_ID });

      const { audiencesVerifiedAgainst } = await runGetUserInfo(
        provider,
        makeIdToken(SERVICE_ID),
      );

      expect(audiencesVerifiedAgainst).toEqual([SERVICE_ID]);
    });

    it("verifies an ios token against the bundle identifier", async () => {
      const provider = buildAppleProvider({ serviceId: SERVICE_ID });

      const { audiencesVerifiedAgainst } = await runGetUserInfo(
        provider,
        makeIdToken(BUNDLE_ID),
      );

      expect(audiencesVerifiedAgainst).toEqual([BUNDLE_ID]);
    });

    it("accepts an audience supplied as an array", async () => {
      const provider = buildAppleProvider({ serviceId: SERVICE_ID });

      const { audiencesVerifiedAgainst } = await runGetUserInfo(
        provider,
        makeIdToken([SERVICE_ID]),
      );

      expect(audiencesVerifiedAgainst).toEqual([SERVICE_ID]);
    });

    it("matches an allowed audience that is not first in the array", async () => {
      const provider = buildAppleProvider({ serviceId: SERVICE_ID });

      const { audiencesVerifiedAgainst } = await runGetUserInfo(
        provider,
        makeIdToken(["https://appleid.apple.com", SERVICE_ID]),
      );

      expect(audiencesVerifiedAgainst).toEqual([SERVICE_ID]);
    });

    it("skips non-string entries when matching the audience array", async () => {
      const provider = buildAppleProvider({ serviceId: SERVICE_ID });

      const { audiencesVerifiedAgainst } = await runGetUserInfo(
        provider,
        makeIdToken([null, 7, SERVICE_ID]),
      );

      expect(audiencesVerifiedAgainst).toEqual([SERVICE_ID]);
    });

    it.each([
      ["an audience that is not ours", makeIdToken("com.attacker.app")],
      ["a token that is not a jwt", "not-a-jwt"],
      ["a token with an unparseable payload", "header.%%%.signature"],
      ["a non-string token", 42],
      ["a missing audience claim", makeIdToken(undefined)],
      [
        "an audience array with no id of ours",
        makeIdToken(["com.attacker.app"]),
      ],
      ["an empty audience array", makeIdToken([])],
    ])(
      "falls back to the configured client id for %s",
      async (_label, token) => {
        const provider = buildAppleProvider({ serviceId: SERVICE_ID });

        const { audiencesVerifiedAgainst } = await runGetUserInfo(
          provider,
          token,
        );

        expect(audiencesVerifiedAgainst).toEqual([BUNDLE_ID]);
      },
    );

    it("ignores the service id audience when AUTH_APPLE_SERVICE_ID is unset", async () => {
      const provider = buildAppleProvider();

      const { audiencesVerifiedAgainst } = await runGetUserInfo(
        provider,
        makeIdToken(SERVICE_ID),
      );

      expect(audiencesVerifiedAgainst).toEqual([BUNDLE_ID]);
    });

    it("restores the configured client id after verification succeeds", async () => {
      const provider = buildAppleProvider({ serviceId: SERVICE_ID });

      const { clientIdAfterCall } = await runGetUserInfo(
        provider,
        makeIdToken(SERVICE_ID),
      );

      expect(clientIdAfterCall).toBe(BUNDLE_ID);
    });

    it("restores the configured client id when verification throws", async () => {
      const provider = buildAppleProvider({ serviceId: SERVICE_ID });
      const implementation: any = {
        type: "oauth2",
        config: { clientId: BUNDLE_ID },
        getUserInfo: jest.fn(async () => {
          throw new Error('unexpected "aud" claim value');
        }),
      };

      const overridden = provider.override(implementation);

      await expect(
        overridden.getUserInfo({
          oAuthTokens: { id_token: makeIdToken(SERVICE_ID) },
        }),
      ).rejects.toThrow('unexpected "aud" claim value');
      expect(implementation.config.clientId).toBe(BUNDLE_ID);
    });
  });
});
