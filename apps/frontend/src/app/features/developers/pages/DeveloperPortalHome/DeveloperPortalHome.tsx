'use client';
import React, { useMemo } from 'react';
import Link from 'next/link';
import { Icon } from '@iconify/react';

import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { useAuthStore } from '@/app/stores/authStore';
import DevRouteGuard from '@/app/ui/layout/guards/DevRouteGuard/DevRouteGuard';

import './DeveloperPortalHome.css';
import '@/app/features/organizations/styles/Organizations.css';

type QuickLink = {
  label: string;
  href: string;
  icon: string;
  external?: boolean;
};

type ActivityEntry = {
  method: string;
  path: string;
  status: string;
  ok: boolean;
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

const RECENT_ACTIVITY: ActivityEntry[] = [
  { method: 'POST', path: '/fhir/Appointment', status: '201', ok: true },
  { method: 'GET', path: '/fhir/Patient?name=poppy', status: '200', ok: true },
  { method: 'GET', path: '/fhir/Observation/vt-882', status: '200', ok: true },
  { method: 'POST', path: '/fhir/DocumentReference', status: '422', ok: false },
];

const DeveloperPortalHome = () => {
  const { session } = useAuthStore();

  const idTokenPayload = session?.getIdToken().decodePayload();
  const displayName = useMemo(() => {
    const name = `${idTokenPayload?.given_name || ''} ${idTokenPayload?.family_name || ''}`.trim();
    if (name) return name;
    if (idTokenPayload?.email) return idTokenPayload.email;
    return 'Developer';
  }, [idTokenPayload?.email, idTokenPayload?.family_name, idTokenPayload?.given_name]);

  return (
    <DevRouteGuard>
      <div className="OperationsWrapper">
        <div className="TitleContainer dev-home-head">
          <div className="dev-portal-intro">
            <h1 className="dev-greet-name text-text-primary font-newsreader">
              <span
                className="block text-body-2 italic-newsreader dev-greet-eyebrow"
                style={{ color: 'var(--color-cyan-text)' }}
              >
                Welcome back,
              </span>
              {displayName}
            </h1>
            <p className="text-body-3 text-text-secondary dev-hero-subtext">
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
              <span className="dev-badge text-caption-2">FHIR-NATIVE API</span>
              <p className="dev-hero-headline text-text-primary">
                One API for appointments, patients, and records. The same one the PIMS runs on.
              </p>
              <p className="text-body-3 text-text-secondary dev-hero-subtext">
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
                  <span className="dev-status-label">Environment</span>
                  <strong className="dev-status-value">Sandbox</strong>
                </li>
                <li>
                  <span className="dev-status-label">Requests · 24h</span>
                  <strong className="dev-status-value dev-tabular">4,218</strong>
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
                <h2 className="text-heading-3 text-text-primary">Quick links</h2>
                <span className="dev-card-pill secondary text-caption-2">Resources</span>
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
                        className="dev-link text-body-4-emphasis text-text-primary"
                      >
                        {linkContent}
                      </a>
                    );
                  }
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="dev-link text-body-4-emphasis text-text-primary"
                    >
                      {linkContent}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="dev-portal-card">
              <div className="dev-card-head">
                <h2 className="text-heading-3 text-text-primary">Your plugin</h2>
                <span className="dev-status-badge in-review text-caption-2">In review</span>
              </div>
              <div className="dev-plugin-row">
                <span className="dev-plugin-icon" aria-hidden="true">
                  <Icon icon="ion:pulse-outline" width={18} height={18} />
                </span>
                <span className="dev-plugin-titles">
                  <span className="dev-plugin-name text-body-4-emphasis text-text-primary">
                    Anesthesia monitor sync
                  </span>
                  <span className="dev-plugin-meta text-caption-2 text-text-tertiary">
                    v0.4.1 · submitted 04 Jul
                  </span>
                </span>
              </div>
              <p className="text-body-4 text-text-secondary dev-plugin-desc">
                Streams vitals from Mindray monitors into the appointment workspace.
              </p>
              <Link href="/developers/plugins" className="dev-card-action text-body-4-emphasis">
                Review status
                <Icon icon="ion:arrow-forward" width={14} height={14} aria-hidden="true" />
              </Link>
            </div>

            <div className="dev-portal-card">
              <div className="dev-card-head">
                <h2 className="text-heading-3 text-text-primary">Recent activity</h2>
                <span className="dev-card-pill secondary text-caption-2">Sandbox</span>
              </div>
              <ul className="dev-activity">
                {RECENT_ACTIVITY.map((entry) => (
                  <li key={`${entry.method}-${entry.path}`}>
                    <span className="dev-req-path text-body-4-emphasis text-text-primary">
                      {entry.method} {entry.path}
                    </span>
                    <span className={`dev-req-status dev-tabular ${entry.ok ? 'ok' : 'err'}`}>
                      {entry.status}
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                href="/developers/api-keys"
                className="dev-activity-foot text-caption-2 text-text-tertiary"
              >
                Full request log in API keys →
              </Link>
            </div>
          </div>
        </section>
      </div>
    </DevRouteGuard>
  );
};

export default DeveloperPortalHome;
