'use client';

import { IoLogoGithub } from 'react-icons/io5';
import { GITHUB_REPO_URL } from './assets';
import { useLatestRelease, useMobileRelease, type ReleaseInfo } from './useGithubStats';

type ReleaseVariant = 'latest' | 'platform' | 'mobile' | 'static';

interface ReleasePillProps {
  variant: ReleaseVariant;
  /** Muted product label, e.g. 'Platform PIMS'. Ignored by the 'latest' variant. */
  label?: string;
  /** Hard-coded version copy, e.g. 'v2.0 beta'. */
  version: string;
  /** Fallback href (used by 'static', and until a live release resolves). */
  href?: string;
}

const GREEN_DOT = '#008f5d';

function useReleaseFor(variant: ReleaseVariant): ReleaseInfo {
  const latest = useLatestRelease();
  const mobile = useMobileRelease();
  if (variant === 'mobile') return mobile;
  if (variant === 'platform' || variant === 'latest') return latest;
  return { tag: null, date: null, url: null };
}

/**
 * Hero eyebrow release pill. The version string is fixed copy; the publish date and
 * link resolve live from GitHub. Green status dot follows the live-status convention.
 */
export function ReleasePill({ variant, label, version, href }: Readonly<ReleasePillProps>) {
  const release = useReleaseFor(variant);
  const resolvedHref =
    release.url ??
    href ??
    (variant === 'latest' ? `${GITHUB_REPO_URL}/releases` : `${GITHUB_REPO_URL}/releases/latest`);

  const dot = (
    <span
      style={{ width: 7, height: 7, borderRadius: 9999, background: GREEN_DOT, flex: 'none' }}
      aria-hidden="true"
    />
  );
  const divider = (
    <span
      style={{ width: 1, height: 12, background: '#d6d1cd', flex: 'none' }}
      aria-hidden="true"
    />
  );

  if (variant === 'latest') {
    return (
      <a
        href={resolvedHref}
        target="_blank"
        rel="noopener"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '8px 15px',
          borderRadius: 9999,
          border: '1px solid #e5dccf',
          background: 'rgba(239,232,220,0.94)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: '-0.01em',
          color: '#5c5956',
          textDecoration: 'none',
        }}
      >
        {dot}
        <span style={{ color: '#302f2e', fontWeight: 600 }}>Latest release</span>
        {divider}
        <span>{release.tag ?? version}</span>
        <IoLogoGithub style={{ fontSize: 15, flex: 'none', color: '#8f8984' }} aria-hidden="true" />
      </a>
    );
  }

  const isStatic = variant === 'static';
  return (
    <a
      href={resolvedHref}
      target="_blank"
      rel="noopener"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 16px',
        borderRadius: 9999,
        border: '1px solid #e5dccf',
        background: 'rgba(239,232,220,0.94)',
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        fontSize: 13,
        fontWeight: 500,
        letterSpacing: '-0.01em',
        color: '#5c5956',
        textDecoration: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {dot}
      {label}
      <span
        style={{ width: 1, height: 12, background: '#d6d1cd', margin: '0 3px' }}
        aria-hidden="true"
      />
      <span style={{ color: '#1d1c1b', fontWeight: 600 }}>{version}</span>
      {!isStatic && release.date ? (
        <span style={{ color: '#8f8984', fontWeight: 500 }}>{` · ${release.date}`}</span>
      ) : null}
      <IoLogoGithub style={{ fontSize: 14, color: '#8f8984', marginLeft: 1 }} aria-hidden="true" />
    </a>
  );
}
