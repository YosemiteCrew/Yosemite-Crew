'use client';

import { useEffect, useRef, useState } from 'react';
import posthog from 'posthog-js';
import { getStorageItem } from '@/app/lib/browserStorage';
import { COOKIE_CONSENT_KEY, sanitizePostHogEvent } from '@/app/lib/posthog';

type Props = {
  apiHost: string;
  projectToken: string;
};

const hasConsent = () => getStorageItem('local', COOKIE_CONSENT_KEY) === 'true';

const PostHogBootstrap = ({ apiHost, projectToken }: Props) => {
  const [consented, setConsented] = useState(false);
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
    if (!initializedRef.current && consented) {
      posthog.init(projectToken, {
        api_host: apiHost,
        autocapture: {
          capture_copied_text: false,
        },
        before_send: sanitizePostHogEvent,
        capture_pageview: 'history_change',
        defaults: '2026-01-30',
        enable_heatmaps: true,
        enable_recording_console_log: false,
        mask_all_element_attributes: true,
        mask_all_text: true,
        opt_out_capturing_by_default: true,
        person_profiles: 'identified_only',
        property_denylist: ['password', 'token', 'access_token', 'refresh_token'],
        session_recording: {
          blockSelector: '[data-ph-no-capture]',
          maskInputOptions: {
            password: true,
          },
          maskTextSelector: '[data-ph-mask]',
        },
      });

      posthog.opt_in_capturing();
      initializedRef.current = true;
      return;
    }

    if (initializedRef.current) {
      if (consented) {
        posthog.opt_in_capturing();
      } else {
        posthog.opt_out_capturing();
      }
    }
  }, [apiHost, consented, projectToken]);
  return null;
};

export default PostHogBootstrap;
