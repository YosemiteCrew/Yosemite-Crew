'use client';

import type { CSSProperties } from 'react';
import { IoLogoGithub } from 'react-icons/io5';
import { GITHUB_REPO_URL } from './assets';
import { useReleaseLanes, type ReleaseLane } from './useGithubStats';

const RELEASES_INDEX_URL = `${GITHUB_REPO_URL}/releases`;

const BAR_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  justifyContent: 'center',
  gap: 0,
  padding: '5px 7px',
  borderRadius: 9999,
  border: '1px solid var(--hairline)',
  background: 'var(--glass-95)',
  backdropFilter: 'blur(40px)',
  WebkitBackdropFilter: 'blur(40px)',
};

const SEGMENT_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'baseline',
  gap: 6,
  padding: '4px 11px',
  borderRadius: 9999,
  fontSize: 12.5,
  fontWeight: 500,
  letterSpacing: '-0.01em',
  lineHeight: 1.45,
  color: 'var(--ink-muted)',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
};

const LABEL_STYLE: CSSProperties = { color: 'var(--ink)', fontWeight: 600 };
const VERSION_STYLE: CSSProperties = {
  color: 'var(--ink-body)',
  fontVariantNumeric: 'tabular-nums',
};
// --ink-muted, not --ink-faint. Measured on the bar's own background, --ink-faint is 2.84:1 in
// light (it clears 4.5:1 only in dark, at 5.67:1), and this is real information at 11.5px, not
// decoration. --ink-muted is 5.71:1 light / 6.56:1 dark and still reads as subordinate to the
// name and version above it.
const DATE_STYLE: CSSProperties = { color: 'var(--ink-muted)', fontSize: 11.5 };

const SEPARATOR_STYLE: CSSProperties = {
  width: 1,
  height: 11,
  background: 'var(--divider)',
  flex: 'none',
};

/** Shown in place of a version until the fetch resolves, or if a lane has no release on the page. */
const PLACEHOLDER = '·';

const Separator = () => <span style={SEPARATOR_STYLE} aria-hidden="true" />;

function LaneSegment({ lane }: Readonly<{ lane: ReleaseLane }>) {
  // No release resolved yet (or none on the fetched page): the segment still links somewhere
  // useful, and shows a placeholder rather than a stale or invented version.
  const href = lane.url ?? RELEASES_INDEX_URL;
  const accessibleName = lane.tag
    ? `${lane.label} ${lane.tag}, released ${lane.date ?? 'recently'}`
    : `${lane.label} releases on GitHub`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={SEGMENT_STYLE}
      title={accessibleName}
      aria-label={accessibleName}
      data-yc-lane
    >
      <span style={LABEL_STYLE}>{lane.label}</span>
      <span style={VERSION_STYLE}>{lane.tag ?? PLACEHOLDER}</span>
      {lane.dateCompact ? <span style={DATE_STYLE}>{lane.dateCompact}</span> : null}
    </a>
  );
}

/**
 * Latest release for each shipped component, as one row of linked tags.
 *
 * Replaces a single "Latest release" pill that showed whichever release was newest repo-wide -
 * always a desktop build, since desktop is the only component whose tag is bare semver and so the
 * only one GitHub gives the Latest badge to. That undersold three of the four release lines and
 * mislabelled the fourth.
 *
 * One glass bar with hairline-separated segments rather than four separate pills: four bordered
 * pills read as four competing objects, where this reads as one status strip.
 */
export function ReleaseLanes() {
  const lanes = useReleaseLanes();

  return (
    <div style={BAR_STYLE} data-yc-lanes>
      <IoLogoGithub
        style={{ fontSize: 14, color: 'var(--ink-faint)', flex: 'none', margin: '0 4px 0 6px' }}
        aria-hidden="true"
      />
      {lanes.map((lane, index) => (
        <span key={lane.key} style={{ display: 'inline-flex', alignItems: 'center' }}>
          {index > 0 ? <Separator /> : null}
          <LaneSegment lane={lane} />
        </span>
      ))}
    </div>
  );
}
