'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/app/ui/icons/Icon';

import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { useAuthStore } from '@/app/stores/authStore';
import DevRouteGuard from '@/app/ui/layout/guards/DevRouteGuard/DevRouteGuard';
import { useIsPhone } from '@/app/ui/layout/PhoneShell/useIsPhone';
import PhoneDevHome from '@/app/features/developers/pages/DeveloperPortalHome/PhoneDevHome';
import { listApiKeys } from '@/app/services/developerApiKeys';
import { getUsage } from '@/app/services/developerUsage';
import { logger } from '@/app/lib/logger';

import './DeveloperPortalHome.css';
import '@/app/features/organizations/styles/Organizations.css';

type QuickLink = {
  label: string;
  href: string;
  icon: string;
  external?: boolean;
};

const QUICK_LINKS: QuickLink[] = [
  {
    label: 'Quickstart · first request in 5 minutes',
    href: '/developers/documentation',
    icon: 'ion:rocket-outline',
  },
  { label: 'Partner with Yosemite Crew', href: '/contact-us', icon: 'ion:people-outline' },
  { label: 'Security & compliance', href: '/privacy-policy', icon: 'ion:shield-checkmark-outline' },
  {
    label: 'github.com/YosemiteCrew',
    href: 'https://github.com/YosemiteCrew',
    icon: 'ion:logo-github',
    external: true,
  },
];

const DeveloperPortalHome = () => {
  const { attributes } = useAuthStore();
  const isPhone = useIsPhone();

  const displayName = useMemo(() => {
    const name = `${attributes?.given_name || ''} ${attributes?.family_name || ''}`.trim();
    if (name) return name;
    if (attributes?.email) return attributes.email;
    return 'Developer';
  }, [attributes?.email, attributes?.family_name, attributes?.given_name]);

  /*
   * The two numbers on this card are read, not asserted.
   *
   * They used to be literals - a "Requests · 24h" of 4,218 and a four-row
   * activity feed - on a portal where the Billing page next door reads the same
   * account and correctly shows 0. Anything shown here now comes from the same
   * endpoints Billing and API Keys use, and shows a dash when it cannot be read.
   */
  const [activeKeyCount, setActiveKeyCount] = useState<number | null>(null);
  const [callCount, setCallCount] = useState<number | null>(null);

  const loadStatus = useCallback(async () => {
    const [keysResult, usageResult] = await Promise.allSettled([listApiKeys(), getUsage()]);

    if (keysResult.status === 'fulfilled') {
      setActiveKeyCount(keysResult.value.filter((key) => key.status === 'active').length);
    } else {
      logger.error(
        'Failed to load developer API keys for the portal status card',
        keysResult.reason
      );
    }

    if (usageResult.status === 'fulfilled') {
      setCallCount(usageResult.value.callCount);
    } else {
      logger.error(
        'Failed to load developer API usage for the portal status card',
        usageResult.reason
      );
    }
  }, []);

  useEffect(() => {
    // Wrapped rather than called directly: the hooks lint cannot see through the
    // useCallback to prove the setStates all happen after an await, and flags a
    // bare `loadStatus()` as a synchronous state write. Same shape as
    // DeveloperBilling's mount effect.
    const run = async () => {
      await loadStatus();
    };
    run();
  }, [loadStatus]);

  const formatCount = (value: number | null) => (value === null ? '—' : value.toLocaleString());

  if (isPhone) {
    return (
      <DevRouteGuard>
        <div className="OperationsWrapper">
          <PhoneDevHome displayName={displayName} />
        </div>
      </DevRouteGuard>
    );
  }

  return (
    <DevRouteGuard>
      <div className="OperationsWrapper">
        <div className="TitleContainer dev-home-head">
          <div className="dev-portal-intro">
            <h1 className="dev-greet-name text-text-primary font-newsreader">
              <span className="block italic-newsreader dev-greet-eyebrow">Welcome back,</span>
              {displayName}
            </h1>
            <p className="dev-hero-subtext">
              Build, customise, and launch apps for the animal health ecosystem
            </p>
          </div>
          <Primary
            text="View docs"
            href="/developers/documentation"
            icon={<Icon icon="ion:book-outline" width={16} height={16} aria-hidden="true" />}
            style={{ maxWidth: 180 }}
          />
        </div>

        <section className="DevPortalHome">
          <div className="dev-portal-hero">
            <div className="dev-hero-copy">
              <span className="dev-badge text-caption-3">FHIR-NATIVE API</span>
              <p className="dev-hero-headline text-text-primary">
                One API for appointments, patients, and records. The same one the PIMS runs on.
              </p>
              <p className="dev-hero-subtext">
                Access APIs, SDKs, and starter templates. Ship a plugin to every clinic on the
                platform, or build your own surface on top.
              </p>
              <div className="dev-hero-actions">
                <Secondary text="Create an API key" href="/developers/api-keys" />
                <Secondary text="Contact support" href="/contact-us" />
              </div>
            </div>
            <div className="dev-hero-card">
              <h2 className="dev-status-title">Quick status</h2>
              <ul>
                <li>
                  <span className="dev-status-label">Portal access</span>
                  <strong className="dev-status-active">
                    <span className="dev-dot" aria-hidden="true" />
                    {'Active'}
                  </strong>
                </li>
                <li>
                  <span className="dev-status-label">Active API keys</span>
                  <strong className="dev-status-value dev-tabular">
                    {formatCount(activeKeyCount)}
                  </strong>
                </li>
                <li>
                  <span className="dev-status-label">API calls this period</span>
                  <strong className="dev-status-value dev-tabular">{formatCount(callCount)}</strong>
                </li>
                <li>
                  <span className="dev-status-label">Next step</span>
                  <strong className="dev-status-next">Browse documentation →</strong>
                </li>
              </ul>
            </div>
          </div>

          <div className="dev-portal-grid">
            <div className="dev-portal-card">
              <div className="dev-card-head">
                <h2 className="dev-card-title">Quick links</h2>
                <span className="dev-card-pill secondary text-caption-3">Resources</span>
              </div>
              <div className="dev-links">
                {QUICK_LINKS.map((link) => {
                  const linkContent = (
                    <>
                      <Icon
                        icon={link.icon}
                        width={16}
                        height={16}
                        className="dev-link-icon"
                        aria-hidden="true"
                      />
                      <span>{link.label}</span>
                    </>
                  );
                  if (link.external) {
                    return (
                      <a
                        key={link.href}
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="dev-link"
                      >
                        {linkContent}
                      </a>
                    );
                  }
                  return (
                    <Link key={link.href} href={link.href} className="dev-link">
                      {linkContent}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/*
              The "Your plugin" and "Recent activity" cards were removed rather
              than emptied. Both described capabilities the platform does not
              have: there is no plugin model in the schema and no request log,
              so neither could ever be populated. An empty state would still
              claim the feature exists.
            */}
            <div className="dev-portal-card">
              <div className="dev-card-head">
                <h2 className="dev-card-title">Your API keys</h2>
                <span className="dev-card-pill secondary text-caption-3">Access</span>
              </div>
              <p className="dev-plugin-desc">
                {activeKeyCount === 0
                  ? 'You have no active keys yet. Create one to authenticate an integration.'
                  : 'Create, review and revoke the keys your integrations authenticate with.'}
              </p>
              <Link href="/developers/api-keys" className="dev-card-action">
                {activeKeyCount === 0 ? 'Create an API key' : 'Manage API keys'}
                <Icon icon="ion:arrow-forward" width={14} height={14} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </DevRouteGuard>
  );
};

export default DeveloperPortalHome;
