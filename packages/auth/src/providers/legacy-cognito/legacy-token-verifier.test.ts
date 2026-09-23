import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';

import jwt from 'jsonwebtoken';

import {
  isLegacyTokenGraceEnabled,
  resetLegacyVerifierForTests,
  setLegacyJwksFetcherForTests,
  verifyLegacyBearerToken,
} from './legacy-token-verifier.js';

const REGION = 'eu-west-1';
const WEB_POOL = 'eu-west-1_webpool';
const MOBILE_POOL = 'eu-west-1_mobilepool';
const AUDIENCE = 'legacy-audience';
const WEB_ISSUER = `https://cognito-idp.${REGION}.amazonaws.com/${WEB_POOL}`;
const MOBILE_ISSUER = `https://cognito-idp.${REGION}.amazonaws.com/${MOBILE_POOL}`;
const KID = 'legacy-signing-key';

const env: NodeJS.ProcessEnv = {
  COGNITO_REGION: REGION,
  COGNITO_USER_POOL_ID: WEB_POOL,
  COGNITO_USER_POOL_ID_MOBILE: MOBILE_POOL,
  COGNITO_AUDIENCE: AUDIENCE,
};

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwks = {
  keys: [{ ...publicKey.export({ format: 'jwk' }), kid: KID, alg: 'RS256', use: 'sig' }],
};

// Counted so the "unknown issuer" cases can assert that the verifier returned
// null *without* reaching for a key - a null alone cannot tell the two apart.
let jwksFetches = 0;

function setup(): void {
  resetLegacyVerifierForTests();
  jwksFetches = 0;
  setLegacyJwksFetcherForTests(async () => {
    jwksFetches += 1;
    return jwks;
  });
}

const staffClaims = {
  iss: WEB_ISSUER,
  sub: 'legacy-user-1',
  aud: AUDIENCE,
  email: 'vet@example.invalid',
  email_verified: true,
  given_name: 'Ada',
  family_name: 'Byron',
};

function sign(payload: Record<string, unknown>, options: jwt.SignOptions = {}): string {
  return jwt.sign(payload, privateKey, { algorithm: 'RS256', keyid: KID, ...options });
}

test('maps a validly signed staff-pool token onto an AuthSession', async () => {
  setup();

  const session = await verifyLegacyBearerToken(sign(staffClaims), env);

  assert.ok(session);
  assert.equal(session.appUserId, 'legacy-user-1');
  assert.equal(session.providerUserId, 'legacy-user-1');
  assert.equal(session.provider, 'cognito');
  assert.equal(session.authProfile, 'pims_web');
  assert.equal(session.loginMethod, 'unknown');
  assert.equal(session.email, 'vet@example.invalid');
  assert.equal(session.emailVerified, true);
  assert.equal(session.firstName, 'Ada');
  assert.equal(session.lastName, 'Byron');
  assert.deepEqual(session.roles, []);
  assert.deepEqual(session.permissions, []);
  assert.equal(session.claims.sub, 'legacy-user-1');
  assert.equal(jwksFetches, 1);
});

// The matched issuer - not a claim in the token - is what picks the profile,
// which is how the pre-migration staff / pet-parent split survives the cutover.
test('routes the mobile pool to the pet-parent profile and accepts a string email_verified', async () => {
  setup();

  const session = await verifyLegacyBearerToken(
    sign({ ...staffClaims, iss: MOBILE_ISSUER, sub: 'legacy-user-2', email_verified: 'true' }),
    env
  );

  assert.ok(session);
  assert.equal(session.authProfile, 'pet_parent_mobile');
  assert.equal(session.appUserId, 'legacy-user-2');
  assert.equal(session.emailVerified, true);
});

/*
 * The forged token carries a real header and a real signature with an edited
 * payload, so anything that trusted the unverified `jwt.decode()` result would
 * hand back a session for "attacker". Verification is the only thing standing
 * between those two segments and an AuthSession.
 */
test('rejects a token whose payload was edited after signing', async () => {
  setup();
  const [header, , signature] = sign(staffClaims).split('.');
  const forgedPayload = Buffer.from(JSON.stringify({ ...staffClaims, sub: 'attacker' })).toString(
    'base64url'
  );

  const session = await verifyLegacyBearerToken(`${header}.${forgedPayload}.${signature}`, env);

  assert.equal(session, null);
});

/*
 * Same key, same claims, different algorithm. jsonwebtoken already refuses an
 * HMAC token verified against a public key, so alg confusion cannot be the arm
 * here; RS512 can, because it is in the list jsonwebtoken would fall back to on
 * an RSA key. Dropping `algorithms: ['RS256']` accepts this token.
 */
test('rejects a token signed with an algorithm the issuer config does not allow', async () => {
  setup();
  const rs512Token = jwt.sign(staffClaims, privateKey, { algorithm: 'RS512', keyid: KID });

  const session = await verifyLegacyBearerToken(rs512Token, env);

  assert.equal(session, null);
});

test('rejects an issuer that is not configured without fetching a key', async () => {
  setup();

  const session = await verifyLegacyBearerToken(
    sign({ ...staffClaims, iss: 'https://securetoken.google.com/some-other-project' }),
    env
  );

  assert.equal(session, null);
  assert.equal(jwksFetches, 0);
});

test('rejects malformed tokens without fetching a key', async () => {
  setup();

  assert.equal(await verifyLegacyBearerToken('not-a-jwt', env), null);
  assert.equal(await verifyLegacyBearerToken(sign({ iss: WEB_ISSUER, aud: AUDIENCE }), env), null);
  assert.equal(await verifyLegacyBearerToken(sign({ sub: 'legacy-user-1' }), env), null);
  assert.equal(jwksFetches, 0);
});

test('rejects a token issued for a different audience', async () => {
  setup();

  const session = await verifyLegacyBearerToken(
    sign({ ...staffClaims, aud: 'some-other-client' }),
    env
  );

  assert.equal(session, null);
});

test('rejects a token whose header carries no key id', async () => {
  setup();

  const noKidToken = jwt.sign(staffClaims, privateKey, { algorithm: 'RS256' });

  const session = await verifyLegacyBearerToken(noKidToken, env);

  assert.equal(session, null);
  assert.equal(jwksFetches, 0);
});

test('the grace window is off unless the flag is exactly "true"', () => {
  assert.equal(isLegacyTokenGraceEnabled({ AUTH_LEGACY_TOKEN_GRACE: 'true' }), true);
  assert.equal(isLegacyTokenGraceEnabled({ AUTH_LEGACY_TOKEN_GRACE: 'TRUE' }), false);
  assert.equal(isLegacyTokenGraceEnabled({}), false);
});
