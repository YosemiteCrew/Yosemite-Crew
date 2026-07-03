import {
  describe,
  it,
  expect,
  jest,
  beforeAll,
  afterAll,
  afterEach,
} from "@jest/globals";
import { generateKeyPairSync } from "crypto";
import jwt from "jsonwebtoken";
import {
  resetLegacyVerifierForTests,
  setAuthService,
} from "@yosemite-crew/auth";

// Legacy-grace integration tests: with AUTH_LEGACY_TOKEN_GRACE=true and no
// active auth provider, residual tokens from the legacy pools must still be
// accepted - and only on routes belonging to the pool's product profile.

const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

jest.mock("jwks-rsa", () =>
  jest.fn(() => ({
    getSigningKey: async () => ({ getPublicKey: () => publicKey }),
  })),
);

import { requireWebAuth, requireMobileAuth } from "../../src/middlewares/auth";
import type { AuthenticatedRequest } from "../../src/middlewares/auth";

const REGION = "eu-central-1";
const WEB_POOL = "test-web-pool";
const MOBILE_POOL = "test-mobile-pool";

const issuerFor = (pool: string) =>
  `https://cognito-idp.${REGION}.amazonaws.com/${pool}`;

const signLegacyToken = (pool: string, claims: Record<string, unknown> = {}) =>
  jwt.sign(
    {
      sub: "legacy-user-1",
      email: "legacy@example.test",
      email_verified: true,
      given_name: "Legacy",
      family_name: "User",
      ...claims,
    },
    privateKey,
    {
      algorithm: "RS256",
      issuer: issuerFor(pool),
      keyid: "test-key",
      expiresIn: "5m",
    },
  );

const makeReqRes = (token?: string) => {
  const req = {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  } as unknown as AuthenticatedRequest;
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

describe("legacy token grace via session middleware", () => {
  beforeAll(() => {
    process.env.AUTH_LEGACY_TOKEN_GRACE = "true";
    process.env.COGNITO_REGION = REGION;
    process.env.COGNITO_USER_POOL_ID = WEB_POOL;
    process.env.COGNITO_USER_POOL_ID_MOBILE = MOBILE_POOL;
    delete process.env.COGNITO_AUDIENCE;
    setAuthService(null);
  });

  afterAll(() => {
    delete process.env.AUTH_LEGACY_TOKEN_GRACE;
    delete process.env.COGNITO_REGION;
    delete process.env.COGNITO_USER_POOL_ID;
    delete process.env.COGNITO_USER_POOL_ID_MOBILE;
    resetLegacyVerifierForTests();
  });

  afterEach(() => {
    resetLegacyVerifierForTests();
  });

  it("accepts a legacy web-pool token on web routes and normalizes the request", async () => {
    const { req, res } = makeReqRes(signLegacyToken(WEB_POOL));
    const next = jest.fn();

    await requireWebAuth(req as never, res as never, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.userId).toBe("legacy-user-1");
    expect(req.provider).toBe("cognito");
    expect(req.email).toBe("legacy@example.test");
    expect(req.emailVerified).toBe(true);
    expect(req.firstName).toBe("Legacy");
    expect(req.lastName).toBe("User");
  });

  it("accepts a legacy mobile-pool token on mobile routes", async () => {
    const { req, res } = makeReqRes(signLegacyToken(MOBILE_POOL));
    const next = jest.fn();

    await requireMobileAuth(req as never, res as never, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.userId).toBe("legacy-user-1");
    expect(req.provider).toBe("cognito");
  });

  it("rejects a legacy mobile-pool token on web routes (pool separation preserved)", async () => {
    const { req, res } = makeReqRes(signLegacyToken(MOBILE_POOL));
    const next = jest.fn();

    await requireWebAuth(req as never, res as never, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects an expired legacy token", async () => {
    const token = jwt.sign({ sub: "legacy-user-1" }, privateKey, {
      algorithm: "RS256",
      issuer: issuerFor(WEB_POOL),
      keyid: "test-key",
      expiresIn: "-5m",
    });
    const { req, res } = makeReqRes(token);
    const next = jest.fn();

    await requireWebAuth(req as never, res as never, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects requests without a bearer token", async () => {
    const { req, res } = makeReqRes();
    const next = jest.fn();

    await requireWebAuth(req as never, res as never, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});
