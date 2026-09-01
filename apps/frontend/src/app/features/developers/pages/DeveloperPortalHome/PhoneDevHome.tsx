'use client';
import React from 'react';
import Link from 'next/link';
import { Icon } from '@/app/ui/icons/Icon';

import './PhoneDevHome.css';
import { usePlatformStatus } from '@/app/hooks/usePlatformStatus';

type NavTile = {
  href: string;
  icon: string;
  title: string;
  meta: string;
};

const NAV_TILES: NavTile[] = [
  {
    href: '/developers/api-keys',
    icon: 'ion:key-outline',
    title: 'API keys',
    meta: 'Create and revoke keys',
  },
  {
    href: '/developers/billing',
    icon: 'ion:card-outline',
    title: 'Billing',
    meta: 'Plan and API usage',
  },
];

type PhoneDevHomeProps = {
  displayName: string;
};

/**
 * Bespoke phone (<768px) layout for the developer home, matching the design's
 * "Phone dev home" frame. Presentation only, over the live display name.
 *
 * The plugin-in-review block and the request log were removed alongside their
 * desktop counterparts: there is no plugin model and no request log behind
 * them, so both were fixed strings dressed as account state.
 */
const PhoneDevHome = ({ displayName }: PhoneDevHomeProps) => {
  const platformStatus = usePlatformStatus();
  return (
    <div className="dev-ph">
      <h1 className="dev-ph-greet">
        <span className="dev-ph-greet-eyebrow">Welcome back,</span>
        <span className="dev-ph-greet-name">{displayName}</span>
      </h1>

      <section className="dev-ph-status" aria-label="Platform status">
        <div className="dev-ph-status-head">
          <h2 className="dev-ph-status-title">Platform status</h2>
          <span className={`dev-ph-status-live dev-ph-status-live-${platformStatus.tone}`}>
            <span className="dev-ph-status-live-dot" aria-hidden="true" />
            {platformStatus.label}
          </span>
        </div>
        {/*
          The request/P95/error grid was three fixed strings - and its request
          count (4,182) did not even agree with the desktop card's (4,218).
          Nothing measures any of them. The live pill above is real: it comes
          from usePlatformStatus.
        */}
      </section>

      <div className="dev-ph-tiles">
        {NAV_TILES.map((tile) => (
          <Link key={tile.href} href={tile.href} className="dev-ph-tile">
            <span className="dev-ph-tile-icon" aria-hidden="true">
              <Icon icon={tile.icon} width={15} height={15} />
            </span>
            <span className="dev-ph-tile-title">{tile.title}</span>
            <span className="dev-ph-tile-meta">{tile.meta}</span>
          </Link>
        ))}
      </div>

      <p className="dev-ph-note">
        <Icon
          icon="ion:desktop-outline"
          width={14}
          height={14}
          className="dev-ph-note-icon"
          aria-hidden="true"
        />
        The website builder is desktop-only. Docs read great here though.
      </p>
    </div>
  );
};

export default PhoneDevHome;
