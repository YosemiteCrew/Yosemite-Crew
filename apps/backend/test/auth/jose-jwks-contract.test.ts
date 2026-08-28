import { describe, expect, it } from "@jest/globals";
import http from "node:http";
import type { AddressInfo } from "node:net";
import * as jose from "jose";

/**
 * Pins the jose contract that supertokens-node's session verification depends
 * on.
 *
 * supertokens-node@24 declares jose ^4 and is held on the patched jose 6 by a
 * `jose@4` override, because no supertokens release moves off 4. That override
 * is only safe while jose keeps the two entry points supertokens actually
 * calls - `createRemoteJWKSet(url, { cacheMaxAge, cooldownDuration })` in
 * combinedRemoteJWKSet.ts and `jwtVerify(token, JWKS)` in thirdpartyUtils.ts -
 * behaving as it does today.
 *
 * Nothing else in the suite reaches that path: supertokens is mocked wherever
 * it appears, so a jose upgrade that broke session verification would leave
 * every other test green and fail only in production, on every authenticated
 * request. This exercises the real pair against a local JWKS endpoint instead.
 */
describe("jose / supertokens JWKS contract", () => {
  const startJwksServer = async (jwk: jose.JWK) => {
    const server = http.createServer((_req, res) => {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ keys: [jwk] }));
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const { port } = server.address() as AddressInfo;
    return {
      url: new URL(`http://127.0.0.1:${port}/.well-known/jwks.json`),
      close: () =>
        new Promise<void>((resolve) => server.close(() => resolve())),
    };
  };

  const KID = "contract-test-kid";

  it("verifies a token through a remote JWKS, and rejects one signed by another key", async () => {
    const { publicKey, privateKey } = await jose.generateKeyPair("RS256", {
      extractable: true,
    });
    const jwk = await jose.exportJWK(publicKey);
    const server = await startJwksServer({
      ...jwk,
      kid: KID,
      alg: "RS256",
      use: "sig",
    });

    try {
      // The option shape supertokens passes; both are still honoured by jose 6.
      const JWKS = jose.createRemoteJWKSet(server.url, {
        cacheMaxAge: 60_000,
        cooldownDuration: 500,
      });

      const token = await new jose.SignJWT({ sub: "user-1", tId: "public" })
        .setProtectedHeader({ alg: "RS256", kid: KID })
        .setIssuedAt()
        .setExpirationTime("2m")
        .sign(privateKey);

      const { payload } = await jose.jwtVerify(token, JWKS);
      expect(payload.sub).toBe("user-1");
      expect(payload.tId).toBe("public");

      // A token carrying the advertised kid but signed by a key the JWKS does
      // not publish must not verify - the half that actually protects sessions.
      const other = await jose.generateKeyPair("RS256", { extractable: true });
      const forged = await new jose.SignJWT({ sub: "attacker" })
        .setProtectedHeader({ alg: "RS256", kid: KID })
        .setIssuedAt()
        .setExpirationTime("2m")
        .sign(other.privateKey);

      await expect(jose.jwtVerify(forged, JWKS)).rejects.toThrow();
    } finally {
      await server.close();
    }
  });

  it("rejects an expired token", async () => {
    const { publicKey, privateKey } = await jose.generateKeyPair("RS256", {
      extractable: true,
    });
    const jwk = await jose.exportJWK(publicKey);
    const server = await startJwksServer({
      ...jwk,
      kid: KID,
      alg: "RS256",
      use: "sig",
    });

    try {
      const JWKS = jose.createRemoteJWKSet(server.url, {
        cacheMaxAge: 60_000,
        cooldownDuration: 500,
      });

      const expired = await new jose.SignJWT({ sub: "user-1" })
        .setProtectedHeader({ alg: "RS256", kid: KID })
        .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
        .sign(privateKey);

      await expect(jose.jwtVerify(expired, JWKS)).rejects.toThrow();
    } finally {
      await server.close();
    }
  });
});
