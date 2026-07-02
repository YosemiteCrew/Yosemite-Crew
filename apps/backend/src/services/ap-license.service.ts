import crypto from "crypto";
import logger from "src/utils/logger";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface JWK {
  kty: string;
  kid: string;
  use: string;
  alg: string;
  n: string;
  e: string;
}

export interface LicenseClaims {
  iss: string;
  aud: string;
  jti: string;
  iat: number;
  exp: number;
  orgId: string;
  instanceDomain: string;
  tier: string;
  keyId: string;
}

interface Cache<T> {
  value: T;
  fetchedAt: number;
}

let jwkCache: Cache<JWK[]> | null = null;
let revokedCache: Cache<string[]> | null = null;

function authorityBase(): string {
  return (
    process.env.AP_LICENSE_AUTHORITY_URL ?? "https://api.yosemitecrew.com"
  ).replace(/\/$/, "");
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.json() as Promise<T>;
}

async function getJwks(): Promise<JWK[]> {
  if (jwkCache && Date.now() - jwkCache.fetchedAt < CACHE_TTL_MS) {
    return jwkCache.value;
  }
  const data = await fetchJson<{ keys: JWK[] }>(
    `${authorityBase()}/api/ap/signing-key.json`,
  );
  jwkCache = { value: data.keys, fetchedAt: Date.now() };
  return data.keys;
}

async function getRevokedJtis(): Promise<string[]> {
  if (revokedCache && Date.now() - revokedCache.fetchedAt < CACHE_TTL_MS) {
    return revokedCache.value;
  }
  const data = await fetchJson<{ revokedJtis: string[] }>(
    `${authorityBase()}/api/ap/revoked.json`,
  );
  revokedCache = { value: data.revokedJtis, fetchedAt: Date.now() };
  return data.revokedJtis;
}

function base64urlDecode(str: string): Buffer {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + "=".repeat(pad), "base64");
}

function jwkToPublicKey(jwk: JWK): crypto.KeyObject {
  return crypto.createPublicKey({
    key: jwk as unknown as crypto.JsonWebKey,
    format: "jwk",
  });
}

export async function verifyLicenseToken(
  token: string,
  expectedDomain: string,
): Promise<LicenseClaims> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");

  const [rawHeader, rawPayload, rawSig] = parts;

  const header = JSON.parse(base64urlDecode(rawHeader).toString("utf8")) as {
    alg: string;
    typ: string;
    kid: string;
  };

  if (header.alg !== "RS256")
    throw new Error(`Unsupported algorithm: ${header.alg}`);

  const keys = await getJwks();
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error(`Unknown kid: ${header.kid}`);

  const publicKey = jwkToPublicKey(jwk);
  const signingInput = Buffer.from(`${rawHeader}.${rawPayload}`);
  const signature = base64urlDecode(rawSig);

  const valid = crypto.verify("RSA-SHA256", signingInput, publicKey, signature);
  if (!valid) throw new Error("Invalid license token signature");

  const claims = JSON.parse(
    base64urlDecode(rawPayload).toString("utf8"),
  ) as LicenseClaims;

  if (claims.iss !== "yosemitecrew.com")
    throw new Error(`Unexpected issuer: ${claims.iss}`);
  if (claims.aud !== "activitypub")
    throw new Error(`Unexpected audience: ${claims.aud}`);

  const nowSecs = Math.floor(Date.now() / 1000);
  if (claims.exp <= nowSecs) throw new Error("License token expired");

  const tokenDomain = claims.instanceDomain
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .toLowerCase();
  const actorDomain = expectedDomain
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .toLowerCase();
  if (tokenDomain !== actorDomain) {
    throw new Error(
      `Domain mismatch: token=${tokenDomain} actor=${actorDomain}`,
    );
  }

  const revoked = await getRevokedJtis();
  if (revoked.includes(claims.jti))
    throw new Error(`License token revoked: jti=${claims.jti}`);

  return claims;
}

export async function isLicenseTokenValid(
  token: string | null | undefined,
  actorUri: string,
): Promise<boolean> {
  if (!token) return false;
  try {
    await verifyLicenseToken(token, actorUri);
    return true;
  } catch (err) {
    logger.warn("[AP license] token invalid", {
      err: (err as Error).message,
      actorUri,
    });
    return false;
  }
}
