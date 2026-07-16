import { describe, it, expect, jest, afterEach } from "@jest/globals";
import jwt from "jsonwebtoken";
import {
  createAuthProvider,
  validateAuthConfig,
  readAuthConfig,
  AuthService,
  AuthConfigError,
  AuthRequiredError,
  createSessionMiddleware,
  setAuthService,
  isLegacyTokenGraceEnabled,
  verifyLegacyBearerToken,
  resetLegacyVerifierForTests,
  type AuthConfig,
  type AuthSession,
} from "@yosemite-crew/auth";

const validSupertokensConfig = (): AuthConfig => ({
  provider: "supertokens",
  profile: "pims_web",
  supertokens: {
    connectionUri: "https://core.example.test",
    appName: "Test",
    apiDomain: "https://api.example.test",
    websiteDomain: "https://web.example.test",
    apiBasePath: "/auth",
    websiteBasePath: "/auth",
  },
});

describe("auth boundary config validation", () => {
  it("accepts a valid supertokens config", () => {
    expect(() => validateAuthConfig(validSupertokensConfig())).not.toThrow();
  });

  it("requires a provider", () => {
    expect(() =>
      validateAuthConfig({ provider: undefined as unknown as "supertokens" }),
    ).toThrow(AuthConfigError);
  });

  it("rejects an unsupported provider", () => {
    expect(() =>
      validateAuthConfig({ provider: "nope" as unknown as "supertokens" }),
    ).toThrow(/Unsupported AUTH_PROVIDER/);
  });

  it("rejects an unsupported profile", () => {
    const config = validSupertokensConfig();
    (config as { profile: string }).profile = "bogus";
    expect(() => validateAuthConfig(config)).toThrow(
      /Unsupported AUTH_PROFILE/,
    );
  });

  it("requires a connection uri for supertokens", () => {
    const config = validSupertokensConfig();
    config.supertokens!.connectionUri = "";
    expect(() => validateAuthConfig(config)).toThrow(
      /SUPERTOKENS_CONNECTION_URI/,
    );
  });
});

describe("readAuthConfig", () => {
  it("reads provider and profile from the environment", () => {
    const config = readAuthConfig({
      AUTH_PROVIDER: "supertokens",
      AUTH_PROFILE: "pet_parent_mobile",
      SUPERTOKENS_CONNECTION_URI: "https://core.example.test",
      SUPERTOKENS_API_DOMAIN: "https://api.example.test",
      SUPERTOKENS_WEBSITE_DOMAIN: "https://web.example.test",
    } as NodeJS.ProcessEnv);

    expect(config.provider).toBe("supertokens");
    expect(config.profile).toBe("pet_parent_mobile");
    expect(config.supertokens?.connectionUri).toBe("https://core.example.test");
  });

  it("defaults the provider to supertokens", () => {
    const config = readAuthConfig({} as NodeJS.ProcessEnv);
    expect(config.provider).toBe("supertokens");
  });
});

describe("createAuthProvider", () => {
  it("returns a SuperTokens provider for AUTH_PROVIDER=supertokens", () => {
    const provider = createAuthProvider(validSupertokensConfig());
    expect(provider.name).toBe("supertokens");

    const service = new AuthService(provider);
    expect(service.providerName).toBe("supertokens");
  });

  it("throws for a recognized-but-unimplemented provider", () => {
    expect(() =>
      createAuthProvider({ provider: "oidc" } as AuthConfig),
    ).toThrow(AuthConfigError);
  });
});

describe("createSessionMiddleware", () => {
  type StubSession = Partial<AuthSession> | null;

  const stubService = (session: StubSession, error?: Error) => {
    setAuthService(
      new AuthService({
        name: "supertokens",
        getSession: async () => {
          if (error) throw error;
          return session as never;
        },
        requireSession: async () => session as never,
        signOut: async () => undefined,
      }),
    );
  };

  const makeReqRes = () => {
    const req = { headers: {} } as never;
    const res = {
      statusCode: 0,
      body: undefined as unknown,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: unknown) {
        this.body = payload;
        return this;
      },
    };
    return { req, res };
  };

  const session = (profile: "pims_web" | "pet_parent_mobile") => ({
    appUserId: "user-1",
    provider: "supertokens" as const,
    authProfile: profile,
    providerUserId: "st-user-1",
    email: "vet@example.test",
    emailVerified: true,
    firstName: "Ada",
    lastName: "Vet",
    roles: [],
    permissions: [],
    claims: { sub: "user-1" },
  });

  afterEach(() => {
    setAuthService(null);
    delete process.env.AUTH_LEGACY_TOKEN_GRACE;
  });

  it("responds 401 when no provider is configured and grace is off", async () => {
    setAuthService(null);
    const { req, res } = makeReqRes();
    const next = jest.fn();

    await createSessionMiddleware({ profile: "pims_web" })(
      req,
      res as never,
      next,
    );

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("populates the request contract and calls next on a matching session", async () => {
    stubService(session("pims_web"));
    const { req, res } = makeReqRes();
    const next = jest.fn();

    await createSessionMiddleware({ profile: "pims_web" })(
      req,
      res as never,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
    const populated = req as {
      userId?: string;
      provider?: string;
      email?: string;
      emailVerified?: boolean;
      firstName?: string;
      auth?: Record<string, unknown>;
    };
    expect(populated.userId).toBe("user-1");
    expect(populated.provider).toBe("supertokens");
    expect(populated.email).toBe("vet@example.test");
    expect(populated.emailVerified).toBe(true);
    expect(populated.firstName).toBe("Ada");
    expect(populated.auth).toEqual({ sub: "user-1" });
  });

  it("rejects a session from the other product profile with 403", async () => {
    stubService(session("pet_parent_mobile"));
    const { req, res } = makeReqRes();
    const next = jest.fn();

    await createSessionMiddleware({ profile: "pims_web" })(
      req,
      res as never,
      next,
    );

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("accepts any profile when the route does not pin one", async () => {
    stubService(session("pet_parent_mobile"));
    const { req, res } = makeReqRes();
    const next = jest.fn();

    await createSessionMiddleware()(req, res as never, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("maps neutral auth errors to their status code", async () => {
    stubService(null, new AuthRequiredError());
    const { req, res } = makeReqRes();
    const next = jest.fn();

    await createSessionMiddleware({ profile: "pims_web" })(
      req,
      res as never,
      next,
    );

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("passes unknown errors to next(err)", async () => {
    const boom = new Error("provider exploded");
    stubService(null, boom);
    const { req, res } = makeReqRes();
    const next = jest.fn();

    await createSessionMiddleware({ profile: "pims_web" })(
      req,
      res as never,
      next,
    );

    expect(next).toHaveBeenCalledWith(boom);
  });

  it("responds 401 when grace is on but the bearer token is not a legacy token", async () => {
    process.env.AUTH_LEGACY_TOKEN_GRACE = "true";
    setAuthService(null);
    const { req, res } = makeReqRes();
    (req as { headers: Record<string, string> }).headers.authorization =
      "Bearer not-a-jwt";
    const next = jest.fn();

    await createSessionMiddleware({ profile: "pims_web" })(
      req,
      res as never,
      next,
    );

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("legacy token grace verifier", () => {
  afterEach(() => {
    resetLegacyVerifierForTests();
  });

  it("is disabled unless AUTH_LEGACY_TOKEN_GRACE is exactly 'true'", () => {
    expect(isLegacyTokenGraceEnabled({} as NodeJS.ProcessEnv)).toBe(false);
    expect(
      isLegacyTokenGraceEnabled({
        AUTH_LEGACY_TOKEN_GRACE: "1",
      } as NodeJS.ProcessEnv),
    ).toBe(false);
    expect(
      isLegacyTokenGraceEnabled({
        AUTH_LEGACY_TOKEN_GRACE: "true",
      } as NodeJS.ProcessEnv),
    ).toBe(true);
  });

  it("returns null for malformed tokens", async () => {
    const result = await verifyLegacyBearerToken("garbage", {
      COGNITO_REGION: "eu-central-1",
      COGNITO_USER_POOL_ID: "pool-web",
    } as NodeJS.ProcessEnv);
    expect(result).toBeNull();
  });

  it("returns null for tokens from an unknown issuer", async () => {
    const token = jwt.sign(
      { sub: "someone", iss: "https://issuer.example.test" },
      "test-secret",
    );
    const result = await verifyLegacyBearerToken(token, {
      COGNITO_REGION: "eu-central-1",
      COGNITO_USER_POOL_ID: "pool-web",
    } as NodeJS.ProcessEnv);
    expect(result).toBeNull();
  });

  it("returns null when no legacy issuers are configured", async () => {
    const token = jwt.sign(
      { sub: "someone", iss: "https://issuer.example.test" },
      "test-secret",
    );
    const result = await verifyLegacyBearerToken(
      token,
      {} as NodeJS.ProcessEnv,
    );
    expect(result).toBeNull();
  });
});
