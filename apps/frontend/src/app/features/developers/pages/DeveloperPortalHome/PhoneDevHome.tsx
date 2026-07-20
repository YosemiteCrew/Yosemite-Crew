'use client';
import React from 'react';
import Link from 'next/link';
import { Icon } from '@iconify/react';

import type { ActivityEntry } from '@/app/features/developers/pages/DeveloperPortalHome/DeveloperPortalHome';

import './PhoneDevHome.css';

type PlatformMetric = {
  label: string;
  value: string;
  accent?: boolean;
};

type NavTile = {
  href: string;
  icon: string;
  title: string;
  meta: string;
};

const PLATFORM_METRICS: PlatformMetric[] = [
  { label: 'Requests · 24h', value: '4,182' },
  { label: 'P95', value: '212 ms' },
  { label: 'Errors', value: '0.2%', accent: true },
];

const NAV_TILES: NavTile[] = [
  {
    href: '/developers/api-keys',
    icon: 'ion:key-outline',
    title: 'API keys',
    meta: '2 active · 1 sandbox',
  },
  {
    href: '/developers/plugins',
    icon: 'ion:extension-puzzle-outline',
    title: 'Plugins',
    meta: '1 published · 1 in review',
  },
];

type PhoneDevHomeProps = {
  displayName: string;
  recentActivity: ActivityEntry[];
};

/**
 * Bespoke phone (<768px) layout for the developer home, matching the design's
 * "Phone dev home" frame. Presentation only: it reuses the live display name and
 * the same recent-activity data as the desktop layout so there is one source of
 * truth for the request log.
 */
const PhoneDevHome = ({ displayName, recentActivity }: PhoneDevHomeProps) => {
  return (
    <div className="dev-ph">
      <h1 className="dev-ph-greet">
        <span className="dev-ph-greet-eyebrow">Welcome back,</span>
        <span className="dev-ph-greet-name">{displayName}</span>
      </h1>

      <section className="dev-ph-status" aria-label="Platform status">
        <div className="dev-ph-status-head">
          <h2 className="dev-ph-status-title">Platform status</h2>
          <span className="dev-ph-status-live">
            <span className="dev-ph-status-live-dot" aria-hidden="true" />
            {'All systems live'}
          </span>
        </div>
        <dl className="dev-ph-metrics">
          {PLATFORM_METRICS.map((metric) => (
            <div key={metric.label} className="dev-ph-metric">
              <dt className="dev-ph-metric-label">{metric.label}</dt>
              <dd className={`dev-ph-metric-value${metric.accent ? ' accent' : ''}`}>
                {metric.value}
              </dd>
            </div>
          ))}
        </dl>
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

      <section className="dev-ph-review" aria-label="Plugin in review">
        <div className="dev-ph-review-head">
          <span className="dev-ph-review-name">Anesthesia monitor sync</span>
          <span className="dev-ph-review-badge">In review</span>
        </div>
        <p className="dev-ph-review-desc">
          Submitted 04 Jul · review usually takes 2–3 working days. We&apos;ll email you when
          it&apos;s ready.
        </p>
        <span className="dev-ph-progress" aria-hidden="true">
          <span className="dev-ph-progress-fill" style={{ width: '55%' }} />
        </span>
      </section>

      <span className="dev-ph-section-label">Recent requests</span>
      <ul className="dev-ph-log">
        {recentActivity.map((entry) => (
          <li key={`${entry.method}-${entry.path}`} className="dev-ph-log-row">
            <span className={`dev-ph-log-status ${entry.ok ? 'ok' : 'err'}`}>{entry.status}</span>
            <span className="dev-ph-log-path">
              {entry.method} {entry.path}
            </span>
          </li>
        ))}
      </ul>

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
