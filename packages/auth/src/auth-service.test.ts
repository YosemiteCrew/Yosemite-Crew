import assert from 'node:assert/strict';
import test from 'node:test';
import { AuthService } from './auth-service.js';
import type { AuthProvider } from './auth-provider.js';
import type { AuthSession, RequestContext } from './types.js';

type Call = { method: string; args: unknown[] };

// The four members every provider must implement. The admin capabilities are
// optional by design, so each test adds back only the ones it is about - which
// is what makes the "provider omits it" cases below expressible at all.
function baseProvider(calls: Call[]): AuthProvider {
  return {
    name: 'supertokens',
    async getSession(ctx: RequestContext) {
      calls.push({ method: 'getSession', args: [ctx] });
      return null;
    },
    async requireSession() {
      throw new Error('not used');
    },
    async signOut(ctx: RequestContext) {
      calls.push({ method: 'signOut', args: [ctx] });
    },
  };
}

test('removeUserRole forwards the user id and role to the provider', async () => {
  const calls: Call[] = [];
  const service = new AuthService({
    ...baseProvider(calls),
    async removeUserRole(appUserId: string, role: string) {
      calls.push({ method: 'removeUserRole', args: [appUserId, role] });
    },
  });

  await service.removeUserRole('user-123', 'member');

  assert.deepEqual(calls, [{ method: 'removeUserRole', args: ['user-123', 'member'] }]);
});

/*
 * The delegations use optional chaining, so a provider that does not implement
 * removeUserRole makes this resolve rather than throw. That is deliberate - it
 * is what lets product code stay provider-neutral - but it means a role
 * replacement can half-apply in total silence: the grant lands, the revoke
 * evaporates, and the caller still sees a fulfilled promise. Pinned here so the
 * no-op stays a decision rather than becoming an accident.
 */
test('removeUserRole is a silent no-op when the provider omits it', async () => {
  const calls: Call[] = [];
  const service = new AuthService(baseProvider(calls));

  await assert.doesNotReject(() => service.removeUserRole('user-123', 'member'));
  assert.deepEqual(calls, []);
});

test('setUserRole forwards the user id and role to the provider', async () => {
  const calls: Call[] = [];
  const service = new AuthService({
    ...baseProvider(calls),
    async setUserRole(appUserId: string, role: string) {
      calls.push({ method: 'setUserRole', args: [appUserId, role] });
    },
  });

  await service.setUserRole('user-123', 'developer');

  assert.deepEqual(calls, [{ method: 'setUserRole', args: ['user-123', 'developer'] }]);
});

test('setUserRole is a silent no-op when the provider omits it', async () => {
  const calls: Call[] = [];
  const service = new AuthService(baseProvider(calls));

  await assert.doesNotReject(() => service.setUserRole('user-123', 'developer'));
  assert.deepEqual(calls, []);
});

/*
 * Grant and revoke are separate provider calls, so a replacement is only
 * correct if both carry the same user id. Asserting the pair together catches
 * a divergence that either call passing on its own would hide.
 */
test('a role replacement grants and revokes against the same user id', async () => {
  const calls: Call[] = [];
  const service = new AuthService({
    ...baseProvider(calls),
    async setUserRole(appUserId: string, role: string) {
      calls.push({ method: 'setUserRole', args: [appUserId, role] });
    },
    async removeUserRole(appUserId: string, role: string) {
      calls.push({ method: 'removeUserRole', args: [appUserId, role] });
    },
  });

  await service.setUserRole('user-123', 'developer');
  await service.removeUserRole('user-123', 'member');

  assert.deepEqual(calls, [
    { method: 'setUserRole', args: ['user-123', 'developer'] },
    { method: 'removeUserRole', args: ['user-123', 'member'] },
  ]);
});

test('a provider failure propagates rather than being absorbed', async () => {
  const service = new AuthService({
    ...baseProvider([]),
    async removeUserRole() {
      throw new Error('provider unavailable');
    },
  });

  await assert.rejects(() => service.removeUserRole('user-123', 'member'), /provider unavailable/);
});

test('getUserRoles defaults to the public tenant and passes an explicit one through', async () => {
  const calls: Call[] = [];
  const service = new AuthService({
    ...baseProvider(calls),
    async getUserRoles(appUserId: string, tenantId: string) {
      calls.push({ method: 'getUserRoles', args: [appUserId, tenantId] });
      return ['developer'];
    },
  });

  assert.deepEqual(await service.getUserRoles('user-123'), ['developer']);
  await service.getUserRoles('user-123', 'tenant-a');

  assert.deepEqual(calls, [
    { method: 'getUserRoles', args: ['user-123', 'public'] },
    { method: 'getUserRoles', args: ['user-123', 'tenant-a'] },
  ]);
});

test('getUserRoles answers with no roles when the provider omits it', async () => {
  const service = new AuthService(baseProvider([]));

  assert.deepEqual(await service.getUserRoles('user-123'), []);
});

test('getUserMetadata answers with an empty object when the provider omits it', async () => {
  const service = new AuthService(baseProvider([]));

  assert.deepEqual(await service.getUserMetadata('user-123'), {});
});

test('updateUserName forwards both names to the provider', async () => {
  const calls: Call[] = [];
  const service = new AuthService({
    ...baseProvider(calls),
    async updateUserName(appUserId: string, name: { firstName: string; lastName: string }) {
      calls.push({ method: 'updateUserName', args: [appUserId, name] });
    },
  });

  await service.updateUserName('user-123', { firstName: 'Ada', lastName: 'Lovelace' });

  assert.deepEqual(calls, [
    { method: 'updateUserName', args: ['user-123', { firstName: 'Ada', lastName: 'Lovelace' }] },
  ]);
});

test('providerName reports the configured provider', () => {
  const service = new AuthService(baseProvider([]));

  assert.equal(service.providerName, 'supertokens');
});

test('session reads and sign-out reach the provider with the request context', async () => {
  const calls: Call[] = [];
  const service = new AuthService(baseProvider(calls));
  const ctx = { req: {}, res: {} } as unknown as RequestContext;

  const session: AuthSession | null = await service.getSession(ctx);
  await service.signOut(ctx);

  assert.equal(session, null);
  assert.deepEqual(
    calls.map((call) => call.method),
    ['getSession', 'signOut']
  );
});
