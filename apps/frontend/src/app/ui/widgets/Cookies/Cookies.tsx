'use client';
import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import Image from 'next/image';

import { getStorageItem, setStorageItem } from '@/app/lib/browserStorage';
import { PHONE_MEDIA_QUERY } from '@/app/ui/layout/PhoneShell/useIsPhone';
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

/**
 * The strip of viewport the card denies, published so a shell that cannot
 * scroll can reserve it.
 *
 * Measured rather than derived from the class list: the card's height depends
 * on how the copy wraps, which depends on the viewport (252px at 390px wide,
 * 276px at 360px). Everything from the card's top edge to the bottom of the
 * viewport is denied, not just the card itself - below it sits the tab-bar
 * reserve, which is not somewhere content can go either.
 */
const CONSENT_INSET_PROPERTY = '--yc-consent-inset';

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
  const cardRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const clear = () => root.style.removeProperty(CONSENT_INSET_PROPERTY);
    const card = cardRef.current;
    if (!card) return clear;

    const publish = () => {
      // Re-read the breakpoint on every publish rather than once at mount:
      // desktop places the card clear of page content and has nothing to
      // reserve, and a rotation crosses that boundary without remounting.
      if (!globalThis.matchMedia?.(PHONE_MEDIA_QUERY).matches) {
        clear();
        return;
      }
      const denied = globalThis.innerHeight - card.getBoundingClientRect().top;
      root.style.setProperty(CONSENT_INSET_PROPERTY, `${Math.max(0, Math.ceil(denied))}px`);
    };

    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(card);
    globalThis.addEventListener('resize', publish);
    return () => {
      observer.disconnect();
      globalThis.removeEventListener('resize', publish);
      clear();
    };
  }, [showCookiePopup]);

  if (!showCookiePopup) return null;

  return (
    /* Phone (< 768px) docks the card to the bottom with even 16px gutters, clear
       of the 72px PhoneShell tab bar and the home indicator. The desktop
       placement - offset from the left edge so the illustration below it reads
       as part of the page - only fits once there is room for both, so it comes
       back at `md`. */
    <aside
      ref={cardRef}
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
