'use client';

import { useEffect, useRef, useState } from 'react';
import posthog from 'posthog-js';
import { getStorageItem } from '@/app/lib/browserStorage';
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
  const [consented, setConsented] = useState<boolean | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    setConsented(hasConsent());

    const onStorage = (event: StorageEvent) => {
      if (event.key === COOKIE_CONSENT_KEY) {
        setConsented(event.newValue === 'true');
      }
    };

    globalThis.addEventListener('storage', onStorage);
    return () => globalThis.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (consented === null) return;
    const { apiHost, projectToken } = getPostHogConfig();
    if (!projectToken || !apiHost) return;

    if (!initializedRef.current) {
      if (!consented) return;

      initializedRef.current = true;
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
          ph.opt_in_capturing();
          globalThis.dispatchEvent(new Event(POSTHOG_READY_EVENT));
        },
      });
      return;
    }

    if (consented) {
      posthog.opt_in_capturing();
    } else {
      posthog.opt_out_capturing();
    }
  }, [consented]);

  return null;
};

export default PostHogBootstrap;
