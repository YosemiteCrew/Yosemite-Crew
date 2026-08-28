'use client';

import React from 'react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { IoCaretDown, IoSearchOutline } from 'react-icons/io5';

import { MEDIA_SOURCES } from '@/app/constants/mediaSources';
import { getSafeImageUrl } from '@/app/lib/urls';
import { startRouteLoader } from '@/app/lib/routeLoader';
import { usePrimaryOrg } from '@/app/hooks/useOrgSelectors';
import { useUniversalSearchStore } from '@/app/stores/universalSearchStore';
import NotificationsBell from '@/app/ui/layout/Notifications/NotificationsBell';

/**
 * 54px phone header: org switcher (short name, tapping opens the org picker),
 * a search icon-button that opens the universal search palette, and the
 * notifications bell. Reuses the existing org data and search store — no new
 * data or handlers are invented.
 *
 * The org switcher is suppressed inside the developer portal. The portal is not
 * org-scoped, so the chip named a clinic the page has nothing to do with, and
 * tapping it left the portal for `/organizations`. The desktop header has always
 * hidden it on this prefix (`UserHeader`'s `!isDev`); the phone header was the
 * one shell that still showed it. Falls back to the brand mark, which is what
 * an account with no org already sees.
 */
const PhoneHeader = () => {
  const router = useRouter();
  const pathname = usePathname();
  const isDevPortal = pathname?.startsWith('/developers') ?? false;
  const primaryOrg = usePrimaryOrg();
  const openUniversalSearch = useUniversalSearchStore((s) => s.open);

  const goToOrganizations = () => {
    startRouteLoader();
    router.push('/organizations');
  };

  return (
    <header className="yc-phone-header">
      {primaryOrg && !isDevPortal ? (
        <button
          type="button"
          className="yc-phone-org"
          onClick={goToOrganizations}
          aria-label="Switch organization"
        >
          <Image
            src={getSafeImageUrl(primaryOrg.imageURL, 'business')}
            alt=""
            width={28}
            height={28}
            className="yc-phone-org-avatar"
          />
          <span className="yc-phone-org-name">{primaryOrg.name}</span>
          <IoCaretDown size={9} className="yc-phone-org-caret" aria-hidden />
        </button>
      ) : (
        <span className="yc-phone-brand">
          <Image
            src={MEDIA_SOURCES.logo}
            alt="Yosemite Crew"
            width={96}
            height={44}
            className="yc-phone-brand-logo"
            priority
          />
        </span>
      )}

      <div className="yc-phone-header-actions">
        <button
          type="button"
          className="yc-phone-iconbtn"
          aria-label="Search"
          onClick={openUniversalSearch}
        >
          <IoSearchOutline size={15} aria-hidden />
        </button>
        <NotificationsBell variant="phone" />
      </div>
    </header>
  );
};

export default PhoneHeader;
