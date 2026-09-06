import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { generateKeyPairSync } from "node:crypto";
import jwt from "jsonwebtoken";

// A real RSA keypair, so a token that genuinely VERIFIES is constructible.
// Without one every case returns null for the same uninteresting reason and the
// suite cannot separate the three guards from each other - which is the gap
// these tests exist to close.
const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const KID = "kid-1";
const getSigningKey = jest.fn(async (_kid: string) => ({
  getPublicKey: () => publicKey,
}));
// Records the jwksUri every client is built for. The URI is the observable that
// separates "rejected by the issuer allowlist" from "rejected by verification":
// with no allowlist match there is no JWKS to verify against at all, so the
// return value is null either way and only the call site distinguishes them.
const jwksClientFactory = jest.fn((_opts: { jwksUri: string }) => ({
  getSigningKey,
}));

jest.mock("jwks-rsa", () => jwksClientFactory);

import {
  verifyLegacyBearerToken,
  resetLegacyVerifierForTests,
} from "@yosemite-crew/auth";

const REGION = "eu-central-1";
const POOL = "test-web-pool";
const ALLOWED_ISS = `https://cognito-idp.${REGION}.amazonaws.com/${POOL}`;
const ALLOWED_JWKS = `${ALLOWED_ISS}/.well-known/jwks.json`;
const ATTACKER_ISS = "https://evil.example.test/pool";

const env = {
  COGNITO_REGION: REGION,
  COGNITO_USER_POOL_ID: POOL,
} as NodeJS.ProcessEnv;

const signRs256 = (iss: string) =>
  jwt.sign({ sub: "user-1", email: "a@b.test" }, privateKey, {
    algorithm: "RS256",
    issuer: iss,
    keyid: KID,
  });

describe("legacy Cognito verifier - the three guards, separately", () => {
  beforeEach(() => {
    // Both the issuer list and the JwksClient cache are module-level. Without
    // this reset a client built by an earlier test is reused on a cache hit, so
    // the factory is never called again and an assertion about construction can
    // pass under the very mutation it exists to catch.
    resetLegacyVerifierForTests();
    jwksClientFactory.mockClear();
    getSigningKey.mockClear();
  });

  it("accepts a correctly signed token from a configured issuer", async () => {
    const session = await verifyLegacyBearerToken(signRs256(ALLOWED_ISS), env);

    expect(session).not.toBeNull();
    expect(session?.appUserId).toBe("user-1");
    expect(jwksClientFactory).toHaveBeenCalledTimes(1);
    expect(jwksClientFactory.mock.calls[0]?.[0]?.jwksUri).toBe(ALLOWED_JWKS);
  });

  // Mutating `getClient(issuer.jwksUri)` inside verifyAgainstIssuer does NOT
  // redden this - that line is unreachable for a token whose issuer is not
  // configured, because `if (!match) return null` returns first. The obvious
  // mutation is the unreachable one, and it comes back green, which reads as
  // "this test enforces nothing". The mutation this case is written against is
  // giving the allowlist a fallback so an unmatched `iss` becomes an issuer:
  //   issuers.find(...) ?? { issuer: iss, jwksUri: `${iss}/.well-known/jwks.json` }
  it("never fetches keys from an issuer that is not configured", async () => {
    const session = await verifyLegacyBearerToken(signRs256(ATTACKER_ISS), env);

    expect(session).toBeNull();
    // The load-bearing assertion. Deriving the JWKS URI from the token instead
    // of from the configured list still returns null here - the attacker's host
    // is unreachable in a test - so only the absence of the call shows that the
    // allowlist, rather than a failed fetch, is what refused the token.
    expect(jwksClientFactory).not.toHaveBeenCalled();
    expect(getSigningKey).not.toHaveBeenCalled();
  });

  it("rejects an HS256 token signed with the JWKS public key as its secret", async () => {
    const forged = jwt.sign({ sub: "user-1" }, publicKey, {
      algorithm: "HS256",
      issuer: ALLOWED_ISS,
      keyid: KID,
    });

    await expect(verifyLegacyBearerToken(forged, env)).resolves.toBeNull();
  });

  it("rejects an RS512 token even though the same key signed it", async () => {
    // The separating input for `algorithms: ['RS256']`. An HS256 forgery does
    // NOT separate it: jsonwebtoken infers the permitted family from the key it
    // is handed, so a PEM public key already refuses HMAC with or without the
    // option. Another RSA algorithm is refused only by the explicit pin.
    const rs512 = jwt.sign({ sub: "user-1" }, privateKey, {
      algorithm: "RS512",
      issuer: ALLOWED_ISS,
      keyid: KID,
    });

    await expect(verifyLegacyBearerToken(rs512, env)).resolves.toBeNull();
  });

  it("rejects a token with no key id without asking for a signing key", async () => {
    const noKid = jwt.sign({ sub: "user-1" }, privateKey, {
      algorithm: "RS256",
      issuer: ALLOWED_ISS,
    });

    await expect(verifyLegacyBearerToken(noKid, env)).resolves.toBeNull();
    expect(getSigningKey).not.toHaveBeenCalled();
  });
});
