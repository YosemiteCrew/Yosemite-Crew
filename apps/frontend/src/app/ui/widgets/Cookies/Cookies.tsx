'use client';
import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

import { publicRoutes } from '@/app/lib/const';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { MEDIA_SOURCES } from '@/app/constants/mediaSources';

const Cookies = () => {
  const [showCookiePopup, setShowCookiePopup] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const cookieConsentGiven = localStorage.getItem('cookieConsentGiven');
    if (!cookieConsentGiven) {
      setShowCookiePopup(true); // If not accepted, show popup
    }
  }, []);

  const setConsent = (value: 'true' | 'false') => {
    localStorage.setItem('cookieConsentGiven', value);
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'cookieConsentGiven', newValue: value })
    );
  };

  const handleConsent = () => {
    setShowCookiePopup(false);
    setConsent('true');
  };

  const handleRejection = () => {
    setShowCookiePopup(false);
    setConsent('false');
  };

  if (!publicRoutes.has(pathname)) return null;

  if (!showCookiePopup) return null;

  return (
    <div className="fixed left-20 bottom-32.5 z-9999">
      <div className="bg-white rounded-2xl max-w-75 p-3 z-22 border border-card-border">
        <div className="flex flex-col gap-2">
          <div className="text-body-4-emphasis text-text-primary">
            Yosemite Crew doesn&apos;t use third party cookies Only a single in-house cookie.
          </div>
          <div className="text-caption-1 text-text-primary">No data is sent to a third party.</div>
        </div>

        <div className="flex flex-col mt-3 mb-2.5 gap-2">
          <Primary text="Accept" href="#" onClick={handleConsent} />
          <Secondary text="Reject" href="#" onClick={handleRejection} />
        </div>
      </div>

      <div className="absolute -bottom-62.5 left-15 pointer-events-none z-25">
        <Image
          src={MEDIA_SOURCES.cookies.cookie}
          alt=""
          aria-hidden="true"
          width={222}
          height={314}
        />
      </div>
      <div className="absolute -bottom-37.5 left-11.25 -z-25">
        <Image
          src={MEDIA_SOURCES.cookies.background}
          alt=""
          aria-hidden="true"
          width={250}
          height={205}
        />
      </div>
    </div>
  );
};

export default Cookies;
