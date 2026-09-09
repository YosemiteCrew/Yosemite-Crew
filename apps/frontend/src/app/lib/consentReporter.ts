import { getStorageItem, setStorageItem } from '@/app/lib/browserStorage';
import { postData } from '@/app/services/axios';

/**
 * Stable per-browser consent subject id, persisted so an accept today and a
 * later re-decision land on the SAME ledger subject (the panel's store records
 * identity fill-only-if-absent and keys everything on consentId). Generated
 * once per browser; cleared when the user clears site storage, which is the
 * same lifetime as the consent cookie itself.
 */
export const CONSENT_ID_KEY = 'ycConsentId';
export const CONSENT_ENDPOINT = '/v1/consent';

export const getOrCreateConsentId = (): string => {
  const existing = getStorageItem('local', CONSENT_ID_KEY);
  if (existing) return existing;
  const id = globalThis.crypto?.randomUUID?.() ?? `anon-${Date.now()}`;
  setStorageItem('local', CONSENT_ID_KEY, id);
  return id;
};

/**
 * Fire-and-forget report of one banner decision to the product backend, which
 * relays it to the panel's consent ledger with the shared key held server-side.
 * The visitor's action (banner dismissing) already happened; a failed report
 * must never surface to them, so errors are swallowed here and the promise is
 * never exposed to the caller.
 */
export const reportConsentDecision = async (granted: boolean): Promise<void> => {
  try {
    await postData(CONSENT_ENDPOINT, {
      consentId: getOrCreateConsentId(),
      granted,
    });
  } catch {
    // Best-effort mirror only - the ledger is the panel's, not the visitor's.
  }
};
