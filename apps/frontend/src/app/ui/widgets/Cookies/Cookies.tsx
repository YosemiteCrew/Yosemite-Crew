'use client';
import React, { useSyncExternalStore } from 'react';
import Image from 'next/image';

import { getStorageItem, setStorageItem } from '@/app/lib/browserStorage';
import { COOKIE_CONSENT_KEY } from '@/app/lib/posthog';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { MEDIA_SOURCES } from '@/app/constants/mediaSources';

const setConsent = (value: 'true' | 'false') => {
  setStorageItem('local', COOKIE_CONSENT_KEY, value);
  globalThis.dispatchEvent(
    new StorageEvent('storage', { key: COOKIE_CONSENT_KEY, newValue: value })
  );
};

const subscribeToConsent = (onChange: () => void): (() => void) => {
  globalThis.window?.addEventListener('storage', onChange);
  return () => globalThis.window?.removeEventListener('storage', onChange);
};

const getConsentSnapshot = () => getStorageItem('local', COOKIE_CONSENT_KEY);
const getServerConsentSnapshot = () => null;

const handleConsent = () => {
  setConsent('true');
};

const handleRejection = () => {
  setConsent('false');
};

const Cookies = () => {
  const consent = useSyncExternalStore(
    subscribeToConsent,
    getConsentSnapshot,
    getServerConsentSnapshot
  );
  const showCookiePopup = !consent;

  if (!showCookiePopup) return null;

  return (
    /* Phone (< 768px) docks the card to the bottom with even 16px gutters, clear
       of the 72px PhoneShell tab bar and the home indicator. The desktop
       placement - offset from the left edge so the illustration below it reads
       as part of the page - only fits once there is room for both, so it comes
       back at `md`. */
    <aside
      aria-label="Cookie consent"
      className="fixed inset-x-4 bottom-[calc(84px+env(safe-area-inset-bottom,0px))] z-9999 md:inset-x-auto md:left-20 md:bottom-32.5"
    >
      <div className="bg-neutral-0 rounded-2xl p-3 z-22 border border-card-border md:max-w-75">
        <div className="flex flex-col gap-2">
          <div className="text-body-4-emphasis text-text-primary">
            Yosemite Crew uses one consent cookie and optional product analytics after you opt in.
          </div>
          <div className="text-caption-1 text-text-primary">
            Accepting enables PostHog for privacy-focused analytics, heatmaps, and replay with
            masking turned on by default.
          </div>
        </div>

        <div className="flex flex-col mt-3 mb-2.5 gap-2">
          <Primary text="Accept" href="#" onClick={handleConsent} />
          <Secondary text="Reject" href="#" onClick={handleRejection} />
        </div>
      </div>

      {/* The illustration is hung 250px BELOW the card, which on a phone puts it
          off the bottom of the screen and across the tab bar's Home/Schedule
          labels. It is decoration (`aria-hidden`), so the phone simply drops
          it rather than shrinking it into the same collision. */}
      <div className="hidden md:block absolute -bottom-62.5 left-15 pointer-events-none z-25">
        <Image
          src={MEDIA_SOURCES.cookies.cookie}
          alt=""
          aria-hidden="true"
          width={222}
          height={314}
        />
      </div>
      <div className="hidden md:block absolute -bottom-37.5 left-11.25 -z-25">
        <Image
          src={MEDIA_SOURCES.cookies.background}
          alt=""
          aria-hidden="true"
          width={250}
          height={205}
        />
      </div>
    </aside>
  );
};

export default Cookies;
