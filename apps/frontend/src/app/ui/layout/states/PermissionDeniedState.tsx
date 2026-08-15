'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { IoLockClosedOutline } from 'react-icons/io5';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { useOrgStore } from '@/app/stores/orgStore';
import './states.css';

export type PermissionDeniedStateProps = {
  /** Denied resource label (e.g. "Finance") — real data, not hardcoded. */
  resource?: string;
  /** What the role can't view (e.g. "invoices and payouts"); defaults to the resource. */
  detail?: string;
  /** Explicit role override; otherwise resolved from the active org membership. */
  role?: string;
  /** Org whose membership role is shown; defaults to the primary org. */
  orgId?: string | null;
  /**
   * `page` (default) renders the centered card for a whole route.
   * `inline` renders a compact notice sized for a section or panel, where a
   * full-page card would overwhelm the surrounding layout.
   */
  variant?: 'page' | 'inline';
  onRequestAccess?: () => void;
  onBack?: () => void;
};

const PermissionDeniedState = ({
  resource = 'this area',
  detail,
  role,
  orgId,
  variant = 'page',
  onRequestAccess,
  onBack,
}: PermissionDeniedStateProps) => {
  const router = useRouter();
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const membershipsByOrgId = useOrgStore((s) => s.membershipsByOrgId);

  const activeOrgId = orgId ?? primaryOrgId;
  const membership = activeOrgId ? membershipsByOrgId[activeOrgId] : undefined;
  const resolvedRole =
    role ?? membership?.roleDisplay ?? membership?.roleCode ?? 'your current role';
  const resolvedDetail = detail ?? resource;

  const handleRequestAccess = onRequestAccess ?? (() => router.push('/organization'));
  const handleBack = onBack ?? (() => router.back());

  if (variant === 'inline') {
    return (
      // <output> carries an implicit `status` role and is announced more
      // reliably than role="status" across assistive tech (sonar Web:S6819).
      <output className="yc-state-inline">
        <span className="yc-state-inline-icon" aria-hidden>
          <IoLockClosedOutline size={15} />
        </span>
        <span className="yc-state-inline-text">
          Your role ({resolvedRole}) can&apos;t view {resolvedDetail}.{' '}
          <button type="button" className="yc-state-inline-link" onClick={handleRequestAccess}>
            Request access
          </button>
        </span>
      </output>
    );
  }

  return (
    <div className="yc-state-wrap">
      <div className="yc-state-card">
        <span className="yc-state-icon yc-state-icon--warn" aria-hidden>
          <IoLockClosedOutline size={25} />
        </span>
        <div className="yc-state-title">You don&apos;t have access to {resource}</div>
        <p className="yc-state-text">
          Your role ({resolvedRole}) can&apos;t view {resolvedDetail}. An owner or manager can
          change this in Organization → Team.
        </p>
        <div className="yc-state-actions">
          <Primary text="Request access" onClick={handleRequestAccess} />
          <Secondary text="Back" onClick={handleBack} />
        </div>
      </div>
    </div>
  );
};

export default PermissionDeniedState;
