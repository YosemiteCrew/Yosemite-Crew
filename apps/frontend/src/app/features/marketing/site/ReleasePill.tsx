'use client';

import type { CSSProperties } from 'react';
import { IoLogoGithub } from 'react-icons/io5';
import { GITHUB_REPO_URL } from './assets';
import {
  useLatestRelease,
  useMobileRelease,
  usePlatformRelease,
  type ReleaseInfo,
} from './useGithubStats';

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

const GREEN_DOT = 'var(--success)';

const LATEST_PILL_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 9,
  padding: '8px 15px',
  borderRadius: 9999,
  border: '1px solid var(--hairline)',
  background: 'var(--glass-95)',
  backdropFilter: 'blur(40px)',
  WebkitBackdropFilter: 'blur(40px)',
  fontSize: 13,
  fontWeight: 500,
  letterSpacing: '-0.01em',
  color: 'var(--ink-muted)',
  textDecoration: 'none',
};

const PILL_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 16px',
  borderRadius: 9999,
  border: '1px solid var(--hairline)',
  background: 'var(--glass-95)',
  backdropFilter: 'blur(40px)',
  WebkitBackdropFilter: 'blur(40px)',
  fontSize: 13,
  fontWeight: 500,
  letterSpacing: '-0.01em',
  color: 'var(--ink-muted)',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
};

const EMPTY_RELEASE: ReleaseInfo = { tag: null, date: null, url: null };

const Dot = () => (
  <span
    style={{ width: 7, height: 7, borderRadius: 9999, background: GREEN_DOT, flex: 'none' }}
    aria-hidden="true"
  />
);

const Divider = () => (
  <span
    style={{ width: 1, height: 12, background: 'var(--divider)', flex: 'none' }}
    aria-hidden="true"
  />
);

/** Home "Latest release" pill body. Takes an already-resolved release (no fetching here). */
function LatestPillBody({
  version,
  href,
  release,
}: Readonly<{ version: string; href?: string; release: ReleaseInfo }>) {
  const resolvedHref = release.url ?? href ?? `${GITHUB_REPO_URL}/releases`;
  return (
    <a href={resolvedHref} target="_blank" rel="noopener noreferrer" style={LATEST_PILL_STYLE}>
      <Dot />
      <span style={{ color: 'var(--ink-body)', fontWeight: 600 }}>Latest release</span>
      <Divider />
      <span>{release.tag ?? version}</span>
      <IoLogoGithub
        style={{ fontSize: 15, flex: 'none', color: 'var(--ink-faint)' }}
        aria-hidden="true"
      />
    </a>
  );
}

/** Platform / mobile / static pill body. Takes an already-resolved release (no fetching here). */
function StandardPillBody({
  variant,
  label,
  version,
  href,
  release,
}: Readonly<{
  variant: ReleaseVariant;
  label?: string;
  version: string;
  href?: string;
  release: ReleaseInfo;
}>) {
  // When no specific release URL resolved, link to the releases index rather than
  // /releases/latest, so a platform/static pill never deep-links the desktop build.
  const resolvedHref = release.url ?? href ?? `${GITHUB_REPO_URL}/releases`;
  const isStatic = variant === 'static';
  // The live release tag is trusted for the mobile and platform pills (each hook filters to its
  // own tag prefix), so they show the real version + publish date. The hard-coded `version` stays
  // as the fallback shown until the live release resolves (or if the fetch fails).
  const shownVersion =
    variant === 'mobile' || variant === 'platform' ? (release.tag ?? version) : version;
  return (
    <a href={resolvedHref} target="_blank" rel="noopener noreferrer" style={PILL_STYLE}>
      <Dot />
      {label}
      <span
        style={{ width: 1, height: 12, background: 'var(--divider)', margin: '0 3px' }}
        aria-hidden="true"
      />
      <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{shownVersion}</span>
      {!isStatic && release.date ? (
        // --ink-muted: --ink-faint measures 2.84:1 on this background in light mode, under the
        // 4.5:1 floor for text this size. Same fix as the release lanes on the home hero.
        <span style={{ color: 'var(--ink-muted)', fontWeight: 500 }}>{` · ${release.date}`}</span>
      ) : null}
      <IoLogoGithub
        style={{ fontSize: 14, color: 'var(--ink-faint)', marginLeft: 1 }}
        aria-hidden="true"
      />
    </a>
  );
}

// Per-variant wrappers each mount EXACTLY ONE release hook, so a pill only ever fires the single
// GitHub request it needs. A `latest`/`mobile`/`static` pill never fetches the platform releases
// list (and vice-versa), which keeps public marketing loads off the unauthenticated rate limit.
function LatestPill({ version, href }: Readonly<ReleasePillProps>) {
  return <LatestPillBody version={version} href={href} release={useLatestRelease()} />;
}
function MobilePill(props: Readonly<ReleasePillProps>) {
  return <StandardPillBody {...props} release={useMobileRelease()} />;
}
function PlatformPill(props: Readonly<ReleasePillProps>) {
  return <StandardPillBody {...props} release={usePlatformRelease()} />;
}
function StaticPill(props: Readonly<ReleasePillProps>) {
  return <StandardPillBody {...props} release={EMPTY_RELEASE} />;
}

/**
 * Hero eyebrow release pill. The version string is fixed copy; the publish date and link resolve
 * live from GitHub. Dispatches to a per-variant pill so only the needed release endpoint is fetched.
 */
export function ReleasePill(props: Readonly<ReleasePillProps>) {
  switch (props.variant) {
    case 'latest':
      return <LatestPill {...props} />;
    case 'mobile':
      return <MobilePill {...props} />;
    case 'platform':
      return <PlatformPill {...props} />;
    default:
      return <StaticPill {...props} />;
  }
}
