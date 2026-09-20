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
  TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
};

const ORIGINAL_FETCH = globalThis.fetch;

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
    delete process.env.TURNSTILE_SECRET_KEY;
    globalThis.fetch = ORIGINAL_FETCH;
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

  describe("business signup abuse controls", () => {
    const configureProtectedSignup = () => {
      process.env.SMTP_HOST = "smtp.example.test";
      process.env.SMTP_PORT = "465";
      process.env.SMTP_SECURE = "true";
      process.env.SMTP_USER = "smtp-user";
      process.env.SMTP_PASSWORD = "smtp-password";
      process.env.SMTP_FROM_NAME = "Yosemite Crew";
      process.env.SMTP_FROM_EMAIL = "auth@example.test";
      process.env.TURNSTILE_SECRET_KEY = "unit-test-only";

      const { getSuperTokensConfig } = require("@yosemite-crew/auth");
      getSuperTokensConfig();
      return mockEmailPasswordInit.mock.calls[0]?.[0] as any;
    };

    const successfulVerification = () => {
      globalThis.fetch = jest.fn(async () => ({
        ok: true,
        json: async () => ({
          success: true,
          action: "business_signup",
          hostname: "app.example.com",
        }),
      })) as unknown as typeof fetch;
    };

    const signUpInput = (email = "First.Last+wave@GoogleMail.com") => ({
      formFields: [
        { id: "email", value: email },
        { id: "password", value: "synthetic-test-value" },
        { id: "turnstileToken", value: "verified-token" },
      ],
      tenantId: "public",
      session: undefined,
      shouldTryLinkingWithSessionUser: undefined,
      options: { req: { original: { ip: "192.0.2.10" } } },
      userContext: {},
    });

    it("registers the bot token field, validates it, and canonicalizes Gmail before signup", async () => {
      successfulVerification();
      const config = configureProtectedSignup();
      const originalSignUpPOST = jest.fn(async () => ({ status: "OK" }));
      const signUpPOST = config.override.apis({
        signUpPOST: originalSignUpPOST,
      }).signUpPOST;

      await expect(signUpPOST(signUpInput())).resolves.toEqual({
        status: "OK",
      });

      const botField = config.signUpFeature.formFields.find(
        (field: { id: string }) => field.id === "turnstileToken",
      );
      expect(botField.optional).toBe(true);
      await expect(
        botField.validate("x".repeat(2049), "public", {}),
      ).resolves.toBe("Complete bot verification before creating an account.");
      expect(originalSignUpPOST).toHaveBeenCalledWith(
        expect.objectContaining({
          formFields: expect.arrayContaining([
            { id: "email", value: "firstlast@gmail.com" },
          ]),
        }),
      );

      const verificationRequest = (globalThis.fetch as jest.Mock).mock.calls[0];
      expect(verificationRequest[0]).toBe(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      );
      const verificationBody = verificationRequest[1].body as URLSearchParams;
      expect(verificationBody.get("response")).toBe("verified-token");
      expect(verificationBody.get("remoteip")).toBe("192.0.2.10");
    });

    it.each([
      [
        "an invalid token",
        {
          success: false,
          action: "business_signup",
          hostname: "app.example.com",
        },
      ],
      [
        "a token minted for another action",
        { success: true, action: "contact_form", hostname: "app.example.com" },
      ],
      [
        "a token minted for another hostname",
        {
          success: true,
          action: "business_signup",
          hostname: "attacker.example",
        },
      ],
    ])("refuses signup for %s", async (_label, verificationResult) => {
      globalThis.fetch = jest.fn(async () => ({
        ok: true,
        json: async () => verificationResult,
      })) as unknown as typeof fetch;
      const config = configureProtectedSignup();
      const originalSignUpPOST = jest.fn(async () => ({ status: "OK" }));
      const signUpPOST = config.override.apis({
        signUpPOST: originalSignUpPOST,
      }).signUpPOST;

      await expect(signUpPOST(signUpInput())).resolves.toEqual({
        status: "SIGN_UP_NOT_ALLOWED",
        reason:
          "We could not verify this signup. Please refresh and try again.",
      });
      expect(originalSignUpPOST).not.toHaveBeenCalled();
    });

    it("refuses signup when the bot token is missing", async () => {
      successfulVerification();
      const config = configureProtectedSignup();
      const originalSignUpPOST = jest.fn(async () => ({ status: "OK" }));
      const signUpPOST = config.override.apis({
        signUpPOST: originalSignUpPOST,
      }).signUpPOST;
      const input = signUpInput();
      input.formFields = input.formFields.filter(
        (field) => field.id !== "turnstileToken",
      );

      await expect(signUpPOST(input)).resolves.toMatchObject({
        status: "SIGN_UP_NOT_ALLOWED",
      });
      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(originalSignUpPOST).not.toHaveBeenCalled();
    });

    it("refuses an oversized bot token before calling Turnstile", async () => {
      successfulVerification();
      const config = configureProtectedSignup();
      const originalSignUpPOST = jest.fn(async () => ({ status: "OK" }));
      const signUpPOST = config.override.apis({
        signUpPOST: originalSignUpPOST,
      }).signUpPOST;
      const input = signUpInput();
      input.formFields.find((field) => field.id === "turnstileToken")!.value =
        "x".repeat(2049);

      await expect(signUpPOST(input)).resolves.toMatchObject({
        status: "SIGN_UP_NOT_ALLOWED",
      });
      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(originalSignUpPOST).not.toHaveBeenCalled();
    });

    it("fails closed when Turnstile is unavailable", async () => {
      globalThis.fetch = jest.fn(async () => {
        throw new Error("synthetic network failure");
      }) as unknown as typeof fetch;
      const consoleError = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const config = configureProtectedSignup();
      const originalSignUpPOST = jest.fn(async () => ({ status: "OK" }));
      const signUpPOST = config.override.apis({
        signUpPOST: originalSignUpPOST,
      }).signUpPOST;

      await expect(signUpPOST(signUpInput())).resolves.toMatchObject({
        status: "SIGN_UP_NOT_ALLOWED",
      });
      expect(originalSignUpPOST).not.toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledWith(
        "[auth] Turnstile verification failed",
        expect.any(Error),
      );
      consoleError.mockRestore();
    });

    it("fails closed when Turnstile returns a non-successful response", async () => {
      globalThis.fetch = jest.fn(async () => ({
        ok: false,
        json: async () => ({
          success: true,
          action: "business_signup",
          hostname: "app.example.com",
        }),
      })) as unknown as typeof fetch;
      const config = configureProtectedSignup();
      const originalSignUpPOST = jest.fn(async () => ({ status: "OK" }));
      const signUpPOST = config.override.apis({
        signUpPOST: originalSignUpPOST,
      }).signUpPOST;

      await expect(signUpPOST(signUpInput())).resolves.toMatchObject({
        status: "SIGN_UP_NOT_ALLOWED",
      });
      expect(originalSignUpPOST).not.toHaveBeenCalled();
    });

    it("tries an exact legacy Gmail alias before the canonical sign-in", async () => {
      successfulVerification();
      const config = configureProtectedSignup();
      const originalSignInPOST = jest.fn(async () => ({ status: "OK" }));
      const signInPOST = config.override.apis({
        signInPOST: originalSignInPOST,
      }).signInPOST;
      const aliasField = [
        { id: "email", value: "First.Last+wave@GoogleMail.com" },
      ];

      await signInPOST({ formFields: aliasField });

      expect(originalSignInPOST).toHaveBeenCalledTimes(1);
      expect(originalSignInPOST).toHaveBeenCalledWith(
        expect.objectContaining({ formFields: aliasField }),
      );
    });

    it("falls back to the canonical Gmail address for sign-in", async () => {
      successfulVerification();
      const config = configureProtectedSignup();
      const originalSignInPOST = jest
        .fn()
        .mockResolvedValueOnce({ status: "WRONG_CREDENTIALS_ERROR" })
        .mockResolvedValueOnce({ status: "OK" });
      const originalEmailExistsGET = jest.fn(async () => ({
        status: "OK",
        exists: false,
      }));
      const signInPOST = config.override.apis({
        signInPOST: originalSignInPOST,
        emailExistsGET: originalEmailExistsGET,
      }).signInPOST;

      await expect(signInPOST(signUpInput())).resolves.toEqual({
        status: "OK",
      });

      expect(originalSignInPOST).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          formFields: expect.arrayContaining([
            { id: "email", value: "firstlast@gmail.com" },
          ]),
        }),
      );
    });

    it("does not fall through to a canonical sibling after a legacy alias rejects the password", async () => {
      successfulVerification();
      const config = configureProtectedSignup();
      const originalSignInPOST = jest.fn(async () => ({
        status: "WRONG_CREDENTIALS_ERROR",
      }));
      const originalEmailExistsGET = jest.fn(async () => ({
        status: "OK",
        exists: true,
      }));
      const signInPOST = config.override.apis({
        signInPOST: originalSignInPOST,
        emailExistsGET: originalEmailExistsGET,
      }).signInPOST;

      await expect(signInPOST(signUpInput())).resolves.toEqual({
        status: "WRONG_CREDENTIALS_ERROR",
      });

      expect(originalSignInPOST).toHaveBeenCalledTimes(1);
      expect(originalEmailExistsGET).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "First.Last+wave@GoogleMail.com",
        }),
      );
    });

    it("uses the canonical Gmail address for password reset when no legacy alias exists", async () => {
      successfulVerification();
      const config = configureProtectedSignup();
      const originalResetPOST = jest.fn(async () => ({ status: "OK" }));
      const originalEmailExistsGET = jest.fn(async () => ({
        status: "OK",
        exists: false,
      }));
      const resetPOST = config.override.apis({
        generatePasswordResetTokenPOST: originalResetPOST,
        emailExistsGET: originalEmailExistsGET,
      }).generatePasswordResetTokenPOST;

      await resetPOST(signUpInput());

      expect(originalResetPOST).toHaveBeenCalledWith(
        expect.objectContaining({
          formFields: expect.arrayContaining([
            { id: "email", value: "firstlast@gmail.com" },
          ]),
        }),
      );
    });

    it("preserves an exact legacy Gmail alias for password reset", async () => {
      successfulVerification();
      const config = configureProtectedSignup();
      const originalResetPOST = jest.fn(async () => ({ status: "OK" }));
      const originalEmailExistsGET = jest.fn(async () => ({
        status: "OK",
        exists: true,
      }));
      const resetPOST = config.override.apis({
        generatePasswordResetTokenPOST: originalResetPOST,
        emailExistsGET: originalEmailExistsGET,
      }).generatePasswordResetTokenPOST;
      const input = signUpInput();

      await resetPOST(input);

      expect(originalEmailExistsGET).toHaveBeenCalledTimes(1);
      expect(originalResetPOST).toHaveBeenCalledWith(input);
    });

    it("reports canonical Gmail accounts through the email-exists API", async () => {
      successfulVerification();
      const config = configureProtectedSignup();
      const originalEmailExistsGET = jest
        .fn()
        .mockResolvedValueOnce({ status: "OK", exists: false })
        .mockResolvedValueOnce({ status: "OK", exists: true });
      const emailExistsGET = config.override.apis({
        emailExistsGET: originalEmailExistsGET,
      }).emailExistsGET;

      await expect(
        emailExistsGET({ email: "First.Last+wave@GoogleMail.com" }),
      ).resolves.toEqual({ status: "OK", exists: true });
      expect(originalEmailExistsGET).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ email: "firstlast@gmail.com" }),
      );
    });

    it("allows local signup when Turnstile is not configured", async () => {
      process.env.SMTP_HOST = "smtp.example.test";
      process.env.SMTP_PORT = "465";
      process.env.SMTP_USER = "smtp-user";
      process.env.SMTP_PASSWORD = "smtp-password";
      process.env.SMTP_FROM_EMAIL = "auth@example.test";
      globalThis.fetch = jest.fn() as unknown as typeof fetch;

      const { getSuperTokensConfig } = require("@yosemite-crew/auth");
      getSuperTokensConfig();
      const config = mockEmailPasswordInit.mock.calls[0]?.[0] as any;
      const originalSignUpPOST = jest.fn(async () => ({ status: "OK" }));
      const signUpPOST = config.override.apis({
        signUpPOST: originalSignUpPOST,
      }).signUpPOST;

      await expect(signUpPOST(signUpInput())).resolves.toEqual({
        status: "OK",
      });
      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(originalSignUpPOST).toHaveBeenCalledTimes(1);
    });

    it("blocks only signup when the Turnstile secret is missing in production", async () => {
      process.env.SMTP_HOST = "smtp.example.test";
      process.env.SMTP_PORT = "465";
      process.env.SMTP_USER = "smtp-user";
      process.env.SMTP_PASSWORD = "smtp-password";
      process.env.SMTP_FROM_EMAIL = "auth@example.test";
      const originalNodeEnv = process.env.NODE_ENV;
      (process.env as Record<string, string | undefined>).NODE_ENV =
        "production";
      globalThis.fetch = jest.fn() as unknown as typeof fetch;

      try {
        const { getSuperTokensConfig } = require("@yosemite-crew/auth");
        getSuperTokensConfig();
        const config = mockEmailPasswordInit.mock.calls[0]?.[0] as any;
        const originalSignUpPOST = jest.fn(async () => ({ status: "OK" }));
        const originalSignInPOST = jest.fn(async () => ({ status: "OK" }));
        const apis = config.override.apis({
          signUpPOST: originalSignUpPOST,
          signInPOST: originalSignInPOST,
        });

        await expect(apis.signUpPOST(signUpInput())).resolves.toEqual({
          status: "SIGN_UP_NOT_ALLOWED",
          reason:
            "We could not verify this signup. Please refresh and try again.",
        });
        await expect(
          apis.signInPOST({
            formFields: [{ id: "email", value: "member@example.test" }],
          }),
        ).resolves.toEqual({ status: "OK" });
        expect(globalThis.fetch).not.toHaveBeenCalled();
        expect(originalSignUpPOST).not.toHaveBeenCalled();
        expect(originalSignInPOST).toHaveBeenCalledTimes(1);
      } finally {
        (process.env as Record<string, string | undefined>).NODE_ENV =
          originalNodeEnv;
      }
    });
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
        recipeUserId: { getAsString: () => "recipe-disabled-business" },
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
        recipeUserId: { getAsString: () => "recipe-active-business" },
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
    ).resolves.toEqual(
      expect.objectContaining({
        status: "OK",
        user: { id: "active-business-user" },
      }),
    );
    expect(mockGetUserMetadata).toHaveBeenCalledTimes(1);
    expect(mockGetUserMetadata).toHaveBeenCalledWith("active-business-user");
  });
  describe("organisation-disable enforcement is wired to every sign-in path", () => {
    // The previous implementation of this feature was rejected for proving a
    // branch instead of an enforcement: its tests mocked the very signal they
    // asserted on, and returned from the metadata check before reaching the
    // host hook at all. These tests do the opposite - metadata is clean, so
    // the ONLY thing that can refuse the sign-in is `isSignInBlocked`, and a
    // recipe that never calls it fails here.
    const setSmtpEnv = () => {
      process.env.SMTP_HOST = "smtp.example.test";
      process.env.SMTP_PORT = "465";
      process.env.SMTP_SECURE = "true";
      process.env.SMTP_USER = "smtp-user";
      process.env.SMTP_PASSWORD = "smtp-password";
      process.env.SMTP_FROM_NAME = "Yosemite Crew";
      process.env.SMTP_FROM_EMAIL = "auth@example.test";
    };

    const buildWithHook = (blocked: boolean) => {
      setSmtpEnv();
      // A third-party provider must be configured or ThirdParty.init is never
      // called and the social path cannot be reached.
      process.env.AUTH_APPLE_CLIENT_ID = "com.example.mobile";
      process.env.AUTH_APPLE_KEY_ID = "KEY123";
      process.env.AUTH_APPLE_PRIVATE_KEY =
        "synthetic-private-key-for-config-test";
      process.env.AUTH_APPLE_TEAM_ID = "TEAM123";
      mockGetUserMetadata.mockResolvedValue({ metadata: {} });

      const {
        getSuperTokensConfig,
        setAuthHooks,
      } = require("@yosemite-crew/auth");
      const isSignInBlocked = jest.fn(async () => blocked);
      setAuthHooks({ isSignInBlocked });
      getSuperTokensConfig();

      return { isSignInBlocked };
    };

    const overriddenPasswordless = () => {
      const config = mockPasswordlessInit.mock.calls[0]?.[0] as any;
      return config.override.functions({
        consumeCode: jest.fn(async () => ({
          status: "OK",
          user: {
            id: "disabled-otp-user",
            emails: ["staff@example.test"],
          },
          recipeUserId: { getAsString: () => "recipe-otp" },
          createdNewRecipeUser: false,
        })),
      });
    };

    const overriddenThirdParty = () => {
      const initArg = mockThirdPartyInit.mock.calls[0]?.[0] as any;
      return initArg.override.functions({
        signInUp: jest.fn(async () => ({
          status: "OK",
          user: { id: "disabled-social-user" },
          recipeUserId: { getAsString: () => "recipe-social" },
          createdNewRecipeUser: false,
        })),
      });
    };

    const overriddenEmailPassword = () => {
      const config = mockEmailPasswordInit.mock.calls[0]?.[0] as any;
      return config.override.functions({
        signIn: jest.fn(async () => ({
          status: "OK",
          user: { id: "disabled-staff-user" },
          recipeUserId: { getAsString: () => "recipe-staff" },
        })),
      });
    };

    it("refuses an email-password sign-in on the host hook alone", async () => {
      const { isSignInBlocked } = buildWithHook(true);

      await expect(
        overriddenEmailPassword().signIn({
          email: "staff@example.test",
          password: "correct-password",
          userContext: {},
        }),
      ).resolves.toEqual({ status: "WRONG_CREDENTIALS_ERROR" });
      expect(isSignInBlocked).toHaveBeenCalledWith(
        expect.objectContaining({
          appUserId: "disabled-staff-user",
          providerUserId: "recipe-staff",
          loginMethod: "emailpassword",
        }),
      );
    });

    it("refuses a correct email code for a disabled organisation", async () => {
      // RESTART_FLOW_ERROR, not an incorrect-code status: it is the only
      // refusal this recipe offers that carries no attempt counters, so it
      // does not tell the caller whether the code itself was right.
      const { isSignInBlocked } = buildWithHook(true);

      await expect(
        overriddenPasswordless().consumeCode({
          email: "staff@example.test",
          userContext: {},
        }),
      ).resolves.toEqual({ status: "RESTART_FLOW_ERROR" });
      expect(isSignInBlocked).toHaveBeenCalledWith(
        expect.objectContaining({
          appUserId: "disabled-otp-user",
          providerUserId: "recipe-otp",
          loginMethod: "otp-email",
        }),
      );
    });

    it("refuses a social sign-in the provider has already vouched for", async () => {
      const { isSignInBlocked } = buildWithHook(true);

      await expect(
        overriddenThirdParty().signInUp({
          thirdPartyId: "apple",
          email: "staff@example.test",
          userContext: {},
        }),
      ).resolves.toEqual({
        status: "SIGN_IN_UP_NOT_ALLOWED",
        reason: "Sign in is not available for this account.",
      });
      expect(isSignInBlocked).toHaveBeenCalledWith(
        expect.objectContaining({
          appUserId: "disabled-social-user",
          providerUserId: "recipe-social",
          loginMethod: "thirdparty-apple",
        }),
      );
    });

    it("lets all three paths through when the hook says the account is live", async () => {
      const { isSignInBlocked } = buildWithHook(false);

      await expect(
        overriddenEmailPassword().signIn({
          email: "staff@example.test",
          password: "correct-password",
          userContext: {},
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          status: "OK",
          user: { id: "disabled-staff-user" },
        }),
      );
      await expect(
        overriddenPasswordless().consumeCode({
          email: "staff@example.test",
          userContext: {},
        }),
      ).resolves.toEqual(expect.objectContaining({ status: "OK" }));
      await expect(
        overriddenThirdParty().signInUp({
          thirdPartyId: "apple",
          email: "staff@example.test",
          userContext: {},
        }),
      ).resolves.toEqual(expect.objectContaining({ status: "OK" }));
      expect(isSignInBlocked).toHaveBeenCalledTimes(3);
    });

    it("does not refuse a sign-in when the hook throws", async () => {
      // Fail OPEN, deliberately and unlike the rest of this change: a database
      // blip must not lock every user out of the product, and the account
      // state it would have reported is still enforced on every authorised
      // request afterwards.
      setSmtpEnv();
      mockGetUserMetadata.mockResolvedValue({ metadata: {} });
      const consoleError = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const {
        getSuperTokensConfig,
        setAuthHooks,
      } = require("@yosemite-crew/auth");
      setAuthHooks({
        isSignInBlocked: jest.fn(async () => {
          throw new Error("database unavailable");
        }),
      });
      getSuperTokensConfig();

      await expect(
        overriddenEmailPassword().signIn({
          email: "staff@example.test",
          password: "correct-password",
          userContext: {},
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          status: "OK",
          user: { id: "disabled-staff-user" },
        }),
      );
      expect(consoleError).toHaveBeenCalledWith(
        "[auth] isSignInBlocked hook failed",
        expect.any(Error),
      );
      consoleError.mockRestore();
    });
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
      process.env.AUTH_APPLE_PRIVATE_KEY =
        "synthetic-private-key-for-config-test";
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
