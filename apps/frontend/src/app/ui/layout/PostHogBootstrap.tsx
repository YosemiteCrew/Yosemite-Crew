'use client';

import { useEffect, useRef } from 'react';
import { getStorageItem } from '@/app/lib/browserStorage';
import { logger } from '@/app/lib/logger';
import { getLoadedPostHog, loadPostHog } from '@/app/lib/posthogClient';
import {
  COOKIE_CONSENT_KEY,
  POSTHOG_PROPERTY_DENYLIST,
  POSTHOG_READY_EVENT,
  sanitizePostHogEvent,
} from '@/app/lib/posthog';

const POSTHOG_EU_HOST = 'https://eu.i.posthog.com';

const getPostHogConfig = () => ({
  apiHost: process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() === POSTHOG_EU_HOST ? POSTHOG_EU_HOST : '',
  projectToken: process.env.NEXT_PUBLIC_POSTHOG_TOKEN?.trim() ?? '',
});

const hasConsent = () => getStorageItem('local', COOKIE_CONSENT_KEY) === 'true';

const PostHogBootstrap = () => {
  const initializedRef = useRef(false);

  useEffect(() => {
    // The consent the visitor has actually given right now. Consent can be
    // withdrawn while the analytics chunk is still downloading, and the in-flight
    // call would otherwise act on the stale value it was invoked with.
    let latestConsent = hasConsent();

    const applyConsent = async (consented: boolean) => {
      const { apiHost, projectToken } = getPostHogConfig();
      if (!projectToken || !apiHost) return;

      latestConsent = consented;

      // Once the client is cached, opting in and out stays synchronous. That
      // matters: PostHogUserSync listens for the same storage event and runs
      // straight after this handler, so an await here would let it identify
      // while capturing was still opted out and PostHog would drop the event.
      //
      // `initializedRef` is part of the condition because a cached module is not
      // the same thing as an initialized client. Withdrawing consent while the
      // chunk is still downloading abandons init below, but loadPostHog has
      // already cached the module - so this branch would toggle capture on a
      // client that was never initialized, emit no ready event, and leave
      // analytics dead until a reload.
      const cached = getLoadedPostHog();
      if (cached && initializedRef.current) {
        if (consented) {
          cached.opt_in_capturing();
        } else {
          cached.opt_out_capturing();
        }
        return;
      }

      if (!consented || initializedRef.current) return;

      // Set before awaiting so a consent event arriving while the chunk is in
      // flight cannot start a second initialization; cleared again if the load
      // fails, so a later consent event can retry rather than being stuck
      // opting in on a client that was never initialized.
      initializedRef.current = true;
      let posthog;
      try {
        posthog = await loadPostHog();
      } catch (error) {
        initializedRef.current = false;
        logger.warn('Failed to load analytics', error);
        return;
      }

      // Consent withdrawn while the chunk was downloading: leave PostHog
      // uninitialized entirely rather than initializing and opting straight out.
      if (!latestConsent) {
        initializedRef.current = false;
        return;
      }

      posthog.init(projectToken, {
        api_host: apiHost,
        autocapture: { capture_copied_text: false },
        before_send: sanitizePostHogEvent,
        capture_pageview: 'history_change',
        defaults: '2026-01-30',
        enable_heatmaps: true,
        enable_recording_console_log: false,
        mask_all_element_attributes: true,
        mask_all_text: true,
        opt_out_capturing_by_default: true,
        person_profiles: 'identified_only',
        property_denylist: POSTHOG_PROPERTY_DENYLIST,
        session_recording: {
          blockSelector: '[data-ph-no-capture]',
          maskInputOptions: { password: true },
          maskTextSelector: '[data-ph-mask]',
        },
        // Use loaded callback so opt_in fires only after init fully completes
        // (including applying defaults + endpoint routing). Calling opt_in_capturing
        // synchronously after posthog.init() fires before defaults are applied,
        // causing the $opt_in event to hit /e/ with no token and return 401.
        loaded: (ph) => {
          // init is async too, so re-check: consent may have been withdrawn
          // between the import resolving and this callback firing.
          if (latestConsent) {
            ph.opt_in_capturing();
          } else {
            ph.opt_out_capturing();
          }
          // Readiness means "the client is initialized", not "we are capturing",
          // and it is only ever emitted here. Returning early when consent had
          // been withdrawn left it permanently unemitted: re-consenting takes
          // the already-loaded path above, which only toggles capture, so
          // anything waiting on this event could never become ready again.
          // Consumers gate on consent separately, so emitting it while opted
          // out captures nothing.
          globalThis.dispatchEvent(new Event(POSTHOG_READY_EVENT));
        },
      });
    };

    void applyConsent(hasConsent());

    const onStorage = (event: StorageEvent) => {
      if (event.key === COOKIE_CONSENT_KEY) {
        void applyConsent(event.newValue === 'true');
      }
    };

    globalThis.addEventListener('storage', onStorage);
    return () => globalThis.removeEventListener('storage', onStorage);
  }, []);

  return null;
};

export default PostHogBootstrap;
