'use client';

import { useEffect, useRef } from 'react';
import posthog from 'posthog-js';
import { useAuthStore } from '@/app/stores/authStore';

const PostHogUserSync = () => {
  const attributes = useAuthStore((state) => state.attributes);
  const status = useAuthStore((state) => state.status);
  const identifiedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (status !== 'authenticated' && status !== 'signin-authenticated') {
      if (identifiedIdRef.current) {
        posthog.reset();
        identifiedIdRef.current = null;
      }
      return;
    }

    const distinctId = attributes?.sub ?? attributes?.email;
    if (!distinctId || identifiedIdRef.current === distinctId) {
      return;
    }

    posthog.identify(distinctId, {
      email: attributes?.email,
      first_name: attributes?.given_name,
      last_name: attributes?.family_name,
      role: attributes?.['custom:role'],
    });
    identifiedIdRef.current = distinctId;
  }, [attributes, status]);

  return null;
};

export default PostHogUserSync;
