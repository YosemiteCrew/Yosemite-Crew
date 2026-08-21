import crypto from "node:crypto";

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import {
  isLicenseTokenValid,
  verifyLicenseToken,
} from "src/services/ap-license.service";

// The service caches the JWKS and the revocation list at module scope for 24h.
// Tests whose outcome depends on the *contents* of those caches (a 500 from the
// JWKS endpoint, a revoked-jti list) must run against a freshly-imported module
// so a prior test's successful fetch has not already populated the cache.
async function withFreshModule<T>(
  run: (mod: typeof import("src/services/ap-license.service")) => Promise<T>,
): Promise<T> {
  let result!: T;
  await jest.isolateModulesAsync(async () => {
    const mod = await import("src/services/ap-license.service");
    result = await run(mod);
  });
  return result;
}

const KID = "test-kid";
const ACTOR_URI = "https://clinic.example.com/ap/organizations/org-1";

function base64url(buf: Buffer | string): string {
  return Buffer.from(buf)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
});

// The JWKS endpoint advertises the public half of the signing key.
const signingJwk = {
  ...publicKey.export({ format: "jwk" }),
  kid: KID,
  use: "sig",
  alg: "RS256",
};

type ClaimOverrides = Partial<{
  iss: string;
  aud: string;
  jti: string;
  iat: number;
  exp: number;
  orgId: string;
  instanceDomain: string;
  tier: string;
  keyId: string;
}>;

function makeToken(
  claimsOverride: ClaimOverrides = {},
  headerOverride: Record<string, unknown> = {},
  signWith: crypto.KeyObject = privateKey,
): string {
  const header = { alg: "RS256", typ: "JWT", kid: KID, ...headerOverride };
  const nowSecs = Math.floor(Date.now() / 1000);
  const claims = {
    iss: "yosemitecrew.com",
    aud: "activitypub",
    jti: "jti-1",
    iat: nowSecs - 60,
    exp: nowSecs + 3600,
    orgId: "org-1",
    instanceDomain: "clinic.example.com",
    tier: "verified",
    keyId: "key-1",
    ...claimsOverride,
  };
  const encHeader = base64url(JSON.stringify(header));
  const encPayload = base64url(JSON.stringify(claims));
  const signingInput = `${encHeader}.${encPayload}`;

  if (header.alg === "none") {
    return `${signingInput}.`;
  }
  if (header.alg === "HS256") {
    const sig = crypto
      .createHmac("sha256", "shared-secret")
      .update(signingInput)
      .digest();
    return `${signingInput}.${base64url(sig)}`;
  }
  const sig = crypto.sign("RSA-SHA256", Buffer.from(signingInput), signWith);
  return `${signingInput}.${base64url(sig)}`;
}

function mockFetch(opts?: { revoked?: string[]; jwks?: unknown }) {
  const jwks = opts?.jwks ?? { keys: [signingJwk] };
  const revoked = { revokedJtis: opts?.revoked ?? [] };
  (global.fetch as unknown as jest.Mock) = jest.fn((url: string) => {
    const body = url.includes("revoked") ? revoked : jwks;
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(body),
    });
  });
}

describe("ap-license.service", () => {
  beforeEach(() => {
    jest.resetModules();
    mockFetch();
    // Reset the module-level jwk/revoked caches by re-importing is heavy; the
    // caches only ever grow more permissive within a run, and each test that
    // depends on cache contents controls its own fetch mock before the call.
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("verifyLicenseToken (valid path)", () => {
    it("returns the claims for a well-formed, signed, unexpired token", async () => {
      const claims = await verifyLicenseToken(makeToken(), ACTOR_URI);
      expect(claims.orgId).toBe("org-1");
      expect(claims.iss).toBe("yosemitecrew.com");
    });

    it("accepts when the actor URI has a scheme and path (domain extracted)", async () => {
      await expect(
        verifyLicenseToken(makeToken(), "https://Clinic.Example.com/ap/x"),
      ).resolves.toBeDefined();
    });
  });

  describe("verifyLicenseToken (rejections)", () => {
    it("rejects a token that does not have three parts", async () => {
      await expect(verifyLicenseToken("a.b", ACTOR_URI)).rejects.toThrow(
        /Invalid JWT format/,
      );
    });

    it("pins the algorithm: rejects alg=none", async () => {
      await expect(
        verifyLicenseToken(makeToken({}, { alg: "none" }), ACTOR_URI),
      ).rejects.toThrow(/Unsupported algorithm/);
    });

    it("pins the algorithm: rejects alg=HS256", async () => {
      await expect(
        verifyLicenseToken(makeToken({}, { alg: "HS256" }), ACTOR_URI),
      ).rejects.toThrow(/Unsupported algorithm/);
    });

    it("rejects an unknown kid not present in the JWKS", async () => {
      await expect(
        verifyLicenseToken(makeToken({}, { kid: "other-kid" }), ACTOR_URI),
      ).rejects.toThrow(/Unknown kid/);
    });

    it("rejects a token signed by a different key (bad signature)", async () => {
      const other = crypto.generateKeyPairSync("rsa", {
        modulusLength: 2048,
      }).privateKey;
      await expect(
        verifyLicenseToken(makeToken({}, {}, other), ACTOR_URI),
      ).rejects.toThrow(/Invalid license token signature/);
    });

    it("rejects a wrong issuer", async () => {
      await expect(
        verifyLicenseToken(makeToken({ iss: "evil.com" }), ACTOR_URI),
      ).rejects.toThrow(/Unexpected issuer/);
    });

    it("rejects a wrong audience", async () => {
      await expect(
        verifyLicenseToken(makeToken({ aud: "other" }), ACTOR_URI),
      ).rejects.toThrow(/Unexpected audience/);
    });

    it("rejects an expired token", async () => {
      const past = Math.floor(Date.now() / 1000) - 10;
      await expect(
        verifyLicenseToken(makeToken({ exp: past }), ACTOR_URI),
      ).rejects.toThrow(/expired/);
    });

    it("rejects a domain mismatch between token and actor", async () => {
      await expect(
        verifyLicenseToken(
          makeToken({ instanceDomain: "other.example.com" }),
          ACTOR_URI,
        ),
      ).rejects.toThrow(/Domain mismatch/);
    });

    it("rejects a revoked jti", async () => {
      mockFetch({ revoked: ["jti-1"] });
      await withFreshModule((mod) =>
        expect(
          mod.verifyLicenseToken(makeToken({ jti: "jti-1" }), ACTOR_URI),
        ).rejects.toThrow(/revoked/),
      );
    });

    it("throws when the JWKS endpoint is not ok", async () => {
      (global.fetch as unknown as jest.Mock) = jest.fn(() =>
        Promise.resolve({ ok: false, status: 500, json: () => ({}) }),
      );
      await withFreshModule((mod) =>
        expect(mod.verifyLicenseToken(makeToken(), ACTOR_URI)).rejects.toThrow(
          /HTTP 500/,
        ),
      );
    });
  });

  describe("isLicenseTokenValid", () => {
    it("returns false for a null token without fetching", async () => {
      const spy = jest.fn();
      (global.fetch as unknown as jest.Mock) = spy;
      await expect(isLicenseTokenValid(null, ACTOR_URI)).resolves.toBe(false);
      expect(spy).not.toHaveBeenCalled();
    });

    it("returns false for an undefined token", async () => {
      await expect(isLicenseTokenValid(undefined, ACTOR_URI)).resolves.toBe(
        false,
      );
    });

    it("returns false for an expired token", async () => {
      const past = Math.floor(Date.now() / 1000) - 10;
      await expect(
        isLicenseTokenValid(makeToken({ exp: past }), ACTOR_URI),
      ).resolves.toBe(false);
    });

    it("returns false for a wrong-issuer token", async () => {
      await expect(
        isLicenseTokenValid(makeToken({ iss: "evil.com" }), ACTOR_URI),
      ).resolves.toBe(false);
    });

    it("returns false for a revoked token", async () => {
      mockFetch({ revoked: ["jti-1"] });
      await withFreshModule((mod) =>
        expect(
          mod.isLicenseTokenValid(makeToken({ jti: "jti-1" }), ACTOR_URI),
        ).resolves.toBe(false),
      );
    });

    it("returns true for a valid token", async () => {
      await expect(isLicenseTokenValid(makeToken(), ACTOR_URI)).resolves.toBe(
        true,
      );
    });
  });

  describe("actor identity binding", () => {
    // Actor documents publish their licence token, and several clinics can
    // share one instance domain, so a domain-only check let a neighbour on the
    // same host present a copied token and pass as its owner.
    it("rejects a token issued to a different org on the same domain", async () => {
      await expect(
        verifyLicenseToken(
          makeToken({ orgId: "org-victim" }),
          "https://clinic.example.com/ap/organizations/org-attacker",
        ),
      ).rejects.toThrow(/orgId mismatch/);
    });

    it("accepts the token for the actor it was issued to", async () => {
      const claims = await verifyLicenseToken(
        makeToken({ orgId: "org-1" }),
        "https://clinic.example.com/ap/organizations/org-1",
      );
      expect(claims.orgId).toBe("org-1");
    });

    it("still accepts a bare instance base URL, which names no organisation", async () => {
      // Local self-verification passes apBaseUrl(), which has nothing to bind
      // to; the domain comparison is the whole check there.
      const claims = await verifyLicenseToken(
        makeToken(),
        "https://clinic.example.com",
      );
      expect(claims.orgId).toBe("org-1");
    });

    it("isLicenseTokenValid reports false for a mismatched actor", async () => {
      await expect(
        isLicenseTokenValid(
          makeToken({ orgId: "org-victim" }),
          "https://clinic.example.com/ap/organizations/org-attacker",
        ),
      ).resolves.toBe(false);
    });
  });
});
