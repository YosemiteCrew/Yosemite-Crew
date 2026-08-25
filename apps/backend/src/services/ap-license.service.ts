import crypto from "node:crypto";
import logger from "src/utils/logger";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Revocations are deliberately NOT cached for the signing-key TTL. A signing key
// changes only on rotation, but a revoked licence must stop working promptly:
// at 24 hours a revoked instance could keep opening follows and running agent
// tasks for a full day after the authority pulled it.
const REVOCATION_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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
  if (
    revokedCache &&
    Date.now() - revokedCache.fetchedAt < REVOCATION_CACHE_TTL_MS
  ) {
    return revokedCache.value;
  }
  // The authority serves a bare JSON array of revoked jti values - see
  // SuperAdmin's app/api/ap/revoked.json/route.ts, which has shipped that shape
  // since before this client existed. Reading it as `{ revokedJtis }` produced
  // undefined, and the `.includes()` below then threw on EVERY verification, so
  // no instance could ever be verified. The object form is still accepted in
  // case the authority is changed later.
  const data = await fetchJson<string[] | { revokedJtis?: string[] }>(
    `${authorityBase()}/api/ap/revoked.json`,
  );
  const jtis = Array.isArray(data) ? data : (data.revokedJtis ?? []);
  revokedCache = { value: jtis, fetchedAt: Date.now() };
  return jtis;
}

function base64urlDecode(str: string): Buffer {
  const padded = str.replaceAll("-", "+").replaceAll("_", "/");
  const pad = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + "=".repeat(pad), "base64");
}

function jwkToPublicKey(jwk: JWK): crypto.KeyObject {
  // No cast: `crypto.JsonWebKey` is gone from the current @types/node, so the
  // old double assertion resolved to `error` and merely silenced the checker.
  // createPublicKey accepts this shape directly.
  return crypto.createPublicKey({ key: jwk, format: "jwk" });
}

/**
 * Binds a licence to the actor presenting it, not merely to its domain.
 *
 * Actor documents publish their licence token, and several clinics can share
 * one instance domain. Checking `instanceDomain` alone therefore let an
 * unverified actor on a multi-tenant host copy a neighbour's token, sign with
 * its own key, and pass the Follow and AgentTask gates as that neighbour.
 *
 * Only enforced when the caller passes a full actor URI. Local self-checks pass
 * the bare instance base URL, which carries no organisation to bind to, and for
 * those the domain comparison is the whole check.
 */
function assertActorIdentityBinding(claims: LicenseClaims, expected: string) {
  let pathname: string;
  try {
    pathname = new URL(
      expected.includes("://") ? expected : `https://${expected}`,
    ).pathname;
  } catch {
    return;
  }

  const parts = pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("organizations");
  if (idx === -1 || idx + 1 >= parts.length) return;

  const actorOrgId = parts[idx + 1];
  if (actorOrgId !== claims.orgId) {
    throw new Error(
      `License token orgId mismatch: token=${claims.orgId} actor=${actorOrgId}`,
    );
  }
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

  assertActorIdentityBinding(claims, expectedDomain);

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
