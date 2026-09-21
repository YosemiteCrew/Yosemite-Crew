import type { AxiosError } from 'axios';

import type { ApiKeyStatus, DeveloperApiKey } from '@/app/services/developerApiKeys';

/*
 * Key semantics with no transport attached.
 *
 * Split from `developerApiKeys` deliberately. The table, the portal status card
 * and the billing copy all need these and none of them needs an HTTP client,
 * and every test that mocks the three request functions would otherwise have to
 * re-export the helpers by hand to keep them real.
 */

/**
 * What the portal shows. `expired` is derived and never stored: nothing moves a
 * key out of `active`, but the API stops accepting it once `expiresAt` passes.
 */
export type ApiKeyDisplayStatus = ApiKeyStatus | 'expired';

/**
 * The number of usable keys one owner may hold, on every plan tier.
 *
 * Mirrors MAX_ACTIVE_KEYS_PER_OWNER in
 * apps/backend/src/services/developer-api-key.service.ts, which refuses a
 * further key with 429 without consulting the owner's plan. Billing copy and
 * the create-key error read this instead of each restating a number, so only
 * one value in the frontend has to be kept in step with the backend.
 */
export const MAX_ACTIVE_API_KEYS = 25;

/**
 * Status as the API would treat it, not as it is stored.
 *
 * `verify` refuses a key when `expiresAt.getTime() <= Date.now()`, so a key is
 * already unusable AT its expiry instant rather than a tick after it, and the
 * same boundary is used here. An `expiresAt` that does not parse is left
 * `active`: the API is the authority on access, and inventing an expiry from an
 * unreadable timestamp would hide a working key from its owner.
 */
export const apiKeyDisplayStatus = (
  key: Pick<DeveloperApiKey, 'status' | 'expiresAt'>,
  now: number = Date.now()
): ApiKeyDisplayStatus => {
  if (key.status !== 'active' || !key.expiresAt) return key.status;
  const expiresAt = Date.parse(key.expiresAt);
  return Number.isNaN(expiresAt) || expiresAt > now ? 'active' : 'expired';
};

/**
 * A credential the API would currently accept. Counting `status === 'active'`
 * instead advertises expired keys as usable.
 */
export const isApiKeyUsable = (
  key: Pick<DeveloperApiKey, 'status' | 'expiresAt'>,
  now: number = Date.now()
): boolean => apiKeyDisplayStatus(key, now) === 'active';

/**
 * The 429 `issue` answers at the key ceiling, as distinct from any other create
 * failure - the two need different wording.
 */
export const isKeyLimitReached = (error: unknown): boolean =>
  (error as AxiosError | undefined)?.response?.status === 429;
