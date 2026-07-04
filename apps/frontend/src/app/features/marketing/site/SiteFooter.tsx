'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import {
  IoLogoGithub,
  IoLogoDiscord,
  IoLogoLinkedin,
  IoLogoInstagram,
  IoLogoTiktok,
  IoLogoApple,
  IoLogoWindows,
  IoLogoGooglePlaystore,
  IoShieldCheckmarkOutline,
  IoPulseOutline,
  IoDocumentTextOutline,
  IoStar,
  IoArrowUp,
} from 'react-icons/io5';
import {
  APP_STORE_URL,
  CONTRIBUTING_URL,
  DISCORD_INVITE_URL,
  GITHUB_REPO_URL,
  INSTAGRAM_URL,
  LINKEDIN_URL,
  MARKETING_LOGO,
  PLAY_STORE_URL,
  RELEASES_LATEST_URL,
  TIKTOK_URL,
  X_URL,
} from './assets';
import { useGithubStats } from './useGithubStats';

const colHead: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#a9a39e',
};
const colLink: CSSProperties = {
  fontSize: 15,
  letterSpacing: '-0.015em',
  color: '#5c5956',
};
const socialLink: CSSProperties = {
  width: 37,
  height: 37,
  borderRadius: 9999,
  border: '1px solid #d6d1cd',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#5c5956',
  textDecoration: 'none',
};
const appBadge: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '9px 16px',
  borderRadius: 9999,
  border: '1px solid #d6d1cd',
  background: '#f7f3ec',
  color: '#5c5956',
  textDecoration: 'none',
  fontSize: 13,
  fontWeight: 500,
  letterSpacing: '-0.01em',
};
const chip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  padding: '7px 14px',
  border: '1px solid #e0dcd8',
  borderRadius: 9999,
  fontSize: 12.5,
  letterSpacing: '-0.01em',
  color: '#6b6763',
  background: '#f7f3ec',
};

const PRODUCT_LINKS = [
  { label: 'Pet Businesses', href: '/pet-businesses' },
  { label: 'Pet Parents', href: '/pet-parents' },
  { label: 'Developers', href: '/developers' },
  { label: 'Pricing', href: '/pricing' },
];
const COMPANY_LINKS = [
  { label: 'About us', href: '/about' },
  { label: 'Contact us', href: '/contact-us' },
  { label: 'Trust Center', href: '/trust-center' },
];
const LEGAL_LINKS = [
  { label: 'Terms', href: '/terms-and-conditions' },
  { label: 'Privacy', href: '/privacy-policy' },
  { label: 'Accessibility', href: '/accessibility' },
  { label: 'DMCA', href: '/dmca' },
  { label: 'Impressum', href: '/impressum' },
];
const COMMUNITY_LINKS = [
  { label: 'GitHub', href: GITHUB_REPO_URL },
  { label: 'Discord', href: DISCORD_INVITE_URL },
  { label: 'Insights', href: '/insights', internal: true },
  { label: 'Developer portal', href: '/developers/signup', internal: true },
  { label: 'Contributing', href: CONTRIBUTING_URL },
];

export function SiteFooter() {
  const { stars } = useGithubStats();

  return (
    <footer data-yc-footer="true" style={{ background: '#eae2d5', borderTop: '1px solid #e5dccf' }}>
      <div
        style={{
          width: 'min(1240px, calc(100% - 48px))',
          margin: '0 auto',
          padding: '72px 0 38px',
        }}
      >
        <div
          data-footer-grid="true"
          data-grid-2-m="true"
          style={{
            display: 'grid',
            gridTemplateColumns: '1.25fr 1fr 1fr 1fr 1fr',
            gap: 40,
            alignItems: 'start',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              alignItems: 'flex-start',
              maxWidth: 290,
            }}
          >
            <Link
              href="/"
              aria-label="Yosemite Crew home"
              style={{ display: 'flex', alignItems: 'center' }}
            >
              <Image
                src={MARKETING_LOGO}
                alt="Yosemite Crew"
                width={54}
                height={54}
                style={{ objectFit: 'contain' }}
              />
            </Link>
            <p
              style={{
                margin: 0,
                fontSize: 14.5,
                lineHeight: 1.6,
                letterSpacing: '-0.015em',
                color: '#837d78',
              }}
            >
              The open-source operating system for animal health. Free to self-host, and built in
              the open.
            </p>
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noopener"
                aria-label="GitHub"
                className="yc-pill-blue"
                style={socialLink}
              >
                <IoLogoGithub style={{ fontSize: 17 }} />
              </a>
              <a
                href={DISCORD_INVITE_URL}
                target="_blank"
                rel="noopener"
                aria-label="Discord"
                className="yc-pill-blue"
                style={socialLink}
              >
                <IoLogoDiscord style={{ fontSize: 17 }} />
              </a>
              <a
                href={LINKEDIN_URL}
                target="_blank"
                rel="noopener"
                aria-label="LinkedIn"
                className="yc-pill-blue"
                style={socialLink}
              >
                <IoLogoLinkedin style={{ fontSize: 17 }} />
              </a>
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener"
                aria-label="Instagram"
                className="yc-pill-blue"
                style={socialLink}
              >
                <IoLogoInstagram style={{ fontSize: 17 }} />
              </a>
              <a
                href={X_URL}
                target="_blank"
                rel="noopener"
                aria-label="X"
                className="yc-pill-blue"
                style={socialLink}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href={TIKTOK_URL}
                target="_blank"
                rel="noopener"
                aria-label="TikTok"
                className="yc-pill-blue"
                style={socialLink}
              >
                <IoLogoTiktok style={{ fontSize: 17 }} />
              </a>
            </div>
          </div>

          <FooterColumn heading="Product">
            {PRODUCT_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="yc-link" style={colLink}>
                {l.label}
              </Link>
            ))}
          </FooterColumn>

          <FooterColumn heading="Community">
            {COMMUNITY_LINKS.map((l) =>
              l.internal ? (
                <Link key={l.href} href={l.href} className="yc-link" style={colLink}>
                  {l.label}
                </Link>
              ) : (
                <a
                  key={l.href}
                  href={l.href}
                  target="_blank"
                  rel="noopener"
                  className="yc-link"
                  style={colLink}
                >
                  {l.label}
                </a>
              )
            )}
          </FooterColumn>

          <FooterColumn heading="Company">
            {COMPANY_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="yc-link" style={colLink}>
                {l.label}
              </Link>
            ))}
          </FooterColumn>

          <FooterColumn heading="Legal">
            {LEGAL_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="yc-link" style={colLink}>
                {l.label}
              </Link>
            ))}
          </FooterColumn>
        </div>

        <div
          data-footer-apps="true"
          data-stack-m="true"
          style={{
            marginTop: 48,
            paddingTop: 34,
            borderTop: '1px solid #e5dccf',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: 40,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', gap: 56, flexWrap: 'wrap' }}>
            <AppColumn heading="Clinic desktop app">
              <a
                href={RELEASES_LATEST_URL}
                target="_blank"
                rel="noopener"
                className="yc-appbadge"
                style={appBadge}
              >
                <IoLogoApple style={{ fontSize: 16 }} />
                macOS
              </a>
              <a
                href={RELEASES_LATEST_URL}
                target="_blank"
                rel="noopener"
                className="yc-appbadge"
                style={appBadge}
              >
                <IoLogoWindows style={{ fontSize: 15 }} />
                Windows
              </a>
            </AppColumn>
            <AppColumn heading="Pet parent app">
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noopener"
                className="yc-appbadge"
                style={appBadge}
              >
                <IoLogoApple style={{ fontSize: 16 }} />
                App Store
              </a>
              <a
                href={PLAY_STORE_URL}
                target="_blank"
                rel="noopener"
                className="yc-appbadge"
                style={appBadge}
              >
                <IoLogoGooglePlaystore style={{ fontSize: 15 }} />
                Google Play
              </a>
            </AppColumn>
          </div>
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 9,
              padding: '11px 18px',
              borderRadius: 9999,
              background: '#302f2e',
              color: '#fff',
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 500,
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
            }}
          >
            <IoLogoGithub style={{ fontSize: 16 }} />
            Star on GitHub
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                paddingLeft: 11,
                marginLeft: 2,
                borderLeft: '1px solid rgba(239,232,220,0.22)',
                color: '#e5dccf',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <IoStar style={{ fontSize: 11.5, color: '#f5c518' }} />
              {stars ?? '★'}
            </span>
          </a>
        </div>

        <div
          data-footer-mid="true"
          data-stack-m="true"
          style={{
            marginTop: 34,
            paddingTop: 30,
            borderTop: '1px solid #e5dccf',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 24,
            flexWrap: 'wrap',
          }}
        >
          <Link
            href="/trust-center"
            className="yc-pill-green"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 14px 8px 13px',
              border: '1px solid #cfe9dd',
              borderRadius: 9999,
              background: '#f7f3ec',
              textDecoration: 'none',
              width: 'fit-content',
            }}
          >
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: 9999,
                background: '#008f5d',
                animation: 'ycStatusPulse 2.6s ease-out infinite',
              }}
              aria-hidden="true"
            />
            <span
              style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em', color: '#1d6b4f' }}
            >
              All systems operational
            </span>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#a9a39e',
                borderLeft: '1px solid #e0dcd8',
                paddingLeft: 10,
              }}
            >
              Live
            </span>
          </Link>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span style={chip}>
              <IoShieldCheckmarkOutline style={{ fontSize: 13, color: '#257bed' }} />
              GDPR
            </span>
            <span style={chip}>
              <IoShieldCheckmarkOutline style={{ fontSize: 13, color: '#257bed' }} />
              SOC 2 Type II
            </span>
            <span style={chip}>
              <IoShieldCheckmarkOutline style={{ fontSize: 13, color: '#257bed' }} />
              ISO 27001
            </span>
            <span style={chip}>
              <IoPulseOutline style={{ fontSize: 13, color: '#257bed' }} />
              HL7 FHIR
            </span>
            <span style={chip}>
              <IoDocumentTextOutline style={{ fontSize: 13, color: '#257bed' }} />
              21 CFR Part 11
            </span>
          </div>
        </div>

        <div
          data-footer-bottom="true"
          data-stack-m="true"
          style={{
            marginTop: 30,
            paddingTop: 26,
            borderTop: '1px solid #e5dccf',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: 20,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, letterSpacing: '-0.01em', color: '#a9a39e' }}>
              © 2026 DuneXploration UG (haftungsbeschränkt) · Am Finther Weg 7, 55127 Mainz ·
              support@yosemitecrew.com · +49 152 277 63275
            </span>
            <span style={{ fontSize: 13, letterSpacing: '-0.01em', color: '#a9a39e' }}>
              Geschäftsführer: Ankit Upadhyay · Amtsgericht Mainz HRB 52778 · VAT: DE367920596 ·
              Yosemite Crew™ is a trademark of DuneXploration UG.
            </span>
          </div>
          <BackToTop />
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  heading,
  children,
}: Readonly<{ heading: string; children: React.ReactNode }>) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      <span style={colHead}>{heading}</span>
      {children}
    </div>
  );
}

function AppColumn({
  heading,
  children,
}: Readonly<{ heading: string; children: React.ReactNode }>) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
      <span style={colHead}>{heading}</span>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{children}</div>
    </div>
  );
}

function BackToTop() {
  const toTop = () => {
    try {
      globalThis.window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      globalThis.window.scrollTo(0, 0);
    }
  };
  return (
    <button
      type="button"
      onClick={toTop}
      className="yc-link"
      style={{
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        fontSize: 13,
        letterSpacing: '-0.01em',
        color: '#837d78',
        background: 'transparent',
        border: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      Back to top <IoArrowUp style={{ fontSize: 13 }} />
    </button>
  );
}
