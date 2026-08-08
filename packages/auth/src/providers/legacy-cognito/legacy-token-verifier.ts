import jwt, { type JwtHeader, type JwtPayload, type SigningKeyCallback } from 'jsonwebtoken';
import jwksClient, { type JwksClient } from 'jwks-rsa';

import type { AuthProfile, AuthSession } from '../../types.js';

// Time-boxed grace verifier for the cutover window. It accepts bearer tokens
// issued by the previous providers (two legacy user pools plus the legacy
// social-login issuer) using pure JWKS verification - no legacy SDK required -
// so in-flight sessions and not-yet-updated mobile builds keep working until
// the grace flag is turned off. Remove this directory (and the flag) after the
// window closes.

export function isLegacyTokenGraceEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.AUTH_LEGACY_TOKEN_GRACE === 'true';
}

type LegacyIssuer = {
  provider: 'cognito' | 'firebase';
  // The legacy issuers were product-scoped (web pool vs mobile pool + social
  // issuer), so the matched issuer determines the auth profile - preserving
  // the pre-migration separation between staff and pet-parent tokens.
  profile: AuthProfile;
  issuer: string;
  jwksUri: string;
  audience?: string;
};

let issuers: LegacyIssuer[] | null = null;
const clients = new Map<string, JwksClient>();

function buildIssuers(env: NodeJS.ProcessEnv): LegacyIssuer[] {
  const list: LegacyIssuer[] = [];
  const region = env.COGNITO_REGION;

  const pools: Array<{ poolId?: string; profile: AuthProfile }> = [
    { poolId: env.COGNITO_USER_POOL_ID, profile: 'pims_web' },
    { poolId: env.COGNITO_USER_POOL_ID_MOBILE, profile: 'pet_parent_mobile' },
  ];

  for (const { poolId, profile } of pools) {
    if (region && poolId) {
      const issuer = `https://cognito-idp.${region}.amazonaws.com/${poolId}`;
      list.push({
        provider: 'cognito',
        profile,
        issuer,
        jwksUri: `${issuer}/.well-known/jwks.json`,
        audience: env.COGNITO_AUDIENCE,
      });
    }
  }

  if (env.FIREBASE_PROJECT_ID) {
    list.push({
      provider: 'firebase',
      profile: 'pet_parent_mobile',
      issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`,
      jwksUri:
        'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
      audience: env.FIREBASE_PROJECT_ID,
    });
  }

  return list;
}

function getClient(jwksUri: string): JwksClient {
  let client = clients.get(jwksUri);
  if (!client) {
    client = jwksClient({
      jwksUri,
      cache: true,
      cacheMaxEntries: 20,
      cacheMaxAge: 10 * 60 * 1000,
      rateLimit: true,
      jwksRequestsPerMinute: 5,
    });
    clients.set(jwksUri, client);
  }
  return client;
}

function verifyAgainstIssuer(token: string, issuer: LegacyIssuer): Promise<JwtPayload> {
  const getKey = (header: JwtHeader, callback: SigningKeyCallback) => {
    if (!header.kid) {
      callback(new Error('Legacy token is missing a key id'));
      return;
    }
    getClient(issuer.jwksUri)
      .getSigningKey(header.kid)
      .then(
        (key) => callback(null, key.getPublicKey()),
        (err: Error) => callback(err)
      );
  };

  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getKey,
      {
        algorithms: ['RS256'],
        issuer: issuer.issuer,
        ...(issuer.audience ? { audience: issuer.audience } : undefined),
      },
      (err, decoded) => {
        if (err) {
          reject(err);
          return;
        }
        if (!decoded || typeof decoded === 'string') {
          reject(new Error('Legacy token payload is not an object'));
          return;
        }
        resolve(decoded);
      }
    );
  });
}

// Verifies a legacy bearer token and normalizes it. Returns null when the
// token was not issued by a configured legacy issuer or fails verification -
// the caller decides whether that means 401.
export async function verifyLegacyBearerToken(
  token: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<AuthSession | null> {
  issuers ??= buildIssuers(env);

  const decoded = jwt.decode(token) as JwtPayload | null;
  const iss = decoded?.iss;
  if (!iss || typeof decoded?.sub !== 'string') {
    return null;
  }

  const match = issuers.find((candidate) => candidate.issuer === iss);
  if (!match) {
    return null;
  }

  let payload: JwtPayload;
  try {
    payload = await verifyAgainstIssuer(token, match);
  } catch {
    return null;
  }

  const emailVerified = payload.email_verified === true || payload.email_verified === 'true';

  return {
    appUserId: payload.sub as string,
    provider: match.provider,
    authProfile: match.profile,
    providerUserId: payload.sub as string,
    loginMethod: 'unknown',
    email: typeof payload.email === 'string' ? payload.email : undefined,
    emailVerified,
    firstName: typeof payload.given_name === 'string' ? payload.given_name : undefined,
    lastName: typeof payload.family_name === 'string' ? payload.family_name : undefined,
    roles: [],
    permissions: [],
    claims: payload as Record<string, unknown>,
  };
}

// Test seam: clears memoized issuer/client state so env changes take effect.
export function resetLegacyVerifierForTests(): void {
  issuers = null;
  clients.clear();
}
