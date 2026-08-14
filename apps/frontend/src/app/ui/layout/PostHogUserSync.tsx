'use client';

import { useEffect, useRef } from 'react';
import { getStorageItem } from '@/app/lib/browserStorage';
import { COOKIE_CONSENT_KEY, POSTHOG_READY_EVENT } from '@/app/lib/posthog';
import { getLoadedPostHog } from '@/app/lib/posthogClient';
import { useAuthStore } from '@/app/stores/authStore';

const hasConsent = () => getStorageItem('local', COOKIE_CONSENT_KEY) === 'true';
// Null until PostHogBootstrap has loaded the analytics chunk, which only happens
// after consent. Every call below is already gated on that, so reading the
// handle synchronously is safe and keeps this component's sync path intact.
const isPostHogLoaded = () =>
  (getLoadedPostHog() as { __loaded?: boolean } | null)?.__loaded === true;
const addDefinedValue = (
  properties: Record<string, string>,
  key: string,
  value: string | undefined
) => {
  if (value !== undefined) {
    properties[key] = value;
  }
};

const PostHogUserSync = () => {
  const attributes = useAuthStore((state) => state.attributes);
  const status = useAuthStore((state) => state.status);
  const identifiedIdRef = useRef<string | null>(null);
  const consentedRef = useRef(false);
  const readyRef = useRef(false);

  // syncIdentityRef always points at a closure over the latest attributes/status
  // (refreshed after every render below) so the mount-only event listeners and the
  // reactive effect can share one implementation without re-subscribing listeners.
  const syncIdentityRef = useRef<() => void>(() => {});
  // No dep array: refresh the closure after every render, before the effects
  // below (declaration order) ever invoke it.
  useEffect(() => {
    syncIdentityRef.current = () => {
      const consented = consentedRef.current;
      const ready = readyRef.current;

      const posthog = getLoadedPostHog();

      if (!consented || !ready) {
        if (identifiedIdRef.current && ready) {
          posthog?.reset();
        }
        identifiedIdRef.current = null;
        return;
      }

      if (status !== 'authenticated' && status !== 'signin-authenticated') {
        if (identifiedIdRef.current) {
          posthog?.reset();
          identifiedIdRef.current = null;
        }
        return;
      }

      const distinctId = attributes?.sub ?? attributes?.email;
      if (!distinctId || identifiedIdRef.current === distinctId) {
        return;
      }

      const personProperties: Record<string, string> = {};
      addDefinedValue(personProperties, 'email', attributes?.email);
      addDefinedValue(personProperties, 'first_name', attributes?.given_name);
      addDefinedValue(personProperties, 'last_name', attributes?.family_name);
      addDefinedValue(personProperties, 'role', attributes?.['custom:role']);

      posthog?.identify(distinctId, personProperties);
      identifiedIdRef.current = distinctId;
    };
  });

  useEffect(() => {
    consentedRef.current = hasConsent();
    readyRef.current = isPostHogLoaded();
    syncIdentityRef.current();

    const onStorage = (event: StorageEvent) => {
      if (event.key === COOKIE_CONSENT_KEY) {
        consentedRef.current = event.newValue === 'true';
        syncIdentityRef.current();
      }
    };
    const onPostHogReady = () => {
      readyRef.current = true;
      syncIdentityRef.current();
    };

    globalThis.addEventListener('storage', onStorage);
    globalThis.addEventListener(POSTHOG_READY_EVENT, onPostHogReady);
    return () => {
      globalThis.removeEventListener('storage', onStorage);
      globalThis.removeEventListener(POSTHOG_READY_EVENT, onPostHogReady);
    };
  }, []);

  useEffect(() => {
    syncIdentityRef.current();
  }, [attributes, status]);

  return null;
};

export default PostHogUserSync;
